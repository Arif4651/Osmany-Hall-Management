import {
  DEPARTMENTS,
  HALL_NAMES,
  STUDENT_LEVELS,
  STUDENT_STATUSES,
} from '../../types/student.types';

const GENDER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
];

function toOptionList(values = []) {
  return values.filter(Boolean).map((value) => ({ label: value, value }));
}

function mergeOptionValues(...lists) {
  return Array.from(
    new Set(
      lists
        .flat()
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
}

export default function StudentFilters({
  filters,
  departments,
  halls,
  onChange,
  onReset,
  // wing admins have a fixed wing — hide gender filter for them
  isWingAdmin = false,
}) {
  const departmentOptions = mergeOptionValues(DEPARTMENTS, departments);
  const hallOptions = mergeOptionValues(HALL_NAMES, halls);

  const filterItems = [
    {
      key: 'department',
      label: 'Department',
      options: [{ label: 'All', value: 'all' }, ...toOptionList(departmentOptions)],
    },
    {
      key: 'level',
      label: 'Level / Year',
      options: [{ label: 'All', value: 'all' }, ...toOptionList(STUDENT_LEVELS)],
    },
    {
      key: 'hallName',
      label: 'Hall Name',
      options: [{ label: 'All', value: 'all' }, ...toOptionList(hallOptions)],
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

        {/* Gender filter — only shown to super_admin / admin, not wing admins */}
        {!isWingAdmin && (
          <label className="field-control">
            <span>Gender</span>
            <select value={filters.gender ?? 'all'} onChange={(event) => onChange('gender', event.target.value)}>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="inline-actions">
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Reset Filters
        </button>
      </div>
    </div>
  );
}
