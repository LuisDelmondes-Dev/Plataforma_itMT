import { apiGet } from '@/lib/api';
import { ChipSemaforo } from '@/components/ChipSemaforo';

interface Produto {
  id: number; tipo: string; formato: string | null; caminho: string;
  municipio: string; codigo_ibge: string; data_voo: string; sensor: string;
  gsd_cm: string; acuracia: string; sistema_referencia: string;
  responsavel_tecnico: string; autorizacao_voo: string;
}
interface Cobertura { codigo_ibge: string; municipio: string; estado: string; km_itmt: string }
interface Estruturante { id: number; tipo: string; nome: string; descricao: string | null; municipio: string; lat: string | null; lon: string | null }

export const dynamic = 'force-dynamic';

/** Geoportal (RF-GEO-001..009): produtos publicados, cobertura de rua e estruturantes. */
export default async function Geoportal() {
  const [produtos, cobertura, estruturantes] = await Promise.all([
    apiGet<Produto[]>('/geo/produtos').catch(() => []),
    apiGet<Cobertura[]>('/geo/cobertura-rua').catch(() => []),
    apiGet<Estruturante[]>('/geo/estruturantes').catch(() => []),
  ]);
  const porMunicipio = new Map<string, Produto[]>();
  for (const p of produtos) porMunicipio.set(p.municipio, [...(porMunicipio.get(p.municipio) ?? []), p]);
  const chipDe = (e: string) =>
    e === 'PUBLICADO_ITMT' ? 'DISPONIVEL' : e === 'PREEXISTENTE' ? 'DEFASADO' : 'SEM_FONTE';
  const rotuloDe = (e: string) =>
    e === 'PUBLICADO_ITMT' ? 'Publicado ITMT' : e === 'PREEXISTENTE' ? 'Preexistente' : 'Pendente';

  return (
    <div>
      <div className="overline">Geoportal</div>
      <h1 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 600, margin: '8px 0' }}>
        Produtos do levantamento aéreo
      </h1>
      <p style={{ color: 'var(--ink-2)', maxWidth: 720 }}>
        Ortomosaicos, modelos digitais e curvas de nível em SIRGAS 2000, com sensor, GSD,
        acurácia declarada, responsável técnico e autorizações de voo registradas em cada
        produto. Produto restrito ou classificado é bloqueado na publicação pelo banco.
      </p>

      {[...porMunicipio.entries()].map(([mun, ps]) => (
        <div key={mun} className="card" style={{ marginTop: 16 }}>
          <div className="overline">{mun}</div>
          <table className="dados" style={{ marginTop: 8 }}>
            <caption style={{ display: 'none' }}>Produtos geográficos de {mun}</caption>
            <thead>
              <tr>
                <th scope="col">Produto</th><th scope="col">Voo</th><th scope="col">Sensor</th>
                <th scope="col">GSD</th><th scope="col">Acurácia</th><th scope="col">SRC</th>
                <th scope="col">Download</th>
              </tr>
            </thead>
            <tbody>
              {ps.map((p) => (
                <tr key={p.id}>
                  <td>{p.tipo.replace('_', ' ')}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{p.data_voo}</td>
                  <td style={{ fontSize: 13 }}>{p.sensor}</td>
                  <td className="num">{p.gsd_cm} cm</td>
                  <td style={{ fontSize: 13 }}>{p.acuracia}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{p.sistema_referencia}</td>
                  <td className="mono" style={{ fontSize: 12 }}><a href={p.caminho}>{p.formato ?? 'objeto'}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 0 }}>
            RT {ps[0].responsavel_tecnico} · aut. voo {ps[0].autorizacao_voo}
          </p>
        </div>
      ))}
      {porMunicipio.size === 0 && (
        <div className="aviso">Nenhum produto publicado ainda. Os levantamentos entram pelo módulo CAMPO → GEO.</div>
      )}

      <h2 style={{ fontSize: 24, lineHeight: '32px', fontWeight: 600, marginTop: 32 }}>
        Cobertura de imagem de rua
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {cobertura.map((c) => (
          <span key={c.codigo_ibge} className={`chip ${chipDe(c.estado) === 'DISPONIVEL' ? 'atual' : chipDe(c.estado) === 'DEFASADO' ? 'defasado' : 'sem-dado'}`}>
            <span className="forma" aria-hidden="true">
              {c.estado === 'PUBLICADO_ITMT' ? '●' : c.estado === 'PREEXISTENTE' ? '◐' : '○'}
            </span>
            {c.municipio}: {rotuloDe(c.estado)}
            {Number(c.km_itmt) > 0 ? ` (${c.km_itmt} km)` : ''}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        O acervo 360° tem cópia soberana no geoportal próprio (RF-GEO-009); serviços externos
        de mapa são canal de distribuição, nunca de custódia.
      </p>

      <h2 style={{ fontSize: 24, lineHeight: '32px', fontWeight: 600, marginTop: 32 }}>
        Projetos estruturantes
      </h2>
      <table className="dados">
        <caption style={{ display: 'none' }}>Projetos estruturantes mapeados</caption>
        <thead>
          <tr><th scope="col">Projeto</th><th scope="col">Tipo</th><th scope="col">Município</th><th scope="col">Coordenadas</th></tr>
        </thead>
        <tbody>
          {estruturantes.map((e) => (
            <tr key={e.id}>
              <td>{e.nome}</td>
              <td className="mono" style={{ fontSize: 12 }}>{e.tipo}</td>
              <td>{e.municipio}</td>
              <td className="mono" style={{ fontSize: 12 }}>{e.lat && e.lon ? `${e.lat}, ${e.lon}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
