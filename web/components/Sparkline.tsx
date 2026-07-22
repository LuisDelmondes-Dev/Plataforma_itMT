/**
 * Sparkline SVG mínimo, sem dependência — tendência anual do indicador.
 * `projecao` (opcional) desenha a continuação TRACEJADA e com pontos
 * vazados: projeção declarada nunca se confunde com dado observado.
 */
export function Sparkline({
  pontos,
  unidade,
  projecao = [],
}: {
  pontos: { ano: number; valor: number }[];
  unidade: string;
  projecao?: { ano: number; valor: number }[];
}) {
  if (pontos.length < 2) return null;
  const todos = [...pontos, ...projecao];
  const W = 320, H = 56, P = 4;
  const vals = todos.map((p) => p.valor);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (todos.length - 1);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const d = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  // a projeção parte do último ponto observado
  const dProj = projecao.length
    ? [`M${x(pontos.length - 1).toFixed(1)},${y(pontos[pontos.length - 1].valor).toFixed(1)}`,
       ...projecao.map((p, i) => `L${x(pontos.length + i).toFixed(1)},${y(p.valor).toFixed(1)}`)].join(' ')
    : null;
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label={
        `Tendência de ${pontos[0].ano} a ${ultimo.ano}, de ${min} a ${max} ${unidade}` +
        (projecao.length ? `; projeção tracejada até ${projecao[projecao.length - 1].ano}` : '')
      }
      style={{ display: 'block', marginTop: 8 }}
    >
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {dProj && (
        <path d={dProj} fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="4 4"
          strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
      )}
      {pontos.map((p, i) => (
        <circle key={p.ano} cx={x(i)} cy={y(p.valor)} r={i === pontos.length - 1 ? 3 : 2} fill="var(--primary)" />
      ))}
      {projecao.map((p, i) => (
        <circle key={`proj-${p.ano}`} cx={x(pontos.length + i)} cy={y(p.valor)} r={2.5}
          fill="var(--surface, #fff)" stroke="var(--primary)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
