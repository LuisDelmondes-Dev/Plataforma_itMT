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
export default async function Direitos({
  searchParams,
}: {
  searchParams: { area?: string; publico?: string; q?: string; pouco?: string };
}) {
  const qs = new URLSearchParams();
  if (searchParams.area) qs.set('area', searchParams.area);
  if (searchParams.publico) qs.set('publico', searchParams.publico);
  if (searchParams.q) qs.set('q', searchParams.q);
  if (searchParams.pouco === '1') qs.set('pouco_conhecidos', '1');

  const [direitos, areas, publicos] = await Promise.all([
    apiGet<DireitoResumo[]>(`/direitos${qs.toString() ? `?${qs}` : ''}`).catch(() => [] as DireitoResumo[]),
    apiGet<AreaContagem[]>('/direitos/areas').catch(() => [] as AreaContagem[]),
    apiGet<Publico[]>('/direitos/publicos').catch(() => [] as Publico[]),
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
    <div>
      <div className="overline">Cidadania</div>
      <h1 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 600, margin: '8px 0' }}>
        Mapa de Direitos e Serviços Públicos Gratuitos
      </h1>
      <p style={{ color: 'var(--ink-2)', maxWidth: 720 }}>
        Cada ficha traz base legal, órgão responsável, documentos, passo a passo, como recorrer
        e a <strong>data da última verificação</strong>. Nada publica sem fonte oficial — o veto
        é de banco, não de convenção. As classificações seguem o nível de segurança da
        informação: confirmada, com variação local, condicionada à avaliação, jurisprudencial.
      </p>

      <div className="card" style={{ margin: '16px 0', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Link className="btn primaria" href="/direitos/descubra">✦ Descubra os seus direitos</Link>
        <Link className={`btn${searchParams.pouco === '1' ? ' sucesso' : ''}`} href={link({ pouco: searchParams.pouco === '1' ? undefined : '1' })}>
          Direitos que muitos desconhecem
        </Link>
        <form action="/direitos" method="get" style={{ display: 'flex', gap: 8, flex: '1 1 260px' }}>
          {searchParams.area && <input type="hidden" name="area" value={searchParams.area} />}
          <input className="campo" type="search" name="q" placeholder="Buscar direito, benefício ou serviço…"
            defaultValue={searchParams.q ?? ''} aria-label="Buscar direito" />
          <button className="btn" type="submit">Buscar</button>
        </form>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
        <Link className={`chip${!searchParams.area ? ' atual' : ''}`} href={link({ area: undefined })}>Todas as áreas</Link>
        {areas.map((a) => (
          <Link key={a.area} className={`chip${searchParams.area === a.area ? ' atual' : ''}`} href={link({ area: a.area })}>
            {AREAS[a.area] ?? a.area} · {a.direitos}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 16px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {direitos.map((d) => {
            const c = CONFIANCA[d.confianca] ?? CONFIANCA.NECESSITA_CONFIRMACAO;
            return (
              <Link key={d.id} href={`/direitos/${d.id}`} className="card" style={{ display: 'block', color: 'inherit' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="chip">{AREAS[d.area] ?? d.area}</span>
                  <span className={`chip ${c.classe}`}><span className="forma" aria-hidden>{c.forma}</span>{c.rotulo}</span>
                  {d.pouco_conhecido && <span className="chip construcao">Pouco conhecido</span>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, lineHeight: '22px' }}>{d.nome}</div>
                <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '6px 0 10px' }}>{d.resumo}</p>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{GRATUIDADE[d.gratuidade] ?? d.gratuidade}</span>
                  <span>{d.depende_de_renda ? 'Depende de renda' : 'Independe de renda'}</span>
                  <span>{d.exige_inss ? 'Exige INSS' : 'Sem contribuição ao INSS'}</span>
                  {d.automatico && <span>Concessão automática</span>}
                </div>
                <div className="regua mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  Verificado em {d.data_verificacao ?? '—'}
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
