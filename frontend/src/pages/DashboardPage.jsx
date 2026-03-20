import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getKPIs, getMyKPIs } from '../services/kpis.js';
import { getSession } from '../services/session.js';
import { getKPIProgress } from '../services/submissions.js';
import { getVerticalDashboard, getVerticals } from '../services/verticals.js';

// ─── tiny design tokens ────────────────────────────────────────────────────
const STATUS = {
  'On Track':  { pill: 'text-emerald-700 bg-emerald-50 ring-emerald-200',  bar: 'bg-emerald-400', dot: 'bg-emerald-400' },
  'At Risk':   { pill: 'text-amber-700  bg-amber-50  ring-amber-200',   bar: 'bg-amber-400',   dot: 'bg-amber-400'   },
  'Behind':    { pill: 'text-rose-700   bg-rose-50   ring-rose-200',    bar: 'bg-rose-500',    dot: 'bg-rose-500'    },
  'Completed': { pill: 'text-sky-700    bg-sky-50    ring-sky-200',     bar: 'bg-sky-400',     dot: 'bg-sky-400'     },
};
function tone(status) { return STATUS[status] ?? STATUS['Behind']; }
function toLabel(value = '') { return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—'; }
function categoryPill(category) {
  if (category === 'revenue') return 'text-violet-700 bg-violet-50 ring-violet-200';
  if (category === 'timeline') return 'text-amber-700 bg-amber-50 ring-amber-200';
  if (category === 'brand') return 'text-emerald-700 bg-emerald-50 ring-emerald-200';
  if (category === 'operations') return 'text-cyan-700 bg-cyan-50 ring-cyan-200';
  if (category === 'growth') return 'text-fuchsia-700 bg-fuchsia-50 ring-fuchsia-200';
  return 'text-sky-700 bg-sky-50 ring-sky-200';
}

// ─── reusable primitives ────────────────────────────────────────────────────
function StatCard({ label, value, sub, valueClass = 'text-slate-900', accent }) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      {accent && (
        <span className={`absolute right-4 top-4 h-2 w-2 rounded-full ${accent}`} />
      )}
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-3 text-4xl font-bold tabular-nums leading-none ${valueClass}`}>{value}</p>
      <p className="mt-2 text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

function ProgressBar({ pct, tone: barClass }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barClass}`}
        style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
      />
    </div>
  );
}

function SectionHeading({ children, count }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-base font-semibold text-slate-800">{children}</h2>
      {count != null && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {count}
        </span>
      )}
    </div>
  );
}

// ─── skeleton loader ────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-5 w-36" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

// ─── main component ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const session = getSession();
  const isAgency = session?.role === 'agency';

  const [verticals, setVerticals]       = useState([]);
  const [dashboards, setDashboards]     = useState({});
  const [kpis, setKpis]                 = useState([]);
  const [attentionRows, setAttentionRows] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [lastUpdated, setLastUpdated]   = useState(null);

  async function load(aliveRef = { current: true }) {
    setLoading(true);
    setError('');
    try {
      const v = await getVerticals();
      if (!aliveRef.current) return;
      const verticalList = Array.isArray(v) ? v : [];
      setVerticals(verticalList);

      const kpiList = session?.role === 'admin' ? await getKPIs() : await getMyKPIs();
      if (!aliveRef.current) return;
      const safeKpis = Array.isArray(kpiList) ? kpiList : [];
      setKpis(safeKpis);

      const dashboardEntries = await Promise.all(
        verticalList.map(async (vertical) => {
          try {
            const d = await getVerticalDashboard(vertical._id);
            return [vertical._id, d];
          } catch {
            return [vertical._id, null];
          }
        })
      );
      if (!aliveRef.current) return;
      setDashboards(Object.fromEntries(dashboardEntries));

      const progressRows = await Promise.all(
        safeKpis.map(async (kpi) => {
          const verticalId   = typeof kpi.vertical === 'string' ? kpi.vertical : kpi.vertical?._id;
          const verticalName = verticalList.find((x) => x._id === verticalId)?.name
            || (typeof kpi.vertical === 'object' ? kpi.vertical?.name : '')
            || 'Unknown Vertical';
          try {
            const progress = await getKPIProgress(kpi._id);
            const perf = Number(progress?.performance || 0);
            return {
              id: kpi._id, name: kpi.name, verticalName,
              category: kpi.category || 'deliverables',
              unit: kpi.unit || 'number',
              frequency: kpi.frequency || 'monthly',
              status: progress?.status || 'Behind',
              performance: Number.isFinite(perf) ? perf : 0,
              target: Number(progress?.target || kpi.target || 0),
              total:  Number(progress?.total || 0),
            };
          } catch {
            return {
              id: kpi._id, name: kpi.name, verticalName,
              category: kpi.category || 'deliverables',
              unit: kpi.unit || 'number',
              frequency: kpi.frequency || 'monthly',
              status: 'Behind', performance: 0,
              target: Number(kpi.target || 0), total: 0,
            };
          }
        })
      );
      if (!aliveRef.current) return;
      setAttentionRows(progressRows);
      setLastUpdated(new Date());
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e.message || 'Failed to load dashboard');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const aliveRef = { current: true };
    load(aliveRef);
    return () => { aliveRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(
    () => verticals.reduce(
      (acc, v) => {
        const d = dashboards[v._id];
        acc.totalKPIs  += Number(d?.totalKPIs  || 0);
        acc.onTrack    += Number(d?.onTrack    || 0);
        acc.atRisk     += Number(d?.atRisk     || 0);
        acc.behind     += Number(d?.behind     || 0);
        acc.completed  += Number(d?.completed  || 0);
        acc.healthSum  += Number(d?.healthScore || 0);
        return acc;
      },
      { totalKPIs: 0, onTrack: 0, atRisk: 0, behind: 0, completed: 0, healthSum: 0 }
    ),
    [dashboards, verticals]
  );

  const avgHealth    = verticals.length ? Math.round(summary.healthSum / verticals.length) : 0;
  const needsAttention = summary.atRisk + summary.behind;
  const totalForBars   = Math.max(summary.totalKPIs, 1);

  const vendorsActive = useMemo(() => {
    const set = new Set();
    for (const kpi of kpis) {
      const assigned = typeof kpi.assignedTo === 'string' ? kpi.assignedTo : kpi.assignedTo?._id;
      if (assigned) set.add(assigned);
    }
    return set.size;
  }, [kpis]);

  const attentionList = useMemo(
    () =>
      [...attentionRows]
        .filter((x) => x.status === 'At Risk' || x.status === 'Behind')
        .sort((a, b) => a.performance - b.performance)
        .slice(0, 6),
    [attentionRows]
  );

  const healthColor =
    avgHealth >= 75 ? 'text-emerald-500' :
    avgHealth >= 50 ? 'text-amber-500'   : 'text-rose-500';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {isAgency ? 'My Overview' : 'Executive Overview'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              {isAgency ? 'My Performance Dashboard' : 'Performance Dashboard'}
            </h1>
            {lastUpdated && !loading && (
              <p className="mt-1 text-[11px] text-slate-400">
                Last refreshed {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => load({ current: true })}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-40 sm:self-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}>
              <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08 1.197.75.75 0 1 1-1.31-.734 6 6 0 0 1 9.44-1.595l.842.841V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.595l-.842-.841v1.018a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5H4.013l.84.841a4.5 4.5 0 0 0 7.08-1.197.75.75 0 0 1 .992-.008Z" clipRule="evenodd" />
            </svg>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </header>

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────────── */}
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* ── KPI Summary Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                label="Portfolio Health"
                value={avgHealth}
                sub={isAgency ? 'my assigned KPI average' : 'average score'}
                valueClass={healthColor}
                accent={healthColor.replace('text-', 'bg-')}
              />
              <StatCard
                label="KPIs On Track"
                value={summary.onTrack}
                sub={`of ${summary.totalKPIs} total`}
                valueClass="text-sky-500"
                accent="bg-sky-400"
              />
              <StatCard
                label="Need Attention"
                value={needsAttention}
                sub="at-risk or behind"
                valueClass="text-amber-500"
                accent="bg-amber-400"
              />
              <StatCard
                label="Vendors Active"
                value={isAgency ? summary.totalKPIs : vendorsActive}
                sub={isAgency ? 'my assigned KPIs' : 'across assignments'}
                valueClass="text-violet-500"
                accent="bg-violet-400"
              />
            </div>

            {/* ── Vertical Health ───────────────────────────────────────── */}
            <section className="space-y-3">
              <SectionHeading count={verticals.length}>{isAgency ? 'My Verticals' : 'Vertical Health'}</SectionHeading>

              {verticals.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                  {isAgency ? 'No verticals are assigned to you yet.' : 'No verticals available.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {verticals.map((v) => {
                    const d = dashboards[v._id] || {};
                    const health = Number(d.healthScore || 0);
                    const healthRing =
                      health >= 75 ? 'ring-emerald-300 text-emerald-600' :
                      health >= 50 ? 'ring-amber-300  text-amber-600'   :
                                     'ring-rose-300   text-rose-600';

                    return (
                      <button
                        key={v._id}
                        type="button"
                        onClick={() => navigate(`/verticals/${v._id}`)}
                        className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        {/* top row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {v.name}
                            </p>
                            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 group-hover:text-slate-700">
                              {v.name}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                              {v.description || 'No description provided.'}
                            </p>
                          </div>
                          {/* health score badge */}
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2 ${healthRing} text-sm font-bold`}>
                            {health}
                          </div>
                        </div>

                        {/* divider */}
                        <div className="my-3 h-px bg-slate-100" />

                        {/* stats row */}
                        <div className="grid grid-cols-3 gap-1 text-center text-xs">
                          <div>
                            <p className="text-slate-400">{isAgency ? 'My KPIs' : 'KPIs'}</p>
                            <p className="mt-0.5 font-semibold text-slate-700">{d.totalKPIs ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-amber-400">At Risk</p>
                            <p className="mt-0.5 font-semibold text-amber-600">{d.atRisk ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-rose-400">Behind</p>
                            <p className="mt-0.5 font-semibold text-rose-600">{d.behind ?? 0}</p>
                          </div>
                        </div>

                        {/* chevron hint */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                          className="absolute bottom-3 right-3 h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-400">
                          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Bottom two panels ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

              {/* KPI Status Breakdown */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <SectionHeading>KPI Status Breakdown</SectionHeading>

                <div className="mt-5 space-y-4">
                  {[
                    { key: 'onTrack',   label: 'On Track',  value: summary.onTrack,   barClass: 'bg-emerald-400' },
                    { key: 'atRisk',    label: 'At Risk',   value: summary.atRisk,    barClass: 'bg-amber-400'   },
                    { key: 'behind',    label: 'Behind',    value: summary.behind,    barClass: 'bg-rose-500'    },
                    { key: 'completed', label: 'Completed', value: summary.completed, barClass: 'bg-sky-400'     },
                  ].map((row) => (
                    <div key={row.key}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">{row.label}</span>
                        <span className="tabular-nums font-semibold text-slate-800">{row.value}</span>
                      </div>
                      <ProgressBar pct={(row.value / totalForBars) * 100} tone={row.barClass} />
                    </div>
                  ))}
                </div>

                {/* summary mini-grid */}
                <div className="mt-5 grid grid-cols-4 divide-x divide-slate-100 rounded-lg border border-slate-100 bg-slate-50">
                  {[
                    { label: 'Total KPIs',  value: summary.totalKPIs,         valueClass: 'text-slate-800' },
                    { label: 'Verticals',   value: verticals.length,           valueClass: 'text-slate-800' },
                    { label: 'Completed',   value: `${summary.completed}/${summary.totalKPIs}`, valueClass: 'text-sky-600' },
                    { label: 'Urgent',      value: needsAttention,             valueClass: 'text-amber-600' },
                  ].map((cell) => (
                    <div key={cell.label} className="flex flex-col items-center px-2 py-3">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{cell.label}</p>
                      <p className={`mt-1 text-sm font-bold tabular-nums ${cell.valueClass}`}>{cell.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Requires Attention */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <SectionHeading count={attentionList.length}>Requires Attention</SectionHeading>

                {attentionList.length === 0 ? (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                      className="h-5 w-5 shrink-0 text-emerald-500">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-medium text-emerald-700">Everything looks on track right now.</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {attentionList.map((item) => {
                      const t = tone(item.status);
                      return (
                        <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400">{item.verticalName}</p>
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${categoryPill(item.category)}`}>
                                  {toLabel(item.category)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {toLabel(item.unit)} • {toLabel(item.frequency)}
                                </span>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${t.pill}`}>
                              {item.status}
                            </span>
                          </div>

                          <div className="mt-2.5">
                            <ProgressBar pct={item.performance} tone={t.bar} />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                            <span>Actual <strong className="text-slate-600">{item.total}</strong></span>
                            <span className="font-medium">{Math.round(item.performance)}%</span>
                            <span>Target <strong className="text-slate-600">{item.target}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

            </div>
          </>
        )}
      </div>
    </div>
  );
}