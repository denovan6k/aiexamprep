import {
  Activity,
  BookOpen,
  Bot,
  Compass,
  CreditCard,
  FileText,
  FolderOpen,
  Layers,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Newspaper,
  // Search,
  Settings,
  Shield,
  Sun,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
  matchPrefixes?: string[];
  defaultOpen?: boolean;
};

export const accountNavItems: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings, exact: true },
  { label: "Models", href: "/settings/models", icon: Bot },
  { label: "Billing", href: "/settings/billing", icon: CreditCard }
];

export const adminNavItems: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
  { label: "Moderation", href: "/admin/moderation", icon: Shield },
  { label: "Support", href: "/admin/support", icon: Mail },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Blog", href: "/dashboard/blog", icon: Newspaper }
];

export const adminNavSection: NavSection = {
  id: "admin",
  title: "Admin",
  items: adminNavItems,
  defaultOpen: true,
  matchPrefixes: ["/admin", "/dashboard/blog"]
};

/** Full workspace nav — same order as the original flat sidebar. */
export const workspaceNavItems: NavItem[] = [
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Projects", href: "/projects", icon: Workflow },
  { label: "Today", href: "/dashboard", icon: Sun },
  // { label: "Search", href: "/search", icon: Search },
  { label: "Courses", href: "/courses", icon: FolderOpen },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "CV Tailor", href: "/cv", icon: FileText },
  { label: "Quizzes", href: "/quizzes", icon: BookOpen },
  { label: "Flashcards", href: "/flashcards", icon: Layers },
  { label: "Progress", href: "/progress", icon: TrendingUp },
  { label: "Usage", href: "/usage", icon: Activity },
  { label: "Community", href: "/community", icon: Users }
];

export const workspaceNavSections: NavSection[] = [
  {
    id: "workspace",
    title: "Workspace",
    items: workspaceNavItems,
    defaultOpen: true,
    matchPrefixes: [
      "/dashboard",
      "/chat",
      "/projects",
      // "/search",
      "/courses",
      "/agents",
      "/cv",
      "/quizzes",
      "/flashcards",
      "/progress",
      "/usage",
      "/community"
    ]
  }
];

export const communityBrowseItems: NavItem[] = [
  { label: "Discover", href: "/community", icon: Compass, exact: true },
  { label: "Groups", href: "/community/groups", icon: Users },
  { label: "Blog", href: "/blog", icon: BookOpen }
];

export function isActiveRoute(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function sectionHasActiveRoute(pathname: string, section: NavSection) {
  if (section.matchPrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  return section.items.some((item) => isActiveRoute(pathname, item.href, item.exact));
}
