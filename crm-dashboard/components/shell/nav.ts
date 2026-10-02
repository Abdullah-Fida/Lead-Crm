import {
  BarChart3,
  CheckSquare,
  FileText,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  MapPin,
  Send,
  Settings,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: 'inbox' | 'tasks';
  status?: 'whatsapp';
  keywords?: string;
}

export const NAV: Array<{ group: string | null; items: NavItem[] }> = [
  {
    group: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview' },
      { href: '/inbox', label: 'Inbox', icon: Inbox, badge: 'inbox', keywords: 'chats replies conversations messages' },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare, badge: 'tasks', keywords: 'todo reminders follow up' },
    ],
  },
  {
    group: 'Leads',
    items: [
      { href: '/leads', label: 'All leads', icon: Users, keywords: 'contacts businesses crm' },
      { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare, keywords: 'kanban deals stages board' },
      { href: '/scraper', label: 'Lead finder', icon: MapPin, keywords: 'scraper google maps search find' },
    ],
  },
  {
    group: 'Outreach',
    items: [
      { href: '/campaigns', label: 'Campaigns', icon: Send, keywords: 'broadcast bulk outreach sequences' },
      { href: '/templates', label: 'Templates', icon: FileText, keywords: 'messages snippets spintax' },
      { href: '/whatsapp', label: 'WhatsApp numbers', icon: Smartphone, status: 'whatsapp', keywords: 'connect qr scan accounts phone' },
    ],
  },
  {
    group: 'Insights',
    items: [{ href: '/analytics', label: 'Analytics', icon: BarChart3, keywords: 'reports stats performance team' }],
  },
];

export const SETTINGS_ITEM: NavItem = { href: '/settings', label: 'Settings', icon: Settings, keywords: 'team members invite workspace profile' };

export const ALL_NAV_ITEMS = [...NAV.flatMap((g) => g.items), SETTINGS_ITEM];
