import { useEffect, useMemo, useState } from 'react';
import Button from '../components/Button.jsx';
import Field from '../components/Field.jsx';
import { getKPIs } from '../services/kpis.js';
import { getKPIProgress } from '../services/submissions.js';
import {
  createVertical,
  deleteVertical,
  getVerticalDashboard,
  getVerticals,
  updateVertical,
} from '../services/verticals.js';

export default function VerticalManagementPage() {
  const [verticals, setVerticals] = useState([]);
  const [selectedVerticalId, setSelectedVerticalId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [progressByKpi, setProgressByKpi] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  async function loadAll(aliveRef = { current: true }) {
    setLoading(true);
    setError('');
    try {
      const [allVerticals, allKpis] = await Promise.all([getVerticals(), getKPIs()]);
      if (!aliveRef.current) return;

      const vList = Array.isArray(allVerticals) ? allVerticals : [];
      setVerticals(vList);
      setKpis(Array.isArray(allKpis) ? allKpis : []);

      const nextSelected =
        selectedVerticalId && vList.some((v) => v._id === selectedVerticalId)
          ? selectedVerticalId
          : vList[0]?._id || '';

      setSelectedVerticalId(nextSelected);
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e.message || 'Failed to load verticals');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const aliveRef = { current: true };
    loadAll(aliveRef);
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadSelectedData() {
      if (!selectedVerticalId) {
        setDashboard(null);
        setProgressByKpi({});
        setEditName('');
        setEditDescription('');
        return;
      }

      const selected = verticals.find((v) => v._id === selectedVerticalId) || null;
      setEditName(selected?.name || '');
      setEditDescription(selected?.description || '');

      try {
        const dash = await getVerticalDashboard(selectedVerticalId).catch(() => null);
        if (!alive) return;
        setDashboard(dash);

        const selectedKpis = kpis.filter((k) => {
          const vId = typeof k.vertical === 'string' ? k.vertical : k.vertical?._id;
          return vId === selectedVerticalId;
        });

        const entries = await Promise.all(
          selectedKpis.map(async (k) => {
            try {
              const progress = await getKPIProgress(k._id);
              return [k._id, progress];
            } catch {
              return [k._id, null];
            }
          })
        );

        if (!alive) return;
        setProgressByKpi(Object.fromEntries(entries));
      } catch {
        if (!alive) return;
        setDashboard(null);
        setProgressByKpi({});
      }
    }

    loadSelectedData();
    return () => {
      alive = false;
    };
  }, [selectedVerticalId, verticals, kpis]);

  const selectedVertical =
    verticals.find((v) => v._id === selectedVerticalId) || null;

  const vendorGroups = useMemo(() => {
    if (!selectedVerticalId) return [];
    const selectedKpis = kpis.filter((k) => {
      const vId = typeof k.vertical === 'string' ? k.vertical : k.vertical?._id;
      return vId === selectedVerticalId;
    });

    const groups = new Map();
    for (const kpi of selectedKpis) {
      const assigned = kpi.assignedTo;
      const vendorId = typeof assigned === 'string' ? assigned : assigned?._id || 'unassigned';
      const vendorName =
        typeof assigned === 'string' ? assigned : assigned?.name || 'Unassigned Vendor';

      if (!groups.has(vendorId)) {
        groups.set(vendorId, {
          id: vendorId,
          name: vendorName,
          email: typeof assigned === 'object' ? assigned?.email || '' : '',
          companyName: typeof assigned === 'object' ? assigned?.companyName || '' : '',
          agencyType: typeof assigned === 'object' ? assigned?.agencyType || '' : '',
          contractValue: typeof assigned === 'object' ? Number(assigned?.contractValue || 0) : 0,
          engagementStart: typeof assigned === 'object' ? assigned?.engagementStart || null : null,
          engagementEnd: typeof assigned === 'object' ? assigned?.engagementEnd || null : null,
          primaryContact: typeof assigned === 'object' ? assigned?.primaryContact || '' : '',
          profileScore: typeof assigned === 'object' ? Number(assigned?.profileScore || 0) : 0,
          items: [],
        });
      }

      const progress = progressByKpi[kpi._id];
      groups.get(vendorId).items.push({
        id: kpi._id,
        name: kpi.name,
        category: kpi.category || 'deliverables',
        unit: kpi.unit || 'number',
        frequency: kpi.frequency || 'monthly',
        status: progress?.status || 'Behind',
        performance: Number(progress?.performance || 0),
        total: Number(progress?.total || 0),
        target: Number(progress?.target || kpi.target || 0),
      });
    }

    return Array.from(groups.values());
  }, [kpis, progressByKpi, selectedVerticalId]);

  function statusBadgeTone(status) {
    if (status === 'On Track') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
    if (status === 'At Risk') return 'border-amber-300 bg-amber-50 text-amber-700';
    return 'border-rose-300 bg-rose-50 text-rose-700';
  }

  function statusBarTone(status) {
    if (status === 'On Track') return 'bg-emerald-400';
    if (status === 'At Risk') return 'bg-amber-400';
    return 'bg-rose-500';
  }

  function toLabel(value = '') {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—';
  }

  function categoryTone(category) {
    if (category === 'revenue') return 'border-violet-200 bg-violet-50 text-violet-700';
    if (category === 'timeline') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (category === 'brand') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (category === 'operations') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    if (category === 'growth') return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700';
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  function money(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function monthLabel(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const res = await createVertical({ name: createName, description: createDescription });
      const createdId = res?.vertical?._id;
      setCreateName('');
      setCreateDescription('');
      setShowCreateForm(false);
      setSuccess(res?.message || 'Vertical created successfully.');
      await loadAll();
      if (createdId) setSelectedVerticalId(createdId);
    } catch (e2) {
      setError(e2.message || 'Failed to create vertical');
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateCurrent(e) {
    e.preventDefault();
    if (!selectedVerticalId) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await updateVertical(selectedVerticalId, { name: editName, description: editDescription });
      setSuccess('Vertical updated successfully.');
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'Failed to update vertical');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteCurrent() {
    if (!selectedVerticalId) return;
    if (!confirm('Delete this vertical?')) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const res = await deleteVertical(selectedVerticalId);
      setSuccess(res?.message || 'Vertical deleted successfully.');
      await loadAll();
    } catch (e2) {
      setError(e2.message || 'Failed to delete vertical');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading vertical details...</div>;
  }

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white px-4 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Vertical Details</div>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Verticals</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsManagementOpen(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
          >
            Vertical Management
          </button>
          <button
            type="button"
            onClick={() => loadAll({ current: true })}
            disabled={loading || busy}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg bg-rose-50 text-rose-700 px-3 py-2 text-sm ring-1 ring-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2 text-sm ring-1 ring-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {verticals.map((v) => (
          <button
            key={v._id}
            type="button"
            onClick={() => setSelectedVerticalId(v._id)}
            className={`rounded border px-3 py-1.5 text-xs uppercase tracking-wide ${
              v._id === selectedVerticalId
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{selectedVertical?.name || 'Vertical'}</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{selectedVertical?.name || 'Vertical'}</div>
            <div className="mt-1 text-xs text-slate-500">{selectedVertical?.description || 'No description provided.'}</div>
          </div>
          <div className="h-10 w-10 rounded-full border border-amber-400 bg-white flex items-center justify-center text-sm font-semibold text-amber-700">
            {dashboard?.healthScore ?? 0}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-200 pt-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">On Track</div>
            <div className="mt-1 text-2xl text-emerald-600">{dashboard?.onTrack ?? 0}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">At Risk</div>
            <div className="mt-1 text-2xl text-amber-600">{dashboard?.atRisk ?? 0}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Behind</div>
            <div className="mt-1 text-2xl text-rose-600">{dashboard?.behind ?? 0}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Completed</div>
            <div className="mt-1 text-2xl text-sky-600">{dashboard?.completed ?? 0}</div>
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-slate-900">Vendors & KPIs</h2>
        <div className="mt-4 space-y-4">
          {vendorGroups.map((group) => (
            <div key={group.id} className="rounded border border-slate-200 bg-slate-50 p-3">
              {(() => {
                const perfList = group.items.map((x) => Number(x.performance || 0));
                const score = perfList.length
                  ? Math.round(perfList.reduce((sum, p) => sum + p, 0) / perfList.length)
                  : 0;
                return (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">{group.name}</div>
                  <div className="text-xs text-slate-500">{group.agencyType || group.email || 'Vendor'}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {money(group.contractValue)} • {monthLabel(group.engagementStart)} - {monthLabel(group.engagementEnd)} • {group.primaryContact || '-'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700">
                    {Math.max(0, Math.min(100, score))}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Work Done %</div>
                </div>
              </div>
                );
              })()}

              <div className="mt-3 space-y-3">
                {group.items.map((item) => (
                  <div key={item.id}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="text-slate-700">{item.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryTone(item.category)}`}>
                            {toLabel(item.category)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {toLabel(item.unit)} • {toLabel(item.frequency)}
                          </span>
                        </div>
                      </div>
                      <span className={`rounded border px-2 py-0.5 uppercase tracking-wide ${statusBadgeTone(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full ${statusBarTone(item.status)}`}
                        style={{ width: `${Math.min(100, Math.max(2, item.performance))}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Actual {item.total}</span>
                      <span>Target {item.target}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {vendorGroups.length === 0 ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No vendor KPI data.</div>
          ) : null}
        </div>
      </section>

      {isManagementOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-10"
          onClick={() => setIsManagementOpen(false)}
        >
          <section
            className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <h2 className="text-xl font-semibold text-slate-900">Vertical Management</h2>
              <button
                type="button"
                onClick={() => setIsManagementOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">Create, edit, and delete verticals.</div>
              <Button
                variant={showCreateForm ? 'secondary' : 'primary'}
                disabled={busy}
                onClick={() => setShowCreateForm((v) => !v)}
              >
                {showCreateForm ? 'Cancel Create' : 'Create Vertical'}
              </Button>
            </div>

            {showCreateForm ? (
              <form onSubmit={onCreate} className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Name">
                    <input
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                      required
                      disabled={busy}
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                      disabled={busy}
                    />
                  </Field>
                </div>
                <div className="mt-3">
                  <Button type="submit" disabled={busy}>
                    Create
                  </Button>
                </div>
              </form>
            ) : null}

            <form onSubmit={onUpdateCurrent} className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-medium text-slate-900">Edit Selected Vertical</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Name">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    required
                    disabled={busy}
                  />
                </Field>
                <Field label="Description">
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    disabled={busy}
                  />
                </Field>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button type="submit" disabled={busy || !selectedVerticalId}>
                  Update
                </Button>
                <Button type="button" variant="danger" disabled={busy || !selectedVerticalId} onClick={onDeleteCurrent}>
                  Delete Selected
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
