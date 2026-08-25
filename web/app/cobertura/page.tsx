import { apiGet } from '@/lib/api';
import { ChipSemaforo } from '@/components/ChipSemaforo';
import { CabecalhoPagina } from '@/components/CabecalhoPagina';
import { TermoExplicado } from '@/components/TermoExplicado';

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
  // Falha propaga para o error.tsx: antes, API fora do ar virava uma
  // matriz vazia muda — o oposto de "ausência é resposta" (RN-005).
  const celulas = await apiGet<Celula[]>('/cobertura');
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
      <CabecalhoPagina
        overline="Cobertura"
        titulo="Matriz de disponibilidade"
        descricao={
          <>
            O que existe, com que data — e o que ainda não existe.{' '}
            <TermoExplicado id="rn-005">A ausência de dado é uma resposta legítima</TermoExplicado>;
            esta matriz é o compromisso público com essa honestidade. Entenda o{' '}
            <TermoExplicado id="semaforo">semáforo</TermoExplicado> abaixo.
          </>
        }
      />
      <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ChipSemaforo status="DISPONIVEL" /> <ChipSemaforo status="DEFASADO" />{' '}
        <ChipSemaforo status="SEM_FONTE" />
      </p>
      {/* Heatmap (Onda C): células compactas de símbolo+cor no lugar do
          texto repetido 142×17 vezes — o rótulo completo segue no title e
          no aria-label de cada célula; a semântica forma+cor é preservada. */}
      <div className="tabela-rolagem" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
        <table className="dados heatmap-cobertura">
          <caption className="sr-only">Cobertura por município e tema</caption>
          <thead>
            <tr>
              <th scope="col">Município</th>
              {temas.map(([id, nome]) => (
                <th key={id} scope="col" className="heatmap-tema">
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
                {temas.map(([tid, tnome]) => {
                  const e = estadoDe(porChave.get(`${codigo}|${tid}`));
                  return (
                    <td
                      key={tid}
                      className="heatmap-celula"
                      title={`${nome} · ${tnome}: ${e.rotulo}`}
                      aria-label={`${tnome}: ${e.rotulo}`}
                    >
                      <span aria-hidden="true" style={{ color: e.cor }}>{e.forma}</span>
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
