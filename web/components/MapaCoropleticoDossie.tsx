'use client';

/**
 * Mapa coroplético COMPACTO do dossiê Xingú (Gauntlet P6) — versão ESTÁTICA
 * do mapa de /mapa: mesma malha municipal do IBGE em /public, mesma projeção
 * equiretangular e a mesma rampa por quantil (--mapa-1..5), sem o aparato de
 * interação (pan/zoom/busca/seleção) — para isso existe o link "abrir no
 * mapa interativo", que leva ao permalink ?indicador=&ano= já existente.
 * Valores de GET /v1/indicadores/:id/mapa (motor determinístico, RG-03);
 * município sem dado fica cinza — ausência é resposta, nunca zero (RN-005).
 * Acessibilidade: a leitura acessível deste mapa é a tabela do ranking na
 * mesma seção do dossiê (mesmos valores, mesma referência).
 */
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';
import { formatarNumero } from '@/lib/format';

interface LinhaMapa { codigo_ibge: string; valor: number; data_referencia: string; fonte: string }
interface RespostaMapa { indicador: string; unidade: string; referencia: string; municipios: LinhaMapa[] }

type Anel = [number, number][];
interface FeatureMun { codarea: string; aneis: Anel[] }

// ---- projeção equiretangular (idêntica à de app/mapa/page.tsx) ----
const VB_L = 960;
function projetar(features: FeatureMun[]) {
  let loMin = Infinity, loMax = -Infinity, laMin = Infinity, laMax = -Infinity;
  for (const f of features) for (const anel of f.aneis) for (const [lo, la] of anel) {
    if (lo < loMin) loMin = lo; if (lo > loMax) loMax = lo;
    if (la < laMin) laMin = la; if (la > laMax) laMax = la;
  }
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

const RAMPA = ['var(--mapa-1)', 'var(--mapa-2)', 'var(--mapa-3)', 'var(--mapa-4)', 'var(--mapa-5)'];
const COR_SEM_DADO = 'var(--surface-container-high, #e8e8e8)';

export function MapaCoropleticoDossie({
  indicadorId,
  referencia,
  destaqueCodigo,
}: {
  indicadorId: number;
  /** Referência da consulta (AAAA-MM-DD) — o mapa usa a MESMA vigência do dossiê. */
  referencia: string;
  /** Município consultado (borda destacada); null em recorte não municipal. */
  destaqueCodigo: string | null;
}) {
  const [features, setFeatures] = useState<FeatureMun[]>([]);
  const [dados, setDados] = useState<RespostaMapa | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    apiGet<RespostaMapa>(
      `/indicadores/${indicadorId}/mapa?referencia=${encodeURIComponent(referencia)}`,
    )
      .then((d) => { setDados(d); setErro(null); })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao consultar o mapa.'));
  }, [indicadorId, referencia]);

  const proj = useMemo(() => (features.length ? projetar(features) : null), [features]);
  const porCodigo = useMemo(
    () => new Map((dados?.municipios ?? []).map((m) => [m.codigo_ibge, m])),
    [dados],
  );
  // Classes por quantil (5) — mesmo critério do mapa interativo.
  const limites = useMemo(() => {
    const vs = (dados?.municipios ?? []).map((m) => m.valor).sort((a, b) => a - b);
    if (vs.length < 5) return [];
    return [1, 2, 3, 4].map((i) => vs[Math.floor((vs.length * i) / 5)]);
  }, [dados]);
  const classeDe = (v: number) => {
    let c = 0;
    for (const l of limites) if (v >= l) c++; else break;
    return Math.min(c, RAMPA.length - 1);
  };

  if (erro) return <p className="aviso" role="alert">{erro}</p>;
  if (!proj || !dados) return <div className="skeleton" style={{ height: 260 }} aria-hidden="true" />;

  const fmt = (v: number) => formatarNumero(v);
  // Ano do DADO exibido (vigência mais recente entre os municípios), não o
  // da consulta (P6 rodada 2): é este ano que o rótulo declara e que o link
  // "abrir no mapa interativo" passa em ?ano= — o mapa interativo abre na
  // MESMA vigência que este coroplético pinta.
  const ano = dados.municipios.length
    ? dados.municipios
        .reduce((a, m) => (m.data_referencia > a ? m.data_referencia : a), '')
        .slice(0, 4)
    : (dados.referencia || referencia).slice(0, 4);
  const destaque = destaqueCodigo ? features.find((f) => f.codarea === destaqueCodigo) : undefined;

  return (
    <div>
      <svg
        viewBox={`0 0 ${VB_L} ${proj.vbAlt.toFixed(1)}`}
        role="img"
        aria-label={
          `Mapa coroplético de ${dados.indicador} por município, referência ${ano}. ` +
          'Os mesmos valores, município a município, estão na tabela do ranking deste dossiê.'
        }
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {features.map((f) => {
          const linha = porCodigo.get(f.codarea);
          return (
            <path
              key={f.codarea}
              d={caminhoDe(f, proj.x, proj.y)}
              fillRule="evenodd"
              fill={linha ? RAMPA[classeDe(linha.valor)] : COR_SEM_DADO}
              stroke="var(--surface, #fff)"
              strokeWidth={0.7}
            />
          );
        })}
        {/* Município consultado por cima, para a borda não ser encoberta. */}
        {destaque && (
          <path
            d={caminhoDe(destaque, proj.x, proj.y)}
            fillRule="evenodd"
            fill="none"
            stroke="var(--navy-950)"
            strokeWidth={2.2}
          />
        )}
      </svg>

      <div className="dossie-mapa-legenda">
        {limites.length > 0 &&
          RAMPA.map((cor, i) => {
            const de = i === 0 ? null : limites[i - 1];
            const ate = i < limites.length ? limites[i] : null;
            const rotulo =
              de === null ? `< ${fmt(ate!)}` :
              ate === null ? `≥ ${fmt(de)}` :
              `${fmt(de)}–${fmt(ate)}`;
            return (
              <span key={cor} className="dossie-mapa-classe">
                <span className="dossie-mapa-cor" style={{ background: cor }} aria-hidden="true" />
                {rotulo}
              </span>
            );
          })}
        <span className="dossie-mapa-classe">
          <span
            className="dossie-mapa-cor"
            style={{ background: COR_SEM_DADO, border: '1px solid var(--border)' }}
            aria-hidden="true"
          />
          sem dado
        </span>
        {destaque && (
          <span className="dossie-mapa-classe">
            <span
              className="dossie-mapa-cor"
              style={{ background: 'transparent', border: '2px solid var(--navy-950)' }}
              aria-hidden="true"
            />
            município consultado
          </span>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <a
          className="btn"
          style={{ textDecoration: 'none', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center' }}
          href={`/mapa?indicador=${indicadorId}&ano=${ano}`}
        >
          Abrir no mapa interativo
        </a>
      </div>
    </div>
  );
}
