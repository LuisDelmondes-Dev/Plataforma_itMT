'use client';

import { useMemo, useRef, useState } from 'react';
import { formatarNumero } from '@/lib/format';

export interface PontoAno {
  ano: number;
  valor: number;
}
export interface SerieLinha {
  rotulo: string;
  pontos: PontoAno[];
  /** Série tracejada = hipótese/projeção — nunca se confunde com observado. */
  tracejada?: boolean;
  cor?: string;
}

const CORES_SERIES = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)', 'var(--serie-5)'];
const fmtCompacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Gráfico de linhas do portal (Onda C) — promoção do GraficoCenarios que
 * vivia preso em app/cenarios. SVG próprio, zero dependências. Doutrina
 * visual preservada: observado é linha CHEIA na cor de dado observado;
 * toda série adicional (cenário/projeção) é TRACEJADA e rotulada.
 * Interativo: hover/foco com crosshair e leitura por ano (mouse, toque e
 * setas do teclado), valores anunciados via aria-live.
 */
export function GraficoLinha({
  observados,
  series = [],
  unidade,
  rotuloObservado = 'Observado',
  altura = 260,
}: {
  observados: PontoAno[];
  series?: SerieLinha[];
  unidade: string;
  rotuloObservado?: string;
  altura?: number;
}) {
  const W = 720, H = altura, P = { t: 12, r: 16, b: 28, l: 64 };
  const svgRef = useRef<SVGSVGElement>(null);
  const [anoFoco, setAnoFoco] = useState<number | null>(null);

  const todos = useMemo(
    () => [...observados, ...series.flatMap((s) => s.pontos)],
    [observados, series],
  );
  if (todos.length < 2) return null;

  const anos = todos.map((p) => p.ano), vals = todos.map((p) => p.valor);
  const aMin = Math.min(...anos), aMax = Math.max(...anos);
  const vMin = Math.min(...vals, 0), vMax = Math.max(...vals);
  const x = (ano: number) => P.l + ((ano - aMin) / (aMax - aMin || 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - ((v - vMin) / (vMax - vMin || 1)) * (H - P.t - P.b);
  const linha = (ps: PontoAno[]) =>
    ps.map((p, i) => `${i ? 'L' : 'M'}${x(p.ano).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');

  const base = observados[observados.length - 1];
  const anosEixo = Array.from({ length: aMax - aMin + 1 }, (_, i) => aMin + i);
  const temFuturo = series.some((s) => s.pontos.length > 0);

  const valoresDoAno = (ano: number) => {
    const linhas: { rotulo: string; valor: number | undefined; cor: string; tracejada: boolean }[] = [
      {
        rotulo: rotuloObservado,
        valor: observados.find((p) => p.ano === ano)?.valor,
        cor: 'var(--dado-observado)',
        tracejada: false,
      },
      ...series.map((s, i) => ({
        rotulo: s.rotulo,
        valor: s.pontos.find((p) => p.ano === ano)?.valor,
        cor: s.cor ?? CORES_SERIES[i % CORES_SERIES.length],
        tracejada: s.tracejada !== false,
      })),
    ];
    return linhas.filter((l) => l.valor !== undefined) as {
      rotulo: string; valor: number; cor: string; tracejada: boolean;
    }[];
  };

  function anoDoEvento(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return aMin;
    const r = svg.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    const frac = (px - P.l) / (W - P.l - P.r);
    return Math.round(aMin + Math.min(1, Math.max(0, frac)) * (aMax - aMin));
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setAnoFoco((a) => Math.min((a ?? aMin) + 1, aMax));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setAnoFoco((a) => Math.max((a ?? aMax) - 1, aMin));
    } else if (e.key === 'Escape') {
      setAnoFoco(null);
    }
  }

  const foco = anoFoco !== null ? valoresDoAno(anoFoco) : [];

  return (
    <div className="grafico-linha">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Série de ${aMin} a ${aMax}, em ${unidade}. Use as setas para ler os valores ano a ano.`}
        tabIndex={0}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => setAnoFoco(anoDoEvento(e.clientX))}
        onPointerLeave={() => setAnoFoco(null)}
        onKeyDown={aoTeclar}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => {
          const v = vMin + f * (vMax - vMin);
          return (
            <g key={f}>
              <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
              <text x={P.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--ink-3)">
                {fmtCompacto.format(v)}
              </text>
            </g>
          );
        })}
        {anosEixo.map((a) => (
          <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
            {a}
          </text>
        ))}
        {temFuturo && (
          <line x1={x(base.ano)} x2={x(base.ano)} y1={P.t} y2={H - P.b} stroke="var(--border)" strokeDasharray="2 3" />
        )}
        {series.map((s, i) => (
          <path
            key={s.rotulo}
            d={linha(s.pontos[0]?.ano > base.ano ? [base, ...s.pontos] : s.pontos)}
            fill="none"
            stroke={s.cor ?? CORES_SERIES[i % CORES_SERIES.length]}
            strokeWidth="2"
            strokeDasharray={s.tracejada === false ? undefined : '5 4'}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.9"
          />
        ))}
        <path
          d={linha(observados)}
          fill="none"
          stroke="var(--dado-observado)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {observados.map((p) => (
          <circle
            key={p.ano}
            cx={x(p.ano)}
            cy={y(p.valor)}
            r={p.ano === base.ano ? 3.5 : 2.5}
            fill="var(--dado-observado)"
          />
        ))}
        {anoFoco !== null && (
          <line x1={x(anoFoco)} x2={x(anoFoco)} y1={P.t} y2={H - P.b} stroke="var(--outline)" strokeWidth="1" />
        )}
        {foco.map((l) => (
          <circle key={l.rotulo} cx={x(anoFoco!)} cy={y(l.valor)} r={4} fill={l.cor} stroke="var(--surface-container-lowest)" strokeWidth="1.5" />
        ))}
      </svg>

      {anoFoco !== null && foco.length > 0 && (
        <div
          className="grafico-tooltip"
          style={{ left: `${((x(anoFoco) / W) * 100).toFixed(1)}%` }}
        >
          <strong>{anoFoco}</strong>
          {foco.map((l) => (
            <span key={l.rotulo}>
              <span className="grafico-tooltip-forma" style={{ color: l.cor }} aria-hidden>
                {l.tracejada ? '╌' : '—'}
              </span>{' '}
              {l.rotulo}: {formatarNumero(l.valor)} {unidade}
            </span>
          ))}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {anoFoco !== null && foco.length
          ? `${anoFoco}: ${foco.map((l) => `${l.rotulo} ${formatarNumero(l.valor)} ${unidade}`).join('; ')}`
          : ''}
      </span>

      <div className="grafico-legenda">
        <span>
          <span className="grafico-tooltip-forma" style={{ color: 'var(--dado-observado)' }} aria-hidden>—</span>{' '}
          {rotuloObservado} (dado real)
        </span>
        {series.map((s, i) => (
          <span key={s.rotulo}>
            <span
              className="grafico-tooltip-forma"
              style={{ color: s.cor ?? CORES_SERIES[i % CORES_SERIES.length] }}
              aria-hidden
            >
              {s.tracejada === false ? '—' : '╌'}
            </span>{' '}
            {s.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
