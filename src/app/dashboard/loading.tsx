export default function Loading() {
  return (
    <div aria-label="Loading dashboard" role="status">
      <div className="stats-grid">
        {[1, 2, 3, 4].map((n) => (
          <div className="skeleton" key={n} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 300, marginTop: 20 }} />
    </div>
  );
}
