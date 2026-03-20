import { useEffect, useMemo, useState } from 'react';
import { getMyKPIs } from '../services/kpis.js';
import { getKPIProgress, sendKPIReport, submitWeeklyData } from '../services/submissions.js';
import { getSession } from '../services/session.js';

function toLabel(v = '') { return v ? v.charAt(0).toUpperCase() + v.slice(1) : '—'; }

function normalizeWeek(value = '') {
  const m = String(value).trim().match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) return '';
  const week = Number(m[2]);
  if (week < 1 || week > 53) return '';
  return `${m[1]}-W${String(week).padStart(2, '0')}`;
}

function weekDisplay(value = '') {
  const normalized = normalizeWeek(value);
  if (!normalized) return value || '—';
  const [, year, week] = normalized.match(/^(\d{4})-W(\d{2})$/);
  return `Week ${Number(week)}, ${year}`;
}

function getCurrentIsoWeek() {
  return isoWeekString(new Date());
}

function getWeekRange(value = '') {
  const normalized = normalizeWeek(value);
  if (!normalized) return '';
  const match = normalized.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const week = Number(match[2]);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const fmt = (d) => d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  return `${fmt(start)} - ${fmt(end)}`;
}

function dateTimeLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── generate week options ────────────────────────────────────────────────────
function isoWeekString(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekOptions(count = 12) {
  const options = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (7 * i));
    const value = isoWeekString(d);
    options.push({ value, display: weekDisplay(value) });
  }
  return options;
}

// ─── status tokens ────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  'On Track':  { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-400', dot: 'bg-emerald-400' },
  'At Risk':   { pill: 'bg-amber-50  text-amber-700  ring-amber-200',    bar: 'bg-amber-400',   dot: 'bg-amber-400'   },
  'Behind':    { pill: 'bg-rose-50   text-rose-700   ring-rose-200',     bar: 'bg-rose-500',    dot: 'bg-rose-500'    },
  'Completed': { pill: 'bg-sky-50    text-sky-700    ring-sky-200',      bar: 'bg-sky-400',     dot: 'bg-sky-400'     },
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
      <button type="button" onClick={onDismiss} className="opacity-40 hover:opacity-100 transition-opacity" aria-label="Dismiss">
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

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{children}</p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function LightSelect({ value, onChange, disabled, required, children }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled} required={required}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
        focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100
        disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </select>
  );
}

function LightInput({ value, onChange, type = 'text', placeholder, required, disabled, readOnly }) {
  return (
    <input value={value} onChange={onChange} type={type} placeholder={placeholder}
      required={required} disabled={disabled} readOnly={readOnly}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
        placeholder:text-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100
        disabled:cursor-not-allowed disabled:opacity-50"/>
  );
}

// ─── week picker ──────────────────────────────────────────────────────────────
function WeekPicker({ value, disabled }) {
  return (
    <div className="space-y-2">
      <LightInput
        value={value}
        onChange={() => {}}
        type="week"
        disabled={disabled}
        readOnly
        required
      />
      {value && (
        <p className="text-[11px] text-slate-400">
          Ongoing week only: <span className="font-medium text-slate-600">{weekDisplay(value)} ({normalizeWeek(value)})</span>
        </p>
      )}
      {value && (
        <p className="text-[11px] text-slate-400">
          Week dates: <span className="font-medium text-slate-600">{getWeekRange(value)}</span>
        </p>
      )}
    </div>
  );
}

// ─── KPI progress bar ─────────────────────────────────────────────────────────
function ProgressBar({ pct, barClass }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-700 ${barClass}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}/>
      <div className="absolute top-0 bottom-0 w-px bg-slate-400/40" style={{ left: '80%' }}/>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function SubmissionPage() {
  const session = getSession();
  const [kpis, setKpis]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [submissionMeta, setSubmissionMeta] = useState(null);
  const [progress, setProgress]   = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [kpiId, setKpiId]         = useState('');
  const ongoingWeek = useMemo(() => getCurrentIsoWeek(), []);
  const [week, setWeek]           = useState(() => getCurrentIsoWeek());
  const [value, setValue]         = useState('');
  const [busy, setBusy]           = useState(false);
  const currentDateLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
    []
  );

  useEffect(() => {
    setWeek(ongoingWeek);
  }, [ongoingWeek]);

  async function loadKPIs(aliveRef = { current: true }) {
    setLoading(true); setError('');
    try {
      const data = await getMyKPIs();
      if (!aliveRef.current) return;
      const list = Array.isArray(data) ? data : [];
      setKpis(list);
      if (!kpiId && list[0]?._id) setKpiId(list[0]._id);
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e.message || 'Failed to load KPIs');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  async function loadProgress(nextKpiId, aliveRef = { current: true }) {
    if (!nextKpiId) { setProgress(null); return; }
    try {
      const p = await getKPIProgress(nextKpiId);
      if (!aliveRef.current) return;
      setProgress(p);
    } catch {
      if (!aliveRef.current) return;
      setProgress(null);
    }
  }

  useEffect(() => {
    const ref = { current: true };
    loadKPIs(ref);
    return () => { ref.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ref = { current: true };
    loadProgress(kpiId, ref);
    return () => { ref.current = false; };
  }, [kpiId]);

  const selected = useMemo(() => kpis.find((k) => k._id === kpiId) || null, [kpis, kpiId]);

  async function onSubmit(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess(''); setSubmissionMeta(null);
    try {
      const normalizedWeek = normalizeWeek(week);
      if (!normalizedWeek) {
        throw new Error('Please select a valid week.');
      }
      if (normalizedWeek !== ongoingWeek) {
        throw new Error(`Only ongoing week submissions are allowed (${ongoingWeek}).`);
      }
      const res = await submitWeeklyData({ kpiId, vendorId: session.userId, week: normalizedWeek, value: Number(value) });
      setSuccess(res?.message || 'Submitted successfully.');
      setSubmissionMeta(res?.submission || null);
      setWeek(ongoingWeek); setValue('');
      await loadProgress(kpiId);
    } catch (e2) { setError(e2.message || 'Submission failed'); }
    finally { setBusy(false); }
  }

  async function onSendReport() {
    if (!kpiId) return;
    setReportBusy(true); setError(''); setSuccess('');
    try {
      const res = await sendKPIReport(kpiId);
      setSuccess(res?.message || 'Report sent successfully.');
    } catch (e) { setError(e.message || 'Failed to send report'); }
    finally { setReportBusy(false); }
  }

  const progressRows = Array.isArray(progress?.submissions)
    ? progress.submissions.map((s, i) => ({
        id: s._id || `${s.week}-${i}`,
        week: s.week,
        value: s.value,
        submittedAt: s.createdAt,
      }))
    : [];

  const perf    = Number(progress?.performance || 0);
  const actual  = Number(progress?.actualProgress ?? progress?.completion ?? perf);
  const expected = Number(progress?.expectedProgress ?? 0);
  const perfPct = Math.min(100, Math.max(0, perf));
  const status  = progress?.status || null;
  const sStyle  = status ? ss(status) : null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Vendor Portal</p>
            <h1 className="mt-0.5 text-2xl font-bold text-slate-900 sm:text-3xl">Submission</h1>
            <p className="mt-1 text-sm text-slate-500">Submit weekly values and review KPI progress.</p>
            <p className="mt-1 text-xs text-slate-400">Today: {currentDateLabel}</p>
          </div>
          {session?.name && (
            <div className="self-start rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm sm:self-auto">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Logged in as</p>
              <p className="text-sm font-semibold text-slate-800">{session.name || session.email}</p>
            </div>
          )}
        </div>

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        {error   && <Toast message={error}   type="error"   onDismiss={() => setError('')}   />}
        {success && <Toast message={success} type="success" onDismiss={() => setSuccess('')} />}

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Left: submission form (2/3) */}
          <div className="lg:col-span-2 space-y-4">

            {/* KPI selector + meta */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-white">
                    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L7.737 9.852a.75.75 0 0 0-1.05 1.072l2.5 2.45a.75.75 0 0 0 1.05 0l2.5-2.45a.75.75 0 1 0-1.05-1.072l-1.487 1.457V2.75ZM3.5 4.25a.75.75 0 0 0-1.5 0v7a.75.75 0 0 0 1.5 0v-7ZM6.25 7a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 6.25 7Z"/>
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-slate-800">Select KPI</h2>
              </div>

              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10"/>
                  <Skeleton className="h-16"/>
                </div>
              ) : (
                <>
                  <FieldLabel>KPI</FieldLabel>
                  <LightSelect value={kpiId} onChange={(e) => setKpiId(e.target.value)} disabled={loading} required>
                    {kpis.map((k) => (
                      <option key={k._id} value={k._id}>
                        {k.name} ({toLabel(k.category || 'deliverables')})
                      </option>
                    ))}
                  </LightSelect>

                  {/* selected KPI meta chips */}
                  {selected && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${catColor(selected.category)}`}>
                        {toLabel(selected.category || 'deliverables')}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                        {toLabel(selected.unit || 'number')}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                        {toLabel(selected.frequency || 'monthly')}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                        Target: {selected.target}
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Submit form */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-white">
                    <path fillRule="evenodd" d="M4 2a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V6.621a1.5 1.5 0 0 0-.44-1.06L9.94 2.439A1.5 1.5 0 0 0 8.878 2H4Zm4 3.5a.75.75 0 0 1 .75.75v2.69l.72-.72a.75.75 0 1 1 1.06 1.06l-2 2a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l.72.72V6.25A.75.75 0 0 1 8 5.5Z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-slate-800">Submit Weekly Data</h2>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <FieldLabel hint="You can submit only for the ongoing week.">Week</FieldLabel>
                  <WeekPicker value={week} disabled={busy || loading}/>
                </div>
                <div>
                  <FieldLabel>{selected ? `Value (${selected.unit || 'number'})` : 'Value'}</FieldLabel>
                  <LightInput value={value} onChange={(e) => setValue(e.target.value)}
                    type="number" placeholder="Enter value…" required disabled={busy || loading}/>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <button type="button" onClick={onSendReport}
                    disabled={reportBusy || loading || !kpiId}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40">
                    {reportBusy ? <Spinner className="h-3.5 w-3.5"/> : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11ZM15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z"/>
                      </svg>
                    )}
                    Send KPI Report
                  </button>
                  <button type="submit" disabled={busy || loading || !kpiId || !week || !value}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50">
                    {busy && <Spinner/>}
                    Submit
                  </button>
                </div>
              </form>
            </section>

            {/* Last submission receipt */}
            {submissionMeta && (
              <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-600">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-sm font-semibold text-emerald-800">Submission Confirmed</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'KPI',    value: selected?.name || '—'              },
                    { label: 'Vendor', value: session?.name || session?.email || '—' },
                    { label: 'Week',   value: weekDisplay(submissionMeta.week)   },
                    { label: 'Value',  value: submissionMeta.value               },
                    { label: 'Date',   value: dateTimeLabel(submissionMeta.createdAt) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-emerald-600">{item.label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-emerald-900 truncate">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: progress panel (1/3) */}
          <div className="space-y-4">

            {/* KPI progress card */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-800">KPI Progress</p>
                {status && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${sStyle.pill}`}>
                    {status}
                  </span>
                )}
              </div>

              {progress ? (
                <>
                  {/* big % */}
                  <div className="text-center mb-4">
                    <p className={`text-5xl font-bold tabular-nums ${sStyle?.pill?.includes('emerald') ? 'text-emerald-500' : sStyle?.pill?.includes('amber') ? 'text-amber-500' : sStyle?.pill?.includes('sky') ? 'text-sky-500' : 'text-rose-500'}`}>
                      {Math.round(perf)}%
                    </p>
                    <p className="mt-1 text-xs text-slate-400">performance</p>
                  </div>

                  <ProgressBar pct={perfPct} barClass={sStyle?.bar || 'bg-slate-300'}/>

                  <div className="mt-4 space-y-2">
                    {[
                      { label: 'Target',    value: progress?.target ?? selected?.target ?? '—' },
                      { label: 'Total',     value: progress?.total ?? '—'                       },
                      { label: 'Actual %',  value: `${Math.round(actual)}%`                     },
                      { label: 'Expected %',value: `${Math.round(expected)}%`                   },
                      { label: 'Category',  value: toLabel(selected?.category || 'deliverables')},
                      { label: 'Unit',      value: toLabel(selected?.unit || 'number')          },
                      { label: 'Frequency', value: toLabel(selected?.frequency || 'monthly')    },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <span className="text-slate-500 uppercase tracking-wide text-[10px]">{row.label}</span>
                        <span className="font-semibold text-slate-700">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">Select a KPI to view progress.</p>
                </div>
              )}
            </section>

          </div>
        </div>

        {/* ── Submission history table ─────────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Submission History</p>
              {progressRows.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {progressRows.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{selected?.name || '—'}</p>
          </div>

          {progressRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-slate-300 mb-3">
                <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875Zm5.845 17.03a.75.75 0 0 0 1.06 0l3-3a.75.75 0 1 0-1.06-1.06l-1.72 1.72V12a.75.75 0 0 0-1.5 0v4.19l-1.72-1.72a.75.75 0 0 0-1.06 1.06l3 3Z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm font-medium text-slate-500">No submissions yet</p>
              <p className="mt-1 text-xs text-slate-400">Submit weekly data above to see history here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {['Week', 'Value', 'Date', 'KPI', 'Vendor'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {progressRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700 tabular-nums">{weekDisplay(r.week)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 tabular-nums">{r.value}</td>
                      <td className="px-4 py-3 text-slate-500">{dateTimeLabel(r.submittedAt)}</td>
                      <td className="px-4 py-3 text-slate-500">{selected?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{session?.name || session?.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}