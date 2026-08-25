export default function Loading() {
  return (
    <div role="status" aria-live="polite" style={{ display: 'grid', gap: 12, padding: '24px 0' }}>
      <div className="skeleton" style={{ height: 32, width: '40%' }} />
      <div className="skeleton" style={{ height: 16, width: '68%' }} />
      <div className="skeleton" style={{ height: 220, width: '100%' }} />
      <span className="sr-only">Carregando a página…</span>
    </div>
  );
}
