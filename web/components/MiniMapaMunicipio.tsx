'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Anel = [number, number][];
interface FeatureMun { codarea: string; aneis: Anel[] }

/**
 * Mini-mapa de localização (Onda C): a silhueta de MT com o município
 * destacado — mesma malha soberana do /mapa, estático e decorativo
 * (aria-hidden; a localização textual está na própria ficha).
 */
export function MiniMapaMunicipio({ codigo }: { codigo: string }) {
  const [features, setFeatures] = useState<FeatureMun[]>([]);

  useEffect(() => {
    fetch('/mt-municipios.geojson')
      .then((r) => r.json())
      .then((gj) => {
        setFeatures(
          (gj.features ?? []).map((f: any) => {
            const g = f.geometry;
            const aneis: Anel[] =
              g.type === 'Polygon' ? g.coordinates
              : g.type === 'MultiPolygon' ? g.coordinates.flat()
              : [];
            return { codarea: String(f.properties?.codarea ?? ''), aneis };
          }),
        );
      })
      .catch(() => {/* decorativo: sem malha, sem mini-mapa */});
  }, []);

  const desenho = useMemo(() => {
    if (!features.length) return null;
    let loMin = Infinity, loMax = -Infinity, laMin = Infinity, laMax = -Infinity;
    for (const f of features) for (const anel of f.aneis) for (const [lo, la] of anel) {
      if (lo < loMin) loMin = lo; if (lo > loMax) loMax = lo;
      if (la < laMin) laMin = la; if (la > laMax) laMax = la;
    }
    const k = Math.cos(((laMin + laMax) / 2) * Math.PI / 180);
    const W = 220;
    const esc = W / ((loMax - loMin) * k);
    const H = (laMax - laMin) * esc;
    const x = (lo: number) => (lo - loMin) * k * esc;
    const y = (la: number) => (laMax - la) * esc;
    const caminho = (f: FeatureMun) =>
      f.aneis.map((a) => 'M' + a.map(([lo, la]) => `${x(lo).toFixed(1)},${y(la).toFixed(1)}`).join('L') + 'Z').join('');
    return { W, H, caminho };
  }, [features]);

  if (!desenho) return null;

  return (
    <div className="mini-mapa">
      <svg viewBox={`0 0 ${desenho.W} ${desenho.H.toFixed(0)}`} width="100%" aria-hidden="true" style={{ display: 'block' }}>
        {features.map((f) => (
          <path
            key={f.codarea}
            d={desenho.caminho(f)}
            fillRule="evenodd"
            fill={f.codarea === codigo ? 'var(--dado-observado)' : 'var(--surface-container-high)'}
            stroke="var(--surface-container-lowest)"
            strokeWidth={0.4}
          />
        ))}
      </svg>
      <Link className="label-md" href={`/mapa`}>
        Ver no mapa de indicadores →
      </Link>
    </div>
  );
}
