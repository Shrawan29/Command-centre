import { useEffect, useMemo, useState } from 'react';
import { createKPI, deleteKPI, getKPIs, updateKPI } from '../services/kpis.js';
import { getUsers } from '../services/users.js';
import { getVerticals } from '../services/verticals.js';

// ─── constants ───────────────────────────────────────────────────────────────
const KPI_CATEGORY_OPTIONS  = ['deliverables', 'revenue', 'timeline', 'brand', 'operations', 'growth'];
const KPI_UNIT_OPTIONS      = ['number', 'percentage', 'leads', 'reports', 'inr', 'hours', 'days', 'count'];
const KPI_FREQUENCY_OPTIONS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const STATUS_FILTERS        = ['all', 'On Track', 'At Risk', 'Behind', 'Completed'];

function cap(s = '') { return s.charAt(0).toUpperCase() + s.slice(1); }

function vendorLabel(user) {
  if (!user) return '';
  return user.name ? `${user.name} (${user.email || ''})` : user.email || '';
}

const CATEGORY_COLORS = {
  revenue:      { pill: 'bg-violet-100 text-violet-700 ring-violet-200',     dot: 'bg-violet-400',  bar: 'bg-violet-400',  card: 'text-violet-500'  },
  timeline:     { pill: 'bg-amber-100  text-amber-700  ring-amber-200',      dot: 'bg-amber-400',   bar: 'bg-amber-400',   card: 'text-amber-500'   },
  brand:        { pill: 'bg-emerald-100 text-emerald-700 ring-emerald-200',  dot: 'bg-emerald-400', bar: 'bg-emerald-400', card: 'text-emerald-500' },
  operations:   { pill: 'bg-cyan-100   text-cyan-700   ring-cyan-200',       dot: 'bg-cyan-400',    bar: 'bg-cyan-400',    card: 'text-cyan-500'    },
  growth:       { pill: 'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200',  dot: 'bg-fuchsia-400', bar: 'bg-fuchsia-400', card: 'text-fuchsia-500' },
  deliverables: { pill: 'bg-sky-100    text-sky-700    ring-sky-200',        dot: 'bg-sky-400',     bar: 'bg-sky-400',     card: 'text-sky-500'     },
};
function catColors(cat) { return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.deliverables; }

const STATUS_STYLES = {
  'On Track':  { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-400' },
  'At Risk':   { badge: 'bg-amber-50  text-amber-700  ring-amber-200',    bar: 'bg-amber-400'   },
  'Behind':    { badge: 'bg-rose-50   text-rose-700   ring-rose-200',     bar: 'bg-rose-500'    },
  'Completed': { badge: 'bg-sky-50    text-sky-700    ring-sky-200',      bar: 'bg-sky-400'     },
};
function statusStyle(s) { return STATUS_STYLES[s] ?? STATUS_STYLES['Behind']; }

// ─── primitives ──────────────────────────────────────────────────────────────

function Toast({ message, type = 'success', onDismiss }) {
  const s = type === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${s}`}>
      {type === 'error' ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/>
        </svg>
      )}
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} className="opacity-40 transition hover:opacity-100" aria-label="Dismiss">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"/>
        </svg>
      </button>
    </div>
  );
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function SpinnerIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
      className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`}>
      <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08 1.197.75.75 0 1 1-1.31-.734 6 6 0 0 1 9.44-1.595l.842.841V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.595l-.842-.841v1.018a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5H4.013l.84.841a4.5 4.5 0 0 0 7.08-1.197.75.75 0 0 1 .992-.008Z" clipRule="evenodd"/>
    </svg>
  );
}

/* Pill toggle group */
function PillGroup({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt} type="button" disabled={disabled} onClick={() => onChange(opt)}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 transition select-none
            ${value === opt
              ? 'bg-slate-900 text-white ring-slate-900'
              : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300 hover:text-slate-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {cap(opt)}
        </button>
      ))}
    </div>
  );
}

function FormSelect({ value, onChange, required, disabled, children }) {
  return (
    <select value={value} onChange={onChange} required={required} disabled={disabled}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </select>
  );
}

function FormInput({ value, onChange, type = 'text', placeholder, required, disabled }) {
  return (
    <input value={value} onChange={onChange} type={type} placeholder={placeholder} required={required} disabled={disabled}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-50"/>
  );
}

function FieldLabel({ children }) {
  return <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{children}</p>;
}

// ─── NEW: Category Summary Cards ─────────────────────────────────────────────
function CategorySummaryCards({ kpis }) {
  const cards = useMemo(() => {
    return KPI_CATEGORY_OPTIONS.map((cat) => {
      const group = kpis.filter((k) => (k.category || 'deliverables') === cat);
      if (group.length === 0) return null;
      // performance: use k.performance if present, else derive from total/target
      const perfs = group.map((k) => {
        if (k.performance != null) return Number(k.performance);
        const t = Number(k.target || 0);
        const a = Number(k.total || k.actual || 0);
        return t > 0 ? Math.round((a / t) * 100) : 0;
      });
      const avg = Math.round(perfs.reduce((s, p) => s + p, 0) / perfs.length);
      return { cat, avg, count: group.length };
    }).filter(Boolean);
  }, [kpis]);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ cat, avg, count }) => {
        const c = catColors(cat);
        return (
          <div key={cat} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            {/* category label with dot */}
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${c.dot}`}/>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{cap(cat)}</span>
            </div>
            {/* big % */}
            <p className={`mt-2 text-3xl font-bold tabular-nums leading-none ${c.card}`}>{avg}%</p>
            {/* bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                style={{ width: `${Math.min(100, Math.max(2, avg))}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{count} KPI{count !== 1 ? 's' : ''}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── NEW: Status Filter Tabs ──────────────────────────────────────────────────
function StatusFilterTabs({ value, onChange, kpis }) {
  const counts = useMemo(() => {
    const map = { all: kpis.length };
    for (const k of kpis) {
      const s = k.status || 'Behind';
      map[s] = (map[s] || 0) + 1;
    }
    return map;
  }, [kpis]);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {STATUS_FILTERS.map((f) => {
        const label = f === 'all' ? 'All Status' : f;
        const count = counts[f] ?? 0;
        const active = value === f;
        return (
          <button
            key={f} type="button" onClick={() => onChange(f)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition
              ${active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
              }`}
          >
            {label}
            {f !== 'all' && count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none
                ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
      <span className="ml-2 text-[11px] text-slate-400">
        Showing {kpis.filter(k => value === 'all' || (k.status || 'Behind') === value).length} of {kpis.length} KPIs
      </span>
    </div>
  );
}

// ─── KPI Form ────────────────────────────────────────────────────────────────
function KPIForm({ id, values, setters, verticals, vendorOptions, disabled, onSubmit }) {
  const { name, target, unit, category, frequency, vertical, assignedTo } = values;
  const { setName, setTarget, setUnit, setCategory, setFrequency, setVertical, setAssignedTo } = setters;

  return (
    <form id={id} onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <FieldLabel>Name</FieldLabel>
          <FormInput value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monthly Revenue" required disabled={disabled}/>
        </div>
        <div>
          <FieldLabel>Target</FieldLabel>
          <FormInput value={target} onChange={(e) => setTarget(e.target.value)}
            type="number" placeholder="0" required disabled={disabled}/>
        </div>
        <div>
          <FieldLabel>Unit</FieldLabel>
          <FormSelect value={unit} onChange={(e) => setUnit(e.target.value)} disabled={disabled}>
            {KPI_UNIT_OPTIONS.map((o) => <option key={o} value={o}>{cap(o)}</option>)}
          </FormSelect>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel>Category</FieldLabel>
          <PillGroup options={KPI_CATEGORY_OPTIONS} value={category} onChange={setCategory} disabled={disabled}/>
        </div>
        <div>
          <FieldLabel>Frequency</FieldLabel>
          <PillGroup options={KPI_FREQUENCY_OPTIONS} value={frequency} onChange={setFrequency} disabled={disabled}/>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Vertical</FieldLabel>
          <FormSelect value={vertical} onChange={(e) => setVertical(e.target.value)} required disabled={disabled}>
            {verticals.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
          </FormSelect>
        </div>
        <div>
          <FieldLabel>Assign To</FieldLabel>
          <FormSelect value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required disabled={disabled}>
            {vendorOptions.map((u) => <option key={u._id} value={u._id}>{vendorLabel(u)}</option>)}
          </FormSelect>
        </div>
      </div>
    </form>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-slate-300">
          <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z"/>
        </svg>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">No KPIs yet</p>
      <p className="mt-1 text-xs text-slate-400">Use the "New KPI" button above to create your first one.</p>
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────
function DeleteModal({ target, onConfirm, onCancel, busy }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-4 pb-8 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-rose-600">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Delete KPI</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Permanently remove <span className="font-medium text-slate-800">"{target.name}"</span>? This cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
          <button type="button" onClick={onCancel} disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50">
            {busy && <SpinnerIcon className="h-3.5 w-3.5" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table cell components ────────────────────────────────────────────────────
function CategoryBadge({ value }) {
  const c = catColors(value);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${c.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`}/>
      {cap(value || 'deliverables')}
    </span>
  );
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
    </span>
  );
}

// ─── NEW: Inline progress bar cell ───────────────────────────────────────────
function ProgressCell({ kpi }) {
  const actual   = Number(kpi.total ?? kpi.actual ?? 0);
  const target   = Number(kpi.target ?? 0);
  const perf     = kpi.performance != null
    ? Number(kpi.performance)
    : target > 0 ? Math.round((actual / target) * 100) : 0;
  const status   = kpi.status || 'Behind';
  const barClass = statusStyle(status).bar;
  const pct      = Math.min(100, Math.max(0, perf));

  // marker position for target line (always at 100% of bar width scaled)
  return (
    <div className="min-w-[180px]">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${pct}%` }}/>
        {/* target tick at 80% position to indicate "expected" midpoint */}
        <div className="absolute top-0 bottom-0 w-px bg-slate-400/60" style={{ left: '80%' }}/>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
        <span>{actual} <span className="text-slate-300">actual</span></span>
        <span className="font-medium text-slate-500">{perf}%</span>
        <span>{target} <span className="text-slate-300">target</span></span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KPIManagementPage() {
  const [kpis, setKpis]               = useState([]);
  const [verticals, setVerticals]     = useState([]);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [busy, setBusy]               = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const [name, setName]               = useState('');
  const [target, setTarget]           = useState('');
  const [unit, setUnit]               = useState('number');
  const [category, setCategory]       = useState('deliverables');
  const [frequency, setFrequency]     = useState('monthly');
  const [vertical, setVertical]       = useState('');
  const [assignedTo, setAssignedTo]   = useState('');

  const [editingId, setEditingId]           = useState('');
  const [editName, setEditName]             = useState('');
  const [editTarget, setEditTarget]         = useState('');
  const [editUnit, setEditUnit]             = useState('number');
  const [editCategory, setEditCategory]     = useState('deliverables');
  const [editFrequency, setEditFrequency]   = useState('monthly');
  const [editVertical, setEditVertical]     = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const [k, v, u] = await Promise.all([getKPIs(), getVerticals(), getUsers()]);
      setKpis(Array.isArray(k) ? k : []);
      setVerticals(Array.isArray(v) ? v : []);
      setUsers(Array.isArray(u) ? u : []);
      if (!vertical && Array.isArray(v) && v[0]?._id) setVertical(v[0]._id);
      const vendors = (Array.isArray(u) ? u : []).filter((x) => x.role === 'agency');
      if (!assignedTo && vendors[0]?._id) setAssignedTo(vendors[0]._id);
    } catch (e) { setError(e.message || 'Failed to load KPI data'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function onCreate(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      await createKPI({ name, target: Number(target), unit, category, frequency, vertical, assignedTo });
      setName(''); setTarget(''); setUnit('number'); setCategory('deliverables'); setFrequency('monthly');
      setSuccess('KPI created successfully.');
      setShowCreate(false);
      await load();
    } catch (e2) { setError(e2.message || 'Failed to create KPI'); }
    finally { setBusy(false); }
  }

  function onStartEdit(kpi) {
    setShowCreate(false);
    setEditingId(kpi._id);
    setEditName(kpi.name || '');
    setEditTarget(String(kpi.target ?? ''));
    setEditUnit(kpi.unit || 'number');
    setEditCategory(kpi.category || 'deliverables');
    setEditFrequency(kpi.frequency || 'monthly');
    setEditVertical(typeof kpi.vertical === 'string' ? kpi.vertical : kpi.vertical?._id || '');
    setEditAssignedTo(typeof kpi.assignedTo === 'string' ? kpi.assignedTo : kpi.assignedTo?._id || '');
    setTimeout(() => document.getElementById('edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }

  function onCancelEdit() {
    setEditingId(''); setEditName(''); setEditTarget('');
    setEditUnit('number'); setEditCategory('deliverables'); setEditFrequency('monthly');
    setEditVertical(''); setEditAssignedTo('');
  }

  async function onSaveEdit(e) {
    e.preventDefault(); if (!editingId) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await updateKPI(editingId, { name: editName, target: Number(editTarget), unit: editUnit, category: editCategory, frequency: editFrequency, vertical: editVertical, assignedTo: editAssignedTo });
      onCancelEdit(); setSuccess('KPI updated successfully.'); await load();
    } catch (e2) { setError(e2.message || 'Failed to update KPI'); }
    finally { setBusy(false); }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return; setBusy(true); setError(''); setSuccess('');
    try {
      await deleteKPI(deleteTarget._id);
      if (editingId === deleteTarget._id) onCancelEdit();
      setSuccess(`"${deleteTarget.name}" deleted.`); setDeleteTarget(null); await load();
    } catch (e) { setError(e.message || 'Failed to delete KPI'); }
    finally { setBusy(false); }
  }

  const vendorOptions    = useMemo(() => users.filter((u) => u.role === 'agency'), [users]);
  const verticalNameById = useMemo(() => Object.fromEntries(verticals.map((v) => [v._id, v.name])), [verticals]);
  const userLabelById    = useMemo(() => Object.fromEntries(users.map((u) => [u._id, vendorLabel(u)])), [users]);

  function resolveVertical(r) { return typeof r.vertical === 'string' ? verticalNameById[r.vertical] || '—' : r.vertical?.name || '—'; }
  function resolveUser(f)     { return typeof f === 'string' ? userLabelById[f] || '—' : vendorLabel(f) || '—'; }
  function resolveVendorName(f) {
    const full = resolveUser(f);
    // strip email part for compact display
    return full.includes('(') ? full.split('(')[0].trim() : full;
  }

  const filteredKpis = useMemo(() =>
    statusFilter === 'all'
      ? kpis
      : kpis.filter((k) => (k.status || 'Behind') === statusFilter),
    [kpis, statusFilter]
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Progress Monitoring</p>
            <h1 className="mt-0.5 text-2xl font-bold text-slate-900 sm:text-3xl">KPI Tracker</h1>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button type="button" onClick={load} disabled={busy || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-40">
              <RefreshIcon spinning={loading}/>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button type="button"
              onClick={() => { setShowCreate((v) => !v); if (!showCreate) onCancelEdit(); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shadow-sm transition
                ${showCreate ? 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
              {showCreate ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"/>
                </svg>
              )}
              {showCreate ? 'Cancel' : 'New KPI'}
            </button>
          </div>
        </div>

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        {error   && <Toast message={error}   type="error"   onDismiss={() => setError('')}   />}
        {success && <Toast message={success} type="success" onDismiss={() => setSuccess('')} />}

        {/* ── NEW: Category Summary Cards ──────────────────────────────────── */}
        {!loading && kpis.length > 0 && (
          <CategorySummaryCards kpis={kpis} />
        )}
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24"/>)}
          </div>
        )}

        {/* ── Create panel ─────────────────────────────────────────────────── */}
        {showCreate && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-white">
                  <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"/>
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-slate-800">New KPI</h2>
            </div>
            <div className="p-5">
              <KPIForm id="create-form"
                values={{ name, target, unit, category, frequency, vertical, assignedTo }}
                setters={{ setName, setTarget, setUnit, setCategory, setFrequency, setVertical, setAssignedTo }}
                verticals={verticals} vendorOptions={vendorOptions}
                disabled={busy || loading} onSubmit={onCreate}/>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              <button type="button" onClick={() => setShowCreate(false)} disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40">
                Cancel
              </button>
              <button type="submit" form="create-form" disabled={busy || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50">
                {busy && <SpinnerIcon/>}
                Create KPI
              </button>
            </div>
          </section>
        )}

        {/* ── Edit panel ───────────────────────────────────────────────────── */}
        {editingId && (
          <section id="edit-panel" className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm ring-1 ring-sky-200/60">
            <div className="flex items-center justify-between gap-3 border-b border-sky-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-white">
                    <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 7.75a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Zm-2 3a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-sky-900">Editing KPI</p>
                  <p className="text-[11px] text-sky-500 truncate max-w-xs">{editName || 'Selected KPI'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onCancelEdit} disabled={busy}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 disabled:opacity-40">
                  Cancel
                </button>
                <button type="submit" form="edit-form" disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50">
                  {busy && <SpinnerIcon className="h-3.5 w-3.5"/>}
                  Save Changes
                </button>
              </div>
            </div>
            <div className="p-5">
              <KPIForm id="edit-form"
                values={{ name: editName, target: editTarget, unit: editUnit, category: editCategory, frequency: editFrequency, vertical: editVertical, assignedTo: editAssignedTo }}
                setters={{ setName: setEditName, setTarget: setEditTarget, setUnit: setEditUnit, setCategory: setEditCategory, setFrequency: setEditFrequency, setVertical: setEditVertical, setAssignedTo: setEditAssignedTo }}
                verticals={verticals} vendorOptions={vendorOptions}
                disabled={busy} onSubmit={onSaveEdit}/>
            </div>
          </section>
        )}

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5 space-y-3">
            {/* table title row */}
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">All KPIs</p>
              {!loading && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{kpis.length}</span>
              )}
            </div>
            {/* NEW: status filter tabs */}
            {!loading && kpis.length > 0 && (
              <StatusFilterTabs value={statusFilter} onChange={setStatusFilter} kpis={kpis}/>
            )}
          </div>

          {loading ? (
            <div className="space-y-2 p-5">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14"/>)}
            </div>
          ) : kpis.length === 0 ? (
            <EmptyState/>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {['KPI', 'Category', 'Vertical / Vendor', 'Progress vs Benchmark', 'Due', 'Status', ''].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredKpis.map((r) => {
                    const isEditing = editingId === r._id;
                    const ss = statusStyle(r.status || 'Behind');
                    const due = r.dueDate
                      ? new Date(r.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : r.deadline
                        ? new Date(r.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Ongoing';

                    return (
                      <tr key={r._id} className={`group transition-colors ${isEditing ? 'bg-sky-50/50' : 'hover:bg-slate-50/80'}`}>
                        {/* KPI name */}
                        <td className="px-4 py-3 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 leading-snug">{r.name}</span>
                            {isEditing && (
                              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-600">editing</span>
                            )}
                          </div>
                        </td>
                        {/* Category */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <CategoryBadge value={r.category}/>
                        </td>
                        {/* Vertical / Vendor stacked */}
                        <td className="px-4 py-3 min-w-[130px]">
                          <p className="text-xs font-medium text-slate-700 leading-snug">{resolveVertical(r)}</p>
                          <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{resolveVendorName(r.assignedTo)}</p>
                        </td>
                        {/* Progress bar */}
                        <td className="px-4 py-3 min-w-[200px]">
                          <ProgressCell kpi={r}/>
                        </td>
                        {/* Due */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{due}</td>
                        {/* Status badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${ss.badge}`}>
                            {r.status || 'Behind'}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button type="button" onClick={() => onStartEdit(r)} disabled={busy}
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow disabled:opacity-40">
                              Edit
                            </button>
                            <button type="button" onClick={() => setDeleteTarget(r)} disabled={busy}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-40">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredKpis.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                        No KPIs match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>

      {deleteTarget && (
        <DeleteModal target={deleteTarget} onConfirm={onConfirmDelete} onCancel={() => setDeleteTarget(null)} busy={busy}/>
      )}
    </div>
  );
}