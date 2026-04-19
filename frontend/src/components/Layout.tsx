import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';
import {
  CircleUser,
  FolderKanban,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users2,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users2 },
  { to: '/roles', label: 'Roles', icon: ShieldCheck },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

// Renders the main authenticated application shell.
export default function Layout() {
  const { logout, permissions, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="grid min-h-screen w-full grid-cols-[240px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950 text-slate-100">
          <div className="px-4 pb-3 pt-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/5">
                <ShieldCheck className="h-4 w-4 text-slate-100" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight text-slate-100">
                  RBAC Admin
                </div>
                <div className="text-xs text-slate-400">Admin dashboard</div>
              </div>
            </div>
          </div>

          <nav className="px-2 pb-4" aria-label="Primary">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition-colors',
                      'hover:bg-white/10 hover:text-white',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                      isActive && 'bg-white/10 text-white'
                    )
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
        </aside>

        <div className="flex min-w-0 w-full flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-6 lg:px-8">
            <div className="min-w-0 truncate text-2xl font-semibold tracking-tight text-slate-900">
              {pageTitle}
            </div>
            <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="User menu"
                  disabled={loggingOut}
                  className="rounded-full border border-slate-200 bg-white/60 hover:bg-slate-50"
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

          <main className="flex-1 min-w-0 w-full px-4 py-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-none">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
