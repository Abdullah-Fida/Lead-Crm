/**
 * Headless-browser Google Maps scraper (Playwright). Scrolls the results feed,
 * then opens each place page and reads its details. Works without an API key,
 * but Google can rate-limit or CAPTCHA datacenter IPs — the Places API provider
 * is the reliable option on servers.
 */
import type { Browser, BrowserContext, Page } from 'playwright';
import type { PlaceResult } from './types';

export class BlockedError extends Error {}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const pause = (min: number, max: number) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

export async function browserAvailable(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright');
    const b = await chromium.launch({ headless: true });
    await b.close();
    return true;
  } catch {
    return false;
  }
}

export class MapsBrowser {
  private browser: Browser | null = null;
  private ctx: BrowserContext | null = null;
  private page: Page | null = null;

  async open() {
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled', '--lang=en-US'],
    });
    this.ctx = await this.browser.newContext({ locale: 'en-US', userAgent: UA, viewport: { width: 1366, height: 900 } });
    // Skip images/fonts: faster and lighter on memory.
    await this.ctx.route('**/*', (route) => {
      const t = route.request().resourceType();
      return t === 'image' || t === 'font' || t === 'media' ? route.abort() : route.continue();
    });
    this.page = await this.ctx.newPage();
  }

  async close() {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
    this.ctx = null;
    this.page = null;
  }

  private async guard(page: Page) {
    const url = page.url();
    if (url.includes('consent.google')) {
      const btn = page.getByRole('button', { name: /accept all|reject all|i agree/i }).first();
      if (await btn.count()) {
        await btn.click().catch(() => undefined);
        await page.waitForLoadState('domcontentloaded').catch(() => undefined);
      }
    }
    if (page.url().includes('/sorry/') || (await page.getByText(/unusual traffic/i).count()) > 0) {
      throw new BlockedError('Google is blocking automated searches from this server (CAPTCHA). Use the Google Places API provider instead.');
    }
  }

  async search(query: string, max: number, opts: { onLog?: (text: string) => void; isCancelled?: () => Promise<boolean> } = {}): Promise<PlaceResult[]> {
    const page = this.page;
    if (!page) throw new Error('Browser not open');
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await this.guard(page);

    const feed = page.locator('div[role="feed"]');
    await Promise.race([feed.waitFor({ timeout: 20_000 }), page.locator('h1.DUwDvf').first().waitFor({ timeout: 20_000 })]).catch(() => undefined);
    await this.guard(page);

    if (!(await feed.count())) {
      // Google jumped straight to a single place.
      const one = await this.readPlace(page).catch(() => null);
      return one ? [one] : [];
    }

    let last = 0;
    let stale = 0;
    for (let i = 0; i < 60; i++) {
      const count = await page.locator('a.hfpxzc').count();
      if (count >= max) break;
      if (await page.getByText(/reached the end of the list/i).count()) break;
      if (count === last) {
        stale++;
        if (stale >= 4) break;
      } else {
        stale = 0;
      }
      last = count;
      await feed.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await pause(1200, 2200);
      if (opts.isCancelled && i % 5 === 4 && (await opts.isCancelled())) break;
    }

    const links = [
      ...new Set(
        await page.locator('a.hfpxzc').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href).filter((h) => h.includes('/maps/place/'))),
      ),
    ].slice(0, max);
    opts.onLog?.(`Found ${links.length} listings; reading details…`);

    const out: PlaceResult[] = [];
    for (const href of links) {
      if (opts.isCancelled && (await opts.isCancelled())) break;
      try {
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await this.guard(page);
        await page.locator('h1.DUwDvf').first().waitFor({ timeout: 12_000 });
        await pause(500, 900);
        const r = await this.readPlace(page);
        if (r) out.push(r);
      } catch (e) {
        if (e instanceof BlockedError) throw e;
        opts.onLog?.(`Skipped one listing: ${(e as Error).message.slice(0, 80)}`);
      }
      await pause(600, 1400);
    }
    return out;
  }

  private async readPlace(page: Page): Promise<PlaceResult | null> {
    const data = await page.evaluate(() => {
      const text = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? null;
      const attr = (sel: string, a: string) => document.querySelector(sel)?.getAttribute(a) ?? null;
      const name = text('h1.DUwDvf');
      const ratingText = text('div.F7nice span[aria-hidden="true"]');
      const reviewsLabel = attr('div.F7nice span[aria-label*="review"]', 'aria-label') ?? text('div.F7nice span:last-child');
      const phoneId = document.querySelector('button[data-item-id^="phone:tel:"]')?.getAttribute('data-item-id') ?? null;
      const website = (document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null)?.href ?? null;
      const addressLabel = attr('button[data-item-id="address"]', 'aria-label');
      const address = addressLabel?.replace(/^Address:\s*/i, '') ?? text('button[data-item-id="address"] .Io6YTe');
      const category = text('button.DkEaL');
      const body = document.body.innerText;
      const status = /Permanently closed/i.test(body) ? 'CLOSED_PERMANENTLY' : /Temporarily closed/i.test(body) ? 'CLOSED_TEMPORARILY' : 'OPERATIONAL';
      return { name, ratingText, reviewsLabel, phoneId, website, address, category, status, url: location.href };
    });
    if (!data.name) return null;
    const url = data.url;
    const placeId = url.match(/!19s(ChIJ[^!?]+)/)?.[1] ?? url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/)?.[1] ?? null;
    const lat = Number(url.match(/!3d(-?\d+\.\d+)/)?.[1] ?? NaN);
    const lng = Number(url.match(/!4d(-?\d+\.\d+)/)?.[1] ?? NaN);
    let website = data.website;
    if (website?.includes('google.com/url')) {
      try {
        website = new URL(website).searchParams.get('q') ?? website;
      } catch {
        /* keep */
      }
    }
    const rating = data.ratingText ? Number(data.ratingText.replace(',', '.')) : NaN;
    const reviews = data.reviewsLabel ? Number((data.reviewsLabel.match(/[\d,.]+/)?.[0] ?? '').replace(/[,.]/g, '')) : NaN;
    const addressParts = (data.address ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return {
      placeId,
      name: data.name,
      phone: data.phoneId ? data.phoneId.replace(/^phone:tel:/, '') : null,
      website: website && !website.includes('google.') ? website : null,
      address: data.address,
      city: addressParts.length >= 2 ? addressParts[addressParts.length - 2]!.replace(/\d+/g, '').trim() || null : null,
      country: null,
      category: data.category,
      rating: Number.isFinite(rating) ? rating : null,
      reviews: Number.isFinite(reviews) ? reviews : null,
      mapsUrl: url.split('?')[0] ?? url,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      businessStatus: data.status,
    };
  }
}
