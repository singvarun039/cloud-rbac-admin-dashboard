import { NavLink, Outlet } from "react-router-dom";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import {
  FolderKanban,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users2,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Users", icon: Users2 },
  { to: "/roles", label: "Roles", icon: ShieldCheck },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export default function Layout() {
  const { logout, permissions } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const canReadUsers = permissions.includes("users.read");
  const canReadRoles = permissions.includes("roles.read");
  const canReadProjects = permissions.includes("projects.read");
  const canReadAuditLogs = permissions.includes("audit.read");

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.to === "/users") return canReadUsers;
      if (item.to === "/roles") return canReadRoles;
      if (item.to === "/projects") return canReadProjects;
      if (item.to === "/audit-logs") return canReadAuditLogs;
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950 text-slate-100">
          <div className="px-4 pb-3 pt-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/5">
                <ShieldCheck
                  className="h-4 w-4 text-slate-100"
                  aria-hidden="true"
                />
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
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition-colors",
                      "hover:bg-white/10 hover:text-white",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                      isActive && "bg-white/10 text-white",
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

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-6">
            <div className="min-w-0 truncate text-sm font-semibold tracking-tight text-slate-900">
              Cloud-Ready RBAC Admin Dashboard
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              type="button"
              disabled={loggingOut}
            >
              {loggingOut ? "Logging out…" : "Logout"}
            </Button>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
