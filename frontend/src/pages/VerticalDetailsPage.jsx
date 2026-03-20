import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getMyKPIs, getKPIs } from '../services/kpis.js';
import { getKPIProgress } from '../services/submissions.js';
import {
  createVertical,
  deleteVertical,
  getVerticalById,
  getVerticalDashboard,
  getVerticals,
  updateVertical,
} from '../services/verticals.js';
import { getSession } from '../services/session.js';

// ─── helpers ──────────────────────────────────────────────────────────────────
function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}
function monthLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function toLabel(v = '') { return v ? v.charAt(0).toUpperCase() + v.slice(1) : '—'; }

// ─── status tokens ────────────────────────────────────────────────────────────
const STATUS = {
  'On Track':  { badge: 'text-emerald-700 bg-emerald-50 ring-emerald-200', bar: 'bg-emerald-400', dot: 'bg-emerald-400' },
  'At Risk':   { badge: 'text-amber-700  bg-amber-50  ring-amber-200',    bar: 'bg-amber-400',   dot: 'bg-amber-400'   },
  'Behind':    { badge: 'text-rose-700   bg-rose-50   ring-rose-200',     bar: 'bg-rose-500',    dot: 'bg-rose-500'    },
  'Completed': { badge: 'text-sky-700    bg-sky-50    ring-sky-200',      bar: 'bg-sky-400',     dot: 'bg-sky-400'     },
};
function st(status) { return STATUS[status] ?? STATUS['Behind']; }

// ─── category tokens ──────────────────────────────────────────────────────────
const CAT = {
  revenue:      'text-violet-700 bg-violet-100 ring-violet-200',
  timeline:     'text-amber-700  bg-amber-100  ring-amber-200',
  brand:        'text-emerald-700 bg-emerald-100 ring-emerald-200',
  operations:   'text-cyan-700   bg-cyan-100   ring-cyan-200',
  growth:       'text-fuchsia-700 bg-fuchsia-100 ring-fuchsia-200',
  deliverables: 'text-sky-700    bg-sky-100    ring-sky-200',
};
function catTone(cat) { return CAT[cat] ?? CAT.deliverables; }

// ─── score ring ───────────────────────────────────────────────────────────────
function scoreRing(score) {
  if (score >= 75) return 'ring-emerald-400 text-emerald-600';
  if (score >= 50) return 'ring-amber-400   text-amber-600';
  return 'ring-rose-400 text-rose-600';
}

// ─── primitives ───────────────────────────────────────────────────────────────
function Feedback({ error, notice, onDismissError, onDismissNotice }) {
  return (
    <>
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd"/>
          </svg>
          <span className="flex-1">{error}</span>
          <button onClick={onDismissError} className="opacity-40 hover:opacity-100 transition-opacity">✕</button>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/>
          </svg>
          <span className="flex-1">{notice}</span>
          <button onClick={onDismissNotice} className="opacity-40 hover:opacity-100 transition-opacity">✕</button>
        </div>
      )}
    </>
  );
}

function LightInput({ value, onChange, placeholder, required, disabled }) {
  return (
    <input
      value={value} onChange={onChange} placeholder={placeholder}
      required={required} disabled={disabled}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
        placeholder:text-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100
        disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function FieldLabel({ children }) {
  return <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{children}</p>;
}

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`}/>;
}

// ─── KPI row ─────────────────────────────────────────────────────────────────
function KpiRow({ item }) {
  const s   = st(item.status);
  const pct = Math.min(100, Math.max(0, item.performance));
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${catTone(item.category)}`}>
              {toLabel(item.category)}
            </span>
            <span className="text-[10px] text-slate-400">{toLabel(item.unit)} · {toLabel(item.frequency)}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1 ${s.badge}`}>
          {item.status}
        </span>
      </div>
      <div className="mt-3">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`} style={{ width: `${pct}%` }}/>
          <div className="absolute top-0 bottom-0 w-px bg-slate-400/50" style={{ left: '80%' }}/>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
          <span>Actual <span className="font-medium text-slate-600">{item.total}</span></span>
          <span className="font-medium text-slate-500">{Math.round(pct)}%</span>
          <span>Target <span className="font-medium text-slate-600">{item.target}</span></span>
        </div>
      </div>
    </div>
  );
}

// ─── vendor card ─────────────────────────────────────────────────────────────
function VendorCard({ group }) {
  const [expanded, setExpanded] = useState(true);
  const perfList = group.items.map((x) => Number(x.performance || 0));
  const score    = perfList.length
    ? Math.min(100, Math.max(0, Math.round(perfList.reduce((s, p) => s + p, 0) / perfList.length)))
    : 0;
  const ring = scoreRing(score);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-4 text-left transition-colors hover:bg-slate-50/80"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{group.name}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{group.agencyType || group.email || 'Vendor'}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {money(group.contractValue)} · {monthLabel(group.engagementStart)} – {monthLabel(group.engagementEnd)}
              {group.primaryContact ? ` · ${group.primaryContact}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 ${ring} text-sm font-bold`}>
              {score}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd"/>
            </svg>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {['On Track', 'At Risk', 'Behind', 'Completed'].map((s) => {
            const count = group.items.filter((x) => x.status === s).length;
            if (!count) return null;
            return (
              <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ${st(s).badge}`}>
                <span className={`h-1 w-1 rounded-full ${st(s).dot}`}/>
                {count} {s}
              </span>
            );
          })}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {group.items.map((item) => <KpiRow key={item.id} item={item}/>)}
          {group.items.length === 0 && (
            <p className="py-2 text-xs text-slate-400">No KPIs assigned.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function VerticalDetailsPage() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const session   = getSession();

  const [vertical, setVertical]           = useState(null);
  const [verticals, setVerticals]         = useState([]);
  const [dashboard, setDashboard]         = useState(null);
  const [kpis, setKpis]                   = useState([]);
  const [progressByKpi, setProgressByKpi] = useState({});
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [notice, setNotice]               = useState('');
  const [busy, setBusy]                   = useState(false);

  const [showCreateForm, setShowCreateForm]       = useState(false);
  const [createName, setCreateName]               = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [editName, setEditName]                   = useState('');
  const [editDescription, setEditDescription]     = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function load(aliveRef = { current: true }) {
    setLoading(true); setError('');
    try {
      const [currentVertical, allVerticals, dash] = await Promise.all([
        getVerticalById(id),
        getVerticals(),
        getVerticalDashboard(id).catch(() => null),
      ]);
      if (!aliveRef.current) return;
      setVertical(currentVertical);
      setVerticals(Array.isArray(allVerticals) ? allVerticals : []);
      setDashboard(dash);

      const allKpis = session?.role === 'admin' ? await getKPIs() : await getMyKPIs();
      const filtered = (Array.isArray(allKpis) ? allKpis : []).filter((k) => {
        const verticalId = typeof k.vertical === 'string' ? k.vertical : k.vertical?._id;
        return verticalId === id;
      });
      if (!aliveRef.current) return;
      setKpis(filtered);

      const entries = await Promise.all(
        filtered.map(async (k) => {
          try { const p = await getKPIProgress(k._id); return [k._id, p]; }
          catch { return [k._id, null]; }
        })
      );
      if (!aliveRef.current) return;
      setProgressByKpi(Object.fromEntries(entries));
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e.message || 'Failed to load vertical details');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const ref = { current: true };
    load(ref);
    return () => { ref.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.role]);

  useEffect(() => {
    setEditName(vertical?.name || '');
    setEditDescription(vertical?.description || '');
  }, [vertical?.name, vertical?.description]);

  const vendorGroups = useMemo(() => {
    const groups = new Map();
    for (const kpi of kpis) {
      const assigned   = kpi.assignedTo;
      const vendorId   = typeof assigned === 'string' ? assigned : assigned?._id || 'unassigned';
      const vendorName = typeof assigned === 'string' ? assigned : assigned?.name || 'Unassigned Vendor';
      if (!groups.has(vendorId)) {
        groups.set(vendorId, {
          id: vendorId, name: vendorName,
          email: typeof assigned === 'object' ? assigned?.email || '' : '',
          agencyType: typeof assigned === 'object' ? assigned?.agencyType || '' : '',
          contractValue: typeof assigned === 'object' ? Number(assigned?.contractValue || 0) : 0,
          engagementStart: typeof assigned === 'object' ? assigned?.engagementStart || null : null,
          engagementEnd: typeof assigned === 'object' ? assigned?.engagementEnd || null : null,
          primaryContact: typeof assigned === 'object' ? assigned?.primaryContact || '' : '',
          items: [],
        });
      }
      const progress    = progressByKpi[kpi._id];
      const performance = Number(progress?.performance || 0);
      groups.get(vendorId).items.push({
        id: kpi._id, name: kpi.name,
        category: kpi.category || 'deliverables',
        unit: kpi.unit || 'number',
        frequency: kpi.frequency || 'monthly',
        status: progress?.status || 'Behind',
        performance,
        total: Number(progress?.total || 0),
        target: Number(progress?.target || kpi.target || 0),
      });
    }
    return Array.from(groups.values());
  }, [kpis, progressByKpi]);

  async function onCreateVertical(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const res = await createVertical({ name: createName, description: createDescription });
      const createdId = res?.vertical?._id;
      setCreateName(''); setCreateDescription(''); setShowCreateForm(false);
      setNotice(res?.message || 'Vertical created successfully.');
      if (createdId) navigate(`/verticals/${createdId}`); else await load();
    } catch (e2) { setError(e2.message || 'Failed to create vertical'); }
    finally { setBusy(false); }
  }

  async function onUpdateCurrentVertical(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await updateVertical(id, { name: editName, description: editDescription });
      setNotice('Vertical updated successfully.'); await load();
    } catch (e2) { setError(e2.message || 'Failed to update vertical'); }
    finally { setBusy(false); }
  }

  async function onDeleteVertical(verticalId) {
    setShowDeleteConfirm(false); setBusy(true); setError(''); setNotice('');
    try {
      const res = await deleteVertical(verticalId);
      setNotice(res?.message || 'Vertical deleted successfully.');
      const nextVerticals = await getVerticals();
      const list = Array.isArray(nextVerticals) ? nextVerticals : [];
      if (verticalId === id) {
        navigate(list[0]?._id ? `/verticals/${list[0]._id}` : '/');
      } else { await load(); }
    } catch (e2) { setError(e2.message || 'Failed to delete vertical'); }
    finally { setBusy(false); }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <Skeleton className="h-10 w-48"/>
          <div className="flex gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-24"/>)}</div>
          <Skeleton className="h-36"/>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-64"/>)}
          </div>
        </div>
      </div>
    );
  }

  const health     = dashboard?.healthScore ?? 0;
  const healthRing = scoreRing(health);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Vertical Details</p>
            <h1 className="mt-0.5 text-2xl font-bold text-slate-900 sm:text-3xl">Verticals</h1>
          </div>
          <button type="button" onClick={() => load({ current: true })} disabled={loading || busy}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-40 sm:self-auto">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`}>
              <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08 1.197.75.75 0 1 1-1.31-.734 6 6 0 0 1 9.44-1.595l.842.841V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.595l-.842-.841v1.018a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5H4.013l.84.841a4.5 4.5 0 0 0 7.08-1.197.75.75 0 0 1 .992-.008Z" clipRule="evenodd"/>
            </svg>
            Refresh
          </button>
        </div>

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        <Feedback error={error} notice={notice} onDismissError={() => setError('')} onDismissNotice={() => setNotice('')}/>

        {/* ── Vertical tabs ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5">
          {verticals.map((v) => (
            <button key={v._id} type="button" onClick={() => navigate(`/verticals/${v._id}`)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition
                ${v._id === id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-slate-300 hover:text-slate-700'}`}>
              {v.name}
            </button>
          ))}
        </div>

        {/* ── Vertical hero card ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{vertical?.name || 'Vertical'}</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">{vertical?.name || 'Vertical'}</h2>
              <p className="mt-1 text-sm text-slate-500 max-w-lg">{vertical?.description || 'No description provided.'}</p>
            </div>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-2 ${healthRing} text-base font-bold`}>
              {health}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
            {[
              { label: 'On Track',  value: dashboard?.onTrack   ?? 0, color: 'text-emerald-500' },
              { label: 'At Risk',   value: dashboard?.atRisk    ?? 0, color: 'text-amber-500'   },
              { label: 'Behind',    value: dashboard?.behind    ?? 0, color: 'text-rose-500'    },
              { label: 'Completed', value: dashboard?.completed ?? 0, color: 'text-sky-500'     },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Admin: vertical management ───────────────────────────────────── */}
        {session?.role === 'admin' && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-white">
                    <path fillRule="evenodd" d="M6.955 1.45A.75.75 0 0 1 7.624 1h.752a.75.75 0 0 1 .69.45l.26.606a6.03 6.03 0 0 1 1.323.763l.604-.262a.75.75 0 0 1 .86.22l.386.534a.75.75 0 0 1-.016.84l-.38.506a6.003 6.003 0 0 1 .05 1.51l.39.51a.75.75 0 0 1 .017.84l-.386.534a.75.75 0 0 1-.86.22l-.604-.262a6.03 6.03 0 0 1-1.323.763l-.26.606a.75.75 0 0 1-.69.45h-.752a.75.75 0 0 1-.69-.45l-.26-.606a6.03 6.03 0 0 1-1.323-.763l-.604.262a.75.75 0 0 1-.86-.22l-.386-.534a.75.75 0 0 1 .016-.84l.38-.506a6.003 6.003 0 0 1-.05-1.51l-.39-.51a.75.75 0 0 1-.017-.84l.386-.534a.75.75 0 0 1 .86-.22l.604.262a6.03 6.03 0 0 1 1.323-.763l.26-.606ZM8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-slate-800">Vertical Management</h2>
              </div>
              <button type="button" onClick={() => setShowCreateForm((v) => !v)} disabled={busy}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition
                  ${showCreateForm
                    ? 'border border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
                {showCreateForm ? 'Cancel' : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"/>
                    </svg>
                    Create Vertical
                  </>
                )}
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">New Vertical</p>
                <form id="create-vertical-form" onSubmit={onCreateVertical}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><FieldLabel>Name</FieldLabel><LightInput value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Vertical name" required disabled={busy}/></div>
                    <div><FieldLabel>Description</FieldLabel><LightInput value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Short description" disabled={busy}/></div>
                  </div>
                </form>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setShowCreateForm(false)} disabled={busy}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40">
                    Cancel
                  </button>
                  <button type="submit" form="create-vertical-form" disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">
                    {busy && <Spinner className="h-3.5 w-3.5"/>}
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* Edit current */}
            <div className="px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Edit Current Vertical</p>
              <form id="edit-vertical-form" onSubmit={onUpdateCurrentVertical}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><FieldLabel>Name</FieldLabel><LightInput value={editName} onChange={(e) => setEditName(e.target.value)} required disabled={busy}/></div>
                  <div><FieldLabel>Description</FieldLabel><LightInput value={editDescription} onChange={(e) => setEditDescription(e.target.value)} disabled={busy}/></div>
                </div>
              </form>
              <div className="mt-3 flex items-center gap-2">
                <button type="submit" form="edit-vertical-form" disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50">
                  {busy && <Spinner className="h-3.5 w-3.5"/>}
                  Save Changes
                </button>
                <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={busy}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-40">
                  Delete Vertical
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Vendors & KPIs ───────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">Vendors & KPIs</h2>
            {vendorGroups.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{vendorGroups.length}</span>
            )}
          </div>

          {vendorGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-slate-300 mb-3">
                <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z"/>
              </svg>
              <p className="text-sm font-medium text-slate-500">No vendor KPI data for this vertical.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {vendorGroups.map((group) => <VendorCard key={group.id} group={group}/>)}
            </div>
          )}
        </section>

        {/* ── Back link ────────────────────────────────────────────────────── */}
        <div className="pt-2">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd"/>
            </svg>
            Back to Dashboard
          </Link>
        </div>

      </div>

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-rose-600">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Delete Vertical</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    Permanently delete <span className="font-medium text-slate-800">"{vertical?.name}"</span>? This cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40">
                Cancel
              </button>
              <button type="button" onClick={() => onDeleteVertical(id)} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50">
                {busy && <Spinner className="h-3.5 w-3.5"/>}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}