'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost, ErroApi } from '@/lib/api';
import { AREAS } from '@/lib/direitos';
import { CabecalhoPagina } from '@/components/CabecalhoPagina';

interface DireitoRef { id: number; nome: string; area: string }
interface Resultado {
  provaveis: DireitoRef[];
  precisam_avaliacao: (DireitoRef & { criterios_a_verificar: string[] })[];
  nao_elegiveis: (DireitoRef & { motivos: string[] })[];
  incompatibilidades: { recebe: number; incompativel_com: { id: number; nome: string }; descricao: string }[];
  aviso_legal: string;
}

const FLAGS: { chave: string; rotulo: string }[] = [
  { chave: 'cadunico', rotulo: 'Minha família está no Cadastro Único' },
  { chave: 'contribuinte_inss', rotulo: 'Contribuo (ou contribuí há pouco) para o INSS' },
  { chave: 'trabalhador_formal', rotulo: 'Trabalho com carteira assinada' },
  { chave: 'desempregado', rotulo: 'Fui demitido(a) sem justa causa' },
  { chave: 'estudante', rotulo: 'Estudo em escola pública' },
  { chave: 'gestante', rotulo: 'Estou grávida, adotei ou tive filho há pouco' },
  { chave: 'deficiencia', rotulo: 'Tenho deficiência (ou TEA)' },
  { chave: 'doenca_grave', rotulo: 'Tenho (ou tive) doença grave' },
  { chave: 'zona_rural', rotulo: 'Vivo/trabalho na zona rural' },
  { chave: 'cuidador', rotulo: 'Sou cuidador(a) ou responsável por alguém' },
];

/**
 * §8 — "Descubra todos os seus direitos". O formulário não pede nome,
 * CPF, NIS, diagnóstico nem valores de renda: só os fatores mínimos
 * (§8: "não solicite dados pessoais desnecessários"). Renda e laudo
 * nunca são decididos aqui — viram "precisa de avaliação".
 */
export default function Descubra() {
  // useSearchParams exige Suspense no App Router
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
      <DescubraConteudo />
    </Suspense>
  );
}

function DescubraConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const [idade, setIdade] = useState<string>('');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const perfilUrlAplicado = useRef(false);

  async function executar(perfilFlags: Record<string, boolean>, perfilIdade: string) {
    setCarregando(true);
    setErro(null);
    try {
      const perfil: Record<string, unknown> = { ...perfilFlags };
      if (perfilIdade !== '') perfil.idade = Number(perfilIdade);
      setResultado(await apiPost<Resultado>('/direitos/descubra', perfil));
      // Permalink do resultado (Onda C): o perfil — nunca dados pessoais
      // além de idade e situações — vira URL recuperável e imprimível.
      const q = new URLSearchParams();
      if (perfilIdade !== '') q.set('idade', perfilIdade);
      const ativas = Object.keys(perfilFlags).filter((c) => perfilFlags[c]);
      if (ativas.length) q.set('s', ativas.join(','));
      router.replace(`/direitos/descubra${q.toString() ? `?${q}` : ''}`, { scroll: false });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagemHumana : e instanceof Error ? e.message : 'Falha na consulta.');
    } finally {
      setCarregando(false);
    }
  }

  // Permalink de entrada: ?idade=&s=flag1,flag2 restaura o perfil e refaz
  // o cruzamento (motor determinístico: mesmo perfil ⇒ mesmo resultado).
  useEffect(() => {
    if (perfilUrlAplicado.current) return;
    perfilUrlAplicado.current = true;
    const sUrl = params.get('s');
    const idadeUrl = params.get('idade') ?? '';
    if (!sUrl && !idadeUrl) return;
    const flagsUrl: Record<string, boolean> = {};
    for (const c of (sUrl ?? '').split(',')) if (FLAGS.some((f) => f.chave === c)) flagsUrl[c] = true;
    setFlags(flagsUrl);
    setIdade(/^\d{1,3}$/.test(idadeUrl) ? idadeUrl : '');
    void executar(flagsUrl, /^\d{1,3}$/.test(idadeUrl) ? idadeUrl : '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function consultar(e: React.FormEvent) {
    e.preventDefault();
    void executar(flags, idade);
  }

  const Lista = ({ itens, titulo, chip, extra }: {
    itens: (DireitoRef & { criterios_a_verificar?: string[]; motivos?: string[] })[];
    titulo: string; chip: string;
    extra?: (d: { criterios_a_verificar?: string[]; motivos?: string[] }) => string[] | undefined;
  }) => (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
        {titulo} <span className={`chip ${chip}`}>{itens.length}</span>
      </h2>
      {itens.length === 0 && <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>Nenhum, com as informações dadas.</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {itens.map((d) => (
          <div key={d.id} className="card" style={{ padding: 14 }}>
            <Link href={`/direitos/${d.id}`} style={{ fontWeight: 600 }}>{d.nome}</Link>
            <span className="chip" style={{ marginLeft: 8 }}>{AREAS[d.area] ?? d.area}</span>
            {extra?.(d)?.map((m, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>· {m}</div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <CabecalhoPagina
        overline={<Link href="/direitos">Mapa de Direitos</Link>}
        titulo="Descubra os seus direitos"
        descricao={
          <>
            Marque o que vale para você. Não pedimos nome, CPF, renda em valores nem diagnóstico
            — o cruzamento é determinístico e o que depende de renda, laudo ou perícia aparece
            como <strong>“precisa de avaliação”</strong>, nunca como promessa.
          </>
        }
      />

      <form onSubmit={consultar} className="card" style={{ marginTop: 16 }}>
        <label style={{ display: 'block', maxWidth: 220, marginBottom: 12 }}>
          <span className="overline">Idade (opcional)</span>
          <input className="campo" type="number" min={0} max={130} value={idade}
            onChange={(e) => setIdade(e.target.value)} placeholder="Ex.: 34" />
        </label>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="overline" style={{ marginBottom: 8 }}>Situações que valem para você</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {FLAGS.map((f) => (
              <label key={f.chave} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
                <input type="checkbox" checked={!!flags[f.chave]}
                  onChange={(e) => setFlags({ ...flags, [f.chave]: e.target.checked })} />
                {f.rotulo}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn primaria" type="submit" disabled={carregando} style={{ marginTop: 16 }}>
          {carregando ? 'Cruzando…' : 'Cruzar com o mapa de direitos'}
        </button>
      </form>

      {erro && <p className="aviso" role="alert" style={{ marginTop: 12 }}>{erro}</p>}

      {resultado && (
        <div aria-live="polite" className="descubra-resultado">
          <div className="nao-imprimir" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn primaria" onClick={() => window.print()}>
              Imprimir esta lista
            </button>
            <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
              É o papel para levar ao CRAS ou ao órgão responsável — o link desta página
              recupera o mesmo resultado.
            </span>
          </div>
          <Lista itens={resultado.provaveis} titulo="Direitos prováveis" chip="atual" />
          <Lista itens={resultado.precisam_avaliacao} titulo="Precisam de avaliação" chip="construcao"
            extra={(d) => d.criterios_a_verificar} />
          <Lista itens={resultado.nao_elegiveis} titulo="Não se aplicam, pelas respostas dadas" chip="sem-dado"
            extra={(d) => d.motivos} />
          {resultado.incompatibilidades.length > 0 && (
            <section style={{ marginTop: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Atenção — benefícios que não acumulam</h2>
              {resultado.incompatibilidades.map((i, k) => (
                <p key={k} className="aviso">{i.descricao}</p>
              ))}
            </section>
          )}
          <p className="aviso" style={{ marginTop: 24 }}>⚠ {resultado.aviso_legal}</p>
        </div>
      )}
    </div>
  );
}
