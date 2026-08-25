import Link from 'next/link';
import { apiGet, Resultado } from '@/lib/api';
import { CartaoIndicador } from '@/components/CartaoIndicador';
import { GraficoLinha } from '@/components/GraficoLinha';
import { GraficoBarras } from '@/components/GraficoBarras';
import { MiniMapaMunicipio } from '@/components/MiniMapaMunicipio';
import { TabelaDados } from '@/components/TabelaDados';
import { TermoExplicado } from '@/components/TermoExplicado';
import { REGIAO } from '@/lib/regiao';
import { formatarNumero } from '@/lib/format';

interface Ficha {
  codigo_ibge: string;
  nome: string;
  area_km2: string;
  regiao_imediata: string;
  regiao_intermediaria: string;
}
interface Destaque { id: number; nome: string; unidade: string; tema: string }
interface SerieHistorica { indicador: string; unidade: string; pontos: { ano: number; valor: number }[] }
interface Comparacao {
  municipio: Partial<Resultado> & { erro?: string };
  regiaoImediata: Partial<Resultado> & { erro?: string };
  regiaoIntermediaria: Partial<Resultado> & { erro?: string };
  estado: Partial<Resultado> & { erro?: string };
}
interface Tema { id: number; nome: string; subtemas_disponiveis: number }

const fmt = new Intl.NumberFormat('pt-BR');
const valorDe = (r: Partial<Resultado> | undefined) =>
  r && 'valor' in r && r.valor !== undefined ? r.valor : null;

/**
 * Ficha municipal (RF-PORTAL-013, SSR para SEO) — Onda C: de lista de 4
 * cartões a dashboard composto: KPIs, série histórica, comparação
 * territorial com barras, mini-mapa, temas navegáveis, direitos e export.
 * Cada seção degrada sozinha (Promise.allSettled): uma fonte fora do ar
 * nunca derruba a ficha inteira, e ausência é dita, nunca zero (RN-005).
 */
export default async function FichaMunicipal(props: { params: Promise<{ codigo: string }> }) {
  const params = await props.params;
  let ficha: Ficha;
  try {
    ficha = await apiGet<Ficha>(`/municipios/${params.codigo}`);
  } catch {
    return (
      <div className="aviso">
        Município {params.codigo} não encontrado. Verifique o código municipal de 7 dígitos.{' '}
        <Link href="/consulta">Buscar por nome →</Link>
      </div>
    );
  }

  // RF-PORTAL-011: os indicadores vêm do catálogo real, não de lista fixa.
  const destaques = await apiGet<Destaque[]>('/indicadores/destaque?limite=6&detalhe=1');
  const [resultadosR, temasR] = await Promise.allSettled([
    Promise.all(
      destaques.map((d) =>
        apiGet<Resultado>(
          `/indicadores/${d.id}/consulta?recorte=MUNICIPIO&codigo=${params.codigo}`,
        ).catch(() => null),
      ),
    ),
    apiGet<Tema[]>('/temas', { revalidate: 3600 }),
  ]);
  const resultados = resultadosR.status === 'fulfilled' ? resultadosR.value : destaques.map(() => null);
  const temas = temasR.status === 'fulfilled' ? temasR.value : [];

  // Série e comparação do primeiro indicador COM dado neste município.
  const idxPrincipal = resultados.findIndex(Boolean);
  const principal = idxPrincipal >= 0 ? destaques[idxPrincipal] : null;
  const [serieR, comparacaoR] = principal
    ? await Promise.allSettled([
        apiGet<SerieHistorica>(`/indicadores/${principal.id}/serie?recorte=MUNICIPIO&codigo=${params.codigo}`),
        apiGet<Comparacao>(`/indicadores/${principal.id}/comparacao?codigo_ibge=${params.codigo}`),
      ])
    : [null, null];
  const serie = serieR && serieR.status === 'fulfilled' && serieR.value.pontos.length > 1 ? serieR.value : null;
  const comparacao = comparacaoR && comparacaoR.status === 'fulfilled' ? comparacaoR.value : null;

  // Breadcrumb sem eco: "Cuiabá › Cuiabá › Cuiabá" vira só "Cuiabá".
  const trilha = [REGIAO.nome, ficha.regiao_intermediaria, ficha.regiao_imediata, ficha.nome]
    .filter((nome, i, arr) => arr.indexOf(nome) === i);

  return (
    <div>
      <nav className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }} aria-label="Localização territorial">
        {trilha.join(' › ')}
      </nav>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '16px 0 8px' }}>
        <h1 className="headline-lg" style={{ margin: 0 }}>{ficha.nome}</h1>
        <span className="mono" style={{ fontSize: 14, color: 'var(--ink-3)' }}>{ficha.codigo_ibge}</span>
      </div>
      <p style={{ color: 'var(--ink-2)', marginTop: 0 }}>
        <TermoExplicado id="rgi">Região Imediata</TermoExplicado> de {ficha.regiao_imediata} ·{' '}
        <TermoExplicado id="rgint">Região Intermediária</TermoExplicado> de{' '}
        {ficha.regiao_intermediaria} ·{' '}
        <span className="mono">{fmt.format(Number(ficha.area_km2))} km²</span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: 16, alignItems: 'start' }} className="ficha-colunas">
        <div>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {destaques.length === 0 && (
              <div className="aviso">
                Ainda não há indicador publicado com dado para a ficha-síntese. A ausência de
                dado é uma resposta legítima — nada foi estimado.
              </div>
            )}
            {resultados.map((r, i) =>
              r ? (
                <CartaoIndicador key={destaques[i].id} resultado={r} />
              ) : (
                <div key={destaques[i].id} className="aviso">
                  {destaques[i].nome}: sem dado publicado para {ficha.nome} — ausência é
                  resposta, nada foi estimado.
                </div>
              ),
            )}
          </div>

          {/* Série histórica do indicador principal */}
          {principal && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span className="title-md">Série histórica — {principal.nome}</span>
              </div>
              {serie ? (
                <>
                  <GraficoLinha observados={serie.pontos} unidade={serie.unidade} rotuloObservado={ficha.nome} />
                  <p className="label-md" style={{ color: 'var(--on-surface-variant)', marginTop: 8 }}>
                    Anos sem ponto não têm dado publicado — ausência é resposta, não zero.
                  </p>
                </>
              ) : (
                <p className="label-md" style={{ color: 'var(--on-surface-variant)' }}>
                  Série insuficiente para desenhar tendência (menos de dois anos com dado).
                </p>
              )}
            </div>
          )}

          {/* Comparação territorial */}
          {principal && comparacao && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span className="title-md">{ficha.nome} no território — {principal.nome}</span>
              </div>
              <GraficoBarras
                unidade={principal.unidade}
                barras={[
                  { rotulo: ficha.nome, valor: valorDe(comparacao.municipio), destaque: true },
                  { rotulo: `RGI de ${ficha.regiao_imediata}`, valor: valorDe(comparacao.regiaoImediata) },
                  { rotulo: `RGInt de ${ficha.regiao_intermediaria}`, valor: valorDe(comparacao.regiaoIntermediaria) },
                  { rotulo: `Estado de ${REGIAO.nome}`, valor: valorDe(comparacao.estado) },
                ]}
              />
              <TabelaDados legenda={`Comparação territorial de ${principal.nome}`}>
                <thead>
                  <tr>
                    <th scope="col">Recorte</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      [ficha.nome, comparacao.municipio],
                      [`Região Imediata de ${ficha.regiao_imediata}`, comparacao.regiaoImediata],
                      [`Região Intermediária de ${ficha.regiao_intermediaria}`, comparacao.regiaoIntermediaria],
                      [`Estado de ${REGIAO.nome}`, comparacao.estado],
                    ] as const
                  ).map(([rotulo, r]) => (
                    <tr key={rotulo}>
                      <td>{rotulo}</td>
                      <td className="num mono-sm">
                        {valorDe(r) !== null ? `${formatarNumero(valorDe(r))} ${('unidade' in r && r.unidade) || ''}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TabelaDados>
            </div>
          )}

          {/* Temas navegáveis → consulta já posicionada no município */}
          {temas.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="overline">Explorar por tema</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {temas
                  .filter((t) => t.subtemas_disponiveis > 0)
                  .map((t) => (
                    <Link
                      key={t.id}
                      className="chip atual"
                      href={`/consulta?municipio=${ficha.codigo_ibge}&tema=${t.id}`}
                    >
                      {t.nome}
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral: localização + cidadania + export */}
        <aside style={{ display: 'grid', gap: 16 }}>
          <div className="card">
            <div className="overline">Localização</div>
            <MiniMapaMunicipio codigo={ficha.codigo_ibge} />
          </div>
          <div className="card">
            <div className="overline">Cidadania</div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '8px 0' }}>
              Direitos e serviços públicos valem em todo o território — descubra os seus.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              <Link className="btn" href="/direitos">Mapa de Direitos</Link>
              <Link className="btn primaria" href="/direitos/descubra">Descubra os seus direitos</Link>
            </div>
          </div>
          {principal && (
            <div className="card">
              <div className="overline">Exportar</div>
              <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '6px 0' }}>
                {principal.nome} para {ficha.nome}, com procedência linha a linha.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['csv', 'xlsx', 'pdf'] as const).map((f) => (
                  <a
                    key={f}
                    className="btn"
                    style={{ textDecoration: 'none', color: 'var(--ink)' }}
                    href={`/api/v1/indicadores/${principal.id}/exportacao?formato=${f}&recorte=MUNICIPIO&codigo=${ficha.codigo_ibge}`}
                  >
                    {f.toUpperCase()}
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        <Link href={`/consulta?municipio=${ficha.codigo_ibge}`}>
          Consulta completa para {ficha.nome} →
        </Link>
      </p>
    </div>
  );
}
