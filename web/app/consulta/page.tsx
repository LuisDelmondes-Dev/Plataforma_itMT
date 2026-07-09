'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet, Resultado } from '@/lib/api';
import { CartaoIndicador } from '@/components/CartaoIndicador';
import { ChipSemaforo } from '@/components/ChipSemaforo';

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
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [livres, setLivres] = useState<string[]>([]); // até 4 municípios (§15.7)
  const [indicadorAtual, setIndicadorAtual] = useState<Indicador | null>(null);

  useEffect(() => {
    apiGet<Municipio[]>('/municipios').then(setMunicipios).catch(() => setMunicipios([]));
    apiGet<Tema[]>('/temas').then(setTemas).catch(() => setTemas([]));
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
      if (s && s.status === 'DISPONIVEL') consultar(s);
    }
  }, [pSub, subtemas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Permalink estável e compartilhável para a combinação atual
  function atualizarUrl(l: Municipio | null, t: Tema | null, st: Subtema | null) {
    const q = new URLSearchParams();
    if (l) q.set('municipio', l.codigo_ibge);
    if (t) q.set('tema', String(t.id));
    if (st) q.set('subtema', String(st.id));
    router.replace(`/consulta?${q.toString()}`, { scroll: false });
  }

  useEffect(() => {
    setSubtema(null);
    setResultado(null);
    setComparacao(null);
    if (tema)
      apiGet<Subtema[]>(`/temas/${tema.id}/subtemas`).then(setSubtemas).catch(() => setSubtemas([]));
  }, [tema]);

  async function consultar(sub: Subtema, comparar: string[] = livres) {
    setSubtema(sub);
    setResultado(null);
    setComparacao(null);
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
        return;
      }
      const ind = inds[0];
      setIndicadorAtual(ind);
      const extra = comparar.length ? `&municipios=${comparar.join(',')}` : '';
      const [res, comp] = await Promise.all([
        apiGet<Resultado>(
          `/indicadores/${ind.id}/consulta?recorte=MUNICIPIO&codigo=${local.codigo_ibge}`,
        ),
        apiGet<Comparacao>(
          `/indicadores/${ind.id}/comparacao?codigo_ibge=${local.codigo_ibge}${extra}`,
        ),
      ]);
      setResultado(res);
      setComparacao(comp);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'A consulta falhou.');
    } finally {
      setCarregando(false);
    }
  }

  function alternarLivre(codigo: string) {
    setLivres((atual) => {
      let novo: string[];
      if (atual.includes(codigo)) novo = atual.filter((c) => c !== codigo);
      else if (atual.length >= 4) {
        // §15.7: além de 5 séries a UI recusa e explica
        setErro('Comparação limitada a 4 municípios além do local (5 séries). Remova um para incluir outro.');
        return atual;
      } else novo = [...atual, codigo];
      setErro(null);
      if (subtema) consultar(subtema, novo);
      return novo;
    });
  }

  const filtrados = busca
    ? municipios.filter((m) =>
        m.nome
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .startsWith(busca.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
      )
    : municipios;

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Rail de consulta (§15.6) */}
      <aside className="rail" aria-label="Consulta em três passos">
        <div className="overline" style={{ marginBottom: 12 }}>
          Consulta
        </div>

        <section className={`passo ${local ? 'feito' : 'ativo'}`}>
          <h3>
            <span className="n">1</span> Local
          </h3>
          <input
            className="campo"
            placeholder="Buscar município…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar município"
          />
          <div style={{ maxHeight: 176, overflowY: 'auto', marginTop: 8 }}>
            {filtrados.map((m) => (
              <button
                key={m.codigo_ibge}
                className={`opcao${local?.codigo_ibge === m.codigo_ibge ? ' selecionada' : ''}`}
                onClick={() => {
                  setLocal(m);
                  setResultado(null);
                  setComparacao(null);
                }}
              >
                {m.nome}
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {m.codigo_ibge}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={`passo ${tema ? 'feito' : local ? 'ativo' : ''}`}>
          <h3>
            <span className="n">2</span> Tema
          </h3>
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
          <h3>
            <span className="n">3</span> Subtema
          </h3>
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
            Mato Grosso › {local.nome}
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
            <CartaoIndicador resultado={resultado} animada />

            {comparacao && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="overline">Comparar com</div>
                <table className="dados" style={{ marginTop: 12 }}>
                  <caption className="overline" style={{ display: 'none' }}>
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
                        ['Município', comparacao.municipio],
                        ['Região Imediata', comparacao.regiaoImediata],
                        ['Região Intermediária', comparacao.regiaoIntermediaria],
                        ['Estado de Mato Grosso', comparacao.estado],
                      ] as const
                    ).map(([rotulo, r]) => (
                      <tr key={rotulo}>
                        <td>{'local' in r && r.local ? `${rotulo} — ${r.local}` : rotulo}</td>
                        <td className="num">
                          {'valor' in r && r.valor !== undefined ? fmt.format(r.valor) : '—'}
                        </td>
                        <td>{('unidade' in r && r.unidade) || ('erro' in r && r.erro) || ''}</td>
                      </tr>
                    ))}
                    {comparacao.municipiosLivres?.map((r, i) => (
                      <tr key={`livre-${i}`}>
                        <td>{'local' in r && r.local ? r.local : `Município ${livres[i]}`}</td>
                        <td className="num">
                          {'valor' in r && r.valor !== undefined ? fmt.format(r.valor) : '—'}
                        </td>
                        <td>{('unidade' in r && r.unidade) || ('erro' in r && r.erro) || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  Agregações seguem o TipoAgregacao do indicador (RN-003): estoques somam,
                  taxas são recalculadas de numerador e denominador — nunca somadas.
                </p>
                <div className="overline" style={{ marginTop: 8 }}>Municípios de livre escolha (até 4)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {municipios
                    .filter((m) => m.codigo_ibge !== local?.codigo_ibge)
                    .map((m) => (
                      <button
                        key={m.codigo_ibge}
                        className="chip"
                        aria-pressed={livres.includes(m.codigo_ibge)}
                        style={
                          livres.includes(m.codigo_ibge)
                            ? { background: 'var(--accent-50)', borderColor: 'var(--accent-600)', cursor: 'pointer' }
                            : { cursor: 'pointer' }
                        }
                        onClick={() => alternarLivre(m.codigo_ibge)}
                      >
                        {m.nome}
                      </button>
                    ))}
                </div>
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

            {indicadores.length > 1 && (
              <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                Este subtema tem {indicadores.length} indicadores; exibindo o primeiro.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
