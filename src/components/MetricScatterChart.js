import { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MetricScatterChart({ data, xField, yField }) {
  const [enlarged, setEnlarged] = useState(false);
  const points = data?.points;
  if (!points?.length) return null;

  const chartData = points.map((p) => ({ x: p.x, y: p.y, name: p.label || `${p.x}, ${p.y}` }));

  const chartEl = (
    <ResponsiveContainer width="100%" height={enlarged ? 400 : 280}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
        <XAxis dataKey="x" name={xField} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
        <YAxis dataKey="y" name={yField} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: 'rgba(15,15,35,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
          formatter={(val) => [val, '']}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
        />
        <Scatter data={chartData} fill="#c97b63" fillOpacity={0.9} name="" />
      </ScatterChart>
    </ResponsiveContainer>
  );

  const handleDownload = (e) => {
    if (e) e.stopPropagation();
    const csv = `${xField},${yField},label\n` + chartData.map((r) => `${r.x},${r.y},"${(r.name || '').replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plot_${xField}_vs_${yField}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="metric-vs-time-chart">
      <p className="metric-vs-time-label">{yField} vs {xField}</p>
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
