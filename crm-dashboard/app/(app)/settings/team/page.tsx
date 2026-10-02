'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, LogOut, MoreHorizontal, Smartphone, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role, type WorkspaceInvite } from '@batsols/shared';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Callout, useConfirm } from '@/components/ui/feedback';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Table, Td, Th, Tr } from '@/components/ui/layout';
import { getSupabase } from '@/lib/supabase/client';
import { qk, useAccounts, useMembers, type Member } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';
import { errorMessage, timeAgo } from '@/lib/utils';
import { APP_URL } from '@/lib/env';

const inviteUrl = (token: string) => `${APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/invite/${token}`;

export default function TeamSettingsPage() {
  return (
    <React.Suspense>
      <TeamSettings />
    </React.Suspense>
  );
}

function TeamSettings() {
  const { workspace, userId, can, role: myRole } = useWorkspace();
  const { members, isLoading } = useMembers();
  const { accounts } = useAccounts();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inviteOpen = params.get('invite') === '1';
  const setInviteOpen = (o: boolean) => router.replace(o ? `${pathname}?invite=1` : pathname, { scroll: false });

  const invites = useQuery({
    queryKey: ['invites', workspace.id],
    enabled: can.admin,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', workspace.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkspaceInvite[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.members(workspace.id) });
    qc.invalidateQueries({ queryKey: ['invites', workspace.id] });
  };

  async function changeRole(m: Member, role: Role) {
    const { error } = await getSupabase().from('workspace_members').update({ role }).eq('workspace_id', workspace.id).eq('user_id', m.user_id);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${m.profile.full_name || m.profile.email} is now ${ROLE_LABELS[role]}`);
    refresh();
    if (m.user_id === userId) router.refresh();
  }

  async function remove(m: Member) {
    const self = m.user_id === userId;
    const ok = await confirm({
      title: self ? `Leave ${workspace.name}?` : `Remove ${m.profile.full_name || m.profile.email}?`,
      description: self
        ? 'You will lose access to this workspace until someone invites you again.'
        : 'They lose access immediately. Their leads stay in the workspace; their WhatsApp numbers stop sending until reassigned or removed.',
      confirmLabel: self ? 'Leave' : 'Remove',
      danger: true,
    });
    if (!ok) return;
    const { error } = await getSupabase().from('workspace_members').delete().eq('workspace_id', workspace.id).eq('user_id', m.user_id);
    if (error) return toast.error(errorMessage(error));
    if (self) {
      router.replace('/dashboard');
      router.refresh();
      return;
    }
    toast.success('Member removed');
    refresh();
  }

  async function revoke(inv: WorkspaceInvite) {
    const { error } = await getSupabase().from('workspace_invites').delete().eq('id', inv.id);
    if (error) return toast.error(errorMessage(error));
    refresh();
  }

  const roleOptions: Role[] = myRole === 'owner' ? ['owner', 'admin', 'member', 'viewer'] : ['admin', 'member', 'viewer'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Members"
          description={`${members.length} ${members.length === 1 ? 'person' : 'people'} in ${workspace.name}`}
          action={
            can.admin && (
              <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus /> Invite
              </Button>
            )
          }
        />
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Role</Th>
                <Th>WhatsApp</Th>
                <Th>Joined</Th>
                <Th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <Td colSpan={5} className="text-muted">
                    Loading…
                  </Td>
                </tr>
              )}
              {members.map((m) => {
                const nums = accounts.filter((a) => a.owner_id === m.user_id);
                const online = nums.filter((a) => a.status === 'connected').length;
                const editable = can.admin && (m.role !== 'owner' || myRole === 'owner');
                return (
                  <Tr key={m.user_id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={m.profile.full_name || m.profile.email} src={m.profile.avatar_url} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {m.profile.full_name || '—'} {m.user_id === userId && <span className="text-xs font-normal text-subtle">(you)</span>}
                          </div>
                          <div className="truncate text-xs text-muted">{m.profile.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {editable && m.user_id !== userId ? (
                        <NativeSelect inputSize="sm" className="w-32" value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)}>
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>{ROLE_LABELS[m.role]}</Badge>
                      )}
                    </Td>
                    <Td>
                      {nums.length ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px]">
                          <Smartphone className="size-3.5 text-subtle" />
                          {online}/{nums.length} connected
                        </span>
                      ) : (
                        <span className="text-[13px] text-subtle">None</span>
                      )}
                    </Td>
                    <Td className="text-[13px] text-muted">{timeAgo(m.created_at)}</Td>
                    <Td>
                      {(editable || m.user_id === userId) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="Member actions">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {m.user_id === userId ? (
                              <DropdownMenuItem danger onSelect={() => remove(m)}>
                                <LogOut /> Leave workspace
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem danger onSelect={() => remove(m)}>
                                <UserMinus /> Remove from workspace
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      {can.admin && (
        <Card>
          <CardHeader title="Pending invites" description="Links expire after 7 days and work once." />
          {invites.data?.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {invites.data.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                return (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Link2 className="size-4 text-subtle" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{inv.email ?? 'Anyone with the link'}</div>
                      <div className="text-xs text-muted">
                        {ROLE_LABELS[inv.role]} · {expired ? <span className="text-danger">expired</span> : `expires ${timeAgo(inv.expires_at)}`}
                      </div>
                    </div>
                    {!expired && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void navigator.clipboard.writeText(inviteUrl(inv.token));
                          toast.success('Invite link copied');
                        }}
                      >
                        <Copy /> Copy link
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" onClick={() => revoke(inv)} aria-label="Revoke invite">
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-t border-border px-5 py-6 text-[13px] text-muted">No pending invites.</div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Roles" description="What each role can do." />
        <ul className="grid gap-px overflow-hidden border-t border-border bg-border sm:grid-cols-2">
          {(['owner', 'admin', 'member', 'viewer'] as Role[]).map((r) => (
            <li key={r} className="bg-surface px-5 py-3">
              <div className="text-[13px] font-medium">{ROLE_LABELS[r]}</div>
              <div className="text-xs text-muted">{ROLE_DESCRIPTIONS[r]}</div>
            </li>
          ))}
        </ul>
      </Card>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onCreated={refresh} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { workspace, userId, can } = useWorkspace();
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<Exclude<Role, 'owner'>>('member');
  const [link, setLink] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setEmail('');
      setRole('member');
      setLink(null);
    }
  }, [open]);

  async function create() {
    setBusy(true);
    const { data, error } = await getSupabase()
      .from('workspace_invites')
      .insert({ workspace_id: workspace.id, email: email.trim().toLowerCase() || null, role, invited_by: userId })
      .select('token')
      .single();
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    const url = inviteUrl(data.token);
    setLink(url);
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    onCreated();
  }

  if (!can.admin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Invite a teammate" description="They’ll create a password and can then connect their own WhatsApp.">
        {link ? (
          <>
            <DialogBody className="space-y-4">
              <Callout tone="success" title="Invite link created and copied">
                Send it to your teammate on WhatsApp, Slack or email. It works once and expires in 7 days.
              </Callout>
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(link);
                    toast.success('Copied');
                  }}
                >
                  <Copy /> Copy
                </Button>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setLink(null)}>
                Invite another
              </Button>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="space-y-4">
              <Field label="Email" optional hint="Lock the link to one email address. Leave empty for a link anyone can use once.">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
              </Field>
              <Field label="Role">
                <div className="grid gap-2">
                  {(['admin', 'member', 'viewer'] as const).map((r) => (
                    <label key={r} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                      <input type="radio" name="role" className="mt-1 accent-[var(--primary)]" checked={role === r} onChange={() => setRole(r)} />
                      <div>
                        <div className="text-[13px] font-medium">{ROLE_LABELS[r]}</div>
                        <div className="text-xs text-muted">{ROLE_DESCRIPTIONS[r]}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={create} loading={busy}>
                <Link2 /> Create invite link
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { DropdownMenuLabel, DropdownMenuSeparator };
