'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, Filter, Globe, MapPin, Play, Plus, Search, Sparkles, Square, Trash2, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BUSINESS_CATEGORIES, PRESET_LOCATIONS, type ScrapeJob, type ScrapeQualify } from '@batsols/shared';
import { Page } from '@/components/shell/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress, Segmented, SwitchRow } from '@/components/ui/controls';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Callout, EmptyState, Skeleton, useConfirm } from '@/components/ui/feedback';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { PageHeader, StatCard, Table, Td, Th, Tr } from '@/components/ui/layout';
import { TagInput } from '@/components/ui/multi-select';
import { PageSpinner } from '@/components/ui/spinner';
import { getSupabase } from '@/lib/supabase/client';
import { qk, useEngineStatus, useMembers, useRealtime } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';
import { cn, errorMessage, formatNumber, fullDate, timeAgo } from '@/lib/utils';

const STATUS: Record<ScrapeJob['status'], { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Stopped', tone: 'warning' },
};

function useJobs() {
  const { workspace } = useWorkspace();
  const key = qk.scrapeJobs(workspace.id);
  useRealtime('scrape_jobs', `workspace_id=eq.${workspace.id}`, [key]);
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('scrape_jobs')
        .select('id, workspace_id, created_by, name, provider, keywords, locations, queries, status, progress, stats, error, created_at, started_at, finished_at, max_per_query, enrich, tags, assign_to, qualify, cancel_requested, updated_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ScrapeJob[];
    },
  });
}

export function ScraperView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can } = useWorkspace();
  const { data: jobs = [], isLoading } = useJobs();
  const { byId } = useMembers();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [params, pathname, router]);

  const totals = jobs.reduce((t, j) => ({ found: t.found + (j.stats.found ?? 0), inserted: t.inserted + (j.stats.inserted ?? 0), dup: t.dup + (j.stats.duplicates ?? 0) }), { found: 0, inserted: 0, dup: 0 });

  return (
    <Page wide>
      <PageHeader
        icon={<MapPin />}
        title="Lead finder"
        description="Find businesses on Google Maps by keyword and city. Results are qualified, de-duplicated and added to your leads."
        actions={
          can.write && (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Search /> New search
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-4">
        <StatCard label="Businesses found" value={formatNumber(totals.found)} icon={<Globe />} />
        <StatCard label="New leads added" value={formatNumber(totals.inserted)} icon={<Users />} accent="success" />
        <StatCard label="Duplicates blocked" value={formatNumber(totals.dup)} icon={<Ban />} accent="warning" />
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !jobs.length ? (
          <EmptyState
            icon={<MapPin />}
            title="Run your first search"
            description="E.g. “Dentists” in “Lahore” and “Karachi”. You’ll watch leads arrive in real time."
            action={can.write && <Button variant="primary" onClick={() => setOpen(true)}><Search /> New search</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <thead>
                <tr>
                  <Th>Search</Th>
                  <Th>Status</Th>
                  <Th className="w-[200px]">Progress</Th>
                  <Th className="text-right">Found</Th>
                  <Th className="text-right">New</Th>
                  <Th className="text-right">Duplicates</Th>
                  <Th>By</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <Tr key={j.id} className="cursor-pointer" onClick={() => router.push(`/scraper/${j.id}`)}>
                    <Td className="max-w-[280px]">
                      <div className="truncate font-medium">{j.name || `${j.keywords.join(', ')} in ${j.locations.join(', ')}`}</div>
                      <div className="text-xs text-subtle">
                        {j.queries.length} searches · {j.provider === 'places' ? 'Places API' : 'Browser'}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={STATUS[j.status].tone} dot pulse={j.status === 'running'}>{STATUS[j.status].label}</Badge>
                    </Td>
                    <Td>
                      <Progress value={j.status === 'completed' ? 100 : ((j.progress.current ?? 0) / Math.max(1, j.progress.total ?? j.queries.length)) * 100} tone={j.status === 'completed' ? 'success' : 'primary'} />
                    </Td>
                    <Td className="text-right tabular">{formatNumber(j.stats.found ?? 0)}</Td>
                    <Td className="text-right tabular font-semibold text-success">{formatNumber(j.stats.inserted ?? 0)}</Td>
                    <Td className="text-right tabular text-muted">{formatNumber(j.stats.duplicates ?? 0)}</Td>
                    <Td className="text-[13px] text-muted">{j.created_by ? byId.get(j.created_by)?.profile.full_name.split(' ')[0] : '—'}</Td>
                    <Td className="text-xs text-subtle">{timeAgo(j.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
      <NewSearchDialog open={open} onOpenChange={setOpen} />
    </Page>
  );
}

function NewSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { workspace, userId, can } = useWorkspace();
  const { members } = useMembers();
  const engine = useEngineStatus();
  const [keywords, setKeywords] = React.useState<string[]>([]);
  const [locations, setLocations] = React.useState<string[]>([]);
  const [provider, setProvider] = React.useState<'places' | 'browser'>('places');
  const [max, setMax] = React.useState(60);
  const [enrich, setEnrich] = React.useState(true);
  const [tags, setTags] = React.useState<string[]>([]);
  const [assignTo, setAssignTo] = React.useState('');
  const [rules, setRules] = React.useState<ScrapeQualify>({ skip_closed: true, website: 'any', require_mobile: false, min_rating: undefined, min_reviews: undefined, exclude_keywords: [] });
  const [busy, setBusy] = React.useState(false);
  const queries = keywords.flatMap((k) => (locations.length ? locations.map((l) => `${k} in ${l}`) : [k]));

  async function start() {
    if (!queries.length) return toast.error('Add at least one keyword');
    setBusy(true);
    const { data, error } = await getSupabase()
      .from('scrape_jobs')
      .insert({
        workspace_id: workspace.id,
        created_by: userId,
        name: `${keywords.join(', ')}${locations.length ? ` in ${locations.join(', ')}` : ''}`.slice(0, 120),
        provider,
        keywords,
        locations,
        queries,
        max_per_query: max,
        enrich,
        tags,
        assign_to: assignTo || null,
        qualify: rules,
      })
      .select('id')
      .single();
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    qc.invalidateQueries({ queryKey: qk.scrapeJobs(workspace.id) });
    onOpenChange(false);
    router.push(`/scraper/${data.id}`);
  }

  const allCats = Object.values(BUSINESS_CATEGORIES).flat();
  const allLocs = Object.values(PRESET_LOCATIONS).flat();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" title="New lead search" description="Every keyword is searched in every location.">
        <DialogBody className="space-y-5">
          {!engine.online && <Callout tone="warning">The engine is offline — the search will start as soon as it’s running.</Callout>}
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="What businesses?" hint="Type and press Enter, or pick below.">
              <TagInput value={keywords} onChange={setKeywords} suggestions={allCats} placeholder="Dentists" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(BUSINESS_CATEGORIES).slice(0, 4).flatMap(([, list]) => list.slice(0, 3)).map((k) => (
                  <button key={k} type="button" onClick={() => setKeywords((v) => (v.includes(k) ? v : [...v, k]))} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted hover:border-primary hover:text-primary">
                    + {k}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Where?" hint="Cities, areas or full addresses.">
              <TagInput value={locations} onChange={setLocations} suggestions={allLocs} placeholder="Lahore" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(PRESET_LOCATIONS[workspace.default_country === 'PK' ? 'Pakistan' : 'United Arab Emirates'] ?? PRESET_LOCATIONS.Pakistan!).slice(0, 8).map((l) => (
                  <button key={l} type="button" onClick={() => setLocations((v) => (v.includes(l) ? v : [...v, l]))} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted hover:border-primary hover:text-primary">
                    + {l}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Source">
              <NativeSelect value={provider} onChange={(e) => setProvider(e.target.value as 'places' | 'browser')}>
                <option value="places">Google Places API (recommended)</option>
                <option value="browser">Google Maps browser</option>
              </NativeSelect>
            </Field>
            <Field label="Results per search" hint={provider === 'places' ? 'Places API returns up to 60' : 'Up to 200'}>
              <Input type="number" min={5} max={provider === 'places' ? 60 : 200} value={max} onChange={(e) => setMax(Number(e.target.value))} />
            </Field>
            <Field label="Assign new leads to">
              <NativeSelect value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">Me</option>
                {can.admin &&
                  members.filter((m) => m.user_id !== userId).map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile.full_name || m.profile.email}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
              <Filter className="size-4 text-primary" /> Lead qualifier
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Min rating">
                <NativeSelect value={rules.min_rating ?? ''} onChange={(e) => setRules({ ...rules, min_rating: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Any</option>
                  {[3, 3.5, 4, 4.5].map((r) => (
                    <option key={r} value={r}>
                      {r}+
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Min reviews">
                <Input type="number" min={0} placeholder="Any" value={rules.min_reviews ?? ''} onChange={(e) => setRules({ ...rules, min_reviews: e.target.value ? Number(e.target.value) : undefined })} />
              </Field>
              <Field label="Website">
                <NativeSelect value={rules.website ?? 'any'} onChange={(e) => setRules({ ...rules, website: e.target.value as ScrapeQualify['website'] })}>
                  <option value="any">Any</option>
                  <option value="without">Only without website</option>
                  <option value="with">Only with website</option>
                </NativeSelect>
              </Field>
              <Field label="Skip names containing">
                <TagInput value={rules.exclude_keywords ?? []} onChange={(v) => setRules({ ...rules, exclude_keywords: v })} placeholder="chain…" />
              </Field>
            </div>
            <div className="mt-2 divide-y divide-border">
              <SwitchRow label="Mobile numbers only" description="Landlines rarely use WhatsApp." checked={!!rules.require_mobile} onCheckedChange={(v) => setRules({ ...rules, require_mobile: v })} />
              <SwitchRow label="Skip closed businesses" checked={rules.skip_closed !== false} onCheckedChange={(v) => setRules({ ...rules, skip_closed: v })} />
              <SwitchRow label="Find emails & social profiles" description="Visits each website to collect contact emails, Instagram, Facebook and LinkedIn." checked={enrich} onCheckedChange={setEnrich} />
            </div>
          </Card>
          <Field label="Tag new leads" optional>
            <TagInput value={tags} onChange={setTags} placeholder="e.g. q4-dentists" />
          </Field>
          {provider === 'places' && <p className="text-xs text-subtle">Needs a Google Places API key (Settings → Integrations). Duplicates already in BatSols are skipped automatically.</p>}
        </DialogBody>
        <DialogFooter>
          <span className="mr-auto text-[13px] text-muted">{queries.length} search{queries.length === 1 ? '' : 'es'} · up to {formatNumber(queries.length * max)} businesses</span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={start} loading={busy} disabled={!queries.length}>
            <Play /> Start search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScrapeJobView({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { can, userId } = useWorkspace();
  const key = qk.scrapeJob(id);
  useRealtime('scrape_jobs', `id=eq.${id}`, [key]);
  const { data: job, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('scrape_jobs').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as ScrapeJob | null;
    },
    refetchInterval: (q) => (q.state.data?.status === 'running' || q.state.data?.status === 'queued' ? 3000 : false),
  });
  const logRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job?.logs?.length]);

  if (isLoading) return <PageSpinner />;
  if (!job) return <Page><EmptyState title="Search not found" /></Page>;
  const active = job.status === 'running' || job.status === 'queued';
  const pct = job.status === 'completed' ? 100 : ((job.progress.current ?? 0) / Math.max(1, job.progress.total ?? job.queries.length)) * 100;
  const s = job.stats;

  async function cancel() {
    await getSupabase().from('scrape_jobs').update({ cancel_requested: true }).eq('id', id);
    toast('Stopping after the current business…');
  }
  async function remove() {
    if (!(await confirm({ title: 'Delete this search?', description: 'The leads it found are kept.', confirmLabel: 'Delete', danger: true }))) return;
    const { error } = await getSupabase().from('scrape_jobs').delete().eq('id', id);
    if (error) return toast.error(errorMessage(error));
    router.push('/scraper');
  }

  return (
    <Page wide>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link href="/scraper" aria-label="Back">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{job.name || 'Lead search'}</h1>
              <Badge tone={STATUS[job.status].tone} dot pulse={job.status === 'running'}>{STATUS[job.status].label}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {job.queries.length} searches · {job.provider === 'places' ? 'Google Places API' : 'Google Maps browser'} · started {job.started_at ? fullDate(job.started_at) : 'soon'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {active && can.write && (
            <Button variant="secondary" onClick={cancel} disabled={job.cancel_requested}>
              <Square /> {job.cancel_requested ? 'Stopping…' : 'Stop'}
            </Button>
          )}
          {(s.inserted ?? 0) > 0 && (
            <Button variant="primary" asChild>
              <Link href={`/leads?scrape_job=${job.id}`}>
                <Users /> View {formatNumber(s.inserted ?? 0)} leads
              </Link>
            </Button>
          )}
          {!active && (can.admin || job.created_by === userId) && (
            <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete search">
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      {job.error && <Callout tone="danger" className="mb-5" title="The search stopped">{job.error}</Callout>}

      <Card className="mb-5 p-5">
        <div className="mb-2 flex justify-between text-[13px]">
          <span className="truncate text-muted">{active ? job.progress.query ? `Searching “${job.progress.query}”` : 'Waiting for the engine…' : 'Finished'}</span>
          <span className="tabular text-muted">
            {job.progress.current ?? 0} / {job.progress.total ?? job.queries.length}
          </span>
        </div>
        <Progress value={pct} tone={job.status === 'completed' ? 'success' : 'primary'} />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { l: 'Found', v: s.found, icon: Globe },
            { l: 'New leads', v: s.inserted, icon: CheckCircle2, cls: 'text-success' },
            { l: 'Duplicates', v: s.duplicates, icon: Ban },
            { l: 'Filtered out', v: s.disqualified, icon: Filter },
            { l: 'No phone', v: s.no_phone, icon: XCircle },
            { l: 'With website', v: s.with_website, icon: Globe },
            { l: 'Enriched', v: s.enriched, icon: Sparkles },
          ].map((x) => (
            <div key={x.l} className="rounded-lg bg-surface-2/60 px-3 py-2.5">
              <div className={cn('text-[18px] font-semibold tabular', x.cls)}>{formatNumber(x.v ?? 0)}</div>
              <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-subtle">
                <x.icon className="size-3" /> {x.l}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Live log" description="What the finder is doing right now" />
        <CardContent>
          <div ref={logRef} className="max-h-[460px] overflow-y-auto rounded-lg bg-[#0b0b10] p-4 font-mono text-[12px] leading-relaxed">
            {(job.logs ?? []).length === 0 && <div className="text-[#8b8b97]">Waiting to start…</div>}
            {(job.logs ?? []).map((l, i) => (
              <div key={i} className={cn(l.level === 'error' ? 'text-[#fb7185]' : l.level === 'warning' ? 'text-[#fbbf24]' : l.level === 'success' ? 'text-[#34d399]' : 'text-[#c4c4cf]')}>
                <span className="mr-2 text-[#6c6c7b]">{new Date(l.t).toLocaleTimeString()}</span>
                {l.text}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 text-xs text-subtle">
        <Plus className="mr-1 inline size-3" />
        New leads are tagged {job.tags.length ? job.tags.map((t) => `#${t}`).join(' ') : 'with the keyword'} and owned by {job.assign_to ? 'the chosen teammate' : 'whoever started the search'}.
      </div>
    </Page>
  );
}
