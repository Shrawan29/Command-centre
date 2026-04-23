import React from 'react';

export default function KPIDetailsModal({ kpi, onClose }) {
  if (!kpi) return null;

  // Try to extract token metrics (Instagram/FB metrics) from kpi.meta.tokenMetrics
  const tokenMetrics = kpi?.meta?.tokenMetrics || {};
  // Show all tokenMetrics if present, otherwise show a message
  const hasTokenMetrics = Object.keys(tokenMetrics).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
        <button
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
          onClick={onClose}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-4">KPI Details</h2>
        <div className="space-y-2 mb-4">
          <div><span className="font-semibold">Name:</span> {kpi.name}</div>
          <div><span className="font-semibold">Category:</span> {kpi.category}</div>
          <div><span className="font-semibold">Unit:</span> {kpi.unit}</div>
          <div><span className="font-semibold">Frequency:</span> {kpi.frequency}</div>
          <div><span className="font-semibold">Target:</span> {kpi.target}</div>
          <div><span className="font-semibold">Status:</span> {kpi.status}</div>
          <div><span className="font-semibold">Due Date:</span> {kpi.dueDate || kpi.deadline || 'Ongoing'}</div>
          <div><span className="font-semibold">Assigned To:</span> {kpi.assignedToName || kpi.assignedTo}</div>
          <div><span className="font-semibold">Description:</span> {kpi.description || '—'}</div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">KPI Metrics</h3>
          {hasTokenMetrics ? (
            <ul className="space-y-1">
              {Object.entries(tokenMetrics).map(([key, value]) => (
                <li key={key}>
                  <span className="font-medium text-slate-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</span> {value}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-slate-400 text-sm">No additional metrics available for this KPI.</div>
          )}
        </div>
      </div>
    </div>
  );
}
