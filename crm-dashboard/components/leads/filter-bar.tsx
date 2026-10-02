'use client';

import * as React from 'react';
import { Building2, Filter, MapPin, Search, SlidersHorizontal, Tag as TagIcon, Target, UserRound, X } from 'lucide-react';
import { LEAD_SOURCES, SOURCE_LABELS, type LeadFilters } from '@batsols/shared';
import { WhatsAppIcon } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { MultiSelect } from '@/components/ui/multi-select';
import { useLeadFacets, useMembers, useStages } from '@/lib/queries';

export function countActiveFilters(f: LeadFilters) {
  return Object.entries(f).filter(([k, v]) => k !== 'q' && v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(k === 'unassigned' && !v)).length;
}

export function FilterBar({
  filters,
  onChange,
  hide = [],
}: {
  filters: LeadFilters;
  onChange: (f: LeadFilters) => void;
  hide?: Array<keyof LeadFilters>;
}) {
  const { stages } = useStages();
  const { members } = useMembers();
  const facets = useLeadFacets();
  const [q, setQ] = React.useState(filters.q ?? '');
  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch });

  // Debounce search typing.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? '') !== q) onChange({ ...filters, q });
    }, 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => setQ(filters.q ?? ''), [filters.q]);

  const active = countActiveFilters(filters);
  const ownerValue = [...(filters.owner_ids ?? []), ...(filters.unassigned ? ['__none'] : [])];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="w-full sm:w-72"
        inputSize="sm"
        leading={<Search />}
        trailing={
          q ? (
            <button onClick={() => setQ('')} aria-label="Clear search" className="hover:text-foreground">
              <X />
            </button>
          ) : undefined
        }
        placeholder="Search name, phone, city, email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!hide.includes('stage_ids') && (
        <MultiSelect
          label="Stage"
          icon={<Target />}
          options={stages.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
          value={filters.stage_ids ?? []}
          onChange={(v) => set({ stage_ids: v })}
        />
      )}
      <MultiSelect
        label="City"
        icon={<MapPin />}
        options={(facets.data?.cities ?? []).map((c) => ({ value: c.value, label: c.value, count: c.count }))}
        value={filters.cities ?? []}
        onChange={(v) => set({ cities: v })}
        emptyText="No cities yet"
      />
      <MultiSelect
        label="Category"
        icon={<Building2 />}
        options={(facets.data?.categories ?? []).map((c) => ({ value: c.value, label: c.value, count: c.count }))}
        value={filters.categories ?? []}
        onChange={(v) => set({ categories: v })}
        emptyText="No categories yet"
      />
      <MultiSelect
        label="Tags"
        icon={<TagIcon />}
        options={(facets.data?.tags ?? []).map((c) => ({ value: c.value, label: `#${c.value}`, count: c.count }))}
        value={filters.tags ?? []}
        onChange={(v) => set({ tags: v })}
        emptyText="No tags yet"
      />
      {!hide.includes('owner_ids') && (
        <MultiSelect
          label="Owner"
          icon={<UserRound />}
          options={[{ value: '__none', label: 'Unassigned' }, ...members.map((m) => ({ value: m.user_id, label: m.profile.full_name || m.profile.email }))]}
          value={ownerValue}
          onChange={(v) => set({ owner_ids: v.filter((x) => x !== '__none'), unassigned: v.includes('__none') })}
        />
      )}
      <MultiSelect
        label="WhatsApp"
        icon={<WhatsAppIcon />}
        options={[
          { value: 'valid', label: 'On WhatsApp' },
          { value: 'unknown', label: 'Not checked' },
          { value: 'invalid', label: 'Not on WhatsApp' },
        ]}
        value={filters.wa_status ?? []}
        onChange={(v) => set({ wa_status: v as LeadFilters['wa_status'] })}
      />
      <MoreFilters filters={filters} onChange={onChange} />
      {active > 0 && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ q: filters.q })}>
          <X /> Clear {active}
        </Button>
      )}
    </div>
  );
}

function MoreFilters({ filters, onChange }: { filters: LeadFilters; onChange: (f: LeadFilters) => void }) {
  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch });
  const count = [filters.min_rating, filters.min_reviews, filters.contacted, filters.has_email, filters.sources?.length, filters.phone_types?.length, filters.has_phone].filter(
    (v) => v !== undefined && v !== null && v !== 0,
  ).length;
  const bool = (v: boolean | undefined) => (v === undefined ? '' : v ? 'yes' : 'no');
  const parseBool = (v: string) => (v === '' ? undefined : v === 'yes');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={count ? 'soft' : 'ghost'} size="sm">
          <SlidersHorizontal /> More{count ? ` · ${count}` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Filter className="size-3.5" /> More filters
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min rating">
            <NativeSelect inputSize="sm" value={filters.min_rating ?? ''} onChange={(e) => set({ min_rating: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Any</option>
              {[3, 3.5, 4, 4.5].map((r) => (
                <option key={r} value={r}>
                  {r}+ ★
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Min reviews">
            <Input inputSize="sm" type="number" min={0} value={filters.min_reviews ?? ''} onChange={(e) => set({ min_reviews: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" />
          </Field>
          <Field label="Outreach" className="col-span-2">
            <NativeSelect inputSize="sm" value={filters.contacted ?? ''} onChange={(e) => set({ contacted: (e.target.value || undefined) as LeadFilters['contacted'] })}>
              <option value="">Any</option>
              <option value="never">Never contacted</option>
              <option value="contacted">Contacted</option>
              <option value="not_replied">Contacted, no reply</option>
              <option value="replied">Replied</option>
            </NativeSelect>
          </Field>
          <Field label="Has phone">
            <NativeSelect inputSize="sm" value={bool(filters.has_phone)} onChange={(e) => set({ has_phone: parseBool(e.target.value) })}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </NativeSelect>
          </Field>
          <Field label="Has email">
            <NativeSelect inputSize="sm" value={bool(filters.has_email)} onChange={(e) => set({ has_email: parseBool(e.target.value) })}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </NativeSelect>
          </Field>
          <Field label="Phone type">
            <NativeSelect
              inputSize="sm"
              value={filters.phone_types?.[0] ?? ''}
              onChange={(e) => set({ phone_types: e.target.value ? [e.target.value as 'mobile' | 'landline' | 'unknown'] : [] })}
            >
              <option value="">Any</option>
              <option value="mobile">Mobile</option>
              <option value="landline">Landline</option>
              <option value="unknown">Unknown</option>
            </NativeSelect>
          </Field>
          <Field label="Source">
            <NativeSelect inputSize="sm" value={filters.sources?.[0] ?? ''} onChange={(e) => set({ sources: e.target.value ? [e.target.value as (typeof LEAD_SOURCES)[number]] : [] })}>
              <option value="">Any</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </PopoverContent>
    </Popover>
  );
}
