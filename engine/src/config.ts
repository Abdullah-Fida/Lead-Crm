import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing required environment variable ${name}. See engine/.env.example.`);
    process.exit(1);
  }
  return v;
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  placesApiKey: process.env.GOOGLE_PLACES_API_KEY?.trim() || null,
  browserScraper: (process.env.SCRAPER_BROWSER ?? 'true').toLowerCase() !== 'false',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  port: process.env.PORT ? Number(process.env.PORT) : null,
  instanceId: process.env.ENGINE_INSTANCE_ID || `${hostname()}-${randomUUID().slice(0, 8)}`,
  version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? process.env.npm_package_version ?? 'dev',
  /** Lease time-to-live; renewed every third of it. */
  leaseTtlSeconds: 45,
};
