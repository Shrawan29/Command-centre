import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

// ─── role badge ───────────────────────────────────────────────────────────────
const ROLE_STYLES = {
  admin:  'bg-violet-100 text-violet-700 ring-violet-200',
  agency: 'bg-sky-100    text-sky-700    ring-sky-200',
  user:   'bg-slate-100  text-slate-600  ring-slate-200',
};
function roleBadge(role = 'user') {
  const style = ROLE_STYLES[role] ?? ROLE_STYLES.user;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ring-1 ${style}`}>
      {role}
    </span>
  );
}

// ─── avatar initials ──────────────────────────────────────────────────────────
function Avatar({ name = '', size = 'md' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const sz = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs';

  return (
    <div className={`${sz} flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-semibold text-white select-none`}>
      {initials || '?'}
    </div>
  );
}

export default function AppLayout({ session, onLogout }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  // derive a page title from the current path
  const pageTitle = (() => {
    const seg = location.pathname.split('/').filter(Boolean)[0] || 'overview';
    return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
  })();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <Sidebar
        role={session.role}
        onLogout={() => {
          onLogout();
          navigate('/login');
        }}
      />

      {/* ── Main column ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 flex-col">

        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur-sm">

          {/* Left: breadcrumb / page title */}
          <div className="flex items-center gap-2 min-w-0">
            {/* subtle home dot */}
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0"/>
            <h2 className="truncate text-sm font-semibold text-slate-800">{pageTitle}</h2>
          </div>

          {/* Right: user identity block */}
          <div className="flex items-center gap-3 shrink-0">
            {roleBadge(session.role)}

            {/* divider */}
            <span className="h-4 w-px bg-slate-200"/>

            {/* name + email */}
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-slate-800">
                {session?.name || 'User'}
              </span>
              {session?.email && (
                <span className="text-[11px] text-slate-400">{session.email}</span>
              )}
            </div>

            {/* avatar */}
            <Avatar name={session?.name || session?.email || 'U'} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-100 bg-white px-6 py-3">
          <p className="text-[11px] text-slate-400">
            &copy; {new Date().getFullYear()} &mdash; KPI Platform
          </p>
        </footer>

      </div>
    </div>
  );
}