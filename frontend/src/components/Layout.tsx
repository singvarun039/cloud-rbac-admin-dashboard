import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearAccessToken } from '../auth/token'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/users', label: 'Users' },
  { to: '/roles', label: 'Roles' },
  { to: '/projects', label: 'Projects' },
  { to: '/audit-logs', label: 'Audit Logs' },
]

export default function Layout() {
  const navigate = useNavigate()

  function onLogout() {
    clearAccessToken()
    navigate('/login', { replace: true })
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
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
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
          <button className="btn" onClick={onLogout} type="button">
            Logout
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
