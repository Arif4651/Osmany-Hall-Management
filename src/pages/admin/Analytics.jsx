import React from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar
} from 'recharts';
import useDocumentTitle from '../../hooks/useDocumentTitle';

// Mock Data specific to the new layout
const preferenceData = [
  { name: 'chicken', value: 85, color: '#5a55d2' },
  { name: 'veg', value: 38, color: '#8b5cf6' },
  { name: 'egg', value: 120, color: '#ef4444' },
  { name: 'fish', value: 63, color: '#f59e0b' },
  { name: 'beef', value: 42, color: '#10b981' },
];

const participationData = [
  { month: 'Nov', breakfast: 620, lunch: 680, dinner: 590 },
  { month: 'Dec', breakfast: 580, lunch: 650, dinner: 560 },
  { month: 'Jan', breakfast: 640, lunch: 700, dinner: 610 },
  { month: 'Feb', breakfast: 660, lunch: 720, dinner: 620 },
  { month: 'Mar', breakfast: 690, lunch: 730, dinner: 640 },
  { month: 'Apr', breakfast: 710, lunch: 740, dinner: 700 },
];

const billingData = [
  { month: 'Nov', billing: 980000, collection: 890000 },
  { month: 'Dec', billing: 920000, collection: 850000 },
  { month: 'Jan', billing: 1050000, collection: 960000 },
  { month: 'Feb', billing: 1100000, collection: 1030000 },
  { month: 'Mar', billing: 1160000, collection: 1050000 },
  { month: 'Apr', billing: 1220000, collection: 880000 },
];

// Helper for large numbers on Y axis
const formatYAxis = (tickItem) => {
  if (tickItem >= 1000) {
    return (tickItem / 1000) + 'K';
  }
  return tickItem;
};

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value, color }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) + 35;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill={color} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="14" fontWeight="500">
      {name}: {value}
    </text>
  );
};

export default function Analytics() {
  useDocumentTitle('Analytics');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Forecast & Analytics</h1>
        <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Predictions and trends for mess operations</p>
      </div>

      {/* Row 1: Forecast */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 20px 0' }}>Tomorrow's Meal Forecast</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {[
            { label: 'Breakfast', count: 198 },
            { label: 'Lunch', count: 225 },
            { label: 'Dinner', count: 210 }
          ].map(meal => (
            <div key={meal.label} style={{ flex: 1, minWidth: '200px', backgroundColor: '#f8fafc', padding: '24px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '8px' }}>{meal.label}</div>
              <div style={{ color: '#4f46e5', fontSize: '2.5rem', fontWeight: '500', lineHeight: 1 }}>{meal.count}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '8px' }}>students</div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Distribution & Participation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(400px, 1.5fr)', gap: '24px' }}>
        {/* Left: Preferences */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 20px 0' }}>Preference Distribution (Tomorrow)</h2>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={preferenceData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  labelLine={false}
                  label={CustomPieLabel}
                >
                  {preferenceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Trend */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 20px 0' }}>Meal Participation Trend</h2>
          <div style={{ flex: 1, minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={participationData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} domain={[0, 800]} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                <Line type="monotone" dataKey="breakfast" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="lunch" stroke="#10b981" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="dinner" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Billing vs Collection */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 20px 0' }}>Monthly Billing vs Collection</h2>
        <div style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={billingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
              <YAxis tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={formatYAxis} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
              <Bar dataKey="billing" fill="#5a55d2" radius={[4, 4, 0, 0]} maxBarSize={60} />
              <Bar dataKey="collection" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}