'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CampoToken } from '@/components/CampoToken';
import { Dialogo } from '@/components/Dialogo';
import { obterToken, salvarToken } from '@/lib/sessao';

interface ChaveApi {
  id: string;
  nome: string;
  prefixo: string;
  escopos: string[];
  quota_minuto: number;
  quota_dia: number;
  status: 'ATIVA' | 'REVOGADA';
  criada_em: string;
  expira_em: string | null;
  ultimo_uso_em: string | null;
  consumo_hoje: number;
}

interface ChaveCriada extends ChaveApi {
  chave: string;
  aviso: string;
}

async function mensagemErro(r: Response) {
  const corpo = await r.json().catch(() => null);
  const mensagem = corpo?.message;
  return Array.isArray(mensagem) ? mensagem.join(' ') : mensagem ?? `Falha na operação (${r.status}).`;
}

export default function Integracoes() {
  const [token, setToken] = useState('');
  const [chaves, setChaves] = useState<ChaveApi[]>([]);
  const [nova, setNova] = useState<ChaveCriada | null>(null);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [autenticado, setAutenticado] = useState(false);
  const [chaveParaRevogar, setChaveParaRevogar] = useState<ChaveApi | null>(null);

  useEffect(() => {
    const salvo = obterToken('integracoes');
    if (salvo) setToken(salvo);
  }, []);

  async function carregar(tokenAtual = token) {
    if (!tokenAtual) return;
    setOcupado(true); setAviso('');
    const r = await fetch('/api/v1/parceiros/chaves', {
      headers: { Authorization: `Bearer ${tokenAtual}` },
    });
    setOcupado(false);
    if (!r.ok) { setAutenticado(false); setAviso(await mensagemErro(r)); return; }
    setChaves(await r.json());
    setAutenticado(true);
    salvarToken('integracoes', tokenAtual);
  }

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const dados = new FormData(formulario);
    const escopos = ['catalogo:ler', 'indicadores:ler'].filter((e) => dados.get(e) === 'on');
    setOcupado(true); setAviso(''); setNova(null);
    const r = await fetch('/api/v1/parceiros/chaves', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: dados.get('nome'), escopos,
        quota_minuto: Number(dados.get('quota_minuto')),
        quota_dia: Number(dados.get('quota_dia')),
      }),
    });
    setOcupado(false);
    if (!r.ok) { setAviso(await mensagemErro(r)); return; }
    const criada = await r.json() as ChaveCriada;
    setNova(criada);
    formulario.reset();
    await carregar();
  }

  async function copiar() {
    if (!nova) return;
    try {
      await navigator.clipboard.writeText(nova.chave);
      setAviso('Chave copiada. Guarde-a em um cofre de segredos.');
    } catch {
      setAviso('Não foi possível copiar automaticamente. Selecione a chave e copie manualmente.');
    }
  }

  async function revogar(chave: ChaveApi) {
    setChaveParaRevogar(null);
    setOcupado(true); setAviso('');
    const r = await fetch(`/api/v1/parceiros/chaves/${chave.id}/revogar`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    setOcupado(false);
    if (!r.ok) { setAviso(await mensagemErro(r)); return; }
    setAviso('Chave revogada. Novas chamadas já estão bloqueadas.');
    await carregar();
  }

  if (!autenticado) {
    return (
      <div className="integracoes acesso">
        <div className="overline">Portal de parceiros · Fase 2</div>
        <h1>Integrações e API</h1>
        <p>Crie credenciais com escopo e quota próprios para consumir dados publicados da plataforma.</p>
        <CampoToken
          titulo="Acesso restrito"
          rotulo="Token de parceiro, universidade ou administrador"
          dica="O token de sessão fica somente nesta aba."
          ocupado={ocupado}
          erro={aviso || undefined}
          aoEnviar={(t) => { setToken(t); void carregar(t); }}
        />
      </div>
    );
  }

  return (
    <div className="integracoes">
      <section className="integracoes-hero">
        <div>
          <div className="overline">Portal de parceiros · API F2</div>
          <h1>Credenciais de integração</h1>
          <p>Chaves isoladas por organização, escopos mínimos e consumo controlado por minuto e por dia.</p>
        </div>
        <button className="btn" disabled={ocupado} onClick={() => carregar()}>Atualizar consumo</button>
      </section>

      {aviso && <div className="aviso" role="status">{aviso}</div>}

      {nova && (
        <section className="integracoes-segredo" aria-labelledby="chave-criada">
          <div><div className="overline">Exibição única</div><h2 id="chave-criada">Copie sua nova chave agora</h2></div>
          <code>{nova.chave}</code>
          <button className="btn primaria" onClick={copiar}>Copiar chave</button>
          <p>{nova.aviso} Não a inclua em código do navegador ou repositório.</p>
        </section>
      )}

      <div className="integracoes-colunas">
        <section className="card">
          <div className="card-header"><strong>Nova credencial</strong></div>
          <form className="integracoes-form" onSubmit={criar}>
            <label>Nome da integração<input className="campo" name="nome" required minLength={3} maxLength={100}
              placeholder="Ex.: painel da universidade" /></label>
            <fieldset>
              <legend>Escopos</legend>
              <label><input type="checkbox" name="catalogo:ler" defaultChecked /> Catálogo e taxonomia</label>
              <label><input type="checkbox" name="indicadores:ler" defaultChecked /> Consulta de indicadores</label>
            </fieldset>
            <div className="integracoes-quotas">
              <label>Chamadas/minuto<input className="campo" name="quota_minuto" type="number" min={1} max={600} defaultValue={60} /></label>
              <label>Chamadas/dia<input className="campo" name="quota_dia" type="number" min={1} max={100000} defaultValue={5000} /></label>
            </div>
            <button className="btn primaria" disabled={ocupado}>Gerar chave secreta</button>
          </form>
        </section>

        <section>
          <div className="integracoes-titulo-lista">
            <div><div className="overline">Uso auditável</div><h2>Suas credenciais</h2></div>
            <span>{chaves.filter((c) => c.status === 'ATIVA').length} ativa{chaves.filter((c) => c.status === 'ATIVA').length === 1 ? '' : 's'}</span>
          </div>
          <div className="integracoes-lista">
            {chaves.map((chave) => (
              <article className="card integracoes-chave" key={chave.id}>
                <div className="integracoes-chave-topo">
                  <div><h3>{chave.nome}</h3><code>itmt_live_{chave.prefixo}_••••••••</code></div>
                  <span className={`chip ${chave.status === 'ATIVA' ? 'atual' : 'sem-dado'}`}>{chave.status}</span>
                </div>
                <div className="integracoes-escopos">{chave.escopos.map((e) => <span key={e}>{e}</span>)}</div>
                <dl>
                  <div><dt>Consumo hoje</dt><dd>{chave.consumo_hoje} / {chave.quota_dia}</dd></div>
                  <div><dt>Limite por minuto</dt><dd>{chave.quota_minuto}</dd></div>
                  <div><dt>Último uso</dt><dd>{chave.ultimo_uso_em ? new Date(chave.ultimo_uso_em).toLocaleString('pt-BR') : 'Nunca'}</dd></div>
                </dl>
                {chave.status === 'ATIVA' && <button className="btn" disabled={ocupado} onClick={() => setChaveParaRevogar(chave)}>Revogar chave</button>}
              </article>
            ))}
            {chaves.length === 0 && <div className="biblioteca-vazio"><strong>Nenhuma credencial</strong><p>Gere uma chave para iniciar a integração.</p></div>}
          </div>
        </section>
      </div>

      <section className="card integracoes-docs">
        <div><div className="overline">Início rápido</div><h2>Chamada autenticada</h2></div>
        <pre><code>{`curl https://SEU_DOMINIO/api/v1/integracoes/temas \\\n  -H "X-API-Key: SUA_CHAVE"`}</code></pre>
        <p>Os cabeçalhos <code>X-RateLimit-Remaining-Minute</code> e <code>X-RateLimit-Remaining-Day</code> informam o saldo disponível.</p>
      </section>

      <Dialogo
        aberto={Boolean(chaveParaRevogar)}
        titulo="Revogar chave"
        destrutivo
        rotuloConfirmar="Revogar definitivamente"
        aoConfirmar={() => { if (chaveParaRevogar) void revogar(chaveParaRevogar); }}
        aoFechar={() => setChaveParaRevogar(null)}
      >
        <p>
          A chave <strong>{chaveParaRevogar?.nome}</strong> deixará de funcionar imediatamente e a
          revogação não pode ser desfeita.
        </p>
      </Dialogo>
    </div>
  );
}

