import StatusBadge from '../ui/StatusBadge';

export default function DataTable({ columns, rows, getRowKey }) {
  return (
    <div className="table-wrapper" role="region" aria-label="Data table">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey ? getRowKey(row, rowIndex) : row.id || rowIndex}>
              {columns.map((col) => {
                const value = row[col.key];
                if (col.type === 'status') {
                  return (
                    <td key={col.key}>
                      <StatusBadge value={value} />
                    </td>
                  );
                }

                return <td key={col.key}>{col.render ? col.render(value, row) : value}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}