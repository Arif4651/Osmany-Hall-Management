import { Search } from 'lucide-react';

export default function StudentSearchBar({ value, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.55rem',
        width: '100%',
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.52rem 0.7rem',
      }}
    >
      <Search size={16} color="#6b7f9f" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name, student ID, hall ID, mobile"
        style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
      />
    </label>
  );
}
