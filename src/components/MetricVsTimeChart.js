import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MetricVsTimeChart({ data, field }) {
  const [enlarged, setEnlarged] = useState(false);
  if (!data?.labels?.length || !data?.values?.length) return null;
  const chartData = data.labels.map((label, i) => ({ date: label, value: data.values[i] }));

  const chartEl = (
    <ResponsiveContainer width="100%" height={enlarged ? 400 : 280}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
        <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
        <Tooltip contentStyle={{ background: 'rgba(15,15,35,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }} />
        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name={field} />
      </LineChart>
    </ResponsiveContainer>
  );

  const handleDownload = (e) => {
    if (e) e.stopPropagation();
    const csv = 'date,' + field + '\n' + chartData.map((r) => `${r.date},${r.value}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plot_${field}_vs_time.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="metric-vs-time-chart">
      <p className="metric-vs-time-label">{field} vs time</p>
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
