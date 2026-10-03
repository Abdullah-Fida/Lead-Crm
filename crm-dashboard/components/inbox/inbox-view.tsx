'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ExternalLink, Inbox, MessagesSquare, Search, UserRound } from 'lucide-react';
import { formatPhone, type Conversation, type Lead, type Message } from '@batsols/shared';
import { WhatsAppIcon } from '@/components/brand';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, NativeSelect } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/menu';
import { Composer, MessageThread } from '@/components/whatsapp/chat';
import { LeadDrawer } from '@/components/leads/lead-drawer';
import { OwnerSelect, Rating, StageSelect, WaStatus } from '@/components/leads/bits';
import { getSupabase } from '@/lib/supabase/client';
import { qk, useAccounts, useMembers, useRealtime } from '@/lib/queries';
import { useLead, useUpdateLead } from '@/lib/leads';
import { useWorkspace } from '@/lib/workspace';
import { cn, hostname, shortDate } from '@/lib/utils';

type ConvRow = Conversation & { lead: Pick<Lead, 'id' | 'business_name' | 'phone' | 'owner_id' | 'city' | 'opted_out'> };
type Filter = 'all' | 'unread' | 'mine' | 'archived';

export function InboxView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { workspace, userId } = useWorkspace();
  const { accounts, byId: accountById } = useAccounts();
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<Filter>('all');
  const [account, setAccount] = React.useState('');
  const [q, setQ] = React.useState('');
  const [drawer, setDrawer] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const selected = params.get('c');
  const listKey = [...qk.conversations(workspace.id), filter, account, q];

  useRealtime('conversations', `workspace_id=eq.${workspace.id}`, [qk.conversations(workspace.id)]);
  const list = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      let query = getSupabase()
        .from('conversations')
        .select('*, lead:leads!inner(id, business_name, phone, owner_id, city, opted_out)')
        .eq('workspace_id', workspace.id)
        .eq('archived', filter === 'archived')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (filter === 'unread') query = query.gt('unread_count', 0);
      if (filter === 'mine') query = query.eq('lead.owner_id', userId);
      if (account) query = query.eq('account_id', account);
      if (q.trim()) query = query.ilike('lead.business_name', `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ConvRow[];
    },
  });

  const select = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('c', id);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const current = list.data?.find((c) => c.id === selected) ?? null;

  // Opening a chat marks it read.
  React.useEffect(() => {
    if (current && current.unread_count > 0) {
      void getSupabase()
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', current.id)
        .then(() => qc.invalidateQueries({ queryKey: qk.conversations(workspace.id) }));
    }
  }, [current, qc, workspace.id]);

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation list */}
      <aside className={cn('flex w-full shrink-0 flex-col border-r border-border md:w-[340px]', selected && 'hidden md:flex')}>
        <div className="space-y-2.5 border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em]">
              <Inbox className="size-4.5 text-primary" /> Inbox
            </h1>
            {mounted && accounts.length > 1 && (
              <NativeSelect inputSize="sm" className="w-40" value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">All numbers</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
          <Input inputSize="sm" leading={<Search />} placeholder="Search chats…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Segmented<Filter>
            size="sm"
            value={filter}
            onChange={setFilter}
            className="w-full"
            options={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'mine', label: 'My leads' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 border-b border-border p-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          {!list.isLoading && !list.data?.length && (
            <EmptyState compact icon={<MessagesSquare />} title={filter === 'unread' ? 'All caught up' : 'No conversations yet'} description="Replies to your campaigns and messages appear here instantly." />
          )}
          {list.data?.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              className={cn('flex w-full gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-surface-2/60', c.id === selected && 'bg-primary-soft hover:bg-primary-soft')}
            >
              <Avatar name={c.lead.business_name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('truncate text-[13.5px]', c.unread_count ? 'font-semibold' : 'font-medium')}>{c.lead.business_name}</span>
                  <span className={cn('ml-auto shrink-0 text-[11px]', c.unread_count ? 'font-semibold text-whatsapp' : 'text-subtle')}>{shortDate(c.last_message_at)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={cn('truncate text-[12.5px]', c.unread_count ? 'text-foreground' : 'text-muted')}>
                    {c.last_direction === 'out' && <span className="text-subtle">You: </span>}
                    {c.last_message_preview}
                  </span>
                  {c.unread_count > 0 && (
                    <span className="ml-auto flex min-w-5 shrink-0 items-center justify-center rounded-full bg-whatsapp-bright px-1.5 text-[11px] font-semibold leading-5 text-black/80">{c.unread_count}</span>
                  )}
                </div>
                {accounts.length > 1 && <div className="mt-0.5 truncate text-[11px] text-subtle">via {accountById.get(c.account_id)?.label}</div>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      {current ? (
        <ChatPane key={current.id} conv={current} onBack={() => router.replace(pathname)} onOpenLead={() => setDrawer(current.lead.id)} />
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <EmptyState icon={<WhatsAppIcon />} title="Select a conversation" description="Every WhatsApp reply from every teammate’s number lands here, live." />
        </div>
      )}
      <LeadDrawer leadId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function ChatPane({ conv, onBack, onOpenLead }: { conv: ConvRow; onBack: () => void; onOpenLead: () => void }) {
  const { workspace, can } = useWorkspace();
  const { byId: accountById } = useAccounts();
  const { byId: members } = useMembers();
  const qc = useQueryClient();
  const { data: lead } = useLead(conv.lead.id);
  const update = useUpdateLead();
  const key = qk.messages(conv.id);
  useRealtime('messages', `conversation_id=eq.${conv.id}`, [key]);
  const messages = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return (data as Message[]).reverse();
    },
  });
  // Queued manual messages have no conversation yet: show them too.
  const queued = useQuery({
    queryKey: [...key, 'queued'],
    queryFn: async () => {
      const { data } = await getSupabase().from('messages').select('*').eq('lead_id', conv.lead.id).eq('account_id', conv.account_id).is('conversation_id', null).order('created_at');
      return (data ?? []) as Message[];
    },
    refetchInterval: 4000,
  });
  const account = accountById.get(conv.account_id);
  const assignee = conv.assigned_to ? members.get(conv.assigned_to) : undefined;

  async function setConv(patch: Partial<Conversation>) {
    await getSupabase().from('conversations').update(patch).eq('id', conv.id);
    qc.invalidateQueries({ queryKey: qk.conversations(workspace.id) });
  }

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="Back">
            ‹
          </Button>
          <Avatar name={conv.lead.business_name} size="md" />
          <button className="min-w-0 flex-1 text-left" onClick={onOpenLead}>
            <div className="truncate text-[14px] font-semibold hover:text-primary">{conv.lead.business_name}</div>
            <div className="truncate text-xs text-muted">
              {formatPhone(conv.lead.phone)} · via {account?.label ?? 'number'}
            </div>
          </button>
          {can.write && (
            <OwnerSelect value={conv.assigned_to} onChange={(id) => setConv({ assigned_to: id })} compact />
          )}
          <Tooltip content={conv.archived ? 'Move back to inbox' : 'Archive chat'}>
            <Button variant="ghost" size="icon-sm" onClick={() => setConv({ archived: !conv.archived })} aria-label="Archive">
              {conv.archived ? <ArchiveRestore /> : <Archive />}
            </Button>
          </Tooltip>
        </header>
        <MessageThread
          messages={[...(messages.data ?? []), ...(queued.data ?? [])]}
          className="min-h-0 flex-1 bg-[#efeae2]/60 dark:bg-[#0b141a]/60"
          emptyHint="No messages in this chat yet."
        />
        {lead && <Composer lead={lead} defaultAccountId={conv.account_id} lockAccount onSent={() => queued.refetch()} />}
        {assignee && <div className="border-t border-border px-4 py-1.5 text-[11px] text-subtle">Assigned to {assignee.profile.full_name}</div>}
      </section>

      {lead && (
        <aside className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-4 xl:flex">
          <div className="text-center">
            <Avatar name={lead.business_name} size="xl" square className="mx-auto" />
            <div className="mt-2 text-[15px] font-semibold">{lead.business_name}</div>
            <div className="text-xs text-muted">{[lead.category, lead.city].filter(Boolean).join(' · ')}</div>
            <div className="mt-1 flex items-center justify-center gap-2">
              <Rating rating={lead.rating} reviews={lead.reviews_count} />
              <WaStatus lead={lead} />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-border p-3">
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-subtle">Stage</div>
              <StageSelect value={lead.stage_id} onChange={(id) => update.mutate({ id: lead.id, patch: { stage_id: id } })} disabled={!can.write} size="md" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-subtle">Lead owner</div>
              <OwnerSelect value={lead.owner_id} onChange={(id) => update.mutate({ id: lead.id, patch: { owner_id: id } })} disabled={!can.write} />
            </div>
          </div>
          <div className="space-y-1.5 text-[13px]">
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="size-3.5" /> {hostname(lead.website)}
              </a>
            )}
            {lead.email && <div className="truncate text-muted">{lead.email}</div>}
            {lead.address && <div className="text-muted">{lead.address}</div>}
          </div>
          <Button variant="secondary" onClick={onOpenLead}>
            <UserRound /> Open full profile
          </Button>
        </aside>
      )}
    </>
  );
}
