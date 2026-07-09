import type { Resultado } from '@/lib/api';
import { ReguaProcedencia } from './ReguaProcedencia';

const fmt = new Intl.NumberFormat('pt-BR');

/**
 * Cartão de indicador (§15.7): valor em mono/tnum + unidade colada
 * + régua de procedência. Sem exceção.
 */
export function CartaoIndicador({
  resultado,
  animada = false,
}: {
  resultado: Resultado;
  animada?: boolean;
}) {
  return (
    <div className="card">
      <div className="overline">{resultado.indicador}</div>
      <div className="kpi" style={{ marginTop: 8 }}>
        {fmt.format(resultado.valor)}
        <span className="unidade">{resultado.unidade}</span>
      </div>
      {resultado.municipios_agregados ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }} className="mono">
          {resultado.agregacao} · {resultado.municipios_agregados} município(s) agregado(s)
        </div>
      ) : null}
      <ReguaProcedencia procedencia={resultado.procedencia} animada={animada} />
    </div>
  );
}
