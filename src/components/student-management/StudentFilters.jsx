import { STUDENT_LEVELS, STUDENT_STATUSES } from '../../types/student.types';

function toOptionList(values = []) {
  return values.filter(Boolean).map((value) => ({ label: value, value }));
}

export default function StudentFilters({
  filters,
  departments,

  halls,
  onChange,
  onReset,
}) {
  const filterItems = [
    {
      key: 'department',
      label: 'Department',
      options: [{ label: 'All', value: 'all' }, ...toOptionList(departments)],
    },
    {
      key: 'level',
      label: 'Level / Year',
      options: [{ label: 'All', value: 'all' }, ...toOptionList(STUDENT_LEVELS)],
    },
  
    {
      key: 'hallName',
      label: 'Hall Name',
      options: [{ label: 'All', value: 'all' }, ...toOptionList(halls)],
    },
    {
      key: 'status',
      label: 'Status',
      options: [{ label: 'All', value: 'all' }, ...toOptionList(STUDENT_STATUSES)],
    },
  ];

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div className="form-grid" style={{ marginBottom: 0 }}>
        {filterItems.map((item) => (
          <label key={item.key} className="field-control">
            <span>{item.label}</span>
            <select value={filters[item.key]} onChange={(event) => onChange(item.key, event.target.value)}>
              {item.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="inline-actions">
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Reset Filters
        </button>
      </div>
    </div>
  );
}
