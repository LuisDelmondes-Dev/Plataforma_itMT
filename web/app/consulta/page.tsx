'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet, ErroApi, Resultado } from '@/lib/api';
import { ComboboxMunicipio } from '@/components/ComboboxMunicipio';
import { TermoExplicado } from '@/components/TermoExplicado';
import { GraficoBarras } from '@/components/GraficoBarras';
import { CartaoIndicador } from '@/components/CartaoIndicador';
import { ChipSemaforo } from '@/components/ChipSemaforo';
import { Sparkline } from '@/components/Sparkline';
import { REGIAO } from '@/lib/regiao';
import { ModoPesquisa, SeletorModoPesquisa } from '@/components/SeletorModoPesquisa';

interface Municipio {
  codigo_ibge: string;
  nome: string;
}
interface Tema {
  id: number;
  nome: string;
  subtemas_disponiveis: string;
  subtemas_total: string;
}
interface Subtema {
  id: number;
  nome: string;
  status: 'DISPONIVEL' | 'EM_CONSTRUCAO' | 'SEM_FONTE';
}
interface Indicador {
  id: number;
  nome: string;
  unidade: string;
  tipo_agregacao: string;
}
interface Comparacao {
  municipio: Partial<Resultado> & { nome: string; erro?: string };
  regiaoImediata: Partial<Resultado> & { erro?: string };
  regiaoIntermediaria: Partial<Resultado> & { erro?: string };
  estado: Partial<Resultado> & { erro?: string };
  municipiosLivres: (Partial<Resultado> & { erro?: string })[];
}
interface SerieHistorica {
  indicador: string;
  unidade: string;
  local: string;
  pontos: { ano: number; valor: number }[];
}

const fmt = new Intl.NumberFormat('pt-BR');

export default function PaginaConsulta() {
  // useSearchParams exige Suspense no App Router
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 300 }} />}>
      <Consulta />
    </Suspense>
  );
}

function Consulta() {
  const router = useRouter();
  const params = useSearchParams();
  // Passos do rail: a numeração 1/2/3 é legítima porque a ordem carrega
  // informação — sem local não há tema; sem tema não há subtema (§15.6).
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [busca, setBusca] = useState('');
  const [local, setLocal] = useState<Municipio | null>(null);

  const [temas, setTemas] = useState<Tema[]>([]);
  const [tema, setTema] = useState<Tema | null>(null);

  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [subtema, setSubtema] = useState<Subtema | null>(null);

  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [serie, setSerie] = useState<SerieHistorica | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [livres, setLivres] = useState<string[]>([]); // até 4 municípios (§15.7)
  const [indicadorAtual, setIndicadorAtual] = useState<Indicador | null>(null);
  const rascunhoInicialAplicado = useRef(false);

  useEffect(() => {
    // Municípios e taxonomia mudam devagar: cache de 1h. Falha vira erro
    // VISÍVEL — antes, API fora do ar deixava o passo "Local" vazio e mudo.
    apiGet<Municipio[]>('/municipios', { revalidate: 3600 })
      .then(setMunicipios)
      .catch((e) => setErro(e instanceof ErroApi ? e.mensagemHumana : 'Falha ao carregar os municípios.'));
    apiGet<Tema[]>('/temas', { revalidate: 3600 })
      .then(setTemas)
      .catch((e) => setErro(e instanceof ErroApi ? e.mensagemHumana : 'Falha ao carregar os temas.'));
  }, []);

  // RF-PORTAL-007: hidratar a consulta a partir do permalink
  const pMun = params.get('municipio');
  const pTema = params.get('tema');
  useEffect(() => {
    if (pMun && municipios.length && !local) {
      const m = municipios.find((x) => x.codigo_ibge === pMun);
      if (m) setLocal(m);
    }
  }, [pMun, municipios]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pTema && temas.length && !tema) {
      const t = temas.find((x) => String(x.id) === pTema);
      if (t) setTema(t);
    }
  }, [pTema, temas]); // eslint-disable-line react-hooks/exhaustive-deps
  const pSub = params.get('subtema');
  useEffect(() => {
    if (pSub && subtemas.length && !subtema && local) {
      const s = subtemas.find((x) => String(x.id) === pSub);
      if (s && s.status === 'DISPONIVEL') {
        // ?comparar= restaura os municípios livres direto do permalink —
        // passado explicitamente para não correr contra o setState.
        const compararUrl = (params.get('comparar') ?? '')
          .split(',')
          .filter((c) => /^\d{7}$/.test(c))
          .slice(0, 4);
        if (compararUrl.length) setLivres(compararUrl);
        consultar(s, compararUrl.length ? compararUrl : undefined);
      }
    }
  }, [pSub, subtemas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca da home (?q=) — resolve o texto para um município pela busca
  // tolerante a acento do servidor (RF-PORTAL-001). O permalink (?municipio)
  // tem precedência; por isso só roda quando não há município no link.
  const pQ = params.get('q');
  const pRascunho = params.get('rascunho');
  useEffect(() => {
    if (!pQ || pMun || local) return;
    setBusca(pQ);
    apiGet<Municipio[]>(`/municipios?q=${encodeURIComponent(pQ)}`)
      .then((achados) => {
        if (achados.length) setLocal(achados[0]);
      })
      .catch(() => {});
  }, [pQ, pMun]); // eslint-disable-line react-hooks/exhaustive-deps

  // A troca Xingú → Pesquisa preserva o texto como rascunho, mas não executa
  // a resolução tolerante do ?q=. A pessoa confirma escolhendo o município.
  useEffect(() => {
    if (rascunhoInicialAplicado.current || !pRascunho) return;
    rascunhoInicialAplicado.current = true;
    if (pQ || pMun || local || busca) return;
    setBusca(pRascunho);
  }, [pRascunho, pQ, pMun, local, busca]);

  // Permalink estável e compartilhável para a combinação atual — Onda C:
  // agora inclui indicador e municípios comparados (antes o link perdia
  // metade do estado).
  function atualizarUrl(
    l: Municipio | null,
    t: Tema | null,
    st: Subtema | null,
    ind?: Indicador | null,
    comparar?: string[],
  ) {
    const q = new URLSearchParams();
    if (l) q.set('municipio', l.codigo_ibge);
    if (t) q.set('tema', String(t.id));
    if (st) q.set('subtema', String(st.id));
    if (ind) q.set('indicador', String(ind.id));
    if (comparar?.length) q.set('comparar', comparar.join(','));
    router.replace(`/consulta?${q.toString()}`, { scroll: false });
  }

  useEffect(() => {
    setSubtema(null);
    setResultado(null);
    setComparacao(null);
    if (tema)
      apiGet<Subtema[]>(`/temas/${tema.id}/subtemas`, { revalidate: 3600 })
        .then(setSubtemas)
        .catch((e) => setErro(e instanceof ErroApi ? e.mensagemHumana : 'Falha ao carregar os subtemas.'));
  }, [tema]);

  async function consultar(sub: Subtema, comparar: string[] = livres) {
    setSubtema(sub);
    setResultado(null);
    setComparacao(null);
    setSerie(null);
    setErro(null);
    if (!local) return;
    atualizarUrl(local, tema, sub);
    setCarregando(true);
    try {
      const inds = await apiGet<Indicador[]>(`/subtemas/${sub.id}/indicadores`);
      setIndicadores(inds);
      if (!inds.length) {
        setErro(
          `O subtema "${sub.nome}" ainda não tem indicador aprovado publicado. ` +
            `A ausência de dado é uma resposta legítima — nada foi estimado.`,
        );
        setCarregando(false);
        return;
      }
      // Multi-indicador (A2): o primeiro é o padrão; o seletor troca sem
      // refazer a busca de subtema. Se o permalink pediu um indicador
      // específico deste subtema, ele tem precedência.
      const indUrl = Number(params.get('indicador')) || null;
      const alvo = (indUrl && inds.find((i) => i.id === indUrl)) || inds[0];
      await carregarIndicador(alvo, comparar, sub);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'A consulta falhou.');
      setCarregando(false);
    }
  }

  // Carrega um indicador específico: valor + comparação territorial + série
  // histórica (A2). A série reusa o motor ano a ano, cada ponto sob as
  // mesmas regras de agregação (RN-003).
  async function carregarIndicador(ind: Indicador, comparar: string[] = livres, sub: Subtema | null = subtema) {
    if (!local) return;
    setIndicadorAtual(ind);
    setResultado(null);
    setComparacao(null);
    setSerie(null);
    setErro(null);
    setCarregando(true);
    atualizarUrl(local, tema, sub, ind, comparar);
    try {
      const extra = comparar.length ? `&municipios=${comparar.join(',')}` : '';
      const [res, comp, ser] = await Promise.all([
        apiGet<Resultado>(
          `/indicadores/${ind.id}/consulta?recorte=MUNICIPIO&codigo=${local.codigo_ibge}`,
        ),
        apiGet<Comparacao>(
          `/indicadores/${ind.id}/comparacao?codigo_ibge=${local.codigo_ibge}${extra}`,
        ),
        apiGet<SerieHistorica>(
          `/indicadores/${ind.id}/serie?recorte=MUNICIPIO&codigo=${local.codigo_ibge}`,
        ).catch(() => null),
      ]);
      setResultado(res);
      setComparacao(comp);
      setSerie(ser && ser.pontos.length > 1 ? ser : null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'A consulta falhou.');
    } finally {
      setCarregando(false);
    }
  }

  // Bug corrigido (fotografia 24/08): os efeitos ficavam DENTRO do updater
  // do setState — em StrictMode o updater roda 2× e a requisição duplicava.
  function alternarLivre(codigo: string) {
    let novo: string[];
    if (livres.includes(codigo)) novo = livres.filter((c) => c !== codigo);
    else if (livres.length >= 4) {
      // §15.7: além de 5 séries a UI recusa e explica
      setErro('Comparação limitada a 4 municípios além do local (5 séries). Remova um para incluir outro.');
      return;
    } else novo = [...livres, codigo];
    setErro(null);
    setLivres(novo);
    if (indicadorAtual) carregarIndicador(indicadorAtual, novo);
    else if (subtema) consultar(subtema, novo);
  }

  function mudarModo(modo: ModoPesquisa) {
    if (modo === 'pesquisa') return;
    const rascunho = busca.trim() || local?.nome || pQ || '';
    router.push(rascunho ? `/xingu?q=${encodeURIComponent(rascunho)}` : '/xingu');
  }

  return (
    <>
      {/* WCAG 1.3.1/2.4.6 (EV-20260822-051): a página não tinha cabeçalho algum —
          leitor de tela abria sem título e o documento ficava sem raiz de outline.
          O rail 1-2-3 carrega o contexto visual, então o h1 vai em .sr-only:
          nomeia a página para tecnologia assistiva sem alterar o desenho. */}
      <h1 className="sr-only">Consulta de indicadores por município, tema e subtema</h1>
      <section className="modo-pesquisa-contextual" aria-label="Modo da pesquisa atual">
        <div>
          <div className="overline">Experiência de consulta</div>
          <p>Escolha entre a pesquisa estruturada e a interpretação em linguagem natural.</p>
        </div>
        <SeletorModoPesquisa ativo="pesquisa" onChange={mudarModo} compacto />
      </section>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Rail de consulta (§15.6) */}
      <aside className="rail" aria-label="Consulta em três passos">
        <div className="overline" style={{ marginBottom: 12 }}>
          Consulta
        </div>

        <section className={`passo ${local ? 'feito' : 'ativo'}`}>
          <h2>
            <span className="n">1</span> Local
          </h2>
          <ComboboxMunicipio
            municipios={municipios}
            rotulo="Município"
            texto={busca}
            aoMudarTexto={setBusca}
            aoSelecionar={(m) => {
              setLocal(m);
              setResultado(null);
              setComparacao(null);
            }}
          />
          {local && (
            <p className="body-md" style={{ margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="chip atual">
                {local.nome} <span className="mono" style={{ fontSize: 11 }}>{local.codigo_ibge}</span>
              </span>
            </p>
          )}
        </section>

        <section className={`passo ${tema ? 'feito' : local ? 'ativo' : ''}`}>
          <h2>
            <span className="n">2</span> Tema
          </h2>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {temas.map((t) => (
              <button
                key={t.id}
                className={`opcao${tema?.id === t.id ? ' selecionada' : ''}`}
                disabled={!local}
                onClick={() => setTema(t)}
              >
                {t.nome}
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {t.subtemas_disponiveis}/{t.subtemas_total}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={`passo ${subtema ? 'feito' : tema ? 'ativo' : ''}`}>
          <h2>
            <span className="n">3</span> Subtema
          </h2>
          {tema ? (
            subtemas.map((s) => (
              <button
                key={s.id}
                className={`opcao${subtema?.id === s.id ? ' selecionada' : ''}`}
                // RN-004: subtema sem fonte nunca é oferecido como disponível
                disabled={s.status !== 'DISPONIVEL'}
                onClick={() => consultar(s)}
              >
                {s.nome}
                <ChipSemaforo status={s.status} />
              </button>
            ))
          ) : (
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>
              Escolha um tema para ver os subtemas.
            </p>
          )}
        </section>
      </aside>

      {/* Canvas de resultado */}
      <section style={{ flex: 1, minWidth: 320 }}>
        {local && (
          <nav
            className="mono"
            style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}
            aria-label="Trilha de navegação"
          >
            {REGIAO.nome} › {local.nome}
            {tema ? ` › ${tema.nome}` : ''}
            {subtema ? ` › ${subtema.nome}` : ''}
          </nav>
        )}

        {!local && (
          <div className="card">
            <div className="overline">Comece pelo local</div>
            <p style={{ color: 'var(--ink-2)', marginBottom: 0 }}>
              Indique o município no passo 1. A consulta segue a sequência Local → Tema →
              Subtema porque a ordem carrega informação: sem local resolvido não há tema.
            </p>
          </div>
        )}

        {carregando && (
          <div className="card">
            <div className="skeleton" style={{ height: 16, width: 180 }} />
            <div className="skeleton" style={{ height: 44, width: 260, marginTop: 12 }} />
            <div className="skeleton" style={{ height: 24, width: '100%', marginTop: 12 }} />
          </div>
        )}

        {erro && !carregando && <div className="aviso">{erro}</div>}

        {resultado && !carregando && (
          <>
            {indicadores.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <span className="overline" style={{ alignSelf: 'center' }}>Indicador:</span>
                {indicadores.map((ind) => (
                  <button
                    key={ind.id}
                    className="chip"
                    aria-pressed={indicadorAtual?.id === ind.id}
                    style={
                      indicadorAtual?.id === ind.id
                        ? { background: 'var(--accent-50)', borderColor: 'var(--accent-600)', cursor: 'pointer' }
                        : { cursor: 'pointer' }
                    }
                    onClick={() => carregarIndicador(ind)}
                  >
                    {ind.nome}
                  </button>
                ))}
              </div>
            )}

            <CartaoIndicador resultado={resultado} animada />

            {serie && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="overline">Série histórica — {serie.local}</div>
                <Sparkline pontos={serie.pontos} unidade={serie.unidade} />
                <div className="tabela-rolagem">
                  <table className="dados" style={{ marginTop: 12 }}>
                    <caption className="sr-only">Série histórica anual</caption>
                    <thead>
                      <tr>
                        <th scope="col">Ano</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Valor</th>
                        <th scope="col">Unidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serie.pontos.map((p) => (
                        <tr key={p.ano}>
                          <td className="mono">{p.ano}</td>
                          <td className="num">{fmt.format(p.valor)}</td>
                          <td>{serie.unidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  Cada ano vem do mesmo motor determinístico e da mesma fonte do valor acima;
                  anos sem dado são omitidos — a ausência não é zero (RN-005).
                </p>
              </div>
            )}

            {comparacao && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="overline">Comparar com</div>
                {/* Barras proporcionais AO LADO da tabela (Onda C): encoding
                    visual sem substituir a forma citável/acessível. */}
                <GraficoBarras
                  unidade={resultado?.unidade}
                  barras={[
                    {
                      rotulo: ('local' in comparacao.municipio && comparacao.municipio.local) || 'Município',
                      valor: 'valor' in comparacao.municipio && comparacao.municipio.valor !== undefined ? comparacao.municipio.valor : null,
                      destaque: true,
                    },
                    {
                      rotulo: 'Região Imediata',
                      valor: 'valor' in comparacao.regiaoImediata && comparacao.regiaoImediata.valor !== undefined ? comparacao.regiaoImediata.valor : null,
                    },
                    {
                      rotulo: 'Região Intermediária',
                      valor: 'valor' in comparacao.regiaoIntermediaria && comparacao.regiaoIntermediaria.valor !== undefined ? comparacao.regiaoIntermediaria.valor : null,
                    },
                    {
                      rotulo: `Estado de ${REGIAO.nome}`,
                      valor: 'valor' in comparacao.estado && comparacao.estado.valor !== undefined ? comparacao.estado.valor : null,
                    },
                    ...(comparacao.municipiosLivres ?? []).map((r, i) => ({
                      rotulo:
                        ('local' in r && r.local) ||
                        municipios.find((x) => x.codigo_ibge === livres[i])?.nome ||
                        'Município comparado',
                      valor: 'valor' in r && r.valor !== undefined ? r.valor : null,
                    })),
                  ]}
                />
                <div className="tabela-rolagem">
                  <table className="dados" style={{ marginTop: 12 }}>
                    <caption className="sr-only">
                      Comparação territorial
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Recorte</th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Valor
                        </th>
                        <th scope="col">Unidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['Município', comparacao.municipio, undefined],
                          ['Região Imediata', comparacao.regiaoImediata, 'rgi'],
                          ['Região Intermediária', comparacao.regiaoIntermediaria, 'rgint'],
                          [`Estado de ${REGIAO.nome}`, comparacao.estado, undefined],
                        ] as const
                      ).map(([rotulo, r, termo]) => (
                        <tr key={rotulo}>
                          <td>
                            {termo ? <TermoExplicado id={termo}>{rotulo}</TermoExplicado> : rotulo}
                            {'local' in r && r.local ? ` — ${r.local}` : ''}
                          </td>
                          <td className="num">
                            {'valor' in r && r.valor !== undefined ? fmt.format(r.valor) : '—'}
                          </td>
                          <td>{('unidade' in r && r.unidade) || ('erro' in r && r.erro) || ''}</td>
                        </tr>
                      ))}
                      {comparacao.municipiosLivres?.map((r, i) => (
                        <tr key={`livre-${i}`}>
                          <td>
                            {'local' in r && r.local
                              ? r.local
                              : municipios.find((x) => x.codigo_ibge === livres[i])?.nome ?? 'Município comparado'}
                          </td>
                          <td className="num">
                            {'valor' in r && r.valor !== undefined ? fmt.format(r.valor) : '—'}
                          </td>
                          <td>{('unidade' in r && r.unidade) || ('erro' in r && r.erro) || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  <TermoExplicado id="agregacao">Como o valor regional é calculado</TermoExplicado>:
                  estoques somam, taxas são recalculadas de numerador e denominador — nunca
                  somadas (regra RN-003 do indicador).
                </p>
                <div className="overline" style={{ marginTop: 8 }}>Municípios de livre escolha (até 4)</div>
                {/* Antes: os 142 municípios re-renderizados como chips. Agora,
                    combobox com busca + chips removíveis só do que foi escolhido. */}
                <div style={{ maxWidth: 360, marginTop: 8 }}>
                  <ComboboxMunicipio
                    municipios={municipios.filter((m) => m.codigo_ibge !== local?.codigo_ibge)}
                    rotulo="Adicionar município à comparação"
                    desabilitados={livres}
                    aoSelecionar={(m) => alternarLivre(m.codigo_ibge)}
                  />
                </div>
                {livres.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {livres.map((codigo) => {
                      const m = municipios.find((x) => x.codigo_ibge === codigo);
                      return (
                        <button
                          key={codigo}
                          className="chip atual"
                          style={{ cursor: 'pointer' }}
                          onClick={() => alternarLivre(codigo)}
                          aria-label={`Remover ${m?.nome ?? codigo} da comparação`}
                        >
                          {m?.nome ?? codigo} ✕
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {indicadorAtual && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="overline">Exportar</div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                  O arquivo leva a procedência linha a linha — idêntico ao que está na tela.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['csv', 'xlsx', 'pdf'] as const).map((f) => (
                    <a
                      key={f}
                      className="btn"
                      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}
                      href={`/api/v1/indicadores/${indicadorAtual.id}/exportacao?formato=${f}&recorte=MUNICIPIO&codigo=${local?.codigo_ibge}`}
                    >
                      {f.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
      </section>
      </div>
    </>
  );
}
