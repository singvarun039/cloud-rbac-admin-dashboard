import { NavLink, Outlet } from "react-router-dom";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/users", label: "Users" },
  { to: "/roles", label: "Roles" },
  { to: "/projects", label: "Projects" },
  { to: "/audit-logs", label: "Audit Logs" },
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
          <div className="p-4">
            <div className="text-sm font-semibold tracking-tight">
              RBAC Admin
            </div>
          </div>
          <nav className="px-2 pb-4">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "block rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white",
                    isActive && "bg-white/10 text-white",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
            <div className="min-w-0 truncate text-sm font-semibold tracking-tight">
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

          <main className="flex-1 px-4 py-6">
            <div className="mx-auto w-full max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
