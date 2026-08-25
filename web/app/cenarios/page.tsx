'use client';

/**
 * Simulador de cenários (apoio à decisão do gestor): "e se crescer X% ao
 * ano?". Toda trajetória vem do motor determinístico (categoria CENARIO,
 * método declarado por linha) — a página só desenha. Hipótese nunca se
 * veste de dado: observado é linha cheia; cenário é tracejado e rotulado.
 */
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';
import { REGIAO } from '@/lib/regiao';
import { GraficoLinha } from '@/components/GraficoLinha';

interface Destaque { id: number; nome: string; unidade: string; tema: string }
interface Municipio { codigo_ibge: string; nome: string }
interface Ponto { ano: number; valor: number }
interface Cenario { rotulo: string; metodo: string; pontos: Ponto[] }
interface RespostaCenarios {
  indicador: string; unidade: string; local: string; categoria: string;
  base: Ponto; observados: Ponto[]; cenarios: Cenario[]; aviso: string;
}

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export default function PaginaCenarios() {
  const [catalogo, setCatalogo] = useState<Destaque[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [indicadorId, setIndicadorId] = useState<number | null>(null);
  const [codigo, setCodigo] = useState<string>(''); // '' = estado
  const [horizonte, setHorizonte] = useState(5);
  const [taxas, setTaxas] = useState<string>('2.5, 5');
  const [dados, setDados] = useState<RespostaCenarios | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Destaque[]>('/indicadores/destaque?limite=12&detalhe=1')
      .then((d) => { setCatalogo(d); if (d.length) setIndicadorId(d[0].id); })
      .catch((e) => setErro(e.message));
    apiGet<Municipio[]>('/municipios', { revalidate: 3600 })
      .then(setMunicipios)
      .catch(() => setErro('Falha ao carregar os municípios.'));
  }, []);

  useEffect(() => {
    if (!indicadorId) return;
    const t = taxas.split(',').map((s) => s.trim()).filter(Boolean).join(',');
    if (!t) return;
    const rec = codigo ? `recorte=MUNICIPIO&codigo=${codigo}` : 'recorte=ESTADO';
    apiGet<RespostaCenarios>(`/indicadores/${indicadorId}/cenarios?${rec}&horizonte=${horizonte}&taxas=${encodeURIComponent(t)}`)
      .then((d) => { setDados(d); setErro(null); })
      .catch((e) => { setDados(null); setErro(e.message); });
  }, [indicadorId, codigo, horizonte, taxas]);

  const anosFuturos = useMemo(
    () => dados?.cenarios[0]?.pontos.map((p) => p.ano) ?? [],
    [dados],
  );

  return (
    <div style={{ maxWidth: 960 }}>
      <p className="overline" style={{ color: 'var(--primary)' }}>APOIO À DECISÃO</p>
      <h1 className="headline-lg" style={{ margin: '4px 0 8px' }}>Simulador de cenários</h1>
      <p className="body-md" style={{ color: 'var(--on-surface-variant)', maxWidth: '65ch' }}>
        "E se crescer X% ao ano?" — cada trajetória é calculada pelo motor com o método
        declarado. Cenário é hipótese para planejar, tracejado e rotulado: nunca se
        confunde com o dado observado (linha cheia).
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <label className="label-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Indicador
          <select className="campo" style={{ minWidth: 240 }} value={indicadorId ?? ''}
            onChange={(e) => setIndicadorId(Number(e.target.value))} aria-label="Escolher indicador">
            {catalogo.map((i) => <option key={i.id} value={i.id}>{i.tema} — {i.nome}</option>)}
          </select>
        </label>
        <label className="label-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Local
          <select className="campo" value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-label="Escolher local">
            <option value="">{REGIAO.nome} (estado)</option>
            {municipios.map((m) => <option key={m.codigo_ibge} value={m.codigo_ibge}>{m.nome}</option>)}
          </select>
        </label>
        <label className="label-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Horizonte
          <select className="campo" value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))}
            aria-label="Anos à frente">
            {[3, 5, 8, 10].map((h) => <option key={h} value={h}>{h} anos</option>)}
          </select>
        </label>
        <label className="label-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Taxas (% a.a.)
          <input className="campo" style={{ width: 140 }} value={taxas}
            onChange={(e) => setTaxas(e.target.value)} placeholder="2.5, 5, -1"
            aria-label="Taxas anuais separadas por vírgula" />
        </label>
      </div>

      {erro && <p className="aviso" role="alert">{erro}</p>}

      {dados && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="title-md">{dados.indicador} — {dados.local}</span>
            </div>
            {/* Componente compartilhado da Onda C (era o GraficoCenarios
                preso nesta página): hover/crosshair, teclado e legenda. */}
            <GraficoLinha
              observados={dados.observados}
              series={dados.cenarios.map((c) => ({ rotulo: c.rotulo, pontos: c.pontos }))}
              unidade={dados.unidade}
              rotuloObservado={`Observado (até ${dados.base.ano})`}
            />
          </div>

          <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
            <div className="card-header"><span className="title-md">Valores por cenário ({dados.unidade})</span></div>
            <table className="dados" style={{ width: '100%' }}>
              <caption className="sr-only">Valores projetados por cenário e ano</caption>
              <thead>
                <tr>
                  <th scope="col">Cenário</th>
                  {anosFuturos.map((a) => <th key={a} scope="col" style={{ textAlign: 'right' }}>{a}</th>)}
                </tr>
              </thead>
              <tbody>
                {dados.cenarios.map((c) => (
                  <tr key={c.rotulo}>
                    <td>{c.rotulo}</td>
                    {c.pontos.map((p) => <td key={p.ano} className="num mono-sm">{fmt.format(p.valor)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              {dados.cenarios.map((c) => (
                <p key={c.rotulo} className="label-md" style={{ color: 'var(--on-surface-variant)', margin: '4px 0' }}>
                  <strong>{c.rotulo}:</strong> {c.metodo}
                </p>
              ))}
            </div>
            <p className="aviso" style={{ marginTop: 10 }}>{dados.aviso}</p>
          </div>
        </>
      )}
    </div>
  );
}
