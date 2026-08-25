import { formatarNumero } from '@/lib/format';

export interface Barra {
  rotulo: string;
  valor: number | null;
  /** Destaque (ex.: o município consultado) — cor cheia. */
  destaque?: boolean;
}

/**
 * Barras horizontais proporcionais (Onda C) — o encoding visual que a
 * comparação territorial e os rankings não tinham. Sempre AO LADO da
 * tabela, nunca no lugar (a tabela segue sendo a forma citável); por
 * isso as barras são aria-hidden e a leitura acessível fica na tabela.
 * Valor nulo (RN-005) vira travessão, nunca barra zero.
 */
export function GraficoBarras({ barras, unidade }: { barras: Barra[]; unidade?: string }) {
  const validos = barras.filter((b) => b.valor !== null) as (Barra & { valor: number })[];
  if (validos.length === 0) return null;
  const max = Math.max(...validos.map((b) => Math.abs(b.valor)), 0) || 1;

  return (
    <div className="grafico-barras" aria-hidden="true">
      {barras.map((b) => (
        <div key={b.rotulo} className="grafico-barras-linha">
          <span className="grafico-barras-rotulo" title={b.rotulo}>
            {b.rotulo}
          </span>
          {b.valor === null ? (
            <span className="grafico-barras-ausente">— sem dado</span>
          ) : (
            <span className="grafico-barras-trilho">
              <span
                className={`grafico-barras-barra${b.destaque ? ' destaque' : ''}`}
                style={{ width: `${Math.max(1.5, (Math.abs(b.valor) / max) * 100).toFixed(1)}%` }}
              />
              <span className="grafico-barras-valor">
                {formatarNumero(b.valor)}
                {unidade ? ` ${unidade}` : ''}
              </span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
