'use client';

/**
 * Painel estratégico (Onda 3): a leitura de estado do território numa
 * tela só — KPIs estaduais com procedência, tendência anual, ranking
 * municipal e cobertura. Tudo do motor determinístico; nenhum número
 * nasce aqui (RG-03), e município ausente é ausência (RN-005).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet, Resultado } from '@/lib/api';
import { CartaoIndicador } from '@/components/CartaoIndicador';
import { Sparkline } from '@/components/Sparkline';

interface Destaque { id: number; nome: string; unidade: string; tema: string }
interface LinhaMapa { codigo_ibge: string; valor: number; data_referencia: string; fonte: string }
interface RespostaMapa { indicador: string; unidade: string; municipios: LinhaMapa[] }
interface SerieHistorica { indicador: string; unidade: string; local: string; pontos: { ano: number; valor: number }[] }
interface Municipio { codigo_ibge: string; nome: string }
interface Cobertura { municipio: string; tema: string; estado: string }

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export default function PaginaPainel() {
  const [catalogo, setCatalogo] = useState<Destaque[]>([]);
  const [kpis, setKpis] = useState<Resultado[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [serie, setSerie] = useState<SerieHistorica | null>(null);
  const [mapa, setMapa] = useState<RespostaMapa | null>(null);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Destaque[]>('/indicadores/destaque?limite=12&detalhe=1')
      .then(async (d) => {
        setCatalogo(d);
        if (d.length) setSel(d[0].id);
        const rs = await Promise.all(
          d.map((i) =>
            apiGet<Resultado>(`/indicadores/${i.id}/consulta?recorte=ESTADO&codigo=51`).catch(() => null),
          ),
        );
        setKpis(rs.filter(Boolean) as Resultado[]);
      })
      .catch((e) => setErro(e.message));
    apiGet<Municipio[]>('/municipios')
      .then((ms) => setNomes(new Map(ms.map((m) => [m.codigo_ibge, m.nome]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sel) return;
    apiGet<SerieHistorica>(`/indicadores/${sel}/serie?recorte=ESTADO`).then(setSerie).catch(() => setSerie(null));
    apiGet<RespostaMapa>(`/indicadores/${sel}/mapa`).then(setMapa).catch(() => setMapa(null));
  }, [sel]);

  const ranking = useMemo(() => {
    const ms = [...(mapa?.municipios ?? [])].sort((a, b) => b.valor - a.valor);
    return { top: ms.slice(0, 10), base: ms.slice(-5).reverse(), total: ms.length };
  }, [mapa]);

  const indicadorSel = catalogo.find((c) => c.id === sel);

  return (
    <div>
      <p className="overline" style={{ color: 'var(--primary)' }}>PAINEL · LEITURA ESTRATÉGICA</p>
      <h1 className="headline-lg" style={{ margin: '4px 0 8px' }}>Mato Grosso em números</h1>
      <p className="body-md" style={{ color: 'var(--on-surface-variant)', maxWidth: '65ch' }}>
        O estado consolidado a partir dos indicadores com dado real — cada número com a sua
        procedência. Para o recorte municipal, use o <Link href="/mapa">mapa</Link> ou a{' '}
        <Link href="/consulta">consulta</Link>.
      </p>

      {erro && <p className="aviso" role="alert">{erro}</p>}

      {/* KPIs estaduais */}
      <section aria-label="Indicadores estaduais" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, margin: '18px 0',
      }}>
        {kpis.map((r) => <CartaoIndicador key={r.indicador} resultado={r} />)}
      </section>

      {/* Seletor do foco */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }} role="tablist" aria-label="Escolher indicador em foco">
        {catalogo.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={sel === c.id}
            className="chip"
            onClick={() => setSel(c.id)}
            style={{
              cursor: 'pointer',
              background: sel === c.id ? 'var(--primary)' : undefined,
              color: sel === c.id ? 'var(--surface, #fff)' : undefined,
              border: '1px solid var(--border)',
            }}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Tendência */}
        <div className="card">
          <div className="card-header"><span className="title-md">Tendência — {indicadorSel?.nome}</span></div>
          {serie && serie.pontos.length >= 2 ? (
            <>
              <Sparkline pontos={serie.pontos} unidade={serie.unidade} />
              <div className="mono-sm" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--on-surface-variant)' }}>
                <span>{serie.pontos[0].ano}: {fmt.format(serie.pontos[0].valor)}</span>
                <span>{serie.pontos.at(-1)!.ano}: {fmt.format(serie.pontos.at(-1)!.valor)} {serie.unidade}</span>
              </div>
              <p className="label-md" style={{ color: 'var(--on-surface-variant)', marginTop: 8 }}>
                Anos sem ponto não têm dado publicado — ausência é resposta, não zero.
              </p>
            </>
          ) : (
            <p className="label-md" style={{ color: 'var(--on-surface-variant)' }}>Série insuficiente para tendência.</p>
          )}
        </div>

        {/* Ranking municipal */}
        <div className="card">
          <div className="card-header"><span className="title-md">Maiores valores municipais</span></div>
          <table className="dados" style={{ width: '100%' }}>
            <caption style={{ display: 'none' }}>Dez maiores municípios em {indicadorSel?.nome}</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Município</th><th scope="col" style={{ textAlign: 'right' }}>{mapa?.unidade}</th></tr></thead>
            <tbody>
              {ranking.top.map((m, i) => (
                <tr key={m.codigo_ibge}>
                  <td className="mono-sm">{i + 1}</td>
                  <td><Link href={`/municipio/${m.codigo_ibge}`}>{nomes.get(m.codigo_ibge) ?? m.codigo_ibge}</Link></td>
                  <td className="num mono-sm">{fmt.format(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="label-md" style={{ color: 'var(--on-surface-variant)', marginTop: 8 }}>
            {ranking.total} municípios com dado · fonte {mapa?.municipios[0]?.fonte ?? '—'}
          </p>
        </div>

        {/* Menores valores */}
        <div className="card">
          <div className="card-header"><span className="title-md">Menores valores municipais</span></div>
          <table className="dados" style={{ width: '100%' }}>
            <caption style={{ display: 'none' }}>Cinco menores municípios em {indicadorSel?.nome}</caption>
            <thead><tr><th scope="col">Município</th><th scope="col" style={{ textAlign: 'right' }}>{mapa?.unidade}</th></tr></thead>
            <tbody>
              {ranking.base.map((m) => (
                <tr key={m.codigo_ibge}>
                  <td><Link href={`/municipio/${m.codigo_ibge}`}>{nomes.get(m.codigo_ibge) ?? m.codigo_ibge}</Link></td>
                  <td className="num mono-sm">{fmt.format(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="label-md" style={{ marginTop: 8 }}>
            <Link href="/mapa">Ver a distribuição completa no mapa →</Link>
          </p>
        </div>

        {/* Cobertura honesta */}
        <div className="card">
          <div className="card-header"><span className="title-md">Cobertura de dados</span></div>
          <p className="body-md">
            {catalogo.length} indicador(es) com dado real publicado, de 17 temas da taxonomia.
            A cobertura completa — tema a tema, município a município — está no painel de{' '}
            <Link href="/cobertura">cobertura</Link>.
          </p>
          <p className="label-md" style={{ color: 'var(--on-surface-variant)' }}>
            O que não tem fonte aparece como "sem fonte" — nunca como zero (RN-004/005).
          </p>
        </div>
      </section>
    </div>
  );
}
