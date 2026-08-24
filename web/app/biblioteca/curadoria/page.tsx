'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

const TOKEN_STORAGE = 'itmt.documentos.token:v1';

interface Pendente {
  id: string;
  titulo: string;
  orgao: string;
  tipo: string;
  criado_por: string;
  criado_em: string;
  versao_id: string;
  arquivo: string;
  mime: string;
  extracao: string;
  seguranca: string;
  antivirus: string | null;
  antivirus_detalhe: string | null;
  metodo: string | null;
  confianca: number | null;
  texto_amostra: string | null;
}

interface Operacao {
  worker_automatico: boolean;
  antivirus: string;
  embeddings_provider: string;
  pgvector: boolean;
  embeddings_indexados: number;
  fila: { tipo: string; status: string; total: number }[];
  versoes: { seguranca: string; total: number }[];
}

async function corpoErro(r: Response) {
  const d = await r.json().catch(() => null);
  return d?.message ?? `Falha na operação (${r.status}).`;
}

export default function CuradoriaDocumental() {
  const [token, setToken] = useState('');
  const [fila, setFila] = useState<Pendente[]>([]);
  const [operacao, setOperacao] = useState<Operacao | null>(null);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    try { setToken(sessionStorage.getItem(TOKEN_STORAGE) ?? ''); } catch { /* storage indisponível (ex.: modo privado): começa sem token */ }
  }, []);

  async function carregarFila(tokenAtual = token) {
    if (!tokenAtual) return;
    setAviso('');
    const headers = { Authorization: `Bearer ${tokenAtual}` };
    const [r, status] = await Promise.all([
      fetch('/api/v1/admin/documentos/pendentes', { headers }),
      fetch('/api/v1/admin/documentos/operacao', { headers }),
    ]);
    if (!r.ok) { setAviso(await corpoErro(r)); return; }
    setFila(await r.json());
    if (status.ok) setOperacao(await status.json());
  }

  function salvarToken(valor: string) {
    setToken(valor);
    try { sessionStorage.setItem(TOKEN_STORAGE, valor); } catch { /* storage indisponível (ex.: modo privado): sessão segue sem persistir */ }
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true); setAviso('');
    const form = new FormData(e.currentTarget);
    const r = await fetch('/api/v1/documentos/upload', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    setOcupado(false);
    if (!r.ok) { setAviso(await corpoErro(r)); return; }
    const d = await r.json();
    e.currentTarget.reset();
    setAviso(`Documento ${d.id} recebido em quarentena. A verificação e a extração serão executadas pela fila segura.`);
    await carregarFila();
  }

  async function processarFila() {
    setOcupado(true); setAviso('');
    const r = await fetch('/api/v1/admin/documentos/processar-fila', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limite: 5 }),
    });
    setOcupado(false);
    if (!r.ok) { setAviso(await corpoErro(r)); return; }
    const d = await r.json();
    setAviso(`${d.processadas} tarefa${d.processadas === 1 ? '' : 's'} processada${d.processadas === 1 ? '' : 's'}.`);
    await carregarFila();
  }

  async function decidir(item: Pendente, decisao: 'APROVADO' | 'REJEITADO') {
    const justificativa = window.prompt(
      decisao === 'APROVADO'
        ? 'Justificativa da aprovação (mínimo 10 caracteres):'
        : 'Motivo da rejeição (mínimo 10 caracteres):',
    );
    if (!justificativa) return;
    let texto_revisado: string | undefined;
    if (decisao === 'APROVADO' && !item.texto_amostra) {
      texto_revisado = window.prompt('Nenhum texto foi extraído. Insira o conteúdo revisado para indexação:') ?? undefined;
      if (!texto_revisado) return;
    }
    setOcupado(true); setAviso('');
    const r = await fetch(`/api/v1/admin/documentos/versoes/${item.versao_id}/revisao`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisao, justificativa, texto_revisado }),
    });
    setOcupado(false);
    if (!r.ok) { setAviso(await corpoErro(r)); return; }
    setAviso(decisao === 'APROVADO' ? 'Documento revisado, indexado e publicado.' : 'Documento rejeitado.');
    await carregarFila();
  }

  return (
    <div className="curadoria-docs">
      <div className="curadoria-topo">
        <div>
          <div className="overline">Operação · acesso restrito</div>
          <h1>Curadoria documental</h1>
          <p>Submeta arquivos e decida a publicação depois de conferir fonte, licença e texto extraído.</p>
        </div>
        <Link href="/biblioteca">Ver biblioteca pública</Link>
      </div>

      <section className="card curadoria-token">
        <label htmlFor="token">Token de curador, parceiro ou administrador</label>
        <div>
          <input id="token" className="campo" type="password" value={token}
            onChange={(e) => salvarToken(e.target.value)} autoComplete="off" />
          <button className="btn" type="button" onClick={() => carregarFila()}>Carregar fila</button>
        </div>
        <small>O token fica somente nesta aba do navegador.</small>
      </section>

      {aviso && <div className="aviso" role="status">{aviso}</div>}

      {operacao && (
        <section className="card curadoria-operacao" aria-label="Estado do processamento documental">
          <div>
            <div className="overline">Processamento seguro</div>
            <strong>{operacao.worker_automatico ? 'Worker automático ativo' : 'Worker sob demanda'}</strong>
            <small>Antivírus: {operacao.antivirus} · Vetores: {operacao.pgvector ? 'pgvector ativo' : 'fallback lexical'}</small>
          </div>
          <div>
            <strong>{operacao.fila.filter((x) => x.status === 'PENDENTE').reduce((s, x) => s + x.total, 0)}</strong>
            <small>tarefas pendentes · {operacao.embeddings_indexados} embeddings</small>
          </div>
          <button className="btn" type="button" disabled={ocupado} onClick={processarFila}>Processar até 5 tarefas</button>
        </section>
      )}

      <div className="curadoria-colunas">
        <section className="card">
          <div className="card-header"><strong>Novo documento</strong></div>
          <form className="curadoria-form" onSubmit={enviar}>
            <label>Título<input className="campo" name="titulo" required minLength={3} maxLength={240} /></label>
            <label>Órgão responsável<input className="campo" name="orgao" required /></label>
            <div className="curadoria-dupla">
              <label>Tipo<select className="campo" name="tipo" required defaultValue="RELATORIO">
                <option value="RELATORIO">Relatório</option><option value="ESTUDO">Estudo</option>
                <option value="LEGISLACAO">Legislação</option><option value="PLANO">Plano</option>
                <option value="NOTA_TECNICA">Nota técnica</option>
                <option value="BASE_METODOLOGICA">Base metodológica</option><option value="OUTRO">Outro</option>
              </select></label>
              <label>Licença<input className="campo" name="licenca" placeholder="Ex.: CC BY 4.0" required /></label>
            </div>
            <label>Descrição<textarea className="campo" name="descricao" rows={3} /></label>
            <label>URL oficial<input className="campo" name="fonte_url" type="url" placeholder="https://…" /></label>
            <label>Código IBGE municipal<input className="campo" name="codigo_ibge" inputMode="numeric" pattern="[0-9]{7}" /></label>
            <label className="curadoria-arquivo">Arquivo
              <input name="arquivo" type="file" required accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp" />
              <small>TXT, Markdown, CSV, JSON, PDF ou imagem · máximo 15 MB</small>
            </label>
            <button className="btn primaria" disabled={ocupado || !token}>Enviar para análise</button>
          </form>
        </section>

        <section>
          <div className="curadoria-fila-titulo">
            <div><div className="overline">RG-09</div><h2>Fila de revisão</h2></div>
            <span>{fila.length} pendente{fila.length === 1 ? '' : 's'}</span>
          </div>
          <div className="curadoria-fila">
            {fila.map((item) => (
              <article className="card" key={item.versao_id}>
                <div className="curadoria-item-meta">
                  <span>{item.tipo.replaceAll('_', ' ')}</span>
                  <span>Antivírus: {item.seguranca}</span>
                  <span>Extração: {item.extracao}</span>
                </div>
                <h3>{item.titulo}</h3>
                <p>{item.orgao} · enviado por {item.criado_por}</p>
                <div className="curadoria-extracao">
                  <span>Método: {item.metodo ?? 'não disponível'}</span>
                  <span>Confiança: {item.confianca == null ? 'não aferida' : `${Math.round(item.confianca * 100)}%`}</span>
                  <span>Assinatura: {item.antivirus ?? 'aguardando verificação'}</span>
                </div>
                <pre>{item.texto_amostra || 'Nenhum texto foi extraído automaticamente. A revisão deve inserir o conteúdo correto.'}</pre>
                <div className="curadoria-acoes">
                  <button className="btn sucesso"
                    disabled={ocupado || item.seguranca !== 'LIMPO' || item.extracao !== 'PROCESSADO'}
                    title={item.seguranca !== 'LIMPO' || item.extracao !== 'PROCESSADO'
                      ? 'A aprovação só é liberada após antivírus e extração.' : undefined}
                    onClick={() => decidir(item, 'APROVADO')}>Revisar e aprovar</button>
                  <button className="btn" disabled={ocupado} onClick={() => decidir(item, 'REJEITADO')}>Rejeitar</button>
                </div>
              </article>
            ))}
            {fila.length === 0 && <div className="biblioteca-vazio"><strong>Fila não carregada ou vazia</strong><p>Informe um token autorizado e carregue a fila.</p></div>}
          </div>
        </section>
      </div>
    </div>
  );
}
