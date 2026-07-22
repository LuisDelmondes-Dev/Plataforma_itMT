/** Sparkline SVG mínimo, sem dependência — tendência anual do indicador. */
export function Sparkline({ pontos, unidade }: { pontos: { ano: number; valor: number }[]; unidade: string }) {
  if (pontos.length < 2) return null;
  const W = 320, H = 56, P = 4;
  const vals = pontos.map((p) => p.valor);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (pontos.length - 1);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const d = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label={`Tendência de ${pontos[0].ano} a ${ultimo.ano}, de ${min} a ${max} ${unidade}`}
      style={{ display: 'block', marginTop: 8 }}
    >
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((p, i) => (
        <circle key={p.ano} cx={x(i)} cy={y(p.valor)} r={i === pontos.length - 1 ? 3 : 2} fill="var(--primary)" />
      ))}
    </svg>
  );
}
