import { NavLink } from 'react-router-dom';

// ─── icons ────────────────────────────────────────────────────────────────────
const Icons = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M2 2.75A.75.75 0 0 1 2.75 2h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-3.5A.75.75 0 0 1 2 6.25v-3.5ZM2 9.75A.75.75 0 0 1 2.75 9h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-3.5A.75.75 0 0 1 2 13.25v-3.5ZM9 2.75A.75.75 0 0 1 9.75 2h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-3.5A.75.75 0 0 1 9 6.25v-3.5ZM9.75 9a.75.75 0 0 0-.75.75v3.5c0 .414.336.75.75.75h3.5a.75.75 0 0 0 .75-.75v-3.5A.75.75 0 0 0 13.25 9h-3.5Z"/>
    </svg>
  ),
  vendors: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z"/>
    </svg>
  ),
  verticals: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M1 9.5A3.5 3.5 0 0 0 4.5 13H12a3 3 0 0 0 .917-5.857 5 5 0 0 0-9.876.494A3.501 3.501 0 0 0 1 9.5Z"/>
    </svg>
  ),
  kpis: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L7.737 9.852a.75.75 0 0 0-1.05 1.072l2.5 2.45a.75.75 0 0 0 1.05 0l2.5-2.45a.75.75 0 1 0-1.05-1.072l-1.487 1.457V2.75ZM3.5 4.25a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0v-7ZM6.25 7a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 6.25 7Z"/>
    </svg>
  ),
  submit: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M4 2a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V6.621a1.5 1.5 0 0 0-.44-1.06L9.94 2.439A1.5 1.5 0 0 0 8.878 2H4Zm4 3.5a.75.75 0 0 1 .75.75v2.69l.72-.72a.75.75 0 1 1 1.06 1.06l-2 2a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l.72.72V6.25A.75.75 0 0 1 8 5.5Z" clipRule="evenodd"/>
    </svg>
  ),
  logout: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 0 1 4.75 2h3a2.75 2.75 0 0 1 2.75 2.75v.5a.75.75 0 0 1-1.5 0v-.5c0-.69-.56-1.25-1.25-1.25h-3c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h3c.69 0 1.25-.56 1.25-1.25v-.5a.75.75 0 0 1 1.5 0v.5A2.75 2.75 0 0 1 7.75 14h-3A2.75 2.75 0 0 1 2 11.25v-6.5Zm9.47.47a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 1 1-1.06-1.06l.97-.97H6.75a.75.75 0 0 1 0-1.5h5.69l-.97-.97a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
    </svg>
  ),
};

// ─── nav link ─────────────────────────────────────────────────────────────────
function LinkItem({ to, icon, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 transition-colors'}>
            {icon}
          </span>
          {children}
        </>
      )}
    </NavLink>
  );
}

// ─── section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="mt-5 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
      {children}
    </p>
  );
}

// ─── role badge ───────────────────────────────────────────────────────────────
const ROLE_STYLES = {
  admin:  'bg-violet-100 text-violet-700 ring-violet-200',
  agency: 'bg-sky-100    text-sky-700    ring-sky-200',
  user:   'bg-slate-100  text-slate-500  ring-slate-200',
};

// ─── sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({ role, onLogout }) {
  const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.user;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white h-screen sticky top-0 overflow-hidden">

      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
        {/* logo mark */}
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 text-white">
            <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v2A1.5 1.5 0 0 1 13.5 7h-11A1.5 1.5 0 0 1 1 5.5v-2ZM1 9.5A1.5 1.5 0 0 1 2.5 8h5A1.5 1.5 0 0 1 9 9.5v3A1.5 1.5 0 0 1 7.5 14h-5A1.5 1.5 0 0 1 1 12.5v-3ZM10.5 8a1.5 1.5 0 0 0-1.5 1.5v3A1.5 1.5 0 0 0 10.5 14H13a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 13 8h-2.5Z"/>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-none">Command Centre</p>
          <p className="mt-0.5 text-[11px] text-slate-400 leading-none">Performance Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">

        <SectionLabel>Overview</SectionLabel>
        <LinkItem to="/" icon={Icons.dashboard} end>Dashboard</LinkItem>

        {role === 'admin' ? (
          <>
            <SectionLabel>Admin</SectionLabel>
            <LinkItem to="/admin/vendors"   icon={Icons.vendors}>Vendor Management</LinkItem>
            <LinkItem to="/admin/verticals" icon={Icons.verticals}>Verticals</LinkItem>
            <LinkItem to="/admin/kpis"      icon={Icons.kpis}>KPI Management</LinkItem>
            <LinkItem to="/admin/submissions" icon={Icons.submit}>Submissions</LinkItem>
          </>
        ) : (
          <>
            <SectionLabel>Vendor</SectionLabel>
            <LinkItem to="/submit" icon={Icons.submit}>Submission</LinkItem>
          </>
        )}
      </nav>

      {/* Footer: role + logout */}
      <div className="border-t border-slate-100 px-3 py-3 space-y-1">
        {/* role chip */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ring-1 ${roleStyle}`}>
            {role}
          </span>
        </div>

        {/* logout */}
        <button
          type="button"
          onClick={onLogout}
          className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          <span className="text-slate-400 transition-colors group-hover:text-rose-500">{Icons.logout}</span>
          Logout
        </button>
      </div>

    </aside>
  );
}