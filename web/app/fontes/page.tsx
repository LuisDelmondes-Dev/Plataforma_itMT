'use client';

import { useEffect, useState } from 'react';

interface Situacao {
  atualizado: boolean;
  motivo: string;
  resumo: Record<string, unknown>;
}
interface Agente {
  slug: string;
  nome: string;
  fonte: string;
  tipo: 'API' | 'ARQUIVO';
  descricao: string;
  validade_dias: number;
  situacao: Situacao;
  instrucao?: string;
  em_execucao: boolean;
}
interface Resultado {
  agente: string;
  origem: 'BANCO' | 'INTERNET' | 'REQUER_ARQUIVO';
  sucesso?: boolean;
  motivo_da_busca?: string;
  situacao: Situacao;
  instrucao?: string;
  saida: string | null;
  duracao_ms?: number;
}

const ROTULO_RESUMO: Record<string, string> = {
  municipios_no_banco: 'Municípios no banco',
  esperado: 'Esperado',
  indicador: 'Indicador',
  status_validacao: 'Status de validação',
  observacoes: 'Observações',
  data_referencia_mais_recente: 'Referência mais recente',
  cargas_da_fonte: 'Cargas da fonte',
  ultima_carga: 'Última carga',
  idade_da_carga_dias: 'Idade da carga (dias)',
};

/**
 * F5 — Agentes de fonte: banco primeiro; internet só quando falta ou
 * venceu. O usuário vê a decisão do agente e o log da pesquisa.
 */
export default function Fontes() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [pesquisando, setPesquisando] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    try {
      const r = await fetch('/api/v1/agentes/fontes');
      if (!r.ok) throw new Error(`Falha ao listar (${r.status}).`);
      setAgentes(await r.json());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao listar agentes.');
    }
  }
  useEffect(() => { carregar(); }, []);

  async function pesquisar(slug: string) {
    setPesquisando((p) => ({ ...p, [slug]: true }));
    try {
      const r = await fetch(`/api/v1/agentes/fontes/${slug}/pesquisar`, { method: 'POST' });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo?.message ?? `Falha (${r.status}).`);
      setResultados((m) => ({ ...m, [slug]: corpo }));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na pesquisa.');
    } finally {
      setPesquisando((p) => ({ ...p, [slug]: false }));
    }
  }

  const chipSituacao = (a: Agente) =>
    a.situacao.atualizado
      ? <span className="chip atual"><span className="forma" aria-hidden>●</span>Atualizado</span>
      : (a.situacao.resumo.observacoes === 0 || a.situacao.resumo.cargas_da_fonte === 0) && a.situacao.resumo.municipios_no_banco === undefined
        ? <span className="chip sem-dado"><span className="forma" aria-hidden>○</span>Sem dados</span>
        : <span className="chip defasado"><span className="forma" aria-hidden>◐</span>Desatualizado</span>;

  const chipOrigem = (r: Resultado) =>
    r.origem === 'BANCO'
      ? <span className="chip atual">Respondido do banco — sem acesso à internet</span>
      : r.origem === 'INTERNET'
        ? <span className={`chip ${r.sucesso ? 'atual' : 'defasado'}`}>
            {r.sucesso ? `Buscado na fonte oficial em ${((r.duracao_ms ?? 0) / 1000).toFixed(1)}s` : 'Busca na fonte falhou'}
          </span>
        : <span className="chip construcao">Requer arquivo oficial (passo manual)</span>;

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="overline">Dados</div>
      <h1 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 600, margin: '8px 0' }}>
        Agentes de fonte
      </h1>
      <p style={{ color: 'var(--ink-2)', maxWidth: 720 }}>
        Um agente por fonte oficial. A regra de cada um: se a informação já está no banco e
        dentro da validade, ele responde <strong>do banco</strong>; só vai à internet quando
        falta ou venceu — e toda busca passa pelo pipeline Bronze→Prata→Ouro com procedência
        e auditoria. Indicador novo continua nascendo <span className="mono">EM_ANALISE</span> até
        parecer humano (RG-09).
      </p>

      {erro && <p className="aviso" role="alert">{erro}</p>}

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {agentes.map((a) => {
          const r = resultados[a.slug];
          return (
            <div key={a.slug} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{a.nome}</span>
                {chipSituacao(a)}
                <span className="chip">{a.tipo === 'API' ? 'Busca automática' : 'Arquivo oficial'}</span>
                <span style={{ flex: 1 }} />
                <button
                  className="btn primaria"
                  onClick={() => pesquisar(a.slug)}
                  disabled={!!pesquisando[a.slug] || a.em_execucao}
                >
                  {pesquisando[a.slug] ? 'Pesquisando…' : 'Pesquisar'}
                </button>
              </div>
              <div style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 6 }}>
                {a.descricao} · <span className="mono">{a.fonte}</span> · validade {a.validade_dias} dias
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                <strong>Diagnóstico:</strong> {a.situacao.motivo}
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {Object.entries(a.situacao.resumo)
                  .filter(([, v]) => v !== null && v !== undefined)
                  .map(([k, v]) => <span key={k}>{ROTULO_RESUMO[k] ?? k}: <strong>{String(v)}</strong></span>)}
              </div>

              {r && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {chipOrigem(r)}
                    {r.motivo_da_busca && (
                      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Motivo: {r.motivo_da_busca}</span>
                    )}
                  </div>
                  {r.instrucao && (
                    <p className="aviso" style={{ marginTop: 8 }}>{r.instrucao}</p>
                  )}
                  {r.saida && (
                    <pre className="mono" style={{
                      marginTop: 8, padding: 12, fontSize: 12, lineHeight: '18px',
                      background: 'var(--surface-container-low)', borderRadius: 8,
                      overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto',
                    }}>{r.saida}</pre>
                  )}
                  <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {Object.entries(r.situacao.resumo)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => <span key={k}>{ROTULO_RESUMO[k] ?? k}: <strong>{String(v)}</strong></span>)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
