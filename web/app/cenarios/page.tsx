'use client';

/**
 * Simulador de cenários (apoio à decisão do gestor): "e se crescer X% ao
 * ano?". Toda trajetória vem do motor determinístico (categoria CENARIO,
 * método declarado por linha) — a página só desenha. Hipótese nunca se
 * veste de dado: observado é linha cheia; cenário é tracejado e rotulado.
 */
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';

interface Destaque { id: number; nome: string; unidade: string; tema: string }
interface Municipio { codigo_ibge: string; nome: string }
interface Ponto { ano: number; valor: number }
interface Cenario { rotulo: string; metodo: string; pontos: Ponto[] }
interface RespostaCenarios {
  indicador: string; unidade: string; local: string; categoria: string;
  base: Ponto; observados: Ponto[]; cenarios: Cenario[]; aviso: string;
}

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
// observado = navy cheio; cenários = cores distintas, sempre tracejadas
const CORES = ['#6b7280', '#006e28', '#b45309', '#3a6ea5', '#8b5cf6'];

function GraficoCenarios({ observados, cenarios, unidade }: {
  observados: Ponto[]; cenarios: Cenario[]; unidade: string;
}) {
  const W = 720, H = 260, P = { t: 12, r: 16, b: 28, l: 64 };
  const todos = [...observados, ...cenarios.flatMap((c) => c.pontos)];
  if (todos.length < 2) return null;
  const anos = todos.map((p) => p.ano), vals = todos.map((p) => p.valor);
  const aMin = Math.min(...anos), aMax = Math.max(...anos);
  const vMin = Math.min(...vals, 0), vMax = Math.max(...vals);
  const x = (ano: number) => P.l + ((ano - aMin) / (aMax - aMin || 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - ((v - vMin) / (vMax - vMin || 1)) * (H - P.t - P.b);
  const linha = (ps: Ponto[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${x(p.ano).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const base = observados[observados.length - 1];
  const anosEixo = Array.from({ length: aMax - aMin + 1 }, (_, i) => aMin + i);
  const fmtCompacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`Cenários de ${aMin} a ${aMax}, em ${unidade}`} style={{ display: 'block' }}>
      {/* grade horizontal discreta */}
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const v = vMin + f * (vMax - vMin);
        return (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={P.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--ink-3)">
              {fmtCompacto.format(v)}
            </text>
          </g>
        );
      })}
      {anosEixo.map((a) => (
        <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{a}</text>
      ))}
      {/* divisor observado × futuro */}
      <line x1={x(base.ano)} x2={x(base.ano)} y1={P.t} y2={H - P.b} stroke="var(--border)" strokeDasharray="2 3" />
      {/* cenários (tracejados) partindo do último observado */}
      {cenarios.map((c, i) => (
        <path key={c.rotulo} d={linha([base, ...c.pontos])} fill="none"
          stroke={CORES[i % CORES.length]} strokeWidth="2" strokeDasharray="5 4"
          strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      ))}
      {/* observado (cheio, por cima) */}
      <path d={linha(observados)} fill="none" stroke="var(--primary)" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {observados.map((p) => (
        <circle key={p.ano} cx={x(p.ano)} cy={y(p.valor)} r={p.ano === base.ano ? 3.5 : 2.5} fill="var(--primary)" />
      ))}
    </svg>
  );
}

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
    apiGet<Municipio[]>('/municipios').then(setMunicipios).catch(() => {});
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
            <option value="">Mato Grosso (estado)</option>
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
            <GraficoCenarios observados={dados.observados} cenarios={dados.cenarios} unidade={dados.unidade} />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
              <span className="label-md" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 18, height: 3, background: 'var(--primary)', display: 'inline-block' }} aria-hidden />
                Observado (até {dados.base.ano})
              </span>
              {dados.cenarios.map((c, i) => (
                <span key={c.rotulo} className="label-md" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 18, height: 0, borderTop: `3px dashed ${CORES[i % CORES.length]}`, display: 'inline-block',
                  }} aria-hidden />
                  {c.rotulo}
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
            <div className="card-header"><span className="title-md">Valores por cenário ({dados.unidade})</span></div>
            <table className="dados" style={{ width: '100%' }}>
              <caption style={{ display: 'none' }}>Valores projetados por cenário e ano</caption>
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
