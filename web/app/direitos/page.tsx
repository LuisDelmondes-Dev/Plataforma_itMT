import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { AREAS, CONFIANCA, GRATUIDADE, type DireitoResumo } from '@/lib/direitos';

export const dynamic = 'force-dynamic';

interface AreaContagem { area: string; direitos: number }
interface Publico { slug: string; nome: string; direitos: number }

/**
 * F4 — Mapa Brasileiro de Serviços Públicos Gratuitos, Benefícios e
 * Direitos do Cidadão. Só aparece aqui o que sobreviveu aos vetos de
 * publicação (F4-RG-01..05): base legal, link oficial e data de
 * verificação são indissociáveis da ficha — a mesma régua de
 * procedência do resto da plataforma.
 */
export default async function Direitos(
  props: {
    searchParams: Promise<{ area?: string; publico?: string; q?: string; pouco?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const qs = new URLSearchParams();
  if (searchParams.area) qs.set('area', searchParams.area);
  if (searchParams.publico) qs.set('publico', searchParams.publico);
  if (searchParams.q) qs.set('q', searchParams.q);
  if (searchParams.pouco === '1') qs.set('pouco_conhecidos', '1');

  const [direitos, areas, publicos] = await Promise.all([
    // Falha propaga para o error.tsx (RN-005): fora do ar ≠ catálogo vazio.
    apiGet<DireitoResumo[]>(`/direitos${qs.toString() ? `?${qs}` : ''}`),
    apiGet<AreaContagem[]>('/direitos/areas', { revalidate: 3600 }),
    apiGet<Publico[]>('/direitos/publicos', { revalidate: 3600 }),
  ]);

  const link = (mut: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const alvo = { ...searchParams, ...mut };
    if (alvo.area) p.set('area', alvo.area);
    if (alvo.publico) p.set('publico', alvo.publico);
    if (alvo.q) p.set('q', alvo.q);
    if (alvo.pouco === '1') p.set('pouco', '1');
    return `/direitos${p.toString() ? `?${p}` : ''}`;
  };

  return (
    <div className="direitos-pagina">
      {/* Hero editorial da Cidadania: a identidade-mãe (navy + verde +
          display) vestida na página mais cidadã do portal. */}
      <section className="direitos-hero">
        <div>
          <p className="overline">Cidadania · verificado por parecer humano</p>
          <h1>Mapa de Direitos e Serviços Públicos Gratuitos</h1>
          <p className="direitos-hero-sub">
            Cada ficha traz base legal, órgão responsável, documentos, passo a passo, como
            recorrer e a <strong>data da última verificação</strong>. Nada publica sem fonte
            oficial — o veto é de banco, não de convenção.
          </p>
          <div className="direitos-hero-acoes">
            <Link className="btn direitos-cta" href="/direitos/descubra">✦ Descubra os seus direitos</Link>
            <Link
              className={`btn direitos-cta-secundaria${searchParams.pouco === '1' ? ' ativa' : ''}`}
              href={link({ pouco: searchParams.pouco === '1' ? undefined : '1' })}
            >
              Direitos que muitos desconhecem
            </Link>
          </div>
        </div>
        <div className="direitos-selo" aria-hidden="true">
          <strong>{direitos.length}</strong>
          <span>direito{direitos.length === 1 ? '' : 's'} publicado{direitos.length === 1 ? '' : 's'}</span>
          <small>RG-09 · parecer humano</small>
        </div>
      </section>

      {/* Busca flutuante sobre o hero */}
      <form action="/direitos" method="get" className="direitos-busca">
        {searchParams.area && <input type="hidden" name="area" value={searchParams.area} />}
        <label className="sr-only" htmlFor="direitos-busca-campo">Buscar direito</label>
        <input id="direitos-busca-campo" className="campo" type="search" name="q"
          placeholder="Buscar direito, benefício ou serviço…" defaultValue={searchParams.q ?? ''} />
        <button className="btn primaria" type="submit">Buscar</button>
      </form>

      <div className="direitos-filtros">
        <Link className={`chip${!searchParams.area ? ' atual' : ''}`} href={link({ area: undefined })}>Todas as áreas</Link>
        {areas.map((a) => (
          <Link key={a.area} className={`chip${searchParams.area === a.area ? ' atual' : ''}`} href={link({ area: a.area })}>
            {AREAS[a.area] ?? a.area} · {a.direitos}
          </Link>
        ))}
      </div>

      <div className="direitos-filtros">
        <span className="overline" style={{ alignSelf: 'center' }}>Público:</span>
        <Link className={`chip${!searchParams.publico ? ' atual' : ''}`} href={link({ publico: undefined })}>Todos</Link>
        {publicos.filter((p) => p.direitos > 0).map((p) => (
          <Link key={p.slug} className={`chip${searchParams.publico === p.slug ? ' atual' : ''}`} href={link({ publico: p.slug })}>
            {p.nome}
          </Link>
        ))}
      </div>

      {direitos.length === 0 ? (
        <p className="aviso">Nenhum direito publicado corresponde aos filtros — a ausência é resposta, não erro.</p>
      ) : (
        <div className="direitos-grid">
          {direitos.map((d) => {
            const c = CONFIANCA[d.confianca] ?? CONFIANCA.NECESSITA_CONFIRMACAO;
            return (
              <Link key={d.id} href={`/direitos/${d.id}`} className={`direitos-card confianca-${c.classe}`}>
                <div className="direitos-card-topo">
                  <span className="direitos-area">{AREAS[d.area] ?? d.area}</span>
                  <span className={`chip ${c.classe}`}><span className="forma" aria-hidden>{c.forma}</span>{c.rotulo}</span>
                </div>
                <h2>{d.nome}</h2>
                {d.pouco_conhecido && <span className="chip construcao direitos-pouco">Pouco conhecido</span>}
                <p className="direitos-resumo">{d.resumo}</p>
                <ul className="direitos-fatos">
                  <li>{GRATUIDADE[d.gratuidade] ?? d.gratuidade}</li>
                  <li>{d.depende_de_renda ? 'Depende de renda' : 'Independe de renda'}</li>
                  <li>{d.exige_inss ? 'Exige INSS' : 'Sem contribuição ao INSS'}</li>
                  {d.automatico && <li>Concessão automática</li>}
                </ul>
                <div className="regua mono direitos-verificacao">
                  <div className="trilho" aria-hidden="true" />
                  Verificado em {d.data_verificacao ?? '—'}
                  <span className="direitos-abrir" aria-hidden="true">ver ficha →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="aviso" style={{ marginTop: 24, maxWidth: 780 }}>
        ⚠ Orientação geral — não substitui atendimento jurídico, médico, previdenciário ou
        social individualizado. Diagnóstico ≠ incapacidade ≠ deficiência ≠ benefício automático.
        Limites de renda e valores mudam periodicamente: confirme no órgão responsável.
      </p>
    </div>
  );
}
