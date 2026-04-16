export default function KeyValueList({ items }) {
  return (
    <dl className="key-value-list">
      {items.map((item) => (
        <div key={item.label} className="key-value-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}