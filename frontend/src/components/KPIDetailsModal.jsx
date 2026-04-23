import React from 'react';

export default function KPIDetailsModal({ kpi, onClose }) {
  if (!kpi) return null;

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
        <div className="space-y-2">
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
      </div>
    </div>
  );
}
