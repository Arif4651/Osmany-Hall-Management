import Card from '../ui/Card';
import { formatCurrency } from '../../utils/formatters';

export default function StatCard({ title, value, trend, tone = 'info', isCurrency = false, unit }) {
  const mappedValue = isCurrency ? formatCurrency(value) : value;

  return (
    <Card className="stat-card">
      <p className="stat-title">{title}</p>
      <h3 className="stat-value">
        {mappedValue}
        {unit ? <span className="stat-unit"> {unit}</span> : null}
      </h3>
      {trend ? <p className={`stat-trend stat-trend-${tone}`}>{trend}</p> : null}
    </Card>
  );
}