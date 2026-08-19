'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Organizacao { organization_id: string; tenant_id: string; slug: string; nome: string; papel: string }
interface Configuracao { chave: string; valor: unknown; atualizada_em: string }

export function OrganizationWorkspace({ slug }: { slug: string }) {
  const [organizacao, setOrganizacao] = useState<Organizacao | null>(null);
  const [configuracoes, setConfiguracoes] = useState<Configuracao[]>([]);
  const [estado, setEstado] = useState<'CARREGANDO' | 'PRONTO' | 'DENIED' | 'ERRO'>('CARREGANDO');

  useEffect(() => {
    let ativa = true;
    async function carregar() {
      try {
        const salva = sessionStorage.getItem('itmt.auth.organization');
        const token = sessionStorage.getItem('itmt.auth.context');
        const atual = salva ? JSON.parse(salva) as Organizacao : null;
        if (!atual || !token || atual.slug !== slug) { if (ativa) setEstado('DENIED'); return; }
        if (ativa) setOrganizacao(atual);
        const resposta = await fetch(`/api/v1/organizacoes/${atual.organization_id}/configuracoes`, {
          headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        if (resposta.status === 401 || resposta.status === 403 || resposta.status === 404) {
          if (ativa) setEstado('DENIED');
          return;
        }
        if (!resposta.ok) throw new Error('Falha de leitura');
        if (ativa) { setConfiguracoes(await resposta.json()); setEstado('PRONTO'); }
      } catch { if (ativa) setEstado('ERRO'); }
    }
    carregar();
    return () => { ativa = false; };
  }, [slug]);

  if (estado === 'CARREGANDO') return <div className="org-workspace-state">Validando membership e contexto…</div>;
  if (estado === 'DENIED') return (
    <div className="org-denied" role="alert">
      <div className="org-denied-code">DENIED</div>
      <h1>Organização fora do contexto</h1>
      <p>Este endereço não pertence à sessão selecionada. Nenhum dado foi solicitado ou exibido.</p>
      <Link className="btn primaria" href="/organizacoes" prefetch={false}>Selecionar organização</Link>
    </div>
  );
  if (estado === 'ERRO') return <div className="org-denied"><h1>Serviço indisponível</h1><p>O contexto não foi alterado. Tente novamente mais tarde.</p></div>;

  return (
    <div className="org-workspace">
      <header>
        <div className="overline">Workspace isolado · {organizacao?.papel}</div>
        <h1>{organizacao?.nome}</h1>
        <code>{organizacao?.organization_id}</code>
      </header>
      <section>
        <h2>Configurações da organização</h2>
        {configuracoes.length ? configuracoes.map((item) => (
          <article key={item.chave}>
            <strong>{item.chave}</strong>
            <pre>{JSON.stringify(item.valor, null, 2)}</pre>
          </article>
        )) : <p>Nenhuma configuração privada cadastrada.</p>}
      </section>
    </div>
  );
}
