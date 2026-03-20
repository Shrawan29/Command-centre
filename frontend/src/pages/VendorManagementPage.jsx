import { useEffect, useMemo, useState } from 'react';
import { createUser, deleteUser, getUsers, updateUser } from '../services/users.js';
import { getKPIs } from '../services/kpis.js';
import { getKPIProgress } from '../services/submissions.js';
import { getVerticals } from '../services/verticals.js';

// ─── helpers ──────────────────────────────────────────────────────────────────
function toCurrency(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
function toDateLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}
function clampScore(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// ─── design tokens ────────────────────────────────────────────────────────────
function scoreRingColor(score) {
  if (score >= 75) return 'ring-emerald-400 text-emerald-600';
  if (score >= 50) return 'ring-amber-400   text-amber-600';
  return 'ring-rose-400 text-rose-600';
}
function scoreBg(score) {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-500';
  return 'text-rose-500';
}

const STATUS_STYLES = {
  'On Track':  { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-400', dot: 'bg-emerald-400', text: 'text-emerald-600' },
  'At Risk':   { badge: 'bg-amber-50  text-amber-700  ring-amber-200',    bar: 'bg-amber-400',   dot: 'bg-amber-400',   text: 'text-amber-500'  },
  'Behind':    { badge: 'bg-rose-50   text-rose-700   ring-rose-200',     bar: 'bg-rose-500',    dot: 'bg-rose-500',    text: 'text-rose-600'   },
  'Completed': { badge: 'bg-sky-50    text-sky-700    ring-sky-200',      bar: 'bg-sky-400',     dot: 'bg-sky-400',     text: 'text-sky-600'    },
};
function ss(status) { return STATUS_STYLES[status] ?? STATUS_STYLES['Behind']; }

const CAT_COLORS = {
  revenue:      'bg-violet-100 text-violet-700 ring-violet-200',
  timeline:     'bg-amber-100  text-amber-700  ring-amber-200',
  brand:        'bg-emerald-100 text-emerald-700 ring-emerald-200',
  operations:   'bg-cyan-100   text-cyan-700   ring-cyan-200',
  growth:       'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200',
  deliverables: 'bg-sky-100    text-sky-700    ring-sky-200',
};
function catColor(cat) { return CAT_COLORS[cat] ?? CAT_COLORS.deliverables; }
function cap(s = '') { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }

// ─── primitives ───────────────────────────────────────────────────────────────
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
      <button type="button" onClick={onDismiss} className="opacity-40 hover:opacity-100 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"/>
        </svg>
      </button>
    </div>
  );
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

function LightInput({ value, onChange, type = 'text', placeholder, required, disabled, readOnly }) {
  return (
    <input value={value} onChange={onChange} type={type} placeholder={placeholder}
      required={required} disabled={disabled} readOnly={readOnly}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300
        focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100
        disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-slate-50 read-only:text-slate-500"/>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{children}</p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function LightField({ label, hint, children }) {
  return <div><FieldLabel hint={hint}>{label}</FieldLabel>{children}</div>;
}

function DeleteModal({ target, onConfirm, onCancel, busy }) {
  return (
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
              <p className="text-sm font-semibold text-slate-900">Delete Vendor</p>
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
            {busy && <Spinner className="h-3.5 w-3.5"/>}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── vendor form ─────────────────────────────────────────────────────────────
function VendorForm({ id, values, setters, disabled, onSubmit, scoreDisplay }) {
  const { name, email, password, agencyType, contractValue, engagementStart, engagementEnd, primaryContact } = values;
  const { setName, setEmail, setPassword, setAgencyType, setContractValue, setEngagementStart, setEngagementEnd, setPrimaryContact } = setters;
  const isEdit = !setEmail;
  return (
    <form id={id} onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LightField label="Name"><LightInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Agency name" required disabled={disabled}/></LightField>
        {!isEdit && <LightField label="Email"><LightInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="contact@agency.com" required disabled={disabled}/></LightField>}
        <LightField label="Role"><LightInput value="agency (vendor)" readOnly disabled/></LightField>
        <LightField label={isEdit ? 'Reset Password' : 'Password'} hint={isEdit ? 'Leave blank to keep current' : undefined}>
          <LightInput value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required={!isEdit} disabled={disabled}/>
        </LightField>
        {isEdit && scoreDisplay != null && (
          <LightField label="Work Done %" hint="Avg across assigned KPIs"><LightInput value={String(scoreDisplay)} readOnly disabled/></LightField>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <LightField label="Agency Type"><LightInput value={agencyType} onChange={(e) => setAgencyType(e.target.value)} placeholder="Social Media Agency" disabled={disabled}/></LightField>
        <LightField label="Primary Contact"><LightInput value={primaryContact} onChange={(e) => setPrimaryContact(e.target.value)} disabled={disabled}/></LightField>
        <LightField label="Contract Value (INR)"><LightInput value={contractValue} onChange={(e) => setContractValue(e.target.value)} type="number" min="0" disabled={disabled}/></LightField>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LightField label="Engagement Start"><LightInput value={engagementStart} onChange={(e) => setEngagementStart(e.target.value)} type="date" disabled={disabled}/></LightField>
        <LightField label="Engagement End"><LightInput value={engagementEnd} onChange={(e) => setEngagementEnd(e.target.value)} type="date" disabled={disabled}/></LightField>
      </div>
    </form>
  );
}

// ─── KPI row in detail panel ──────────────────────────────────────────────────
function KpiRow({ kpi }) {
  const actual = Number(kpi.total ?? kpi.actual ?? 0);
  const target = Number(kpi.target ?? 0);
  const perf   = kpi.performance != null ? Number(kpi.performance) : target > 0 ? Math.round((actual / target) * 100) : 0;
  const pct    = Math.min(100, Math.max(0, perf));
  const s      = ss(kpi.status || 'Behind');
  const verticalName = kpi.verticalName || kpi.vertical?.name || '—';

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{kpi.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${catColor(kpi.category)}`}>
              {cap(kpi.category || 'deliverables')}
            </span>
            <span className="text-[10px] text-slate-400">{verticalName}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ring-1 ${s.badge}`}>
          {kpi.status || 'Behind'}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`} style={{ width: `${pct}%` }}/>
        <div className="absolute top-0 bottom-0 w-px bg-slate-400/50" style={{ left: '80%' }}/>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
        <span>Actual <span className="font-medium text-slate-600">{actual}</span></span>
        <span className={`font-semibold ${s.text}`}>{perf}%</span>
        <span>Target <span className="font-medium text-slate-600">{target}</span></span>
      </div>
    </div>
  );
}

// ─── mini score bar (inside vendor list card) ─────────────────────────────────
function MiniScoreBar({ score }) {
  const pct   = Math.min(100, Math.max(0, score));
  const color = score >= 75 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 mt-2">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }}/>
    </div>
  );
}

// ─── vendor detail panel ──────────────────────────────────────────────────────
function VendorDetailPanel({ vendor, score, kpis, onEdit, onDelete, busy }) {
  const [kpiFilter, setKpiFilter] = useState('all');

  // ── All hooks must be called before any early return ──────────────────────
  const statusCounts = useMemo(() => {
    const m = {};
    for (const k of kpis) m[k.status || 'Behind'] = (m[k.status || 'Behind'] || 0) + 1;
    return m;
  }, [kpis]);

  const filteredKpis = useMemo(() =>
    kpiFilter === 'all' ? kpis : kpis.filter((k) => (k.status || 'Behind') === kpiFilter),
    [kpis, kpiFilter]
  );

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-slate-50/50">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-slate-300">
            <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-500">Select a vendor</p>
        <p className="mt-1 text-xs text-slate-400">Click any row on the left to view KPI performance.</p>
      </div>
    );
  }

  const ringClass = scoreRingColor(score);
  const perf = score;
  const perfColor = perf >= 75 ? 'bg-emerald-400' : perf >= 50 ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      {/* header */}
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{vendor.agencyType || 'Agency'}</p>
            <h2 className="mt-0.5 text-xl font-bold text-slate-900 leading-tight truncate">{vendor.name}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{vendor.email}</p>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-2 ${ringClass} text-sm font-bold`}>
            {score}
          </div>
        </div>

        {/* overall progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>Overall Performance</span>
            <span className={`font-semibold ${scoreBg(score)}`}>{score}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all duration-700 ${perfColor}`} style={{ width: `${perf}%` }}/>
          </div>
        </div>

        {/* meta grid */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Contract',  value: toCurrency(vendor.contractValue)                                          },
            { label: 'Engagement', value: `${toDateLabel(vendor.engagementStart)} – ${toDateLabel(vendor.engagementEnd)}` },
            { label: 'Contact',   value: vendor.primaryContact || '—'                                              },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700 truncate">{item.value}</p>
            </div>
          ))}
        </div>

        {/* status mini pills row */}
        {kpis.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(statusCounts).map(([status, count]) => {
              const t = ss(status);
              return (
                <span key={status} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ${t.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`}/>
                  {count} {status}
                </span>
              );
            })}
          </div>
        )}

        {/* actions */}
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={onEdit} disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40">
            Edit Vendor
          </button>
          <button type="button" onClick={onDelete} disabled={busy}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-40">
            Delete
          </button>
        </div>
      </div>

      {/* KPI section */}
      <div className="flex-1 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">KPI Performance</p>
            {kpis.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{kpis.length}</span>
            )}
          </div>
          {/* KPI status filter */}
          {kpis.length > 0 && (
            <div className="flex items-center gap-1">
              {['all', 'On Track', 'At Risk', 'Behind', 'Completed'].map((f) => {
                const cnt = f === 'all' ? kpis.length : (statusCounts[f] || 0);
                if (f !== 'all' && !cnt) return null;
                return (
                  <button key={f} type="button" onClick={() => setKpiFilter(f)}
                    className={`rounded px-2 py-0.5 text-[9px] font-semibold transition
                      ${kpiFilter === f
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-400 hover:text-slate-600'}`}>
                    {f === 'all' ? 'All' : f}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {kpis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-slate-400">No KPIs assigned to this vendor.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredKpis.map((k) => <KpiRow key={k._id} kpi={k}/>)}
            {filteredKpis.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No KPIs match this filter.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function VendorManagementPage() {
  const [users, setUsers]                     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState('');
  const [scoreByVendorId, setScoreByVendorId] = useState({});
  const [kpisByVendorId, setKpisByVendorId]   = useState({});
  const [busy, setBusy]                       = useState(false);
  const [selectedId, setSelectedId]           = useState(null);
  const [typeFilter, setTypeFilter]           = useState('ALL');
  const [showCreate, setShowCreate]           = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [search, setSearch]                   = useState('');

  const [name, setName]                       = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [agencyType, setAgencyType]           = useState('');
  const [contractValue, setContractValue]     = useState('');
  const [engagementStart, setEngagementStart] = useState('');
  const [engagementEnd, setEngagementEnd]     = useState('');
  const [primaryContact, setPrimaryContact]   = useState('');

  const [editingId, setEditingId]                     = useState('');
  const [editName, setEditName]                       = useState('');
  const [editPassword, setEditPassword]               = useState('');
  const [editAgencyType, setEditAgencyType]           = useState('');
  const [editContractValue, setEditContractValue]     = useState('');
  const [editEngagementStart, setEditEngagementStart] = useState('');
  const [editEngagementEnd, setEditEngagementEnd]     = useState('');
  const [editPrimaryContact, setEditPrimaryContact]   = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await getUsers();
      const safeUsers = Array.isArray(data) ? data : [];
      setUsers(safeUsers);

      const allVerticals = await getVerticals().catch(() => []);
      const verticalNameById = Object.fromEntries(
        (Array.isArray(allVerticals) ? allVerticals : []).map((v) => [v._id, v.name])
      );

      const allKpis = await getKPIs().catch(() => []);
      const safeKpis = Array.isArray(allKpis) ? allKpis : [];

      const progressRows = await Promise.all(
        safeKpis.map(async (kpi) => {
          const assignedTo = typeof kpi.assignedTo === 'string' ? kpi.assignedTo : kpi.assignedTo?._id;
          if (!assignedTo) return null;
          const verticalName = typeof kpi.vertical === 'string'
            ? verticalNameById[kpi.vertical] || 'Unassigned'
            : kpi.vertical?.name || 'Unassigned';
          try {
            const progress = await getKPIProgress(kpi._id);
            return { ...kpi, assignedTo, verticalName, performance: Number(progress?.performance || 0), status: progress?.status || kpi.status || 'Behind', total: Number(progress?.total || 0) };
          } catch {
            return { ...kpi, assignedTo, verticalName, performance: 0, status: 'Behind', total: 0 };
          }
        })
      );

      const grouped = {};
      const kpiGrouped = {};
      for (const row of progressRows) {
        if (!row?.assignedTo) continue;
        grouped[row.assignedTo] = grouped[row.assignedTo] || [];
        grouped[row.assignedTo].push(Number(row.performance || 0));
        kpiGrouped[row.assignedTo] = kpiGrouped[row.assignedTo] || [];
        kpiGrouped[row.assignedTo].push(row);
      }

      const nextScores = {};
      for (const user of safeUsers.filter((u) => u.role === 'agency')) {
        const perfList = grouped[user._id] || [];
        const avg = perfList.length ? perfList.reduce((s, p) => s + p, 0) / perfList.length : 0;
        nextScores[user._id] = clampScore(avg);
      }
      setScoreByVendorId(nextScores);
      setKpisByVendorId(kpiGrouped);
    } catch (e) { setError(e.message || 'Failed to load vendors'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      await createUser({ name, email, role: 'agency', password, agencyType, contractValue: Number(contractValue || 0), engagementStart: engagementStart || null, engagementEnd: engagementEnd || null, primaryContact });
      setName(''); setEmail(''); setPassword(''); setAgencyType(''); setContractValue(''); setEngagementStart(''); setEngagementEnd(''); setPrimaryContact('');
      setSuccess('Vendor created successfully.'); setShowCreate(false); await load();
    } catch (e2) { setError(e2.message || 'Failed to create vendor'); }
    finally { setBusy(false); }
  }

  function onStartEdit(u) {
    setShowCreate(false);
    setEditingId(u._id); setEditName(u.name || ''); setEditPassword(''); setEditAgencyType(u.agencyType || '');
    setEditContractValue(String(u.contractValue ?? '')); setEditEngagementStart(toDateInput(u.engagementStart));
    setEditEngagementEnd(toDateInput(u.engagementEnd)); setEditPrimaryContact(u.primaryContact || '');
    setTimeout(() => document.getElementById('edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }

  function onCancelEdit() {
    setEditingId(''); setEditName(''); setEditPassword(''); setEditAgencyType('');
    setEditContractValue(''); setEditEngagementStart(''); setEditEngagementEnd(''); setEditPrimaryContact('');
  }

  async function onSaveEdit(e) {
    e.preventDefault(); if (!editingId) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const payload = { name: editName, role: 'agency', agencyType: editAgencyType, contractValue: Number(editContractValue || 0), engagementStart: editEngagementStart || null, engagementEnd: editEngagementEnd || null, primaryContact: editPrimaryContact };
      if (editPassword) payload.password = editPassword;
      await updateUser(editingId, payload);
      onCancelEdit(); setSuccess('Vendor updated successfully.'); await load();
    } catch (e2) { setError(e2.message || 'Failed to update vendor'); }
    finally { setBusy(false); }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return; setBusy(true); setError(''); setSuccess('');
    try {
      await deleteUser(deleteTarget._id);
      if (editingId === deleteTarget._id) onCancelEdit();
      if (selectedId === deleteTarget._id) setSelectedId(null);
      setSuccess(`"${deleteTarget.name}" deleted.`); setDeleteTarget(null); await load();
    } catch (e) { setError(e.message || 'Failed to delete vendor'); }
    finally { setBusy(false); }
  }

  const agencies      = useMemo(() => users.filter((u) => u.role === 'agency'), [users]);
  const agencyTypes   = useMemo(() => [...new Set(agencies.map((a) => a.agencyType).filter(Boolean))], [agencies]);

  const filteredAgencies = useMemo(() => {
    let list = typeFilter === 'ALL' ? agencies : agencies.filter((a) => a.agencyType === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.agencyType?.toLowerCase().includes(q) ||
        a.primaryContact?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [agencies, typeFilter, search]);

  const selectedVendor = useMemo(() => agencies.find((a) => a._id === selectedId) || null, [agencies, selectedId]);
  const selectedScore  = selectedId ? (scoreByVendorId[selectedId] ?? 0) : 0;
  const selectedKpis   = selectedId ? (kpisByVendorId[selectedId] ?? []) : [];
  const atRiskCount    = (id) => (kpisByVendorId[id] || []).filter((k) => k.status === 'At Risk' || k.status === 'Behind').length;

  // summary stats
  const summaryStats = useMemo(() => {
    const scores = agencies.map((a) => scoreByVendorId[a._id] ?? 0);
    const avgScore = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
    const allKpis  = Object.values(kpisByVendorId).flat();
    const totalContract = agencies.reduce((s, a) => s + Number(a.contractValue || 0), 0);
    return {
      total: agencies.length,
      avgScore,
      atRisk: allKpis.filter((k) => k.status === 'At Risk' || k.status === 'Behind').length,
      totalContract,
    };
  }, [agencies, scoreByVendorId, kpisByVendorId]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Agency Management</p>
            <h1 className="mt-0.5 text-2xl font-bold text-slate-900 sm:text-3xl">Vendor Registry</h1>
            <p className="mt-1 text-sm text-slate-500">Manage vendor profiles, contracts and KPI performance.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button type="button" onClick={load} disabled={busy || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}>
                <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08 1.197.75.75 0 1 1-1.31-.734 6 6 0 0 1 9.44-1.595l.842.841V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.595l-.842-.841v1.018a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5H4.013l.84.841a4.5 4.5 0 0 0 7.08-1.197.75.75 0 0 1 .992-.008Z" clipRule="evenodd"/>
              </svg>
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
              {showCreate ? 'Cancel' : 'Add Vendor'}
            </button>
          </div>
        </div>

        {/* ── Summary stat strip ───────────────────────────────────────────── */}
        {!loading && agencies.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Vendors',   value: summaryStats.total,                                 valueClass: 'text-slate-800'   },
              { label: 'Avg Performance', value: `${summaryStats.avgScore}%`,                         valueClass: scoreBg(summaryStats.avgScore) },
              { label: 'KPIs at Risk',    value: summaryStats.atRisk,                                 valueClass: summaryStats.atRisk > 0 ? 'text-rose-500' : 'text-emerald-500' },
              { label: 'Total Contract',  value: toCurrency(summaryStats.totalContract),               valueClass: 'text-slate-800'   },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className={`mt-1.5 text-2xl font-bold tabular-nums leading-none ${stat.valueClass}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16"/>)}
          </div>
        )}

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        {error   && <Toast message={error}   type="error"   onDismiss={() => setError('')}   />}
        {success && <Toast message={success} type="success" onDismiss={() => setSuccess('')} />}

        {/* ── Create panel ─────────────────────────────────────────────────── */}
        {showCreate && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-white">
                  <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"/>
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-slate-800">Add Vendor</h2>
            </div>
            <div className="p-5">
              <VendorForm id="create-form"
                values={{ name, email, password, agencyType, contractValue, engagementStart, engagementEnd, primaryContact }}
                setters={{ setName, setEmail, setPassword, setAgencyType, setContractValue, setEngagementStart, setEngagementEnd, setPrimaryContact }}
                disabled={busy || loading} onSubmit={onCreate}/>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              <button type="button" onClick={() => setShowCreate(false)} disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-40">
                Cancel
              </button>
              <button type="submit" form="create-form" disabled={busy || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50">
                {busy && <Spinner/>}
                Create Vendor
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
                  <p className="text-sm font-semibold text-sky-900">Editing Vendor</p>
                  <p className="text-[11px] text-sky-500 truncate max-w-xs">{editName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onCancelEdit} disabled={busy}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 disabled:opacity-40">
                  Cancel
                </button>
                <button type="submit" form="edit-form" disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50">
                  {busy && <Spinner className="h-3.5 w-3.5"/>}
                  Save Changes
                </button>
              </div>
            </div>
            <div className="p-5">
              <VendorForm id="edit-form"
                values={{ name: editName, password: editPassword, agencyType: editAgencyType, contractValue: editContractValue, engagementStart: editEngagementStart, engagementEnd: editEngagementEnd, primaryContact: editPrimaryContact }}
                setters={{ setName: setEditName, setPassword: setEditPassword, setAgencyType: setEditAgencyType, setContractValue: setEditContractValue, setEngagementStart: setEditEngagementStart, setEngagementEnd: setEditEngagementEnd, setPrimaryContact: setEditPrimaryContact }}
                disabled={busy} onSubmit={onSaveEdit} scoreDisplay={scoreByVendorId[editingId] ?? 0}/>
            </div>
          </section>
        )}

        {/* ── Two-panel body ───────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ minHeight: '560px' }}>
          <div className="flex h-full" style={{ minHeight: '560px' }}>

            {/* Left: vendor list */}
            <div className="w-80 shrink-0 flex flex-col border-r border-slate-100">

              {/* search + filter bar */}
              <div className="border-b border-slate-100 px-3 py-3 space-y-2">
                {/* search */}
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none">
                    <path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd"/>
                  </svg>
                  <input
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search vendors…"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400
                      focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-200"/>
                </div>
                {/* type filter pills */}
                {agencyTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {['ALL', ...agencyTypes].map((t) => (
                      <button key={t} type="button" onClick={() => setTypeFilter(t)}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition
                          ${typeFilter === t
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* vendor list */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="space-y-2 p-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24"/>)}
                  </div>
                ) : filteredAgencies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <p className="text-sm text-slate-400">{search ? 'No vendors match your search.' : 'No vendors found.'}</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredAgencies.map((vendor) => {
                      const score     = scoreByVendorId[vendor._id] ?? 0;
                      const riskCount = atRiskCount(vendor._id);
                      const ringClass = scoreRingColor(score);
                      const isActive  = selectedId === vendor._id;
                      const kpiCount  = (kpisByVendorId[vendor._id] || []).length;

                      return (
                        <button key={vendor._id} type="button"
                          onClick={() => setSelectedId(isActive ? null : vendor._id)}
                          className={`w-full rounded-lg border px-3 py-3 text-left transition
                            ${isActive
                              ? 'border-slate-300 bg-slate-50 shadow-sm'
                              : 'border-transparent hover:border-slate-200 hover:bg-slate-50/70'}`}>

                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800 leading-snug">{vendor.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{vendor.agencyType || 'Agency'}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {riskCount > 0 && (
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 ring-1 ring-rose-200">
                                  {riskCount} at risk
                                </span>
                              )}
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 ${ringClass} text-xs font-bold`}>
                                {score}
                              </div>
                            </div>
                          </div>

                          {/* mini score bar */}
                          <MiniScoreBar score={score}/>

                          <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                            <div>
                              <p className="text-slate-400 uppercase tracking-wide">Contract</p>
                              <p className="mt-0.5 text-slate-600 font-medium">{toCurrency(vendor.contractValue)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 uppercase tracking-wide">Period</p>
                              <p className="mt-0.5 text-slate-600 font-medium">{toDateLabel(vendor.engagementStart)} – {toDateLabel(vendor.engagementEnd)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 uppercase tracking-wide">KPIs</p>
                              <p className="mt-0.5 text-slate-600 font-medium">{kpiCount}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* list footer count */}
              {!loading && (
                <div className="border-t border-slate-100 px-4 py-2">
                  <p className="text-[10px] text-slate-400">{filteredAgencies.length} of {agencies.length} vendors</p>
                </div>
              )}
            </div>

            {/* Right: detail panel */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <VendorDetailPanel
                vendor={selectedVendor}
                score={selectedScore}
                kpis={selectedKpis}
                onEdit={() => selectedVendor && onStartEdit(selectedVendor)}
                onDelete={() => selectedVendor && setDeleteTarget(selectedVendor)}
                busy={busy}
              />
            </div>
          </div>
        </div>

      </div>

      {deleteTarget && (
        <DeleteModal target={deleteTarget} onConfirm={onConfirmDelete} onCancel={() => setDeleteTarget(null)} busy={busy}/>
      )}
    </div>
  );
}