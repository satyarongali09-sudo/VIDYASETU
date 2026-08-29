type Metric = {
  label: string;
  value: string;
  detail: string;
};

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="grid" aria-label="Metrics">
      {metrics.map((metric) => (
        <article className="card" key={metric.label}>
          <div className="metric">{metric.value}</div>
          <h2>{metric.label}</h2>
          <p>{metric.detail}</p>
        </article>
      ))}
    </section>
  );
}
