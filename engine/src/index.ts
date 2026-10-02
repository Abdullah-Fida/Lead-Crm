/**
 * BatSols engine: WhatsApp sessions, campaign runner, outbox, lead searches,
 * background jobs and automations. Stateless apart from the database — safe
 * to restart at any time.
 */
import { createServer } from 'node:http';
import { config } from './config';
import { log } from './log';
import { every, errMsg } from './util';
import { acquireLease, releaseLease, renewLease } from './lease';
import { SessionManager } from './wa/manager';
import { getMessage, handleUpdates, handleUpsert, onReply } from './messaging/inbound';
import { processOutbox, recoverStuckMessages } from './messaging/outbox';
import { CampaignRunner } from './campaigns/runner';
import { ScrapeWorker } from './scraper/worker';
import { JobsWorker } from './jobs/worker';
import { processAutomationQueue, processNoReply, runAutomations } from './automations/runner';
import { browserAvailable } from './scraper/browser';

async function main() {
  log.info({ instance: config.instanceId, version: config.version }, 'BatSols engine starting');

  let healthy = false;
  if (config.port) {
    createServer((req, res) => {
      const ok = req.url === '/health' ? healthy : true;
      res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok, instance: config.instanceId }));
    }).listen(config.port, () => log.info({ port: config.port }, 'health endpoint listening'));
  }

  await acquireLease();
  healthy = true;

  const manager = new SessionManager({ onMessages: handleUpsert, onUpdates: handleUpdates, getMessage });
  const campaigns = new CampaignRunner(manager);
  const scraper = new ScrapeWorker();
  const jobs = new JobsWorker(manager);
  const browserOk = config.browserScraper ? await browserAvailable() : false;
  if (config.browserScraper && !browserOk) log.warn('Chromium not available: the browser scraper is disabled (run `npm run browsers -w engine`).');

  onReply(async ({ workspaceId, leadId, accountId, text, firstReply }) => {
    await runAutomations({ workspaceId, trigger: 'reply_received', leadId, accountId, text, firstReply });
  });

  await scraper.recover();
  await jobs.recover();
  await campaigns.recoverStuck();
  await recoverStuckMessages();

  const onErr = (what: string) => (e: unknown) => log.error({ err: errMsg(e) }, `${what} failed`);
  const stops = [
    every(3_000, () => manager.reconcile(), onErr('session reconcile')),
    every(60_000, () => manager.watchdog(), onErr('session watchdog'), 30_000),
    every(30 * 60_000, () => manager.refreshLimits(), onErr('limits refresh'), 5 * 60_000),
    every(2_000, () => processOutbox(manager), onErr('outbox'), 2_000),
    every(2_000, () => campaigns.tick(), onErr('campaigns'), 4_000),
    every(5 * 60_000, () => campaigns.recoverStuck(), onErr('campaign recovery'), 5 * 60_000),
    every(5 * 60_000, () => recoverStuckMessages(), onErr('message recovery'), 5 * 60_000),
    every(4_000, () => scraper.tick(), onErr('scraper'), 3_000),
    every(4_000, () => jobs.tick(), onErr('jobs'), 3_000),
    every(3_000, () => processAutomationQueue(), onErr('automation queue'), 5_000),
    every(10 * 60_000, () => processNoReply(), onErr('no-reply automations'), 60_000),
  ];

  // Lease heartbeat: if another instance ever takes over, stop at once so two
  // engines never drive the same WhatsApp sessions.
  let shuttingDown = false;
  const heartbeat = every(
    Math.floor((config.leaseTtlSeconds * 1000) / 3),
    async () => {
      const stats = manager.stats();
      const ok = await renewLease({
        sessions: stats.sessions,
        connected: stats.connected,
        campaigns: campaigns.activeCount,
        scraping: Boolean(scraper.running),
        browser: browserOk,
      });
      if (!ok && !shuttingDown) {
        log.error('Lost the engine lease to another instance; stopping');
        await shutdown('lease lost', 1);
      }
    },
    onErr('heartbeat'),
  );

  async function shutdown(reason: string, code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ reason }, 'shutting down');
    heartbeat();
    for (const stop of stops) stop();
    const timer = setTimeout(() => process.exit(code), 15_000);
    try {
      await manager.shutdown();
      if (code === 0) await releaseLease();
    } catch (e) {
      log.error({ err: errMsg(e) }, 'shutdown error');
    }
    clearTimeout(timer);
    process.exit(code);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (e) => log.error({ err: errMsg(e) }, 'unhandled rejection'));
  process.on('uncaughtException', (e) => log.error({ err: errMsg(e) }, 'uncaught exception'));
  log.info('engine running');
}

main().catch((e) => {
  log.fatal({ err: errMsg(e) }, 'engine failed to start');
  process.exit(1);
});
