import "./Metrics.css";

interface MetricsProps {
  label: string;
  value: string;
}

export function Metrics({ label, value }: MetricsProps) {
  return (
    <div className="metric-display">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}
