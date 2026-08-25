import { apiGet } from '@/lib/api';
import { CabecalhoPagina } from '@/components/CabecalhoPagina';

interface Ativo {
  id: number; tipo: string; titulo: string; autor: string; licenca: string;
  caminho: string; duracao_min: string | null; legenda: string | null;
  transcricao: string | null; tags: string | null; municipio: string;
}

export const dynamic = 'force-dynamic';

/** MTIMAGENS + VIDEOS (RF-IMG-001): acervo público pesquisável. */
export default async function Acervo(props: { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  const searchParams = await props.searchParams;
  const qs = new URLSearchParams();
  if (searchParams.q) qs.set('q', searchParams.q);
  if (searchParams.tipo) qs.set('tipo', searchParams.tipo);
  const ativos = await apiGet<Ativo[]>(`/midia/acervo?${qs.toString()}`); // falha propaga (RN-005)

  return (
    <div>
      <CabecalhoPagina
        overline="MT Imagens · Vídeos"
        titulo="Acervo audiovisual dos municípios"
        descricao="Todo ativo publicado carrega autor, licença explícita e — quando há pessoa identificável — termo de consentimento arquivado. Imagem de via pública só entra após anonimização verificada. Vídeos sempre com legenda e transcrição."
      />
      <form style={{ display: 'flex', gap: 8, margin: '16px 0', maxWidth: 560 }}>
        <input className="campo" name="q" defaultValue={searchParams.q ?? ''} placeholder="Buscar por título ou tag…" aria-label="Buscar no acervo" />
        <button className="btn primaria" type="submit">Buscar</button>
      </form>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
        {ativos.map((a) => (
          <div key={a.id} className="card">
            <div className="overline">{a.tipo.replace('_', ' ')} · {a.municipio}</div>
            <h2 style={{ fontSize: 18, lineHeight: '24px', margin: '8px 0' }}>{a.titulo}</h2>
            {a.duracao_min && <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>{a.duracao_min} min · legenda e transcrição disponíveis</p>}
            <div className="regua" style={{ marginTop: 10 }}>
              <div className="trilho" aria-hidden="true" />
              <div className="legenda">{a.autor} · {a.licenca}</div>
            </div>
            <p style={{ marginTop: 10, marginBottom: 0 }}>
              <a className="mono" style={{ fontSize: 12 }} href={a.caminho}>abrir ativo</a>
              {a.transcricao && <> · <a className="mono" style={{ fontSize: 12 }} href={a.transcricao}>transcrição</a></>}
            </p>
          </div>
        ))}
        {ativos.length === 0 && <div className="aviso">Nenhum ativo publicado corresponde à busca.</div>}
      </div>
    </div>
  );
}
