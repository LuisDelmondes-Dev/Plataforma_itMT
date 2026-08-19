'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Organizacao {
  tenant_id: string;
  organization_id: string;
  slug: string;
  nome: string;
  papel: string;
  membership_version: number;
}

export default function OrganizacoesPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => { setToken(sessionStorage.getItem('itmt.auth.identity') ?? ''); }, []);

  async function carregar(evento?: React.FormEvent) {
    evento?.preventDefault();
    setCarregando(true);
    setErro('');
    try {
      const resposta = await fetch('/api/v1/auth/organizacoes', {
        headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (!resposta.ok) throw new Error('Sessão inválida ou expirada. Entre novamente.');
      const lista = await resposta.json() as Organizacao[];
      sessionStorage.setItem('itmt.auth.identity', token);
      setOrganizacoes(lista);
      if (!lista.length) setErro('Sua identidade ainda não possui uma organização ativa.');
    } catch (falha) {
      setOrganizacoes([]);
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar as organizações.');
    } finally { setCarregando(false); }
  }

  async function selecionar(organizacao: Organizacao) {
    setCarregando(true);
    setErro('');
    try {
      const resposta = await fetch('/api/v1/auth/contexto', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ organization_id: organizacao.organization_id }),
      });
      if (!resposta.ok) throw new Error('A organização não está mais disponível para esta identidade.');
      const contexto = await resposta.json();

      // Contexto anterior nunca acompanha a troca. Respostas privadas não são
      // armazenadas pelo service worker; a mensagem também limpa adapters futuros.
      sessionStorage.removeItem('itmt.auth.context');
      sessionStorage.removeItem('itmt.auth.organization');
      navigator.serviceWorker?.controller?.postMessage({ type: 'PURGE_PRIVATE' });
      sessionStorage.setItem('itmt.auth.context', contexto.token);
      sessionStorage.setItem('itmt.auth.organization', JSON.stringify(organizacao));
      router.push(`/o/${organizacao.slug}`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha ao selecionar organização.');
      setCarregando(false);
    }
  }

  return (
    <div className="org-console">
      <header className="org-hero">
        <div>
          <div className="overline">Fronteira de segurança</div>
          <h1>Escolha o território de trabalho</h1>
          <p>Cada sessão contextual pertence a uma única organização. A troca invalida o contexto anterior e nunca reaproveita dados privados.</p>
        </div>
        <div className="org-seal" aria-hidden="true"><span>RLS</span><small>FORCE</small></div>
      </header>

      <form className="org-token" onSubmit={carregar}>
        <label htmlFor="identity-token">Token da identidade</label>
        <div>
          <input id="identity-token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token obtido no login" />
          <button className="btn primaria" type="submit" disabled={!token || carregando}>{carregando ? 'Verificando…' : 'Listar organizações'}</button>
        </div>
        <small>O token de identidade lista somente memberships próprias; ele ainda não acessa recursos privados.</small>
      </form>

      {erro && <p className="org-error" role="alert">{erro}</p>}
      <section className="org-grid" aria-live="polite">
        {organizacoes.map((organizacao, indice) => (
          <button
            type="button" className="org-card" key={organizacao.organization_id}
            onClick={() => selecionar(organizacao)} disabled={carregando}
            style={{ '--ordem': indice } as React.CSSProperties}
          >
            <span className="org-index">{String(indice + 1).padStart(2, '0')}</span>
            <span className="org-name">{organizacao.nome}</span>
            <span className="org-meta">{organizacao.papel} · membership v{organizacao.membership_version}</span>
            <span className="org-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </section>
    </div>
  );
}
