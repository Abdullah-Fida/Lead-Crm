/**
 * Runs lead searches (scrape_jobs) one at a time with live progress, logs and
 * stats; applies the qualifier rules; dedupes by phone and place id; assigns
 * owners; optionally enriches websites; supports cancellation.
 */
import { normalizePhone, type ScrapeJob, type ScrapeLog, type ScrapeStats } from '@batsols/shared';
import { db } from '../db';
import { config } from '../config';
import { log } from '../log';
import { getWorkspace, notify } from '../common';
import { errMsg, sleep } from '../util';
import { BlockedError, MapsBrowser } from './browser';
import { enrichWebsite } from './enrich';
import { PlacesApiError, searchPlaces } from './places';
import { qualify } from './qualify';
import type { PlaceResult, QualifyRules } from './types';

const MAX_LOGS = 300;

export class ScrapeWorker {
  running: string | null = null;

  async tick() {
    if (this.running) return;
    const { data: next } = await db.from('scrape_jobs').select('*').eq('status', 'queued').order('created_at').limit(1).maybeSingle();
    if (!next) return;
    const { data: claimed } = await db
      .from('scrape_jobs')
      .update({ status: 'running', started_at: new Date().toISOString(), error: null })
      .eq('id', next.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();
    if (!claimed) return;
    this.running = claimed.id;
    try {
      await this.run(claimed);
    } finally {
      this.running = null;
    }
  }

  /** Jobs left 'running' by a crashed engine are re-queued. */
  async recover() {
    await db.from('scrape_jobs').update({ status: 'queued' }).eq('status', 'running');
  }

  private async run(job: ScrapeJob) {
    const logs: ScrapeLog[] = Array.isArray(job.logs) ? [...job.logs] : [];
    const stats: Required<ScrapeStats> = { found: 0, inserted: 0, duplicates: 0, no_phone: 0, with_website: 0, without_website: 0, enriched: 0, errors: 0, disqualified: 0 };
    let progress = { current: 0, total: job.queries.length, query: '' };
    let dirty = true;
    const add = (level: ScrapeLog['level'], text: string) => {
      logs.push({ t: new Date().toISOString(), level, text });
      if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
      dirty = true;
    };
    const flush = async () => {
      if (!dirty) return;
      dirty = false;
      await db.from('scrape_jobs').update({ logs, stats, progress }).eq('id', job.id);
    };
    const flusher = setInterval(() => void flush().catch(() => undefined), 2000);
    let cancelled = false;
    const isCancelled = async () => {
      if (cancelled) return true;
      const { data } = await db.from('scrape_jobs').select('cancel_requested').eq('id', job.id).maybeSingle();
      cancelled = Boolean(data?.cancel_requested);
      return cancelled;
    };

    const ws = await getWorkspace(job.workspace_id);
    const country = ws?.default_country ?? 'PK';
    const rules: QualifyRules = job.qualify ?? {};
    const owner = job.assign_to ?? job.created_by;
    let browser: MapsBrowser | null = null;

    try {
      let apiKey: string | null = null;
      if (job.provider === 'places') {
        const { data: integ } = await db.from('workspace_integrations').select('google_places_api_key').eq('workspace_id', job.workspace_id).maybeSingle();
        apiKey = integ?.google_places_api_key?.trim() || config.placesApiKey;
        if (!apiKey) throw new Error('No Google Places API key. Add one in Settings → Integrations, or use the browser scraper.');
      } else {
        if (!config.browserScraper) throw new Error('The browser scraper is disabled on this server. Use the Google Places API provider.');
        browser = new MapsBrowser();
        await browser.open();
      }
      add('info', `Starting ${job.queries.length} search${job.queries.length === 1 ? '' : 'es'} with ${job.provider === 'places' ? 'Google Places API' : 'the Google Maps browser scraper'}`);

      for (let i = 0; i < job.queries.length; i++) {
        if (await isCancelled()) break;
        const query = job.queries[i]!;
        progress = { current: i + 1, total: job.queries.length, query };
        add('info', `Searching “${query}”`);
        await flush();

        let places: PlaceResult[] = [];
        try {
          places =
            job.provider === 'places'
              ? await searchPlaces(apiKey!, query, job.max_per_query, { regionCode: country, isCancelled })
              : await browser!.search(query, job.max_per_query, { onLog: (t) => add('info', t), isCancelled });
        } catch (e) {
          if (e instanceof BlockedError || (e instanceof PlacesApiError && [403, 429].includes(e.status))) throw e;
          stats.errors++;
          add('error', `“${query}” failed: ${errMsg(e)}`);
          continue;
        }
        add('success', `“${query}”: ${places.length} businesses found`);

        const keyword = job.keywords.find((k) => query.toLowerCase().startsWith(k.toLowerCase())) ?? null;
        const location = job.locations.find((l) => query.toLowerCase().endsWith(l.toLowerCase())) ?? null;
        const enrichQueue: Array<{ id: string; website: string }> = [];

        for (const p of places) {
          stats.found++;
          const phone = normalizePhone(p.phone, p.country ?? country);
          const verdict = qualify(p, phone?.type ?? null, rules);
          if (!verdict.ok) {
            stats.disqualified++;
            add('warning', `Skipped ${p.name}: ${verdict.reason}`);
            continue;
          }
          if (!phone) {
            stats.no_phone++;
            add('warning', `Skipped ${p.name}: no phone number`);
            continue;
          }
          const row = {
            workspace_id: job.workspace_id,
            business_name: p.name.slice(0, 300),
            phone: phone.digits,
            phone_raw: p.phone,
            phone_type: phone.type,
            website: p.website,
            address: p.address,
            city: p.city ?? location,
            country: p.country ?? phone.country ?? null,
            category: p.category ?? keyword,
            rating: p.rating !== null ? Math.round(p.rating * 10) / 10 : null,
            reviews_count: p.reviews,
            google_maps_url: p.mapsUrl,
            place_id: p.placeId,
            latitude: p.lat,
            longitude: p.lng,
            source: 'scraper' as const,
            scrape_job_id: job.id,
            tags: [...job.tags, ...(keyword ? [keyword.toLowerCase()] : [])],
            owner_id: owner,
            created_by: job.created_by,
          };
          const { data: inserted, error } = await db.from('leads').upsert(row, { onConflict: 'workspace_id,phone', ignoreDuplicates: true }).select('id');
          if (error) {
            if (error.code === '23505') {
              stats.duplicates++;
              add('info', `Already in BatSols: ${p.name}`);
            } else {
              stats.errors++;
              add('error', `Couldn’t save ${p.name}: ${error.message}`);
            }
            continue;
          }
          if (!inserted?.length) {
            stats.duplicates++;
            add('info', `Already in BatSols: ${p.name}`);
            continue;
          }
          stats.inserted++;
          if (p.website) stats.with_website++;
          else stats.without_website++;
          add('success', `Saved ${p.name} · ${phone.display}${p.website ? ' · has website' : ' · no website'}`);
          if (job.enrich && p.website) enrichQueue.push({ id: inserted[0]!.id, website: p.website });
        }

        // Website enrichment, 3 at a time.
        for (let k = 0; k < enrichQueue.length; k += 3) {
          if (await isCancelled()) break;
          await Promise.all(
            enrichQueue.slice(k, k + 3).map(async ({ id, website }) => {
              const { emails, socials } = await enrichWebsite(website);
              if (!emails.length && !Object.keys(socials).length) return;
              await db.from('leads').update({ ...(emails[0] ? { email: emails[0] } : {}), socials }).eq('id', id);
              stats.enriched++;
            }),
          );
        }
        if (enrichQueue.length) add('info', `Enriched ${stats.enriched} websites so far`);

        if (i < job.queries.length - 1) await sleep(job.provider === 'places' ? 1500 : 4000 + Math.random() * 5000);
      }

      const status = cancelled ? 'cancelled' : 'completed';
      add(cancelled ? 'warning' : 'success', cancelled ? 'Stopped by user' : `Done: ${stats.inserted} new leads, ${stats.duplicates} duplicates, ${stats.disqualified} filtered out`);
      clearInterval(flusher);
      dirty = true;
      await flush();
      await db.from('scrape_jobs').update({ status, finished_at: new Date().toISOString() }).eq('id', job.id);
      await notify(job.workspace_id, [job.created_by], {
        type: 'scrape_completed',
        title: cancelled ? 'Lead search stopped' : 'Lead search finished',
        body: `${job.name || job.queries[0] || 'Search'}: ${stats.inserted} new leads`,
        link: `/scraper/${job.id}`,
      });
    } catch (e) {
      clearInterval(flusher);
      const msg = errMsg(e);
      add('error', msg);
      dirty = true;
      await flush().catch(() => undefined);
      await db.from('scrape_jobs').update({ status: 'failed', error: msg, finished_at: new Date().toISOString() }).eq('id', job.id);
      await notify(job.workspace_id, [job.created_by], { type: 'scrape_failed', title: 'Lead search failed', body: msg, link: `/scraper/${job.id}` });
      log.warn({ job: job.id, err: msg }, 'scrape job failed');
    } finally {
      clearInterval(flusher);
      await browser?.close();
    }
  }
}
