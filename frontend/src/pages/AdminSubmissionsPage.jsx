import { useEffect, useMemo, useState } from 'react';
import { getKPIs } from '../services/kpis.js';
import { getAdminSubmissions } from '../services/submissions.js';
import { getUsers } from '../services/users.js';
import { getVerticals } from '../services/verticals.js';

function normalizeWeek(value = '') {
  const m = String(value).trim().match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) return '';
  const week = Number(m[2]);
  if (week < 1 || week > 53) return '';
  return `${m[1]}-W${String(week).padStart(2, '0')}`;
}

function weekDisplay(value = '') {
  const normalized = normalizeWeek(value);
  if (!normalized) return value || '-';
  const [, year, week] = normalized.match(/^(\d{4})-W(\d{2})$/);
  return `Week ${Number(week)}, ${year}`;
}

function dateTimeLabel(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminSubmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [rows, setRows] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [verticals, setVerticals] = useState([]);

  const [week, setWeek] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [kpiId, setKpiId] = useState('');
  const [verticalId, setVerticalId] = useState('');

  const filters = useMemo(
    () => ({
      week: normalizeWeek(week),
      vendorId,
      kpiId,
      verticalId,
    }),
    [week, vendorId, kpiId, verticalId]
  );

  async function loadOptions() {
    const [usersData, kpisData, verticalsData] = await Promise.all([
      getUsers(),
      getKPIs(),
      getVerticals(),
    ]);

    setVendors((Array.isArray(usersData) ? usersData : []).filter((user) => user.role === 'agency'));
    setKpis(Array.isArray(kpisData) ? kpisData : []);
    setVerticals(Array.isArray(verticalsData) ? verticalsData : []);
  }

  async function loadSubmissions(isRefresh = false) {
    setError('');
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getAdminSubmissions(filters);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load submissions');
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        await loadOptions();
        if (!alive) return;
        await loadSubmissions(false);
      } catch (e) {
        if (!alive) return;
        setError(e.message || 'Failed to load admin data');
        setLoading(false);
      }
    }

    init();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    loadSubmissions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.week, filters.vendorId, filters.kpiId, filters.verticalId]);

  const uniqueSubmitters = useMemo(() => {
    const ids = new Set(rows.map((row) => row?.vendor?._id).filter(Boolean));
    return ids.size;
  }, [rows]);

  const totalSubmittedValue = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row?.value || 0), 0),
    [rows]
  );

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Submission Monitor</h1>
        <p className="mt-2 text-sm text-slate-500">
          Track who submitted reports and filter records by week, vendor, KPI, and vertical.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Total Reports</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Who Submitted</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{uniqueSubmitters}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Submitted Value</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalSubmittedValue.toFixed(2)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Filters</h2>
          <button
            type="button"
            onClick={() => loadSubmissions(true)}
            disabled={refreshing}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Week</span>
            <input
              type="week"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
            <span className="block text-[11px] text-slate-400">{week ? weekDisplay(week) : 'All weeks'}</span>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vendor</span>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor._id} value={vendor._id}>{vendor.name} ({vendor.email})</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">KPI</span>
            <select
              value={kpiId}
              onChange={(e) => setKpiId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">All KPIs</option>
              {kpis.map((kpi) => (
                <option key={kpi._id} value={kpi._id}>{kpi.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vertical</span>
            <select
              value={verticalId}
              onChange={(e) => setVerticalId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">All verticals</option>
              {verticals.map((vertical) => (
                <option key={vertical._id} value={vertical._id}>{vertical.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Submission Records</h2>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2 px-4 py-4">
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">No submissions match the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Week</th>
                  <th className="px-4 py-3 font-semibold">Vendor</th>
                  <th className="px-4 py-3 font-semibold">KPI</th>
                  <th className="px-4 py-3 font-semibold">Vertical</th>
                  <th className="px-4 py-3 font-semibold">Value</th>
                  <th className="px-4 py-3 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{weekDisplay(row.week)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.vendor?.name || '-'}</p>
                      <p className="text-xs text-slate-500">{row.vendor?.email || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{row.kpi?.name || '-'}</p>
                      <p className="text-xs text-slate-500">{row.kpi?.frequency || '-'} {row.kpi?.unit || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.kpi?.vertical?.name || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{Number(row.value || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-700">{dateTimeLabel(row.updatedAt || row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
