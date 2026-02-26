import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#c97b63', '#6b9bd1', '#7bc96b', '#d4a373', '#9b8dc4'];

export default function MetricVsTimeChart({ data, field, fields }) {
  const [enlarged, setEnlarged] = useState(false);
  const series = data?.series;
  const labels = data?.labels;
  const legacyValues = data?.values;
  const legacyField = field || (fields && fields[0]);
  const isLegacy = !series && labels?.length && legacyValues?.length;
  const metricFields = fields && fields.length ? fields : (legacyField ? [legacyField] : []);
  const chartData = isLegacy
    ? labels.map((label, i) => ({ date: label, [legacyField]: legacyValues[i] }))
    : series && labels?.length
      ? labels.map((label, i) => {
          const row = { date: label };
          for (const s of series) row[s.field] = s.values[i];
          return row;
        })
      : [];
  if (!chartData.length) return null;

  const chartEl = (
    <ResponsiveContainer width="100%" height={enlarged ? 400 : 280}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
        <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
        <Tooltip contentStyle={{ background: 'rgba(15,15,35,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }} />
        {metricFields.map((f, i) => (
          <Line key={f} type="monotone" dataKey={f} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} name={f} />
        ))}
        {metricFields.length > 1 && <Legend />}
      </LineChart>
    </ResponsiveContainer>
  );

  const handleDownload = (e) => {
    if (e) e.stopPropagation();
    const headers = ['date', ...metricFields].join(',');
    const rows = chartData.map((r) => [r.date, ...metricFields.map((f) => r[f])].join(','));
    const csv = headers + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plot_${metricFields.join('_')}_vs_time.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const labelText = metricFields.length > 1 ? `${metricFields.join(', ')} vs time` : `${metricFields[0] || 'metric'} vs time`;

  return (
    <div className="metric-vs-time-chart">
      <p className="metric-vs-time-label">{labelText}</p>
      {!enlarged ? (
        <div className="chart-inline" onClick={() => setEnlarged(true)}>
          {chartEl}
        </div>
      ) : (
        <div className="chart-enlarged" onClick={() => setEnlarged(false)}>
          <div onClick={(e) => e.stopPropagation()}>{chartEl}</div>
          <div className="chart-enlarged-actions">
            <button type="button" onClick={handleDownload}>Download CSV</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setEnlarged(false); }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
