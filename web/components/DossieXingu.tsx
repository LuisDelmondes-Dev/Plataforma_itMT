'use client';

/**
 * DASH-XINGU (Gauntlet P6) — o DOSSIÊ do modo xingu como dashboard
 * explicativo de gestor, na ordem narrativa "onde estamos → onde dói →
 * para onde vamos → como eu provo". TODO numeral exibido vem do JSON do
 * motor determinístico (RG-03); aqui só há formatação pt-BR e a diferença
 * município−recorte da comparação, calculada NA EXIBIÇÃO sobre dois valores
 * do motor e declarada em nota. Bloco sem dado declara o motivo (RN-005) —
 * a seção nunca some. Sugestões (A16) são exibidas VERBATIM, na ordem do
 * servidor: o texto já foi auditado numeral a numeral (A06) — reescrever ou
 * reordenar aqui violaria RG-03.
 */
import { REGIAO } from '@/lib/regiao';
import { formatarNumero } from '@/lib/format';
import { GraficoBarras } from '@/components/GraficoBarras';
import { GraficoLinha } from '@/components/GraficoLinha';
import { TabelaDados } from '@/components/TabelaDados';
import { ReguaProcedencia } from '@/components/ReguaProcedencia';
import { MapaCoropleticoDossie } from '@/components/MapaCoropleticoDossie';
import type { Agregacao, CitacaoProcedencia, RankingMunicipioDto } from '@/components/DashboardPesquisa';

// ---- Contrato do dossiê (espelho de DossieXingu em api/src/xingu/orquestrador.service.ts) ----

export interface RankingCompletoDto {
  indicador: string;
  unidade: string;
  referencia: string;
  agregacao: Agregacao;
  total_estadual: number | null;
  media_estadual: number | null;
  media_estadual_motivo?: string;
  total_municipios: number;
  ausentes: { total: number; codigos: string[] };
  municipios: RankingMunicipioDto[];
}

export interface SerieDossieDto {
  indicador: string;
  unidade: string;
  local: string;
  pontos: { ano: number; valor: number }[];
}

/** Um nível da comparação territorial: Resultado do motor OU erro declarado. */
export interface NivelComparacaoDto {
  valor?: number;
  unidade?: string;
  local?: string;
  nome?: string;
  procedencia?: CitacaoProcedencia[];
  erro?: string;
}

export interface ComparacaoDto {
  municipio: NivelComparacaoDto;
  regiaoImediata: NivelComparacaoDto;
  regiaoIntermediaria: NivelComparacaoDto;
  estado: NivelComparacaoDto;
}

export interface CausaCategoriaDto { categoria: string; valor: number; participacao: number }
export interface CausaDimensaoDto {
  dimensao: string;
  referencia: string;
  total: number;
  categorias: CausaCategoriaDto[];
  procedencia: CitacaoProcedencia[];
}
export interface CausasDto {
  indicador: string;
  unidade: string;
  recorte: string;
  local: string;
  referencia: string;
  decomposicao_de?: string;
  dimensoes: CausaDimensaoDto[];
}

export interface SugestaoDto {
  texto: string;
  pratica_citada: string;
  fonte_referencia: string;
  gatilho: string;
  origem: { tipo: 'RANKING_MUNICIPIO' | 'INDICADOR' | 'CAUSA' | 'SERIE'; codigo_ibge?: string; indicadorId: number };
}

export interface DossieXinguDto {
  ranking: RankingCompletoDto;
  serie: SerieDossieDto;
  comparacao: ComparacaoDto | null;
  comparacao_motivo?: string;
  causas: CausasDto | null;
  causas_motivo?: string;
  sugestoes: SugestaoDto[];
  sugestoes_motivo?: string;
}

// ---- Formatação (números do motor em pt-BR, nunca re-arredondados) ----
const num = (v: number | null | undefined) => formatarNumero(v, 6);
const inteiro = (v: number) => formatarNumero(v, 0);
const delta = (d: number | null) => (d === null ? '—' : `${d > 0 ? '+' : ''}${formatarNumero(d, 6)}`);

const textoSecundario = { fontSize: 12, color: 'var(--on-surface-variant)' } as const;

const ROTULO_DIMENSAO: Record<string, string> = {
  CAPITULO_CID10: 'Por capítulo CID-10',
  CAUSA_EVITAVEL: 'Causas evitáveis (0–4 anos)',
  COMPONENTE: 'Por componente etário',
};

const ROTULO_GATILHO: Record<string, string> = {
  ACIMA_DA_MEDIA: 'acima da média estadual',
  ABAIXO_DA_MEDIA: 'abaixo da média estadual',
  TENDENCIA_ALTA: 'tendência de alta',
  TENDENCIA_QUEDA: 'tendência de queda',
  CAUSA_DOMINANTE: 'causa dominante',
  COBERTURA_INCOMPLETA: 'cobertura incompleta',
};

/** Âncora da seção do dossiê que motivou a sugestão ("dado de origem"). */
const ANCORA_ORIGEM: Record<SugestaoDto['origem']['tipo'], string> = {
  RANKING_MUNICIPIO: '#dossie-ranking',
  INDICADOR: '#dossie-onde-estamos',
  CAUSA: '#dossie-causas',
  SERIE: '#dossie-serie',
};

const valorDe = (r: NivelComparacaoDto) => (typeof r.valor === 'number' ? r.valor : null);

function linhaAusentes(total: number): string {
  if (total === 0) return 'Todos os municípios têm dado nesta referência.';
  return `${inteiro(total)} município${total > 1 ? 's' : ''} sem dado — ausência é resposta, não zero.`;
}

export function DossieXingu({
  dossie,
  indicadorId,
  codigoIbge,
  recorte,
  codigo,
  referencia,
  valores,
  citacoes,
  pesquisaId,
}: {
  dossie: DossieXinguDto;
  /** Id do indicador (contexto da resposta) — habilita mapa e exportação. */
  indicadorId: number | null;
  /** Município consultado (recorte MUNICIPIO); null nos demais recortes. */
  codigoIbge: string | null;
  recorte: string;
  codigo: string | null;
  /** Referência da consulta (AAAA-MM-DD). */
  referencia: string;
  /** O valor do recorte consultado, como a resposta trouxe. */
  valores?: { rotulo: string; valor: number; unidade: string }[];
  /** Citações da resposta (quinteto §12.1) para a régua do card principal. */
  citacoes: CitacaoProcedencia[];
  pesquisaId: string | null;
}) {
  const { ranking, serie, comparacao, causas, sugestoes } = dossie;
  const temMedia = ranking.media_estadual !== null;
  const comDado = ranking.municipios.length;
  const linhaMunicipio = codigoIbge
    ? ranking.municipios.find((m) => m.codigo_ibge === codigoIbge) ?? null
    : null;
  const kpi =
    valores?.[0] ??
    (linhaMunicipio
      ? { rotulo: linhaMunicipio.nome, valor: linhaMunicipio.valor, unidade: ranking.unidade }
      : null);
  // Ano exibido = ano do DADO (procedência), nunca a data da consulta —
  // mesmo padrão IBGE Cidades já usado no dashboard da pesquisa (P5).
  const ano = citacoes[0]?.data_referencia?.slice(0, 4) ?? ranking.referencia.slice(0, 4);
  const procedenciaCard = citacoes.length
    ? citacoes
    : linhaMunicipio?.procedencia ?? ranking.municipios[0]?.procedencia ?? [];

  // Mini ranking: as duas pontas, SEM julgamento de polaridade — "maiores" e
  // "menores" descrevem o valor; quem julga é o texto das sugestões (A16).
  const maiores = ranking.municipios.filter((m) => m.top_n);
  const menores = [...ranking.municipios.filter((m) => m.bottom_n)].reverse();

  const vm = comparacao ? valorDe(comparacao.municipio) : null;
  const niveis: [string, NivelComparacaoDto, boolean][] = comparacao
    ? [
        [comparacao.municipio.nome ?? comparacao.municipio.local ?? 'Município', comparacao.municipio, true],
        [comparacao.regiaoImediata.local ?? 'Região Imediata', comparacao.regiaoImediata, false],
        [comparacao.regiaoIntermediaria.local ?? 'Região Intermediária', comparacao.regiaoIntermediaria, false],
        [comparacao.estado.local ?? `Estado de ${REGIAO.nome}`, comparacao.estado, false],
      ]
    : [];

  // Exportação no recorte ESTADO (P6 rodada 2): o dossiê mostra o ranking
  // COMPLETO — o arquivo do rodapé leva as mesmas linhas (todos os municípios
  // com dado, posição e Δ vs média, exportação P5), não 1 linha do recorte
  // municipal. A referência é a MESMA da consulta que gerou o dossiê.
  const urlExportacao = (formato: 'csv' | 'xlsx' | 'pdf') =>
    `/api/v1/indicadores/${indicadorId}/exportacao?formato=${formato}&recorte=ESTADO` +
    `&referencia=${referencia}`;

  return (
    <section className="dossie-xingu" aria-label={`Dossiê do gestor — ${ranking.indicador}`}>
      <span className="overline" style={{ color: 'var(--primary)' }}>
        Dossiê do gestor · {ranking.indicador} [{ano}]
      </span>

      {/* 1 · ONDE ESTAMOS — valor do recorte + comparação territorial */}
      <div className="card" id="dossie-onde-estamos">
        <span className="overline">Onde estamos</span>
        <h2 className="title-md" style={{ marginTop: 2 }}>
          {kpi?.rotulo ?? ranking.indicador}
        </h2>
        {kpi && (
          <div className="kpi" style={{ marginTop: 8 }}>
            {num(kpi.valor)}{' '}
            <span className="unidade">
              {kpi.unidade} [{ano}]
            </span>
          </div>
        )}
        {linhaMunicipio && (
          <p style={{ ...textoSecundario, margin: '6px 0 0' }}>
            {linhaMunicipio.posicao}º de {inteiro(comDado)} municípios com dado
            {temMedia && (
              <>
                {' '}
                · média estadual {num(ranking.media_estadual)} {ranking.unidade} · Δ vs média:{' '}
                {delta(linhaMunicipio.delta_media_estadual)}
              </>
            )}
          </p>
        )}

        {comparacao ? (
          <div style={{ marginTop: 12 }}>
            <GraficoBarras
              unidade={kpi?.unidade ?? ranking.unidade}
              barras={niveis.map(([rotulo, nivel, ehMunicipio]) => ({
                rotulo,
                valor: valorDe(nivel),
                destaque: ehMunicipio,
              }))}
            />
            <TabelaDados legenda={`Comparação territorial — ${ranking.indicador}, referência ${ano}`}>
              <thead>
                <tr>
                  <th scope="col">Recorte</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Valor ({kpi?.unidade ?? ranking.unidade})
                  </th>
                  <th scope="col" style={{ textAlign: 'right' }} title="Valor do município menos o valor do recorte">
                    Δ município − recorte
                  </th>
                </tr>
              </thead>
              <tbody>
                {niveis.map(([rotulo, nivel, ehMunicipio]) => {
                  const v = valorDe(nivel);
                  return (
                    <tr key={rotulo} style={ehMunicipio ? { fontWeight: 600 } : undefined}>
                      <td>{rotulo}</td>
                      <td className="num">{v !== null ? num(v) : '—'}</td>
                      <td className="num">
                        {ehMunicipio || v === null || vm === null ? '—' : delta(vm - v)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TabelaDados>
            <p style={{ ...textoSecundario, margin: '8px 0 0' }}>
              Δ = valor do município menos o valor do recorte, calculado na exibição sobre os
              valores do motor mostrados acima.
            </p>
          </div>
        ) : (
          <p className="aviso" role="status" style={{ marginTop: 12 }}>
            {dossie.comparacao_motivo ??
              'Comparação território×região×Estado indisponível para este recorte.'}
          </p>
        )}
        <ReguaProcedencia procedencia={procedenciaCard} />
      </div>

      {/* 2 · ONDE DÓI — decomposição por causa (motor P3) */}
      <div className="card" id="dossie-causas">
        <span className="overline">Onde dói</span>
        <h2 className="title-md" style={{ marginTop: 2 }}>Decomposição por causa</h2>
        {causas ? (
          <>
            {causas.decomposicao_de && (
              <p style={{ ...textoSecundario, margin: '6px 0 0', maxWidth: '64ch' }}>
                Decomposição de “{causas.decomposicao_de}” — a taxa não tem contagem própria; as
                causas são do numerador.
              </p>
            )}
            {causas.dimensoes.map((d) => {
              const maiorParticipacao = Math.max(...d.categorias.map((c) => c.participacao));
              return (
                <div key={d.dimensao} className="dossie-causa">
                  <div className="dossie-causa-cab">
                    <strong>{ROTULO_DIMENSAO[d.dimensao] ?? d.dimensao}</strong>
                    <span style={textoSecundario}>
                      {inteiro(d.total)} no total · referência {d.referencia.slice(0, 4)}
                    </span>
                  </div>
                  {d.categorias.map((cat) => {
                    const dominante = cat.participacao === maiorParticipacao;
                    return (
                      <div
                        key={cat.categoria}
                        className={`dossie-causa-linha${dominante ? ' dominante' : ''}`}
                      >
                        <span className="dossie-causa-rotulo" title={cat.categoria}>
                          {cat.categoria}
                        </span>
                        <span className="dossie-causa-trilho" aria-hidden="true">
                          <span
                            className="dossie-causa-barra"
                            style={{ width: `${Math.min(100, Math.max(1.5, cat.participacao)).toFixed(1)}%` }}
                          />
                        </span>
                        <span className="dossie-causa-valor">
                          {inteiro(cat.valor)} de {inteiro(d.total)} ({formatarNumero(cat.participacao)}%)
                          {dominante ? ' · dominante' : ''}
                        </span>
                      </div>
                    );
                  })}
                  <ReguaProcedencia procedencia={d.procedencia} />
                </div>
              );
            })}
          </>
        ) : (
          <p className="aviso" role="status" style={{ marginTop: 12 }}>
            {dossie.causas_motivo ?? 'Sem decomposição por causa para este indicador/recorte.'}
          </p>
        )}
      </div>

      {/* 3 · PARA ONDE VAMOS — série histórica + as duas pontas do ranking */}
      <div className="card" id="dossie-serie">
        <span className="overline">Para onde vamos</span>
        <h2 className="title-md" style={{ marginTop: 2 }}>
          Série histórica — {serie.local}
        </h2>
        {serie.pontos.length >= 2 ? (
          <>
            <GraficoLinha observados={serie.pontos} unidade={serie.unidade} rotuloObservado={serie.local} />
            <p style={{ ...textoSecundario, margin: '8px 0 0' }}>
              Anos sem ponto não têm dado publicado — ausência é resposta, não zero.
            </p>
          </>
        ) : (
          <p className="aviso" role="status" style={{ marginTop: 12 }}>
            Série insuficiente para desenhar tendência (menos de dois anos com dado publicado) —
            ausência é resposta, não zero.
          </p>
        )}

        {linhaMunicipio && (
          <p style={{ fontSize: 14, margin: '14px 0 0' }}>
            <strong>{linhaMunicipio.nome}</strong>: {linhaMunicipio.posicao}º de {inteiro(comDado)}{' '}
            municípios com dado no estado.
          </p>
        )}
        <div className="dossie-minirank">
          <div>
            <span className="overline">Maiores valores</span>
            <ul className="dossie-minirank-lista">
              {maiores.map((m) => (
                <li key={m.codigo_ibge} className={m.codigo_ibge === codigoIbge ? 'destaque' : undefined}>
                  {m.posicao}º {m.nome} · <span className="mono-sm">{num(m.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="overline">Menores valores</span>
            <ul className="dossie-minirank-lista">
              {menores.map((m) => (
                <li key={m.codigo_ibge} className={m.codigo_ibge === codigoIbge ? 'destaque' : undefined}>
                  {m.posicao}º {m.nome} · <span className="mono-sm">{num(m.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p style={{ ...textoSecundario, margin: '10px 0 0', maxWidth: '64ch' }}>
          “Maiores” e “menores” descrevem apenas o valor do indicador — se isso é bom ou ruim
          depende do indicador; essa leitura aparece nas sugestões, abaixo.
        </p>
      </div>

      {/* 4 · RANKING COMPLETO — a forma citável, com rolagem interna */}
      <div className="card dossie-ranking" id="dossie-ranking">
        <span className="overline">Ranking completo</span>
        <h2 className="title-md" style={{ marginTop: 2 }}>
          Os {inteiro(comDado)} municípios com dado [{ano}]
        </h2>
        <TabelaDados
          legenda={`Ranking completo dos municípios de ${REGIAO.nome} — ${ranking.indicador}, referência ${ano}`}
        >
          <thead>
            <tr>
              <th scope="col">Posição</th>
              <th scope="col">Município</th>
              <th scope="col" style={{ textAlign: 'right' }}>Valor ({ranking.unidade})</th>
              {temMedia && (
                <th scope="col" style={{ textAlign: 'right' }} title="Diferença em relação à média estadual">
                  Δ vs média
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ranking.municipios.map((m) => {
              const consultado = m.codigo_ibge === codigoIbge;
              return (
                <tr
                  key={m.codigo_ibge}
                  style={consultado ? { fontWeight: 600, background: 'var(--surface-container-low)' } : undefined}
                >
                  <td className="num">{m.posicao}º</td>
                  <td>{m.nome}{consultado ? ' ◂ consultado' : ''}</td>
                  <td className="num">{num(m.valor)}</td>
                  {temMedia && <td className="num">{delta(m.delta_media_estadual)}</td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={temMedia ? 4 : 3} style={textoSecundario}>
                {linhaAusentes(ranking.ausentes.total)}
              </td>
            </tr>
          </tfoot>
        </TabelaDados>
        {temMedia ? (
          <p style={{ ...textoSecundario, margin: '8px 0 0' }}>
            Δ = diferença em relação à média estadual ({num(ranking.media_estadual)} {ranking.unidade}).
          </p>
        ) : ranking.media_estadual_motivo ? (
          <p style={{ ...textoSecundario, margin: '8px 0 0' }}>{ranking.media_estadual_motivo}</p>
        ) : null}
      </div>

      {/* 5 · MAPA — coroplético compacto e estático; interação fica em /mapa */}
      <div className="card" id="dossie-mapa">
        <span className="overline">Território</span>
        <h2 className="title-md" style={{ marginTop: 2 }}>
          Mapa por município [{ano}]
        </h2>
        {indicadorId !== null ? (
          <>
            <MapaCoropleticoDossie
              indicadorId={indicadorId}
              referencia={referencia}
              destaqueCodigo={codigoIbge}
            />
            <p style={{ ...textoSecundario, margin: '10px 0 0' }}>
              A tabela do ranking acima é a leitura acessível deste mapa — mesmos valores, mesma
              referência. Município em cinza não tem dado (RN-005).
            </p>
          </>
        ) : (
          <p className="aviso" role="status" style={{ marginTop: 12 }}>
            A resposta não trouxe o identificador do indicador — abra o mapa pela navegação
            (menu Mapa).
          </p>
        )}
      </div>

      {/* 6 · COMO EU PROVO — sugestões do A16 (dossiê, não decisão · RG-09) */}
      <div className="card" id="dossie-sugestoes">
        <span className="overline">Como eu provo</span>
        <h2 className="title-md" style={{ marginTop: 2 }}>Sugestões — dossiê, não decisão</h2>
        <p style={{ ...textoSecundario, margin: '6px 0 0', maxWidth: '64ch' }}>
          Subsídio gerado por regras determinísticas sobre os números do motor, citando práticas
          reconhecidas de gestão. Cada sugestão aponta o dado que a motivou; a decisão de agir é
          humana (RG-09).
        </p>
        {sugestoes.length > 0 ? (
          <div className="dossie-sugestoes">
            {sugestoes.map((s, i) => (
              <article key={i} className="dossie-sugestao" aria-label={`Sugestão ${i + 1}`}>
                {/* Texto VERBATIM do servidor — auditado pelo A06 (RG-03). */}
                <p>{s.texto}</p>
                <div className="dossie-sugestao-meta">
                  <span className="chip">{ROTULO_GATILHO[s.gatilho] ?? s.gatilho.toLowerCase()}</span>
                  <span>
                    Prática: <strong>{s.pratica_citada}</strong>
                  </span>
                  <a href={ANCORA_ORIGEM[s.origem.tipo] ?? '#dossie-onde-estamos'}>dado de origem</a>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 6 }}>
                  {s.fonte_referencia}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="aviso" role="status" style={{ marginTop: 12 }}>
            {dossie.sugestoes_motivo ?? 'Nenhuma sugestão para este recorte.'}
          </p>
        )}
      </div>

      {/* 7 · Rodapé — papel antes de tela + rastro da pesquisa persistida */}
      <div className="dossie-rodape">
        {indicadorId !== null && (
          <span>
            Exportar o ranking completo:{' '}
            <a href={urlExportacao('csv')}>CSV</a> · <a href={urlExportacao('xlsx')}>XLSX</a> ·{' '}
            <a href={urlExportacao('pdf')}>PDF</a>
          </span>
        )}
        {pesquisaId && (
          <a
            className="mono"
            style={{ fontSize: 11, color: 'var(--on-surface-variant)', overflowWrap: 'anywhere' }}
            href={`/api/v1/pesquisas/${pesquisaId}`}
          >
            pesquisa registrada · reabra em /v1/pesquisas/{pesquisaId}
          </a>
        )}
      </div>
    </section>
  );
}
