import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { AREAS, CONFIANCA, GRATUIDADE } from '@/lib/direitos';

export const dynamic = 'force-dynamic';

interface Ficha {
  id: number;
  nome: string;
  area: string;
  resumo: string;
  quempodeusar: string;
  quemnaoseenquadra: string | null;
  gratuidade: string;
  abrangencia: string;
  orgaogestor: string;
  orgaoexecutor: string | null;
  baselegal: string;
  naturezanorma: string;
  requisitos: string | null;
  criteriorenda: string | null;
  exigecontribuicaoinss: boolean;
  automatico: boolean;
  documentos: string | null;
  laudopericia: string | null;
  comosolicitar: string | null;
  ondesolicitar: string | null;
  linkoficial: string;
  prazoestimado: string | null;
  validaderenovacao: string | null;
  valorcobertura: string | null;
  acumulacao: string | null;
  motivosnegativa: string | null;
  comorecorrer: string | null;
  canaisreclamacao: string | null;
  observacoes: string | null;
  confianca: string;
  data_verificacao: string | null;
  verificacao_desatualizada: boolean;
  publicos: { slug: string; nome: string }[];
  condicoes: { nome: string; tipo: string; observacao: string | null }[];
  regras: { fator: string; valor: number | null; efeito: string; descricao: string }[];
  incompatibilidades: { direito_id: number; nome: string; descricao: string }[];
  aviso_legal: string;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 15, lineHeight: '20px', fontWeight: 600, marginBottom: 4 }}>{titulo}</h2>
      <div style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: '21px' }}>{children}</div>
    </section>
  );
}

/** Ficha completa do §6 do prompt mestre — campo a campo, com procedência. */
export default async function FichaDireito({ params }: { params: { id: string } }) {
  const d = await apiGet<Ficha>(`/direitos/${params.id}`).catch(() => null);
  if (!d) notFound();
  const c = CONFIANCA[d.confianca] ?? CONFIANCA.NECESSITA_CONFIRMACAO;

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="overline">
        <Link href="/direitos">Mapa de Direitos</Link> · {AREAS[d.area] ?? d.area}
      </div>
      <h1 style={{ fontSize: 28, lineHeight: '36px', fontWeight: 600, margin: '8px 0' }}>{d.nome}</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }}>
        <span className={`chip ${c.classe}`}><span className="forma" aria-hidden>{c.forma}</span>{c.rotulo}</span>
        <span className="chip">{GRATUIDADE[d.gratuidade] ?? d.gratuidade}</span>
        <span className="chip">{d.abrangencia}</span>
        <span className="chip">{d.criteriorenda ? 'Depende de renda' : 'Independe de renda'}</span>
        <span className="chip">{d.exigecontribuicaoinss ? 'Exige contribuição ao INSS' : 'Não exige INSS'}</span>
        {d.automatico && <span className="chip atual">Concessão automática</span>}
      </div>

      {d.verificacao_desatualizada && (
        <p className="aviso">
          ⚠ A última verificação desta ficha tem mais de 180 dias ({d.data_verificacao ?? 'sem data'}).
          Confirme as regras vigentes no órgão responsável antes de decidir.
        </p>
      )}

      <div className="card" style={{ marginTop: 8 }}>
        <p style={{ fontSize: 16, lineHeight: '24px' }}>{d.resumo}</p>
        <div className="regua mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          Base legal: {d.baselegal} · {d.naturezanorma.replaceAll('_', ' ').toLowerCase()} ·{' '}
          <a href={d.linkoficial}>página oficial</a> · verificado em {d.data_verificacao ?? '—'}
        </div>
      </div>

      <Secao titulo="Quem pode usar">{d.quempodeusar}</Secao>
      {d.quemnaoseenquadra && <Secao titulo="Quem não se enquadra">{d.quemnaoseenquadra}</Secao>}
      {d.requisitos && <Secao titulo="Requisitos">{d.requisitos}</Secao>}
      {d.criteriorenda && <Secao titulo="Critério de renda">{d.criteriorenda}</Secao>}
      {d.documentos && <Secao titulo="Documentos necessários">{d.documentos}</Secao>}
      {d.laudopericia && <Secao titulo="Laudo ou perícia">{d.laudopericia}</Secao>}
      {d.comosolicitar && <Secao titulo="Como solicitar">{d.comosolicitar}</Secao>}
      {d.ondesolicitar && <Secao titulo="Onde solicitar">{d.ondesolicitar}</Secao>}
      {d.prazoestimado && <Secao titulo="Prazo estimado">{d.prazoestimado}</Secao>}
      {d.validaderenovacao && <Secao titulo="Validade e renovação">{d.validaderenovacao}</Secao>}
      {d.valorcobertura && <Secao titulo="Valor ou cobertura">{d.valorcobertura}</Secao>}
      {d.acumulacao && <Secao titulo="Acumulação com outros benefícios">{d.acumulacao}</Secao>}
      {d.motivosnegativa && <Secao titulo="Motivos comuns de negativa">{d.motivosnegativa}</Secao>}
      {d.comorecorrer && <Secao titulo="Como recorrer">{d.comorecorrer}</Secao>}
      {d.canaisreclamacao && <Secao titulo="Canais de reclamação">{d.canaisreclamacao}</Secao>}
      {d.observacoes && <Secao titulo="Observações importantes">{d.observacoes}</Secao>}

      <Secao titulo="Órgãos responsáveis">
        Gestor: {d.orgaogestor}{d.orgaoexecutor ? ` · Executor: ${d.orgaoexecutor}` : ''}
      </Secao>

      {d.publicos.length > 0 && (
        <Secao titulo="Públicos">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {d.publicos.map((p) => (
              <Link key={p.slug} className="chip" href={`/direitos?publico=${p.slug}`}>{p.nome}</Link>
            ))}
          </div>
        </Secao>
      )}

      {d.condicoes.length > 0 && (
        <Secao titulo="Doenças e condições associadas — sem automatismo">
          <table className="dados">
            <thead><tr><th scope="col">Condição</th><th scope="col">O que observar</th></tr></thead>
            <tbody>
              {d.condicoes.map((cd) => (
                <tr key={cd.nome}>
                  <td>{cd.nome}</td>
                  <td style={{ fontSize: 13 }}>{cd.observacao ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
      )}

      {d.regras.length > 0 && (
        <Secao titulo="Critérios avaliados pelo motor determinístico">
          <ul style={{ paddingLeft: 18 }}>
            {d.regras.map((r, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <span className={`chip ${r.efeito === 'REQUISITO' ? 'atual' : 'construcao'}`} style={{ marginRight: 8 }}>
                  {r.efeito === 'REQUISITO' ? 'Requisito' : 'Precisa de avaliação'}
                </span>
                {r.descricao}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {d.incompatibilidades.length > 0 && (
        <Secao titulo="Não acumula com">
          <ul style={{ paddingLeft: 18 }}>
            {d.incompatibilidades.map((i) => (
              <li key={i.direito_id} style={{ marginBottom: 4 }}>
                <Link href={`/direitos/${i.direito_id}`}>{i.nome}</Link> — {i.descricao}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <p className="aviso" style={{ marginTop: 24 }}>⚠ {d.aviso_legal}</p>
    </div>
  );
}
