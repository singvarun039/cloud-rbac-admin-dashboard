import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
} from './ui/drawer';
import { cn } from '../lib/utils';
import {
  CircleUser,
  FolderKanban,
  LayoutDashboard,
  Menu,
  ScrollText,
  ShieldCheck,
  Users2,
  X,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users2 },
  { to: '/roles', label: 'Roles', icon: ShieldCheck },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

// Shared sidebar nav content rendered in both desktop sidebar and mobile drawer.
function SidebarContent({
  visibleNavItems,
  onNavClick,
}: {
  visibleNavItems: typeof navItems;
  onNavClick?: () => void;
}) {
  return (
    <>
      <div className="px-4 pb-3 pt-4">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <ShieldCheck className="h-4 w-4 text-slate-100" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-slate-100">RBAC Admin</div>
            <div className="text-xs text-slate-400">Admin dashboard</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 pb-4" aria-label="Primary">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavClick}
              className={({ isActive }) =>
                cn('nav-item group', isActive && 'nav-item-active')
              }
            >
              <Icon
                className="h-4 w-4 flex-none text-slate-400 transition-colors group-hover:text-slate-100"
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}

// Renders the main authenticated application shell.
export default function Layout() {
  const { logout, permissions, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  const pageTitle = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const titles: Record<string, string> = {
      '/': 'Dashboard',
      '/users': 'Users',
      '/roles': 'Roles',
      '/projects': 'Projects',
      '/audit-logs': 'Audit Logs',
    };
    return titles[path] ?? '';
  }, [location.pathname]);

  const canReadUsers = permissions.includes('users.read');
  const canReadRoles = permissions.includes('roles.read');
  const canReadProjects = permissions.includes('projects.read');
  const canReadAuditLogs = permissions.includes('audit.read');

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.to === '/users') return canReadUsers;
      if (item.to === '/roles') return canReadRoles;
      if (item.to === '/projects') return canReadProjects;
      if (item.to === '/audit-logs') return canReadAuditLogs;
      return true;
    });
  }, [canReadAuditLogs, canReadProjects, canReadRoles, canReadUsers]);

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      {/* Mobile nav drawer (slides from left) */}
      <Drawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} direction="left">
        <DrawerContent className="inset-y-0 left-0 h-full w-64 rounded-none border-r border-slate-800 bg-slate-950 text-slate-100">
          <DrawerClose
            className="absolute right-3 top-3 rounded-sm text-slate-400 opacity-70 transition-opacity hover:text-white hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </DrawerClose>
          <SidebarContent
            visibleNavItems={visibleNavItems}
            onNavClick={() => setMobileNavOpen(false)}
          />
        </DrawerContent>
      </Drawer>

      <div className="app-shell-inner">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="app-sidebar">
          <SidebarContent visibleNavItems={visibleNavItems} />
        </aside>

        {/* Main content column */}
        <div className="flex min-w-0 w-full flex-col">
          <header className="app-header">
            <div className="flex min-w-0 items-center gap-3">
              {/* Hamburger — visible only on mobile */}
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Open navigation"
                className="shrink-0 rounded-md border border-slate-200 bg-white/60 hover:bg-slate-50 lg:hidden"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5 text-slate-700" aria-hidden="true" />
              </Button>
              <div className="min-w-0 truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {pageTitle}
              </div>
            </div>

            <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="User menu"
                  disabled={loggingOut}
                  className="shrink-0 rounded-full border border-slate-200 bg-white/60 hover:bg-slate-50"
                >
                  <CircleUser className="h-5 w-5 text-slate-700" aria-hidden="true" />
                </Button>
              </PopoverTrigger>

              <PopoverContent align="end" className="w-64 p-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900">
                    {user?.name || 'Signed in'}
                  </div>
                  <div className="break-all text-xs text-muted-foreground">
                    {user?.email || '—'}
                  </div>
                </div>

                <div className="-mx-3 my-3 h-px bg-slate-200" />

                <Button
                  variant="ghost"
                  type="button"
                  className="h-9 w-full justify-start text-red-600 hover:bg-slate-100 hover:text-red-600"
                  onClick={async () => {
                    setUserMenuOpen(false);
                    await onLogout();
                  }}
                >
                  Logout
                </Button>
              </PopoverContent>
            </Popover>
          </header>

          <main className="app-main">
            <div className="w-full max-w-none">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
