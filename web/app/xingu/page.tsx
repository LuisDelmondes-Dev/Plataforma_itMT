'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { REGIAO } from '@/lib/regiao';
import { ModoPesquisa, SeletorModoPesquisa } from '@/components/SeletorModoPesquisa';

interface Citacao {
  fonte: string;
  url: string | null;
  data_referencia: string;
  data_extracao?: string;
  licenca: string;
  hash: string;
}
interface Situacao {
  modo: string;
  llm: string;
  chaves_carregadas: { anthropic: boolean; openai: boolean };
  provedores: { provedor: string; llm: string; detalhe: string }[];
}
interface Followup { rotulo: string; tipo: 'PERGUNTA' | 'LINK'; alvo: string }
interface Opcao { rotulo: string; pergunta_sugerida: string }
interface Resposta {
  estado: 'RESPONDIDA' | 'CLARIFICACAO' | 'SEM_DADO' | 'BLOQUEADA';
  resposta: string;
  plano?: { recorte: string; codigo: string | null; indicador?: string; local?: string; periodo: { referencia: string } };
  clarificacao?: { pergunta: string; opcoes: Opcao[] };
  citacoes?: Citacao[];
  followups?: Followup[];
  contexto?: { indicador_id?: number; codigo_ibge?: string };
  auditoria: { numerais: number; vetos: number; interprete: string };
  latencia_ms: number;
}
interface Mensagem { papel: 'usuario' | 'xingu'; texto: string; dados?: Resposta }

/**
 * XINGU-CHAT (RF-CHAT-001..012).
 * O plano de consulta aparece como bloco estruturado ACIMA da narrativa —
 * o usuário vê o raciocínio antes da frase (§15.7). Voz: STT via Web
 * Speech API (pt-BR) e TTS opcional via speechSynthesis.
 */
export default function Xingu() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
      <XinguConteudo />
    </Suspense>
  );
}

function XinguConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [ocupada, setOcupada] = useState(false);
  const [falar, setFalar] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const contexto = useRef<Resposta['contexto']>(undefined);
  const fim = useRef<HTMLDivElement>(null);
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const consultaInicialAplicada = useRef(false);
  const pQ = params.get('q');

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens]);

  useEffect(() => {
    const fechar = (event: KeyboardEvent) => event.key === 'Escape' && setMenuAberto(false);
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, []);

  // /xingu?q= transporta a intenção sem executar a IA. A pessoa ainda precisa
  // confirmar no compositor, evitando chamadas acidentais ao apenas trocar o modo.
  useEffect(() => {
    if (consultaInicialAplicada.current || !pQ) return;
    consultaInicialAplicada.current = true;
    setTexto(pQ);
  }, [pQ]);

  // RG-05: mostra ao usuário se a IA de linguagem livre está ativa ou se o
  // portal está no modo léxico determinístico (ex.: provedores sem crédito).
  useEffect(() => {
    fetch('/api/v1/xingu/situacao')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setSituacao(s))
      .catch(() => {});
  }, []);

  async function perguntar(pergunta: string) {
    if (!pergunta.trim() || ocupada) return;
    setMensagens((m) => [...m, { papel: 'usuario', texto: pergunta }]);
    setTexto('');
    setOcupada(true);
    try {
      const r = await fetch('/api/v1/xingu/pergunta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pergunta, contexto: contexto.current }),
      });
      const d: Resposta = await r.json();
      if (d.contexto) contexto.current = { ...contexto.current, ...d.contexto };
      setMensagens((m) => [...m, { papel: 'xingu', texto: d.resposta, dados: d }]);
      if (falar && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(d.resposta);
        u.lang = 'pt-BR';
        window.speechSynthesis.speak(u); // RF-CHAT-002 (TTS)
      }
    } catch {
      setMensagens((m) => [
        ...m,
        {
          papel: 'xingu',
          texto:
            'A Xingú está indisponível no momento. O portal continua funcionando pela navegação Local → Tema → Subtema (RG-05).',
        },
      ]);
    } finally {
      setOcupada(false);
    }
  }

  /** RF-CHAT-001: entrada por áudio (STT pt-BR no navegador). */
  function ouvir() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMensagens((m) => [
        ...m,
        { papel: 'xingu', texto: 'Este navegador não oferece reconhecimento de voz. Digite a pergunta.' },
      ]);
      return;
    }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.onstart = () => setOuvindo(true);
    rec.onend = () => setOuvindo(false);
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript;
      if (t) perguntar(t);
    };
    rec.start();
  }

  function mudarModo(modo: ModoPesquisa) {
    if (modo === 'xingu') return;
    const ultimaPergunta = [...mensagens].reverse().find((mensagem) => mensagem.papel === 'usuario');
    const rascunho = texto.trim() || ultimaPergunta?.texto || '';
    router.push(rascunho ? `/consulta?rascunho=${encodeURIComponent(rascunho)}` : '/consulta');
  }

  function usarSugestao(sugestao: string) {
    setTexto(sugestao);
    setMenuAberto(false);
  }

  function limparConversa() {
    setMensagens([]);
    setTexto('');
    contexto.current = undefined;
    window.speechSynthesis?.cancel();
    setMenuAberto(false);
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="modo-pesquisa-contextual" aria-label="Modo da pesquisa atual">
        <div>
          <div className="overline">Experiência de consulta</div>
          <p>Use linguagem natural sem perder o acesso à pesquisa estruturada.</p>
        </div>
        <SeletorModoPesquisa ativo="xingu" onChange={mudarModo} compacto />
      </section>
      <div className="overline">IA Xingú</div>
      <h1 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 600, margin: '8px 0' }}>
        Pergunte aos dados de {REGIAO.nome}
      </h1>
      <p style={{ color: 'var(--ink-2)' }}>
        A Xingú traduz a sua pergunta em um plano de consulta — exibido antes da resposta —
        e executa no motor determinístico. Nenhum número vem do modelo de linguagem: cada
        valor é auditado contra o resultado da consulta antes de aparecer aqui.
      </p>

      {situacao && situacao.llm !== 'ATIVO' && (
        <div className="aviso" role="status" style={{ marginTop: 8 }}>
          <strong>Modo léxico determinístico (RG-05).</strong> A IA de linguagem livre está
          indisponível no momento — as respostas vêm do vocabulário do domínio (município,
          tema, indicador). O portal funciona normalmente; nenhum número deixa de ser auditado.
          {situacao.provedores?.some((p) => /crédito|credit|quota/i.test(p.detalhe)) &&
            ' (Provedores sem crédito — adicione crédito em uma conta para ativar a linguagem livre.)'}
        </div>
      )}

      <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '24px 0' }}>
        {mensagens.length === 0 && (
          <div className="card">
            <div className="overline">Exemplos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {[
                'Quantos leitos de UTI existem em Cuiabá?',
                `Qual a população de ${REGIAO.nome}?`,
                'Cobertura vacinal no consórcio Teles Pires',
              ].map((s) => (
                <button key={s} className="btn" onClick={() => perguntar(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m, i) =>
          m.papel === 'usuario' ? (
            <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
              <div className="card" style={{ padding: '10px 14px', background: 'var(--accent-50)', borderColor: 'var(--accent-600)' }}>
                {m.texto}
              </div>
            </div>
          ) : (
            <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '92%', width: '100%' }}>
              {/* O plano ANTES da frase (RF-CHAT-003 / §15.7) */}
              {m.dados?.plano && (
                <div
                  className="mono"
                  style={{
                    fontSize: 12, lineHeight: '18px', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--neutral-100)',
                    padding: '8px 12px', marginBottom: 6, color: 'var(--ink-2)',
                  }}
                >
                  ✛ PLANO&nbsp; recorte={m.dados.plano.recorte}
                  {m.dados.plano.codigo ? ` codigo=${m.dados.plano.codigo}` : ''}
                  {m.dados.plano.indicador ? ` indicador="${m.dados.plano.indicador}"` : ''}
                  {' '}ref={m.dados.plano.periodo?.referencia}
                </div>
              )}
              <div className="card" style={{ padding: '12px 16px' }}>
                <p style={{ margin: 0 }}>{m.texto}</p>

                {m.dados?.citacoes?.length
                  ? m.dados.citacoes.map((c, ci) => (
                      <div key={ci} className="regua" style={{ marginTop: 10 }}>
                        <div className="trilho" aria-hidden="true" />
                        <div className="legenda">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer">{c.fonte}</a>
                          ) : (
                            c.fonte
                          )}
                          {' · ref. '}{c.data_referencia.slice(0, 4)}
                          {' · '}{c.licenca}
                          {' · '}
                          <span className="mono" title={c.hash}>{c.hash.slice(0, 12)}…</span>
                        </div>
                      </div>
                    ))
                  : null}

                {m.dados?.clarificacao && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {m.dados.clarificacao.opcoes.map((o) => (
                      <button key={o.rotulo} className="btn" onClick={() => perguntar(o.pergunta_sugerida)}>
                        {o.rotulo}
                      </button>
                    ))}
                  </div>
                )}

                {m.dados?.followups?.length ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {m.dados.followups.map((f) =>
                      f.tipo === 'PERGUNTA' ? (
                        <button key={f.rotulo} className="btn" onClick={() => perguntar(f.alvo)}>
                          {f.rotulo}
                        </button>
                      ) : (
                        <a key={f.rotulo} className="btn" style={{ textDecoration: 'none', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center' }} href={f.alvo}>
                          {f.rotulo}
                        </a>
                      ),
                    )}
                  </div>
                ) : null}

                {m.dados && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10 }}>
                    {m.dados.latencia_ms} ms · intérprete {m.dados.auditoria.interprete} · auditor A06:{' '}
                    {m.dados.auditoria.vetos === 0 ? 'sem vetos' : `${m.dados.auditoria.vetos} veto(s) aplicado(s)`}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {ocupada && <div className="skeleton" style={{ height: 56, width: '60%' }} />}
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); perguntar(texto); }}
        className="xingu-compositor"
      >
        <div className="barra-xingu-compositor">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                perguntar(texto);
              }
            }}
            rows={2}
            placeholder="Pergunte o que quiser"
            aria-label="Pergunta para a itMT"
          />
          <div className="barra-xingu-acoes">
            <div className="barra-xingu-mais">
              <button type="button" className="barra-xingu-icone barra-xingu-adicionar" aria-label="Adicionar contexto" aria-expanded={menuAberto} aria-controls="menu-xingu-chat" onClick={() => setMenuAberto(!menuAberto)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              {menuAberto && (
                <div className="barra-xingu-menu" id="menu-xingu-chat">
                  <span>Adicionar à conversa</span>
                  {['Qual a população de Mato Grosso?', 'Quantos leitos de UTI existem em Cuiabá?', 'Cobertura vacinal no consórcio Teles Pires'].map((sugestao) => (
                    <button type="button" key={sugestao} onClick={() => usarSugestao(sugestao)}>{sugestao}</button>
                  ))}
                  <button type="button" onClick={() => setFalar(!falar)}>{falar ? 'Desativar leitura das respostas' : 'Ler respostas em voz alta'}</button>
                  <button type="button" onClick={() => mudarModo('pesquisa')}>Abrir pesquisa estruturada</button>
                  {mensagens.length > 0 && <button type="button" className="perigo" onClick={limparConversa}>Limpar conversa</button>}
                </div>
              )}
            </div>
            {texto.trim() ? (
              <button type="submit" className="barra-xingu-icone barra-xingu-enviar" disabled={ocupada} aria-label="Enviar pergunta">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></svg>
              </button>
            ) : (
              <button type="button" className={`barra-xingu-icone${ouvindo ? ' ativo' : ''}`} onClick={ouvir} aria-pressed={ouvindo} aria-label="Perguntar por voz">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></svg>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
