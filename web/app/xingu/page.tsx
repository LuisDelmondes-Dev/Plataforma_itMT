'use client';

import { useEffect, useRef, useState } from 'react';

interface Citacao {
  fonte: string;
  url: string | null;
  data_referencia: string;
  licenca: string;
  hash: string;
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
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [ocupada, setOcupada] = useState(false);
  const [falar, setFalar] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const contexto = useRef<Resposta['contexto']>(undefined);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens]);

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

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="overline">IA Xingú</div>
      <h1 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 600, margin: '8px 0' }}>
        Pergunte aos dados de Mato Grosso
      </h1>
      <p style={{ color: 'var(--ink-2)' }}>
        A Xingú traduz a sua pergunta em um plano de consulta — exibido antes da resposta —
        e executa no motor determinístico. Nenhum número vem do modelo de linguagem: cada
        valor é auditado contra o resultado da consulta antes de aparecer aqui.
      </p>

      <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '24px 0' }}>
        {mensagens.length === 0 && (
          <div className="card">
            <div className="overline">Exemplos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {[
                'Quantos leitos de UTI existem em Cuiabá?',
                'Qual a população de Mato Grosso?',
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

                {m.dados?.citacoes?.length ? (
                  <div className="regua" style={{ marginTop: 10 }}>
                    <div className="trilho" aria-hidden="true" />
                    <div className="legenda">
                      {m.dados.citacoes[0].url ? (
                        <a href={m.dados.citacoes[0].url} target="_blank" rel="noreferrer">
                          {m.dados.citacoes[0].fonte}
                        </a>
                      ) : (
                        m.dados.citacoes[0].fonte
                      )}
                      {' · ref. '}{m.dados.citacoes[0].data_referencia.slice(0, 4)}
                      {' · '}{m.dados.citacoes[0].licenca}
                    </div>
                  </div>
                ) : null}

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
        style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 16 }}
      >
        <input
          className="campo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pergunte em linguagem natural…"
          aria-label="Pergunta para a IA Xingú"
        />
        <button type="button" className="btn" onClick={ouvir} aria-pressed={ouvindo} aria-label="Perguntar por voz">
          {ouvindo ? '● Ouvindo' : '🎙 Voz'}
        </button>
        <button type="button" className="btn" onClick={() => setFalar(!falar)} aria-pressed={falar} aria-label="Ler respostas em voz alta">
          {falar ? '🔊 TTS on' : '🔇 TTS'}
        </button>
        <button type="submit" className="btn primaria" disabled={ocupada || !texto.trim()}>
          Perguntar
        </button>
      </form>
    </div>
  );
}
