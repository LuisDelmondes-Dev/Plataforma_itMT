'use client';

/**
 * Home-buscador: a pesquisa responde NA PRÓPRIA página, como um buscador.
 * Quem responde é o motor da Xingú (POST /xingu/pergunta) — plano antes da
 * frase, número auditado (A06) e citações com procedência; em paralelo, a
 * busca de município monta um painel de conhecimento (ficha/consulta/mapa).
 * Sem LLM, o intérprete léxico responde do mesmo jeito (RG-05); pergunta
 * ambígua vira clarificação; ausência é dita, nunca estimada (RN-005).
 */
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { apiGet, apiPost, ErroApi } from '@/lib/api';
import { REGIAO } from '@/lib/regiao';
import { PesquisaPrincipal } from '@/components/PesquisaPrincipal';
import { ReguaProcedencia } from '@/components/ReguaProcedencia';
import { EstadoDado } from '@/components/EstadoDado';
import { DashboardPesquisa, type CitacaoProcedencia, type RankingTopDto } from '@/components/DashboardPesquisa';

type Citacao = CitacaoProcedencia;
interface RespostaXingu {
  estado: 'RESPONDIDA' | 'CLARIFICACAO' | 'SEM_DADO' | 'BLOQUEADA';
  resposta: string;
  plano?: { recorte: string; codigo: string | null; indicador_id?: number; indicador?: string; local?: string; periodo?: { referencia: string } };
  clarificacao?: { pergunta: string; opcoes: { rotulo: string; pergunta_sugerida: string }[] };
  citacoes?: Citacao[];
  followups?: { rotulo: string; tipo: 'PERGUNTA' | 'LINK'; alvo: string }[];
  contexto?: { indicador_id?: number; codigo_ibge?: string };
  /** DASH-PESQUISA (P5): presente só no modo 'pesquisa' com estado RESPONDIDA. */
  ranking_top?: RankingTopDto;
  auditoria: { numerais: number; vetos: number; interprete: string };
  latencia_ms: number;
}
interface Municipio { codigo_ibge: string; nome: string }

/**
 * Ano do DADO (não o da consulta), pela mesma regra do DashboardPesquisa:
 * máximo entre as vigências da procedência do ranking. O plano carrega a data
 * pedida (hoje) — exibi-la como "dados de AAAA" contradiz o motor (crítico
 * P5/rodada 3: o chip era a última superfície dizendo 2026 com dado de 2024).
 */
function anoDoDado(r: RespostaXingu): string | null {
  let max: string | null = null;
  for (const m of r.ranking_top?.municipios ?? [])
    for (const p of m.procedencia ?? []) {
      const ano = String(p.data_referencia ?? '').slice(0, 4);
      if (ano && (!max || ano > max)) max = ano;
    }
  return max;
}

export default function Home() {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState<RespostaXingu | null>(null);
  const [municipio, setMunicipio] = useState<Municipio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const pesquisou = carregando || resposta !== null || erro !== null;

  async function pesquisar(termo: string) {
    setPergunta(termo);
    setCarregando(true);
    setErro(null);
    setResposta(null);
    setMunicipio(null);
    // Painel de conhecimento: em paralelo, tenta casar um município.
    apiGet<Municipio[]>(`/municipios?q=${encodeURIComponent(termo)}`)
      .then((ms) => setMunicipio(ms[0] ?? null))
      .catch(() => setMunicipio(null)); // painel é bônus: sem ele, a resposta segue
    try {
      // RN-MODO (P4): na home a barra é o lado "Pesquisa" do seletor — o
      // lado "Xingú" navega para /xingu, que envia modo 'xingu'.
      setResposta(await apiPost<RespostaXingu>('/xingu/pergunta', { pergunta: termo, modo: 'pesquisa' }));
    } catch (e) {
      setErro(e);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className={`home-minima${pesquisou ? ' pesquisou' : ''}`}>
      <Link href="/" aria-label="Início — Plataforma itMT" onClick={() => { setResposta(null); setErro(null); setMunicipio(null); }}>
        <Image
          className="home-minima-logo"
          src="/itmt-horizontal.png"
          alt={`Plataforma itMT — inteligência territorial ${REGIAO.nome}`}
          width={720}
          height={272}
          priority
        />
      </Link>
      <PesquisaPrincipal aoPesquisar={pesquisar} />

      {pesquisou && (
        <div className="home-resultados" aria-live="polite">
          <div className="home-resposta">
            {carregando && <EstadoDado estado="carregando" />}
            {erro !== null && !carregando && (
              <EstadoDado estado="erro" erro={erro instanceof ErroApi ? erro : undefined} aoTentarNovamente={() => pesquisar(pergunta)} />
            )}
            {resposta && (
              <>
                {resposta.plano && (
                  <div className="plano-consulta">
                    <span className="overline">Consultei</span>
                    <span className="plano-consulta-resumo">
                      {resposta.plano.indicador ?? 'Indicador a confirmar'}
                      {' · '}
                      {resposta.plano.local ?? resposta.plano.codigo ?? REGIAO.nome}
                      {(() => {
                        const ano =
                          anoDoDado(resposta) ??
                          (resposta.plano?.periodo?.referencia
                            ? String(resposta.plano.periodo.referencia).slice(0, 4)
                            : null);
                        return ano ? ` · dados de ${ano}` : '';
                      })()}
                    </span>
                  </div>
                )}
                <div className="card home-resposta-texto">
                  <p>{resposta.resposta}</p>
                  {resposta.citacoes?.map((c, i) => (
                    <ReguaProcedencia key={i} procedencia={[c]} />
                  ))}
                  {resposta.clarificacao && (
                    <div className="home-resposta-opcoes">
                      {resposta.clarificacao.opcoes.map((o) => (
                        <button key={o.rotulo} className="btn" onClick={() => pesquisar(o.pergunta_sugerida)}>
                          {o.rotulo}
                        </button>
                      ))}
                    </div>
                  )}
                  {resposta.followups?.length ? (
                    <div className="home-resposta-opcoes">
                      {resposta.followups.map((f) =>
                        f.tipo === 'PERGUNTA' ? (
                          <button key={f.rotulo} className="btn" onClick={() => pesquisar(f.alvo)}>
                            {f.rotulo}
                          </button>
                        ) : (
                          <Link key={f.rotulo} className="btn" href={f.alvo}>
                            {f.rotulo}
                          </Link>
                        ),
                      )}
                    </div>
                  ) : null}
                  <div className="home-resposta-auditoria">
                    Respondida em {resposta.latencia_ms} ms · intérprete{' '}
                    <span className="mono">{resposta.auditoria.interprete}</span> · auditoria de
                    números: {resposta.auditoria.vetos === 0 ? 'sem vetos' : `${resposta.auditoria.vetos} veto(s)`}
                    {' · '}
                    <Link href={`/xingu?q=${encodeURIComponent(pergunta)}`}>continuar na Xingú →</Link>
                  </div>
                </div>
                {/* DASH-PESQUISA (P5): o dashboard só existe quando o motor
                    mandou ranking_top (modo pesquisa, RESPONDIDA) — em
                    CLARIFICACAO/SEM_DADO o texto acima já é a resposta. */}
                {resposta.estado === 'RESPONDIDA' && resposta.ranking_top && (
                  <DashboardPesquisa
                    rankingTop={resposta.ranking_top}
                    indicadorId={resposta.contexto?.indicador_id ?? resposta.plano?.indicador_id ?? null}
                    citacoes={resposta.citacoes ?? []}
                  />
                )}
              </>
            )}
          </div>

          {municipio && !carregando && (
            <aside className="home-painel-municipio" aria-label={`Atalhos de ${municipio.nome}`}>
              <span className="overline">Município</span>
              <strong>{municipio.nome}</strong>
              <span className="mono home-painel-codigo">{municipio.codigo_ibge}</span>
              <div className="home-painel-acoes">
                <Link className="btn primaria" href={`/municipio/${municipio.codigo_ibge}`}>Ficha completa</Link>
                <Link className="btn" href={`/consulta?municipio=${municipio.codigo_ibge}`}>Consulta guiada</Link>
                <Link className="btn" href="/mapa">Ver no mapa</Link>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
