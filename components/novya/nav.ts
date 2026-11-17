// Sidebar navigation for every area of the Support dashboard (supporter-dashboard.pdf).
import type { LucideIcon } from "lucide-react";
import {
  Accessibility, BadgeEuro, BarChart3, BookOpen, Brain, Calendar, CheckSquare, ClipboardList, FileText, Folder,
  FolderKanban, Gauge, GraduationCap, HardDrive, Headphones, History, Image, Inbox, Layers, LayoutGrid, LifeBuoy,
  ListChecks, Package, Presentation, Search, Settings, Shield, ShieldCheck, Sheet, SlidersHorizontal,
  Sparkles, Stethoscope, TrendingUp, Upload, UserRound, Users, Workflow, Zap, Bell, Siren, Briefcase,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; title?: string };
export type NavArea = {
  key: string;
  match: (p: string) => boolean;
  back?: { href: string; label: string }[];
  items: NavItem[];
  recentConversations?: boolean;
};

export const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/queue", label: "Queue", icon: Headphones },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/workspace", label: "Workspace", icon: Package },
];
export const leadNav: NavItem = { href: "/team", label: "Teamleader", icon: Users };

const under = (base: string) => (p: string) => p === base || p.startsWith(base + "/");

export const areas: NavArea[] = [
  {
    key: "assistant",
    match: under("/assistant"),
    back: [{ href: "/dashboard", label: "Back to Dashboard" }],
    recentConversations: true,
    items: [
      { href: "/assistant", label: "New Chat", icon: Sparkles, title: "Assistant" },
      { href: "/assistant/folders", label: "Folders", icon: Folder, title: "Assistant · Folders" },
      { href: "/assistant/investigations", label: "Investigations", icon: Search, title: "Kora · Investigations" },
      { href: "/assistant/actions", label: "Actions", icon: Zap, title: "Assistant · Actions" },
      { href: "/assistant/brain", label: "Brain", icon: Brain, title: "Assistant · Brain" },
      { href: "/assistant/history", label: "History", icon: History, title: "Assistant · History" },
    ],
  },
  {
    key: "learn-help",
    match: under("/learn/help"),
    back: [
      { href: "/dashboard", label: "Back to Dashboard" },
      { href: "/learn", label: "Back to Learn" },
    ],
    items: [
      { href: "/learn", label: "Overview", icon: LayoutGrid, title: "Learn" },
      { href: "/learn/knowledge", label: "Knowledge", icon: BookOpen, title: "Learn" },
      { href: "/learn/courses", label: "Courses", icon: Layers, title: "Learn" },
      { href: "/learn/progress", label: "My Progress", icon: TrendingUp, title: "Learn" },
      { href: "/learn/help", label: "Help Center", icon: LifeBuoy, title: "Learn" },
    ],
  },
  {
    key: "learn",
    match: under("/learn"),
    back: [{ href: "/dashboard", label: "Back to Dashboard" }],
    items: [
      { href: "/learn", label: "Overview", icon: LayoutGrid, title: "Learn" },
      { href: "/learn/knowledge", label: "Knowledge", icon: BookOpen, title: "Learn" },
      { href: "/learn/courses", label: "Courses", icon: Layers, title: "Learn" },
      { href: "/learn/progress", label: "My Progress", icon: TrendingUp, title: "Learn" },
      { href: "/learn/help", label: "Help Center", icon: LifeBuoy, title: "Learn" },
    ],
  },
  {
    key: "support-hub",
    match: under("/workspace/support"),
    back: [{ href: "/workspace", label: "Back to Workspace" }],
    items: [
      { href: "/workspace/support", label: "Overview", icon: LayoutGrid, title: "Support Hub" },
      { href: "/workspace/support/cases", label: "Cases", icon: Briefcase, title: "Cases" },
      { href: "/workspace/support/users", label: "Users", icon: Users, title: "Users" },
      { href: "/workspace/support/investigations", label: "Investigations", icon: Search, title: "Investigations" },
      { href: "/workspace/support/escalations", label: "Escalations", icon: Siren, title: "Escalations" },
      { href: "/workspace/support/diagnostics", label: "Diagnostics", icon: Stethoscope, title: "Diagnostics" },
      { href: "/workspace/support/quality", label: "Quality & SLA", icon: Gauge, title: "Quality & SLA" },
    ],
  },
  {
    key: "office",
    match: under("/workspace/office"),
    back: [
      { href: "/dashboard", label: "Back to Dashboard" },
      { href: "/workspace", label: "Back to Workspace" },
    ],
    items: [
      { href: "/workspace/office", label: "Overview", icon: LayoutGrid, title: "Office" },
      { href: "/workspace/office/docs", label: "Docs", icon: FileText, title: "Docs" },
      { href: "/workspace/office/sheets", label: "Sheets", icon: Sheet, title: "Sheets" },
      { href: "/workspace/office/presentations", label: "Presentations", icon: Presentation, title: "Presentations" },
      { href: "/workspace/office/transfers", label: "Imports & Exports", icon: Upload, title: "Imports & Exports" },
    ],
  },
  {
    key: "media",
    match: under("/workspace/media"),
    back: [
      { href: "/dashboard", label: "Back to Dashboard" },
      { href: "/workspace", label: "Back to Workspace" },
    ],
    items: [
      { href: "/workspace/media", label: "Overview", icon: LayoutGrid, title: "Media" },
      { href: "/workspace/media/library", label: "Library", icon: Image, title: "Media" },
      { href: "/workspace/media/upload", label: "Upload", icon: Upload, title: "Media" },
      { href: "/workspace/media/collections", label: "Collections", icon: Layers, title: "Media" },
      { href: "/workspace/media/brand-assets", label: "Brand Assets", icon: Sparkles, title: "Media" },
      { href: "/workspace/media/storage", label: "Storage", icon: HardDrive, title: "Media" },
    ],
  },
  {
    key: "workspace",
    match: (p) => p === "/workspace",
    back: [{ href: "/dashboard", label: "Back to Support" }],
    items: [
      { href: "/workspace", label: "Overview", icon: LayoutGrid, title: "Workspace" },
      { href: "/workspace/support", label: "Support", icon: Inbox, title: "Support Hub" },
      { href: "/workspace/office", label: "Office", icon: CheckSquare, title: "Office" },
      { href: "/workspace/media", label: "Media", icon: Image, title: "Media" },
    ],
  },
  {
    key: "team",
    match: under("/team"),
    back: [{ href: "/dashboard", label: "Back to Dashboard" }],
    items: [
      { href: "/team", label: "Overview", icon: LayoutGrid, title: "Teamleader" },
      { href: "/team/tasks", label: "Tasks", icon: ListChecks, title: "Tasks" },
      { href: "/team/supporters", label: "Supporters", icon: Users, title: "Supporters" },
      { href: "/team/queue-assignments", label: "Queue Assignments", icon: ClipboardList, title: "Queue Assignments" },
      { href: "/team/cases", label: "Team Cases", icon: FolderKanban, title: "Open Cases" },
      { href: "/team/portfolios", label: "Partner Portfolios", icon: BarChart3, title: "Partner Portfolios" },
      { href: "/team/performance", label: "Performance & Coach", icon: TrendingUp, title: "Performance & Coaching" },
      { href: "/team/credits", label: "Credits & Approvals", icon: BadgeEuro, title: "Credits & Approvals" },
    ],
  },
  {
    key: "settings",
    match: under("/settings"),
    back: [{ href: "/dashboard", label: "Back to Dashboard" }],
    items: [
      { href: "/settings", label: "Overview", icon: LayoutGrid, title: "Support Settings" },
      { href: "/settings/profile", label: "Profile", icon: UserRound, title: "Support Settings" },
      { href: "/settings/security", label: "Account & Security", icon: Shield, title: "Support Settings" },
      { href: "/settings/notifications", label: "Notifications", icon: Bell, title: "Support Settings" },
      { href: "/settings/preferences", label: "Work Preferences", icon: SlidersHorizontal, title: "Support Settings" },
      { href: "/settings/privacy", label: "Privacy & Sessions", icon: ShieldCheck, title: "Support Settings" },
      { href: "/settings/accessibility", label: "App & Accessibility", icon: Accessibility, title: "Support Settings" },
    ],
  },
];

/** Header titles for routes that are not sidebar items (design header text). */
const extraTitles: [string, string][] = [
  ["/assistant/c", "Assistant · Conversation"],
  ["/queue", "Queue"],
  ["/tasks", "Tasks"],
  ["/inbox", "Inbox"],
  ["/calendar", "Calendar"],
  ["/workflows", "Workflows"],
  ["/dashboard", "Overview"],
];

export function areaFor(pathname: string) {
  return areas.find((a) => a.match(pathname)) || null;
}

export function titleFor(pathname: string) {
  const area = areaFor(pathname);
  const candidates: [string, string][] = [
    ...(area?.items || []).map((i) => [i.href, i.title || i.label] as [string, string]),
    ...extraTitles,
    ...mainNav.map((i) => [i.href, i.label] as [string, string]),
  ];
  const hit = candidates
    .filter(([href]) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] || "Support";
}

export const accountMenu: NavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: UserRound },
  { href: "/settings/security", label: "Account & Security", icon: Shield },
  { href: "/settings/privacy", label: "Privacy & Sessions", icon: ShieldCheck },
  { href: "/settings/accessibility", label: "App & Accessibility", icon: Accessibility },
  { href: "/settings", label: "Settings", icon: Settings },
];

