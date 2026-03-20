import StatsBox from './StatsBox.jsx';

export default function VerticalCard({ vertical, dashboard, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl bg-white ring-1 ring-slate-200 hover:ring-slate-300 transition p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{vertical.name}</div>
          {vertical.description ? (
            <div className="mt-1 text-xs text-slate-500 line-clamp-2">{vertical.description}</div>
          ) : null}
        </div>
        <div className="shrink-0 rounded-lg bg-slate-900 text-white px-2.5 py-1 text-xs font-semibold">
          Health {dashboard?.healthScore ?? 0}%
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatsBox label="On Track" value={dashboard?.onTrack ?? 0} />
        <StatsBox label="At Risk" value={dashboard?.atRisk ?? 0} />
        <StatsBox label="Behind" value={dashboard?.behind ?? 0} />
        <StatsBox label="Completed" value={dashboard?.completed ?? 0} />
      </div>
    </button>
  );
}
