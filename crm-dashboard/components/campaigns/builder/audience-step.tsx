'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Layers, ListChecks, MousePointerClick, ShieldCheck, Users } from 'lucide-react';
import type { LeadFilters } from '@batsols/shared';
import { FilterBar } from '@/components/leads/filter-bar';
import { Card } from '@/components/ui/card';
import { SwitchRow } from '@/components/ui/controls';
import { Callout } from '@/components/ui/feedback';
import { NativeSelect } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Spinner } from '@/components/ui/spinner';
import { getSupabase } from '@/lib/supabase/client';
import { cleanFilters } from '@/lib/leads';
import { useLeadLists } from '@/lib/lists';
import { useWorkspace } from '@/lib/workspace';
import { cn, formatNumber } from '@/lib/utils';
import { effectiveFilters, type BuilderState } from './state';

export function useAudienceCount(audience: BuilderState['audience'], skipLandlines: boolean, excludeCampaignId?: string) {
  const { workspace } = useWorkspace();
  const filters = cleanFilters({ ...effectiveFilters(audience, skipLandlines), ...(excludeCampaignId ? { exclude_campaign_id: excludeCampaignId } : {}) });
  const raw = cleanFilters(audience.mode === 'selection' && audience.ids ? { ids: audience.ids } : audience.filters);
  return useQuery({
    queryKey: ['audience-count', workspace.id, filters, raw],
    queryFn: async () => {
      const sb = getSupabase();
      const [eligible, matching, unknownWa] = await Promise.all([
        sb.rpc('filtered_leads', { p_workspace: workspace.id, p_filters: filters }, { count: 'exact', head: true }),
        sb.rpc('filtered_leads', { p_workspace: workspace.id, p_filters: raw }, { count: 'exact', head: true }),
        sb.rpc('filtered_leads', { p_workspace: workspace.id, p_filters: { ...filters, wa_status: ['unknown'] } }, { count: 'exact', head: true }),
      ]);
      if (eligible.error) throw eligible.error;
      return { eligible: eligible.count ?? 0, matching: matching.count ?? 0, unknownWa: unknownWa.count ?? 0 };
    },
  });
}

export function AudienceStep({ state, set, campaignId }: { state: BuilderState; set: (fn: (s: BuilderState) => BuilderState) => void; campaignId?: string }) {
  const a = state.audience;
  const lists = useLeadLists();
  const count = useAudienceCount(a, state.settings.skip_landlines, campaignId);
  const setA = (patch: Partial<BuilderState['audience']>) => set((s) => ({ ...s, audience: { ...s.audience, ...patch } }));
  const setF = (f: LeadFilters) => setA({ filters: f });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { mode: 'filters' as const, icon: Layers, title: 'Leads matching filters', text: 'Pick by stage, city, category, tags, lists, quality…' },
          {
            mode: 'selection' as const,
            icon: MousePointerClick,
            title: a.ids ? `${formatNumber(a.ids.length)} hand-picked leads` : 'Hand-picked leads',
            text: a.ids ? 'Selected on the Leads page' : 'Select leads on the Leads page, then “Add to campaign”',
            disabled: !a.ids,
          },
        ].map((o) => (
          <button
            key={o.mode}
            type="button"
            disabled={o.disabled}
            onClick={() => setA({ mode: o.mode })}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              a.mode === o.mode ? 'border-primary bg-primary-soft ring-1 ring-primary/30' : 'border-border bg-surface hover:border-border-strong',
            )}
          >
            <o.icon className={cn('mt-0.5 size-5', a.mode === o.mode ? 'text-primary' : 'text-subtle')} />
            <div>
              <div className="text-[14px] font-semibold">{o.title}</div>
              <div className="mt-0.5 text-[12.5px] text-muted">{o.text}</div>
            </div>
          </button>
        ))}
      </div>

      {a.mode === 'filters' && (
        <Card className="space-y-3 p-4">
          <FilterBar filters={a.filters} onChange={setF} />
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect
              label="Lead lists"
              icon={<ListChecks />}
              options={(lists.data ?? []).map((l) => ({ value: l.id, label: l.name, color: l.color }))}
              value={a.filters.list_ids ?? []}
              onChange={(v) => setF({ ...a.filters, list_ids: v })}
              emptyText="No lists yet"
            />
            <MultiSelect
              label="Quality"
              icon={<Flame />}
              options={[
                { value: 'hot', label: 'Hot (70+)' },
                { value: 'warm', label: 'Warm (40–69)' },
                { value: 'cold', label: 'Cold (<40)' },
              ]}
              value={a.filters.tiers ?? []}
              onChange={(v) => setF({ ...a.filters, tiers: v as Array<'hot' | 'warm' | 'cold'> })}
            />
          </div>
        </Card>
      )}

      <Card className="divide-y divide-border px-4">
        <SwitchRow
          label="Skip leads already in another active campaign"
          description="Guarantees no business gets messages from two campaigns — or two teammates — at once."
          checked={a.skipActive}
          onCheckedChange={(v) => setA({ skipActive: v })}
        />
        <div className="flex items-start justify-between gap-6 py-3">
          <div>
            <div className="text-[13.5px] font-medium">Skip recently contacted leads</div>
            <div className="mt-0.5 text-[12.5px] text-muted">Avoid messaging someone again too soon.</div>
          </div>
          <NativeSelect inputSize="sm" className="w-44" value={a.skipContactedDays ?? 0} onChange={(e) => setA({ skipContactedDays: Number(e.target.value) || null })}>
            <option value={0}>Don’t skip</option>
            <option value={7}>Contacted in last 7 days</option>
            <option value={30}>Contacted in last 30 days</option>
            <option value={90}>Contacted in last 90 days</option>
            <option value={3650}>Ever contacted</option>
          </NativeSelect>
        </div>
        <SwitchRow
          label="Only numbers verified on WhatsApp"
          description="Use “Verify WhatsApp numbers” on the Leads page first. Otherwise numbers are checked right before sending."
          checked={a.onlyVerified}
          onCheckedChange={(v) => setA({ onlyVerified: v })}
        />
      </Card>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-primary-soft-border bg-primary-soft px-5 py-4">
        <Users className="size-6 text-primary" />
        <div className="flex-1">
          {count.isLoading ? (
            <span className="flex items-center gap-2 text-[14px]">
              <Spinner className="size-4" /> Counting…
            </span>
          ) : (
            <>
              <div className="text-[15px] font-semibold">
                <span className="tabular text-primary">{formatNumber(count.data?.eligible ?? 0)}</span> leads will receive this campaign
              </div>
              <div className="text-[12.5px] text-muted">
                {formatNumber(count.data?.matching ?? 0)} match · {formatNumber((count.data?.matching ?? 0) - (count.data?.eligible ?? 0))} excluded (no phone, opted out, not on WhatsApp, landline or already in a campaign)
              </div>
            </>
          )}
        </div>
        {(count.data?.unknownWa ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-success" /> {formatNumber(count.data!.unknownWa)} will be checked on WhatsApp before sending
          </div>
        )}
      </div>
      {count.data && count.data.eligible === 0 && <Callout tone="warning">No leads match yet. Loosen the filters, or add leads first.</Callout>}
    </div>
  );
}
