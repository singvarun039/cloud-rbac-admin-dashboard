import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/useAuth";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/users", label: "Users" },
  { to: "/roles", label: "Roles" },
  { to: "/projects", label: "Projects" },
  { to: "/audit-logs", label: "Audit Logs" },
];

export default function Layout() {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

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
      <aside className="sidebar">
        <div className="sidebar-title">RBAC Admin</div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Cloud-Ready RBAC Admin Dashboard</div>
          <button
            className="btn"
            onClick={onLogout}
            type="button"
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
