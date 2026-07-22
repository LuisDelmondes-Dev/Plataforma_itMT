'use client';

/**
 * Mapa coroplético de Mato Grosso (Onda 2 — GIS).
 * SVG próprio, sem lib de mapa nem tiles externos: a malha municipal do
 * IBGE (qualidade mínima, SIRGAS 2000) vive em /public e é projetada em
 * equiretangular simples — suficiente e fiel na escala estadual.
 * Valores vêm do motor determinístico (GET /indicadores/:id/mapa), cada
 * um com procedência; município sem dado é "sem dado" (RN-005), nunca zero.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';

interface Destaque { id: number; nome: string; unidade: string; tema: string }
interface LinhaMapa { codigo_ibge: string; valor: number; data_referencia: string; fonte: string }
interface RespostaMapa { indicador: string; unidade: string; referencia: string; municipios: LinhaMapa[] }
interface Municipio { codigo_ibge: string; nome: string }

type Anel = [number, number][];
interface FeatureMun { codarea: string; aneis: Anel[] }

// ---- projeção equiretangular: lon/lat → x/y no viewBox ----
const VB_L = 960; // largura lógica do SVG
function projetar(features: FeatureMun[]) {
  let loMin = Infinity, loMax = -Infinity, laMin = Infinity, laMax = -Infinity;
  for (const f of features) for (const anel of f.aneis) for (const [lo, la] of anel) {
    if (lo < loMin) loMin = lo; if (lo > loMax) loMax = lo;
    if (la < laMin) laMin = la; if (la > laMax) laMax = la;
  }
  // correção de aspecto pela latitude média (MT ≈ -13°)
  const k = Math.cos(((laMin + laMax) / 2) * Math.PI / 180);
  const larg = (loMax - loMin) * k, alt = laMax - laMin;
  const esc = VB_L / larg;
  const vbAlt = alt * esc;
  const x = (lo: number) => (lo - loMin) * k * esc;
  const y = (la: number) => (laMax - la) * esc;
  return { x, y, vbAlt };
}

function caminhoDe(f: FeatureMun, x: (n: number) => number, y: (n: number) => number): string {
  return f.aneis
    .map((anel) => 'M' + anel.map(([lo, la]) => `${x(lo).toFixed(1)},${y(la).toFixed(1)}`).join('L') + 'Z')
    .join('');
}

// Rampa sequencial do tema (claro → navy institucional). 5 classes por quantil.
const RAMPA = ['#dbe4f0', '#a9bdd9', '#7391b8', '#3d6394', '#123a68'];
const COR_SEM_DADO = 'var(--surface-container-high, #e8e8e8)';

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export default function PaginaMapa() {
  const router = useRouter();
  const [indicadores, setIndicadores] = useState<Destaque[]>([]);
  const [indicadorId, setIndicadorId] = useState<number | null>(null);
  const [anos, setAnos] = useState<number[]>([]);
  const [ano, setAno] = useState<number | null>(null); // null = mais recente
  const [dados, setDados] = useState<RespostaMapa | null>(null);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [features, setFeatures] = useState<FeatureMun[]>([]);
  const [pairar, setPairar] = useState<{ codigo: string; mx: number; my: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const refCaixa = useRef<HTMLDivElement>(null);

  // Malha (asset local) + catálogo + nomes — uma vez.
  useEffect(() => {
    fetch('/mt-municipios.geojson')
      .then((r) => r.json())
      .then((gj) => {
        const fs: FeatureMun[] = (gj.features ?? []).map((f: any) => {
          const g = f.geometry;
          const aneis: Anel[] =
            g.type === 'Polygon' ? g.coordinates
            : g.type === 'MultiPolygon' ? g.coordinates.flat()
            : [];
          return { codarea: String(f.properties?.codarea ?? ''), aneis };
        });
        setFeatures(fs);
      })
      .catch(() => setErro('Falha ao carregar a malha municipal.'));
    apiGet<Destaque[]>('/indicadores/destaque?limite=12&detalhe=1')
      .then((d) => { setIndicadores(d); if (d.length) setIndicadorId(d[0].id); })
      .catch(() => setErro('Falha ao carregar o catálogo.'));
    apiGet<Municipio[]>('/municipios')
      .then((ms) => setNomes(new Map(ms.map((m) => [m.codigo_ibge, m.nome]))))
      .catch(() => {});
  }, []);

  // Anos disponíveis do indicador (série no recorte estadual).
  useEffect(() => {
    if (!indicadorId) return;
    setAno(null);
    apiGet<{ pontos: { ano: number }[] }>(`/indicadores/${indicadorId}/serie?recorte=ESTADO`)
      .then((s) => setAnos(s.pontos.map((p) => p.ano)))
      .catch(() => setAnos([]));
  }, [indicadorId]);

  // Valores do mapa.
  useEffect(() => {
    if (!indicadorId) return;
    const ref = ano ? `?referencia=${ano}-12-31` : '';
    apiGet<RespostaMapa>(`/indicadores/${indicadorId}/mapa${ref}`)
      .then((d) => { setDados(d); setErro(null); })
      .catch((e) => setErro(e.message));
  }, [indicadorId, ano]);

  const porCodigo = useMemo(
    () => new Map((dados?.municipios ?? []).map((m) => [m.codigo_ibge, m])),
    [dados],
  );

  // Classes por quantil (5).
  const limites = useMemo(() => {
    const vs = (dados?.municipios ?? []).map((m) => m.valor).sort((a, b) => a - b);
    if (vs.length < 5) return [];
    return [1, 2, 3, 4].map((i) => vs[Math.floor((vs.length * i) / 5)]);
  }, [dados]);
  const corDe = (v: number) => {
    let c = 0;
    for (const l of limites) if (v >= l) c++; else break;
    return RAMPA[Math.min(c, RAMPA.length - 1)];
  };

  const proj = useMemo(() => (features.length ? projetar(features) : null), [features]);

  const aoMover = (e: React.MouseEvent, codigo: string) => {
    const caixa = refCaixa.current?.getBoundingClientRect();
    setPairar({ codigo, mx: e.clientX - (caixa?.left ?? 0), my: e.clientY - (caixa?.top ?? 0) });
  };

  const linhaPairada = pairar ? porCodigo.get(pairar.codigo) : null;

  return (
    <div>
      <p className="overline" style={{ color: 'var(--primary)' }}>GIS · TERRITÓRIO</p>
      <h1 className="headline-lg" style={{ margin: '4px 0 8px' }}>Mapa de indicadores</h1>
      <p className="body-md" style={{ color: 'var(--on-surface-variant)', maxWidth: '65ch' }}>
        Cada município colorido pelo valor do indicador — direto do motor determinístico,
        com procedência. Município sem dado aparece em cinza: ausência é resposta, nunca zero.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <label className="label-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Indicador
          <select
            className="campo"
            style={{ minWidth: 260 }}
            value={indicadorId ?? ''}
            onChange={(e) => setIndicadorId(Number(e.target.value))}
            aria-label="Escolher indicador"
          >
            {indicadores.map((i) => (
              <option key={i.id} value={i.id}>{i.tema} — {i.nome}</option>
            ))}
          </select>
        </label>
        <label className="label-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Ano
          <select
            className="campo"
            value={ano ?? ''}
            onChange={(e) => setAno(e.target.value ? Number(e.target.value) : null)}
            aria-label="Escolher ano de referência"
          >
            <option value="">mais recente</option>
            {[...anos].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      {erro && <p className="aviso" role="alert">{erro}</p>}

      <div className="card" style={{ position: 'relative' }} ref={refCaixa}>
        {proj && (
          <svg
            viewBox={`0 0 ${VB_L} ${proj.vbAlt.toFixed(0)}`}
            role="img"
            aria-label={dados ? `Mapa de ${dados.indicador} por município` : 'Mapa de Mato Grosso'}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          >
            {features.map((f) => {
              const linha = porCodigo.get(f.codarea);
              return (
                <path
                  key={f.codarea}
                  d={caminhoDe(f, proj.x, proj.y)}
                  fillRule="evenodd"
                  fill={linha ? corDe(linha.valor) : COR_SEM_DADO}
                  stroke="var(--surface, #fff)"
                  strokeWidth={0.7}
                  style={{ cursor: 'pointer', transition: 'opacity var(--motion-micro, .12s)' }}
                  opacity={pairar && pairar.codigo !== f.codarea ? 0.75 : 1}
                  tabIndex={0}
                  aria-label={`${nomes.get(f.codarea) ?? f.codarea}: ${linha ? `${fmt.format(linha.valor)} ${dados?.unidade ?? ''}` : 'sem dado'}`}
                  onMouseMove={(e) => aoMover(e, f.codarea)}
                  onMouseLeave={() => setPairar(null)}
                  onClick={() => router.push(`/municipio/${f.codarea}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/municipio/${f.codarea}`)}
                />
              );
            })}
          </svg>
        )}

        {pairar && (
          <div
            style={{
              position: 'absolute', left: Math.min(pairar.mx + 14, 700), top: pairar.my + 14,
              background: 'var(--surface-container-lowest)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', boxShadow: 'var(--e2)', padding: '10px 12px',
              pointerEvents: 'none', maxWidth: 300, zIndex: 5,
            }}
            role="status"
          >
            <strong className="body-md">{nomes.get(pairar.codigo) ?? pairar.codigo}</strong>
            {linhaPairada ? (
              <>
                <div className="mono" style={{ fontSize: 18, margin: '2px 0' }}>
                  {fmt.format(linhaPairada.valor)} <span className="label-md">{dados?.unidade}</span>
                </div>
                <div className="regua"><span className="legenda">
                  {linhaPairada.fonte} · ref. {linhaPairada.data_referencia.slice(0, 10)}
                </span></div>
              </>
            ) : (
              <div className="label-md" style={{ color: 'var(--on-surface-variant)' }}>
                sem dado para este indicador
              </div>
            )}
          </div>
        )}

        {/* Legenda de classes */}
        {limites.length > 0 && dados && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
            <span className="overline">{dados.indicador} ({dados.unidade})</span>
            {RAMPA.map((cor, i) => {
              const de = i === 0 ? null : limites[i - 1];
              const ate = i < limites.length ? limites[i] : null;
              const rotulo =
                de === null ? `< ${fmt.format(ate!)}` :
                ate === null ? `≥ ${fmt.format(de)}` :
                `${fmt.format(de)}–${fmt.format(ate)}`;
              return (
                <span key={cor} className="label-md" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 14, height: 14, background: cor, borderRadius: 3, display: 'inline-block' }} aria-hidden />
                  {rotulo}
                </span>
              );
            })}
            <span className="label-md" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, background: COR_SEM_DADO, border: '1px solid var(--border)', borderRadius: 3, display: 'inline-block' }} aria-hidden />
              sem dado
            </span>
          </div>
        )}
      </div>

      <p className="label-md" style={{ color: 'var(--on-surface-variant)', marginTop: 10 }}>
        Malha municipal: IBGE (API de Malhas, SIRGAS 2000, qualidade mínima) — servida deste
        próprio portal, sem serviços de terceiros. Clique em um município para abrir a ficha.
      </p>
    </div>
  );
}
