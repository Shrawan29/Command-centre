export default function Table({ columns, rows, rowKey }) {
  return (
    <div className="overflow-auto rounded-lg ring-1 ring-slate-200 bg-white">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-50">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-sm text-slate-500" colSpan={columns.length}>
                No data.
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr
                key={rowKey ? rowKey(r) : idx}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}
              >
                {columns.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-3 py-2 text-sm text-slate-800">
                    {c.cell ? c.cell(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
