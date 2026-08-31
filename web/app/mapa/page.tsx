'use client';

/**
 * Mapa coroplético de Mato Grosso (Onda 2 — GIS; interação da Onda C).
 * SVG próprio, sem lib de mapa nem tiles externos: a malha municipal do
 * IBGE (qualidade mínima, SIRGAS 2000) vive em /public e é projetada em
 * equiretangular simples — suficiente e fiel na escala estadual.
 * Valores vêm do motor determinístico (GET /indicadores/:id/mapa), cada
 * um com procedência; município sem dado é "sem dado" (RN-005), nunca zero.
 *
 * Onda C: pan/zoom por viewBox (roda, arrasto, pinça e botões), busca de
 * município com centralização, roving tabindex (o teclado navega os 142
 * municípios sem virar armadilha de Tab), indicador+ano no permalink.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { REGIAO } from '@/lib/regiao';
import { ComboboxMunicipio } from '@/components/ComboboxMunicipio';

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

// Rampa sequencial tokenizada (--mapa-1..5, Onda A). 5 classes por quantil.
const RAMPA = ['var(--mapa-1)', 'var(--mapa-2)', 'var(--mapa-3)', 'var(--mapa-4)', 'var(--mapa-5)'];
const COR_SEM_DADO = 'var(--surface-container-high, #e8e8e8)';
const ZOOM_MIN = VB_L / 16; // até 16× de aproximação
const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

interface Vista { x: number; y: number; w: number }

export default function PaginaMapa() {
  // useSearchParams exige Suspense no App Router
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 420 }} />}>
      <Mapa />
    </Suspense>
  );
}

function Mapa() {
  const router = useRouter();
  const params = useSearchParams();
  const [indicadores, setIndicadores] = useState<Destaque[]>([]);
  const [indicadorId, setIndicadorId] = useState<number | null>(null);
  const [anos, setAnos] = useState<number[]>([]);
  const [ano, setAno] = useState<number | null>(null); // null = mais recente
  const [dados, setDados] = useState<RespostaMapa | null>(null);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [features, setFeatures] = useState<FeatureMun[]>([]);
  const [pairar, setPairar] = useState<{ codigo: string; mx: number; my: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista | null>(null); // null = MT inteiro
  const [focoCodigo, setFocoCodigo] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [classeAtiva, setClasseAtiva] = useState<number | null>(null); // filtro da legenda
  const refCaixa = useRef<HTMLDivElement>(null);
  const refSvg = useRef<SVGSVGElement>(null);
  const arrasto = useRef<{ px: number; py: number; vista: Vista; moveu: boolean } | null>(null);
  const ponteiros = useRef<Map<number, { x: number; y: number }>>(new Map());
  const urlInicialAplicada = useRef(false);

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
    // Permalink: ?indicador=&ano= são a fonte de verdade inicial.
    const indUrl = Number(params.get('indicador')) || null;
    const anoUrl = Number(params.get('ano')) || null;
    if (anoUrl) setAno(anoUrl);
    apiGet<Destaque[]>('/indicadores/destaque?limite=12&detalhe=1')
      .then((d) => {
        setIndicadores(d);
        // O permalink é a fonte de verdade MESMO fora da lista de destaque
        // (P6 rodada 2: o dossiê linka indicadores aprovados — ex. taxas —
        // que a lista curta pode não trazer; o select ganha a opção extra).
        // Indicador inexistente/não aprovado vira o 404 honesto do motor.
        if (indUrl) setIndicadorId(indUrl);
        else if (d.length) setIndicadorId(d[0].id);
        urlInicialAplicada.current = true;
      })
      .catch(() => setErro('Falha ao carregar o catálogo.'));
    apiGet<Municipio[]>('/municipios', { revalidate: 3600 })
      .then((ms) => setNomes(new Map(ms.map((m) => [m.codigo_ibge, m.nome]))))
      .catch(() => setErro('Falha ao carregar os nomes dos municípios.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function sincronizarUrl(ind: number | null, a: number | null) {
    const q = new URLSearchParams();
    if (ind) q.set('indicador', String(ind));
    if (a) q.set('ano', String(a));
    router.replace(`/mapa${q.toString() ? `?${q}` : ''}`, { scroll: false });
  }

  // Anos disponíveis do indicador (série no recorte estadual).
  useEffect(() => {
    if (!indicadorId) return;
    apiGet<{ pontos: { ano: number }[] }>(`/indicadores/${indicadorId}/serie?recorte=ESTADO`)
      .then((s) => {
        const disponiveis = s.pontos.map((p) => p.ano);
        setAnos(disponiveis);
        setAno((a) => (a && disponiveis.includes(a) ? a : null));
      })
      // Sem série não há seletor de ano, mas o mapa segue com a referência
      // mais recente — ausência de série não é erro fatal (RN-005).
      .catch(() => setAnos([]));
  }, [indicadorId]);

  // Valores do mapa.
  useEffect(() => {
    if (!indicadorId) return;
    const ref = ano ? `?referencia=${ano}-12-31` : '';
    apiGet<RespostaMapa>(`/indicadores/${indicadorId}/mapa${ref}`)
      .then((d) => { setDados(d); setErro(null); })
      .catch((e) => setErro(e.message));
    if (urlInicialAplicada.current) sincronizarUrl(indicadorId, ano);
  }, [indicadorId, ano]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const classeDe = (v: number) => {
    let c = 0;
    for (const l of limites) if (v >= l) c++; else break;
    return Math.min(c, RAMPA.length - 1);
  };
  const corDe = (v: number) => RAMPA[classeDe(v)];

  // Ranking do indicador atual (para o painel de seleção).
  const rankingDesc = useMemo(
    () => [...(dados?.municipios ?? [])].sort((a, b) => b.valor - a.valor),
    [dados],
  );

  const proj = useMemo(() => (features.length ? projetar(features) : null), [features]);

  // Centro (bbox) de cada município — para centralizar busca e foco.
  const centros = useMemo(() => {
    if (!proj) return new Map<string, { cx: number; cy: number }>();
    const m = new Map<string, { cx: number; cy: number }>();
    for (const f of features) {
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      for (const anel of f.aneis) for (const [lo, la] of anel) {
        const px = proj.x(lo), py = proj.y(la);
        if (px < xMin) xMin = px; if (px > xMax) xMax = px;
        if (py < yMin) yMin = py; if (py > yMax) yMax = py;
      }
      m.set(f.codarea, { cx: (xMin + xMax) / 2, cy: (yMin + yMax) / 2 });
    }
    return m;
  }, [features, proj]);

  // Ordem alfabética para navegação por teclado (roving tabindex).
  const ordem = useMemo(
    () => [...features].sort((a, b) =>
      (nomes.get(a.codarea) ?? a.codarea).localeCompare(nomes.get(b.codarea) ?? b.codarea, 'pt-BR')),
    [features, nomes],
  );
  const focoAtual = focoCodigo ?? ordem[0]?.codarea ?? null;

  // ---- viewBox: pan/zoom ----
  const razao = proj ? proj.vbAlt / VB_L : 1;
  const vistaAtual: Vista = vista ?? { x: 0, y: 0, w: VB_L };
  const vb = `${vistaAtual.x.toFixed(1)} ${vistaAtual.y.toFixed(1)} ${vistaAtual.w.toFixed(1)} ${(vistaAtual.w * razao).toFixed(1)}`;

  function pontoLogico(clientX: number, clientY: number): { x: number; y: number } {
    const r = refSvg.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: vistaAtual.x + ((clientX - r.left) / r.width) * vistaAtual.w,
      y: vistaAtual.y + ((clientY - r.top) / r.height) * vistaAtual.w * razao,
    };
  }

  function aplicarZoom(fator: number, ancora?: { x: number; y: number }) {
    setVista((v) => {
      const atual = v ?? { x: 0, y: 0, w: VB_L };
      const w = Math.min(VB_L, Math.max(ZOOM_MIN, atual.w / fator));
      if (w >= VB_L) return null; // voltou ao estado inteiro
      const a = ancora ?? { x: atual.x + atual.w / 2, y: atual.y + (atual.w * razao) / 2 };
      const nx = a.x - ((a.x - atual.x) * w) / atual.w;
      const ny = a.y - ((a.y - atual.y) * w) / atual.w;
      return { x: nx, y: ny, w };
    });
  }

  function centralizarEm(codigo: string) {
    const c = centros.get(codigo);
    if (!c) return;
    const w = Math.max(ZOOM_MIN, VB_L / 6);
    setVista({ x: c.cx - w / 2, y: c.cy - (w * razao) / 2, w });
    setFocoCodigo(codigo);
    setSelecionado(codigo);
    // devolve o foco de teclado ao município centralizado
    requestAnimationFrame(() => document.getElementById(`mun-${codigo}`)?.focus());
  }

  function aoRolar(e: React.WheelEvent) {
    e.preventDefault();
    aplicarZoom(e.deltaY < 0 ? 1.25 : 1 / 1.25, pontoLogico(e.clientX, e.clientY));
  }

  function aoDescer(e: React.PointerEvent) {
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.current.size === 1) {
      arrasto.current = { px: e.clientX, py: e.clientY, vista: vistaAtual, moveu: false };
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function aoMoverPonteiro(e: React.PointerEvent) {
    const antes = ponteiros.current.get(e.pointerId);
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.current.size === 2) {
      // pinça: escala pela variação da distância entre os dois ponteiros
      const [a, b] = [...ponteiros.current.values()];
      if (!antes) return;
      const dAntes = Math.hypot(a.x - b.x, a.y - b.y);
      // recomputa usando a posição anterior deste ponteiro
      const outro = [...ponteiros.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (!outro) return;
      const dDepois = Math.hypot(e.clientX - outro.x, e.clientY - outro.y);
      const dInicial = Math.hypot(antes.x - outro.x, antes.y - outro.y);
      if (dInicial > 0 && Math.abs(dDepois - dInicial) > 2) {
        aplicarZoom(dDepois / dInicial, pontoLogico((e.clientX + outro.x) / 2, (e.clientY + outro.y) / 2));
      }
      void dAntes;
      return;
    }
    if (!arrasto.current) return;
    const dx = e.clientX - arrasto.current.px;
    const dy = e.clientY - arrasto.current.py;
    if (Math.abs(dx) + Math.abs(dy) > 5) arrasto.current.moveu = true;
    if (!arrasto.current.moveu || !vista) return; // sem zoom não há o que arrastar
    const r = refSvg.current?.getBoundingClientRect();
    if (!r) return;
    const v = arrasto.current.vista;
    setVista({
      x: v.x - (dx / r.width) * v.w,
      y: v.y - (dy / r.height) * v.w * razao,
      w: v.w,
    });
  }

  function aoSoltar(e: React.PointerEvent) {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size === 0) {
      // clique (sem arrasto) é tratado no onClick de cada path
      setTimeout(() => { arrasto.current = null; }, 0);
    }
  }

  // 1º clique SELECIONA (abre o painel de detalhe); clicar de novo no
  // mesmo município abre a ficha — evita navegação acidental após um pan.
  function aoClicarMunicipio(codigo: string) {
    if (arrasto.current?.moveu) return; // arrasto não é clique
    if (selecionado === codigo) router.push(`/municipio/${codigo}`);
    else setSelecionado(codigo);
  }

  function aoTeclarNoMapa(e: React.KeyboardEvent) {
    if (!focoAtual || !ordem.length) return;
    const i = ordem.findIndex((f) => f.codarea === focoAtual);
    let proximo: string | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') proximo = ordem[Math.min(i + 1, ordem.length - 1)].codarea;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') proximo = ordem[Math.max(i - 1, 0)].codarea;
    else return;
    e.preventDefault();
    setFocoCodigo(proximo);
    document.getElementById(`mun-${proximo}`)?.focus();
  }

  const aoMover = (e: React.MouseEvent, codigo: string) => {
    const caixa = refCaixa.current?.getBoundingClientRect();
    setPairar({ codigo, mx: e.clientX - (caixa?.left ?? 0), my: e.clientY - (caixa?.top ?? 0) });
  };

  const linhaPairada = pairar ? porCodigo.get(pairar.codigo) : null;
  const larguraCaixa = refCaixa.current?.clientWidth ?? 0;
  const municipiosBusca = useMemo(
    () => [...nomes.entries()].map(([codigo_ibge, nome]) => ({ codigo_ibge, nome })),
    [nomes],
  );

  return (
    <div>
      <p className="overline" style={{ color: 'var(--primary)' }}>GIS · TERRITÓRIO</p>
      <h1 className="headline-lg" style={{ margin: '4px 0 8px' }}>Mapa de indicadores</h1>
      <p className="body-md" style={{ color: 'var(--on-surface-variant)', maxWidth: '65ch' }}>
        Cada município colorido pelo valor do indicador — direto do motor determinístico,
        com procedência. Município sem dado aparece em cinza: ausência é resposta, nunca zero.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', margin: '16px 0' }}>
        <label className="label-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Indicador
          <select
            className="campo"
            style={{ minWidth: 'min(260px, 60vw)' }}
            value={indicadorId ?? ''}
            onChange={(e) => setIndicadorId(Number(e.target.value))}
            aria-label="Escolher indicador"
          >
            {indicadores.map((i) => (
              <option key={i.id} value={i.id}>{i.tema} — {i.nome}</option>
            ))}
            {/* Indicador vindo do permalink fora da lista curta: opção extra
                nomeada pela resposta do próprio mapa (aditivo). */}
            {indicadorId !== null && !indicadores.some((i) => i.id === indicadorId) && (
              <option value={indicadorId}>{dados?.indicador ?? `Indicador ${indicadorId}`}</option>
            )}
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
        <div style={{ minWidth: 240, flex: '0 1 300px' }}>
          <ComboboxMunicipio
            municipios={municipiosBusca}
            rotulo="Localizar município"
            placeholder="Buscar e aproximar…"
            aoSelecionar={(m) => centralizarEm(m.codigo_ibge)}
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href).catch(() => {});
          }}
        >
          Copiar link desta visão
        </button>
      </div>

      {erro && <p className="aviso" role="alert">{erro}</p>}

      <div className="card" style={{ position: 'relative' }} ref={refCaixa}>
        <div className="controles-mapa" style={{ position: 'absolute', top: 12, right: 12, zIndex: 6 }}>
          <button type="button" aria-label="Aproximar" onClick={() => aplicarZoom(1.5)}>+</button>
          <button type="button" aria-label="Afastar" onClick={() => aplicarZoom(1 / 1.5)}>−</button>
          <button type="button" aria-label="Ver o estado inteiro" onClick={() => setVista(null)}>⤢</button>
        </div>
        {proj && (
          <svg
            ref={refSvg}
            viewBox={vb}
            role="img"
            aria-label={
              (dados ? `Mapa de ${dados.indicador} por município` : `Mapa de ${REGIAO.nome}`) +
              '. Use as setas para percorrer os municípios e Enter para abrir a ficha.'
            }
            style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', cursor: vista ? 'grab' : 'default' }}
            onWheel={aoRolar}
            onPointerDown={aoDescer}
            onPointerMove={aoMoverPonteiro}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
            onKeyDown={aoTeclarNoMapa}
          >
            {features.map((f) => {
              const linha = porCodigo.get(f.codarea);
              const foraDoFiltro =
                classeAtiva !== null && (!linha || classeDe(linha.valor) !== classeAtiva);
              return (
                <path
                  key={f.codarea}
                  id={`mun-${f.codarea}`}
                  d={caminhoDe(f, proj.x, proj.y)}
                  fillRule="evenodd"
                  fill={linha ? corDe(linha.valor) : COR_SEM_DADO}
                  stroke={f.codarea === selecionado ? 'var(--navy-950)' : 'var(--surface, #fff)'}
                  strokeWidth={(f.codarea === selecionado ? 1.8 : 0.7) * (vistaAtual.w / VB_L)}
                  style={{ cursor: 'pointer', transition: 'opacity var(--motion-standard, .2s), fill var(--motion-standard, .2s)' }}
                  opacity={foraDoFiltro ? 0.16 : pairar && pairar.codigo !== f.codarea ? 0.75 : 1}
                  // Roving tabindex: só o município ativo entra na ordem de Tab
                  // — antes eram 142 paradas sem escape.
                  tabIndex={f.codarea === focoAtual ? 0 : -1}
                  aria-label={`${nomes.get(f.codarea) ?? f.codarea}: ${linha ? `${fmt.format(linha.valor)} ${dados?.unidade ?? ''}` : 'sem dado'}. Enter seleciona; Enter de novo abre a ficha.`}
                  onFocus={() => setFocoCodigo(f.codarea)}
                  onMouseMove={(e) => aoMover(e, f.codarea)}
                  onMouseLeave={() => setPairar(null)}
                  onClick={() => aoClicarMunicipio(f.codarea)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    if (selecionado === f.codarea) router.push(`/municipio/${f.codarea}`);
                    else setSelecionado(f.codarea);
                  }}
                />
              );
            })}
          </svg>
        )}

        {pairar && (
          <div
            style={{
              position: 'absolute',
              // clamp medido no container — antes era um 700 hardcoded que
              // desalinhava em telas largas.
              left: Math.max(8, Math.min(pairar.mx + 14, larguraCaixa - 316)),
              top: pairar.my + 14,
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

        {/* Painel do município selecionado */}
        {selecionado && (
          <div className="mapa-selecao" role="region" aria-label={`Detalhe de ${nomes.get(selecionado) ?? selecionado}`}>
            <div className="mapa-selecao-topo">
              <strong>{nomes.get(selecionado) ?? selecionado}</strong>
              <button type="button" className="mapa-selecao-fechar" aria-label="Limpar seleção" onClick={() => setSelecionado(null)}>✕</button>
            </div>
            {(() => {
              const linha = porCodigo.get(selecionado);
              if (!linha) {
                return <p className="label-md" style={{ margin: 0, color: 'var(--on-surface-variant)' }}>Sem dado deste indicador para o município — ausência é resposta, não zero.</p>;
              }
              const posicao = rankingDesc.findIndex((m) => m.codigo_ibge === selecionado) + 1;
              return (
                <>
                  <div className="mapa-selecao-valor mono">
                    {fmt.format(linha.valor)} <span className="label-md">{dados?.unidade}</span>
                  </div>
                  <p className="label-md" style={{ margin: '2px 0 0', color: 'var(--on-surface-variant)' }}>
                    {posicao}º de {rankingDesc.length} municípios com dado · {linha.fonte} · ref. {linha.data_referencia.slice(0, 4)}
                  </p>
                </>
              );
            })()}
            <div className="mapa-selecao-acoes">
              <button type="button" className="btn primaria" onClick={() => router.push(`/municipio/${selecionado}`)}>Abrir ficha</button>
              <button type="button" className="btn" onClick={() => router.push(`/consulta?municipio=${selecionado}`)}>Ver na consulta</button>
            </div>
          </div>
        )}

        {/* Legenda de classes — clicável: destaca a faixa no mapa */}
        {limites.length > 0 && dados && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
            <span className="overline">{dados.indicador} ({dados.unidade})</span>
            {RAMPA.map((cor, i) => {
              const de = i === 0 ? null : limites[i - 1];
              const ate = i < limites.length ? limites[i] : null;
              const rotulo =
                de === null ? `< ${fmt.format(ate!)}` :
                ate === null ? `≥ ${fmt.format(de)}` :
                `${fmt.format(de)}–${fmt.format(ate)}`;
              return (
                <button
                  key={cor}
                  type="button"
                  className={`mapa-legenda-classe${classeAtiva === i ? ' ativa' : ''}`}
                  aria-pressed={classeAtiva === i}
                  title={classeAtiva === i ? 'Mostrar todas as faixas' : 'Destacar só esta faixa no mapa'}
                  onClick={() => setClasseAtiva((a) => (a === i ? null : i))}
                >
                  <span style={{ width: 14, height: 14, background: cor, borderRadius: 3, display: 'inline-block' }} aria-hidden />
                  {rotulo}
                </button>
              );
            })}
            <span className="label-md" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, background: COR_SEM_DADO, border: '1px solid var(--border)', borderRadius: 3, display: 'inline-block' }} aria-hidden />
              sem dado
            </span>
            {classeAtiva !== null && (
              <button type="button" className="btn" style={{ minHeight: 28, padding: '2px 10px', fontSize: 12 }} onClick={() => setClasseAtiva(null)}>
                Mostrar todas
              </button>
            )}
          </div>
        )}
      </div>

      <p className="label-md" style={{ color: 'var(--on-surface-variant)', marginTop: 10 }}>
        Malha municipal: IBGE (API de Malhas, SIRGAS 2000, qualidade mínima) — servida deste
        próprio portal, sem serviços de terceiros. Clique em um município para abrir a ficha;
        role para aproximar, arraste para mover.
      </p>
    </div>
  );
}
