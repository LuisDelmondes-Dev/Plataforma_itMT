import { apiGet } from '@/lib/api';

interface Fonte {
  id: number;
  nome: string;
  origem: string | null;
  url: string | null;
  base_legal: string;
  licenca: string;
  periodicidade: string | null;
  ultima_carga: string | null;
  cargas: number;
}

export const dynamic = 'force-dynamic';

/** RF-ADMIN-007: transparência do próprio sistema. */
export default async function Transparencia() {
  const fontes = await apiGet<Fonte[]>('/fontes').catch(() => [] as Fonte[]);
  return (
    <div style={{ maxWidth: 900 }}>
      <div className="overline">Transparência</div>
      <h1 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 600, margin: '8px 0' }}>
        Inventário de bases e política de dados
      </h1>

      <h2 style={{ fontSize: 24, lineHeight: '32px', fontWeight: 600 }}>Inventário de bases</h2>
      <p style={{ color: 'var(--ink-2)' }}>
        Toda fonte tem base legal e licença registradas antes do primeiro byte ser coletado
        (RG-06). Sem base legal, o conector não executa — a regra falha o pipeline, não avisa.
      </p>
      <table className="dados">
        <caption style={{ display: 'none' }}>Fontes de dados da plataforma</caption>
        <thead>
          <tr>
            <th scope="col">Fonte</th>
            <th scope="col">Base legal</th>
            <th scope="col">Licença</th>
            <th scope="col">Periodicidade</th>
            <th scope="col">Última carga</th>
          </tr>
        </thead>
        <tbody>
          {fontes.map((f) => (
            <tr key={f.id}>
              <td>{f.url ? <a href={f.url}>{f.nome}</a> : f.nome}</td>
              <td className="mono" style={{ fontSize: 12 }}>{f.base_legal}</td>
              <td style={{ fontSize: 13 }}>{f.licenca}</td>
              <td className="mono" style={{ fontSize: 12 }}>{f.periodicidade ?? '—'}</td>
              <td className="mono" style={{ fontSize: 12 }}>{f.ultima_carga?.slice(0, 10) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 24, lineHeight: '32px', fontWeight: 600, marginTop: 32 }}>
        Política de privacidade
      </h2>
      <p style={{ color: 'var(--ink-2)' }}>
        A ITMT não mantém dado pessoal identificável de cidadão no núcleo analítico (RG-07).
        Os indicadores publicados são agregados por município. O acervo de imagens de via
        pública passa por anonimização de rostos e placas antes de qualquer publicação
        (RG-08). A plataforma é camada de acesso: todo número aponta para a sua origem, e a
        licença de redistribuição nunca é mais permissiva do que a recebida (RG-12).
      </p>

      <h2 style={{ fontSize: 24, lineHeight: '32px', fontWeight: 600, marginTop: 32 }}>
        Canal do titular de dados
      </h2>
      <p style={{ color: 'var(--ink-2)' }}>
        Solicitações de titulares (acesso, correção, eliminação) são atendidas em até 15
        dias (RG-11) pelo e-mail{' '}
        <a href="mailto:titular@itmt.mt.gov.br">titular@itmt.mt.gov.br</a>. Toda solicitação
        e resposta entram na trilha de auditoria imutável da plataforma.
      </p>

      <h2 style={{ fontSize: 24, lineHeight: '32px', fontWeight: 600, marginTop: 32 }}>
        Auditoria pública
      </h2>
      <p style={{ color: 'var(--ink-2)' }}>
        Cada consulta, ingestão e publicação gera um evento em cadeia SHA-256 imutável
        (INSERT-ONLY, com UPDATE/DELETE revogados no banco). A integridade da cadeia é
        verificável por script independente incluído no código-fonte.
      </p>
    </div>
  );
}
