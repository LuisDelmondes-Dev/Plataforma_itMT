'use client';

/**
 * DASH-PESQUISA (Gauntlet P5) — a resposta do modo pesquisa em forma de
 * dashboard simples: card do índice geral (barra de legibilidade: IBGE
 * Cidades), barras top-5 e tabela completa filtrável (barra de completude:
 * TabNet). Todo numeral vem do JSON do motor (RG-03) — aqui só existe
 * formatação pt-BR. O ranking cheio é buscado sob demanda no endpoint da
 * P2; município sem dado aparece como ausência declarada, nunca zero
 * (RN-005).
 */
import { useState } from 'react';
import { apiGet } from '@/lib/api';
import { REGIAO } from '@/lib/regiao';
import { formatarNumero } from '@/lib/format';
import { GraficoBarras } from '@/components/GraficoBarras';
import { TabelaDados } from '@/components/TabelaDados';
import { EstadoDado } from '@/components/EstadoDado';
import { ReguaProcedencia } from '@/components/ReguaProcedencia';

/** Quinteto de procedência como chega nas citações da Xingú (a data de extração pode faltar). */
export interface CitacaoProcedencia {
  fonte: string;
  url: string | null;
  data_referencia: string;
  data_extracao?: string;
  licenca: string;
  hash: string;
  /** E3: fase de homologação na fonte; ausente = desconhecido (o selo só aparece quando afirmável). */
  status_dado?: 'PRELIMINAR' | 'CONSOLIDADO' | 'REVISADO';
}

/** Linha do ranking municipal (contrato da P2, espelhado do motor). */
export interface RankingMunicipioDto {
  posicao: number;
  codigo_ibge: string;
  nome: string;
  valor: number;
  delta_media_estadual: number | null;
  top_n: boolean;
  bottom_n: boolean;
  procedencia: CitacaoProcedencia[];
}

export type Agregacao = 'SOMA' | 'RECALCULO' | 'MEDIA_PONDERADA' | 'NAO_AGREGAVEL';

/** Bloco `ranking_top` do envelope RespostaXingu (contrato da P4, modo pesquisa). */
export interface RankingTopDto {
  indicador: string;
  unidade: string;
  referencia: string;
  agregacao: Agregacao;
  media_estadual: number | null;
  total_estadual: number | null;
  total_municipios: number;
  ausentes: { total: number };
  /** Só as linhas top-N; o ranking cheio vem de GET /v1/indicadores/:id/ranking. */
  municipios: RankingMunicipioDto[];
  tabela_completa: true;
}

/** Resposta de GET /v1/indicadores/:id/ranking (P2) — o ranking completo. */
interface RankingCompletoDto {
  indicador: string;
  unidade: string;
  referencia: string;
  agregacao: Agregacao;
  media_estadual: number | null;
  total_estadual: number | null;
  total_municipios: number;
  ausentes: { total: number; codigos: string[] };
  municipios: RankingMunicipioDto[];
}

/** Número exatamente como o motor mandou, só em pt-BR (nunca re-arredondado). */
const num = (v: number | null | undefined) => formatarNumero(v, 6);
const inteiro = (v: number) => formatarNumero(v, 0);
/** Delta com sinal explícito; null (sem média estadual, RN-003) vira travessão. */
const delta = (d: number | null) => (d === null ? '—' : `${d > 0 ? '+' : ''}${formatarNumero(d, 6)}`);
/** Busca leiga: sem acento e sem caixa. */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const textoSecundario = { fontSize: 12, color: 'var(--on-surface-variant)' } as const;

function linhaAusentes(total: number): string {
  if (total === 0) return 'Todos os municípios têm dado nesta referência.';
  const plural = total > 1;
  return `${inteiro(total)} município${plural ? 's' : ''} sem dado nesta referência — ausência é resposta, não zero.`;
}

export function DashboardPesquisa({
  rankingTop,
  indicadorId,
  citacoes,
}: {
  rankingTop: RankingTopDto;
  /** Id do indicador (plano/contexto da resposta) — habilita ranking cheio e CSV. */
  indicadorId: number | null;
  /** Citações da resposta (quinteto §12.1) para a régua do card estadual. */
  citacoes: CitacaoProcedencia[];
}) {
  const [expandida, setExpandida] = useState(false);
  const [completo, setCompleto] = useState<RankingCompletoDto | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [filtro, setFiltro] = useState('');

  const temMedia = rankingTop.media_estadual !== null;
  const colunas = temMedia ? 4 : 3;
  const procedencia = citacoes.length > 0 ? citacoes : rankingTop.municipios[0]?.procedencia ?? [];
  const fonte = procedencia[0]?.fonte;

  async function carregarCompleto() {
    if (indicadorId === null) return;
    setCarregando(true);
    setErro(null);
    try {
      setCompleto(
        await apiGet<RankingCompletoDto>(
          `/indicadores/${indicadorId}/ranking?referencia=${encodeURIComponent(rankingTop.referencia)}`,
        ),
      );
    } catch (e) {
      setErro(e);
    } finally {
      setCarregando(false);
    }
  }

  function alternar() {
    const abrir = !expandida;
    setExpandida(abrir);
    if (abrir && completo === null && !carregando) void carregarCompleto();
  }

  // Linhas exibidas: top-5 fechado; ranking cheio (filtrável) aberto.
  const aberta = expandida && completo !== null;
  const todas = aberta ? completo.municipios : rankingTop.municipios;
  const filtroAtivo = aberta && filtro.trim() !== '';
  const linhas = filtroAtivo
    ? todas.filter((m) => normalizar(m.nome).includes(normalizar(filtro.trim())))
    : todas;
  const ausentesTotal = aberta ? completo.ausentes.total : rankingTop.ausentes.total;

  // Ano exibido = ANO DO DADO (vigência real na procedência das linhas do
  // ranking), nunca a data da consulta — padrão IBGE Cidades: o colchete é o
  // ano do dado, o mesmo que a frase do motor e a régua já mostram. O
  // parâmetro `referencia` das URLs (ranking cheio, CSV) segue o da consulta.
  const anosLinhas = todas
    .map((m) =>
      m.procedencia.reduce<string | null>((maior, p) => {
        const a = p.data_referencia.slice(0, 4);
        return maior === null || a > maior ? a : maior;
      }, null),
    )
    .filter((a): a is string => a !== null);
  const anoMax = anosLinhas.length
    ? anosLinhas.reduce((a, b) => (a > b ? a : b))
    : rankingTop.referencia.slice(0, 4);
  const anoMin = anosLinhas.length ? anosLinhas.reduce((a, b) => (a < b ? a : b)) : anoMax;
  // Vigência heterogênea entre municípios ⇒ intervalo honesto ("2023–2024").
  const ano = anoMin === anoMax ? anoMax : `${anoMin}–${anoMax}`;

  // Card estadual: SOMA mostra o total; RECALCULO/MEDIA_PONDERADA mostram a
  // média (o rollup do motor JÁ é a média); NAO_AGREGAVEL não tem agregado
  // estadual válido (RN-003) — aviso curto em vez de número.
  const valorEstadual =
    rankingTop.agregacao === 'SOMA' ? rankingTop.total_estadual : rankingTop.media_estadual;
  // "Com dado" exclui os ausentes — total_municipios inclui quem não tem dado
  // e contradizia a frase do motor (crítico P5/rodada 3: "13" vs "12").
  const municipiosComDado = rankingTop.total_municipios - (rankingTop.ausentes?.total ?? 0);
  const legendaEstadual =
    rankingTop.agregacao === 'SOMA'
      ? `Soma de ${inteiro(municipiosComDado)} municípios com dado` +
        (temMedia ? ` · média por município: ${num(rankingTop.media_estadual)} ${rankingTop.unidade}` : '')
      : rankingTop.agregacao === 'RECALCULO'
        ? `Taxa estadual recalculada pelo motor sobre ${inteiro(municipiosComDado)} municípios com dado`
        : `Média estadual ponderada pela população, sobre ${inteiro(municipiosComDado)} municípios com dado`;

  return (
    <section aria-label={`Painel da pesquisa — ${rankingTop.indicador}`} style={{ display: 'grid', gap: 8 }}>
      {/* 1 · Índice geral do estado (legibilidade de card, referência R2) */}
      <div className="card">
        <span className="overline">
          {rankingTop.indicador} · {REGIAO.nome}
        </span>
        {rankingTop.agregacao === 'NAO_AGREGAVEL' ? (
          <p style={{ ...textoSecundario, fontSize: 13, margin: '8px 0 0', maxWidth: '56ch' }}>
            Este indicador não pode ser somado nem ter média estadual (regra RN-003: cada valor é
            do próprio município). O ranking abaixo continua válido, município a município.
          </p>
        ) : (
          <>
            <div className="kpi" style={{ marginTop: 8 }}>
              {num(valorEstadual)}{' '}
              <span className="unidade">
                {rankingTop.unidade} [{ano}]
              </span>
            </div>
            <p style={{ ...textoSecundario, margin: '4px 0 0' }}>{legendaEstadual}</p>
          </>
        )}
        <ReguaProcedencia procedencia={procedencia} />
      </div>

      {/* 2 · Barras top-5 + 3 · tabela (a tabela é a forma citável; as barras são o encoding visual) */}
      <div className="card">
        <span className="overline">
          Os {inteiro(rankingTop.municipios.length)} maiores municípios [{ano}]
        </span>
        <GraficoBarras
          barras={rankingTop.municipios.map((m) => ({
            rotulo: `${m.posicao}º ${m.nome}`,
            valor: m.valor,
            destaque: m.posicao === 1,
          }))}
          unidade={rankingTop.unidade}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          {indicadorId !== null && (
            <button type="button" className="btn" aria-expanded={expandida} onClick={alternar}>
              {expandida
                ? 'Mostrar só os primeiros'
                : `Ver todos os ${inteiro(rankingTop.total_municipios)} municípios`}
            </button>
          )}
          {aberta && (
            <input
              type="search"
              className="campo"
              style={{ flex: 1, minWidth: 180, width: 'auto' }}
              placeholder="Filtrar por nome do município…"
              aria-label="Filtrar municípios por nome"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          )}
        </div>

        {expandida && carregando && <EstadoDado estado="carregando" />}
        {expandida && erro !== null && !carregando && (
          <EstadoDado estado="erro" erro={erro} aoTentarNovamente={() => void carregarCompleto()} />
        )}

        <TabelaDados
          legenda={`Ranking dos municípios de ${REGIAO.nome} — ${rankingTop.indicador}, referência ${ano}`}
        >
          <thead>
            <tr>
              <th scope="col">Posição</th>
              <th scope="col">Município</th>
              <th scope="col" style={{ textAlign: 'right' }}>
                Valor ({rankingTop.unidade})
              </th>
              {temMedia && (
                <th scope="col" style={{ textAlign: 'right' }} title="Diferença em relação à média estadual">
                  Δ vs média
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {linhas.map((m) => (
              <tr key={m.codigo_ibge} style={m.posicao === 1 ? { fontWeight: 600 } : undefined}>
                <td className="num">{m.posicao}º</td>
                <td>{m.nome}</td>
                <td className="num">{num(m.valor)}</td>
                {temMedia && <td className="num">{delta(m.delta_media_estadual)}</td>}
              </tr>
            ))}
            {filtroAtivo && linhas.length === 0 && (
              <tr>
                <td colSpan={colunas}>Nenhum município encontrado com esse nome.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={colunas} style={textoSecundario}>
                {linhaAusentes(ausentesTotal)}
              </td>
            </tr>
          </tfoot>
        </TabelaDados>
        {temMedia && (
          <p style={{ ...textoSecundario, margin: '8px 0 0' }}>
            Δ = diferença em relação à média estadual.
          </p>
        )}

        {/* 4 · Rodapé: procedência resumida + exportação (papel antes de tela) */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={textoSecundario}>
            {fonte ? `Fonte: ${fonte} · ` : ''}dados de {ano}
          </span>
          {indicadorId !== null && (
            <a
              className="btn"
              style={{ textDecoration: 'none' }}
              href={`/api/v1/indicadores/${indicadorId}/exportacao?formato=csv&recorte=ESTADO&referencia=${rankingTop.referencia}`}
            >
              Baixar CSV
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
