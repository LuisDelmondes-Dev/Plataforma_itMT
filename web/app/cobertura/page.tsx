import { apiGet } from '@/lib/api';
import { ChipSemaforo } from '@/components/ChipSemaforo';

interface Celula {
  codigo_ibge: string;
  municipio: string;
  tema_id: number;
  tema: string;
  ultima_referencia: string | null;
  observacoes: number;
}

export const dynamic = 'force-dynamic';

/**
 * Painel de cobertura município × tema (RF-ADMIN-002), publicado e HONESTO —
 * inclusive sobre o que não existe (critério de aceite do MVP).
 * Semáforo: forma + rótulo + cor (§15.1).
 */
export default async function Cobertura() {
  const celulas = await apiGet<Celula[]>('/cobertura').catch(() => [] as Celula[]);
  const municipios = [...new Map(celulas.map((c) => [c.codigo_ibge, c.municipio])).entries()];
  const temas = [...new Map(celulas.map((c) => [c.tema_id, c.tema])).entries()].sort(
    (a, b) => a[0] - b[0],
  );
  const porChave = new Map(celulas.map((c) => [`${c.codigo_ibge}|${c.tema_id}`, c]));
  const anoAtual = new Date().getFullYear();

  const estadoDe = (c?: Celula) => {
    if (!c || Number(c.observacoes) === 0) return { forma: '○', rotulo: 'Sem dado', cor: 'var(--state-missing)' };
    const ano = c.ultima_referencia ? Number(c.ultima_referencia.slice(0, 4)) : 0;
    return ano >= anoAtual - 1
      ? { forma: '●', rotulo: `Atual (${ano})`, cor: 'var(--state-current)' }
      : { forma: '◐', rotulo: `Defasado (${ano})`, cor: 'var(--state-stale)' };
  };

  return (
    <div>
      <div className="overline">Cobertura</div>
      <h1 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 600, margin: '8px 0' }}>
        Matriz de disponibilidade
      </h1>
      <p style={{ color: 'var(--ink-2)', maxWidth: 720 }}>
        O que existe, com que data — e o que ainda não existe. A ausência de dado é uma
        resposta legítima (RN-005); esta matriz é o compromisso público com essa honestidade.
      </p>
      <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ChipSemaforo status="DISPONIVEL" /> <ChipSemaforo status="DEFASADO" />{' '}
        <ChipSemaforo status="SEM_FONTE" />
      </p>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table className="dados" style={{ minWidth: 900 }}>
          <caption style={{ display: 'none' }}>Cobertura por município e tema</caption>
          <thead>
            <tr>
              <th scope="col">Município</th>
              {temas.map(([id, nome]) => (
                <th key={id} scope="col" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                  {nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {municipios.map(([codigo, nome]) => (
              <tr key={codigo}>
                <th scope="row" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {nome}
                </th>
                {temas.map(([tid]) => {
                  const e = estadoDe(porChave.get(`${codigo}|${tid}`));
                  return (
                    <td key={tid} className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      <span aria-hidden="true" style={{ color: e.cor }}>{e.forma}</span> {e.rotulo}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
