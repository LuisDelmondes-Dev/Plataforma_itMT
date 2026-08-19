import { apiGet } from '@/lib/api';
import Link from 'next/link';

interface Documento {
  id: string;
  titulo: string;
  descricao: string | null;
  orgao: string;
  tipo: string;
  municipio: string | null;
  licenca: string;
  fonte_url: string | null;
  versao_id: string;
  versao: number;
  hash: string;
  mime: string;
  publicado_em: string;
}

interface ResultadoBusca {
  trecho_id: string;
  documento_id: string;
  titulo: string;
  orgao: string;
  licenca: string;
  fonte_url: string | null;
  versao_id: string;
  versao: number;
  hash: string;
  pagina: number | null;
  trecho: string;
  relevancia: number;
}

interface Busca {
  consulta: string;
  total: number;
  resultados: ResultadoBusca[];
  modo: 'HIBRIDA_RRF' | 'LEXICAL';
  vetorial: boolean;
  motivo_fallback?: string;
}

export const dynamic = 'force-dynamic';

function semMarcacaoPerigosa(html: string) {
  return html
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('&lt;mark&gt;', '<mark>').replaceAll('&lt;/mark&gt;', '</mark>');
}

export default async function Biblioteca(props: { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  const params = await props.searchParams;
  const q = params.q?.trim() ?? '';
  const qs = new URLSearchParams();
  if (params.tipo) qs.set('tipo', params.tipo);
  const [documentos, busca] = await Promise.all([
    apiGet<Documento[]>(`/documentos?${qs}`).catch(() => []),
    q.length >= 2
      ? apiGet<Busca>(`/documentos/busca?q=${encodeURIComponent(q)}`).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="biblioteca">
      <section className="biblioteca-hero">
        <div>
          <div className="overline">Biblioteca territorial · Fase 2</div>
          <h1>Documentos públicos com fonte verificável</h1>
          <p>
            Pesquise relatórios, estudos, planos e metodologias. Cada resultado aponta para a
            versão revisada, o órgão responsável, a licença e o hash do arquivo original.
          </p>
        </div>
        <div className="biblioteca-selo" aria-label="Política de publicação">
          <span>RG-09</span>
          <strong>Revisão humana</strong>
          <small>obrigatória antes da publicação</small>
        </div>
      </section>

      <form className="biblioteca-busca" role="search">
        <label htmlFor="q">Buscar dentro dos documentos</label>
        <div className="biblioteca-busca-linha">
          <input id="q" className="campo" name="q" defaultValue={q}
            placeholder="Ex.: saneamento rural, estradas vicinais, plano diretor…" />
          <select className="campo biblioteca-tipo" name="tipo" defaultValue={params.tipo ?? ''} aria-label="Tipo de documento">
            <option value="">Todos os tipos</option>
            <option value="RELATORIO">Relatórios</option>
            <option value="ESTUDO">Estudos</option>
            <option value="LEGISLACAO">Legislação</option>
            <option value="PLANO">Planos</option>
            <option value="NOTA_TECNICA">Notas técnicas</option>
            <option value="BASE_METODOLOGICA">Metodologias</option>
          </select>
          <button className="btn primaria" type="submit">Pesquisar</button>
        </div>
      </form>

      {busca && (
        <section aria-labelledby="resultados-busca" className="biblioteca-resultados">
          <div className="biblioteca-secao-titulo">
            <div>
              <div className="overline">Busca no conteúdo</div>
              <h2 id="resultados-busca">{busca.total} trecho{busca.total === 1 ? '' : 's'} encontrado{busca.total === 1 ? '' : 's'}</h2>
            </div>
            <span className="biblioteca-consulta">“{busca.consulta}”</span>
            <span className="biblioteca-consulta" title={busca.motivo_fallback}>
              {busca.vetorial ? 'Busca híbrida' : 'Busca lexical'}
            </span>
          </div>
          <div className="biblioteca-trechos">
            {busca.resultados.map((r, i) => (
              <article className="biblioteca-trecho" key={r.trecho_id}>
                <span className="biblioteca-numero">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="overline">{r.orgao}{r.pagina ? ` · página ${r.pagina}` : ''}</div>
                  <h3>{r.titulo}</h3>
                  <p dangerouslySetInnerHTML={{ __html: semMarcacaoPerigosa(r.trecho) }} />
                  <div className="biblioteca-fonte">
                    <span>v{r.versao}</span><span>{r.licenca}</span>
                    <code title={r.hash}>sha256 {r.hash.slice(0, 12)}…</code>
                    <a href={`/api/v1/documentos/versoes/${r.versao_id}/arquivo`}>Abrir fonte</a>
                  </div>
                </div>
              </article>
            ))}
            {busca.total === 0 && <div className="aviso">Nenhum trecho revisado corresponde a essa pesquisa.</div>}
          </div>
        </section>
      )}

      <section aria-labelledby="catalogo-documental">
        <div className="biblioteca-secao-titulo">
          <div>
            <div className="overline">Catálogo publicado</div>
            <h2 id="catalogo-documental">Acervo documental</h2>
          </div>
          <span>{documentos.length} documento{documentos.length === 1 ? '' : 's'}</span>
        </div>
        <div className="biblioteca-grid">
          {documentos.map((d) => (
            <article className="biblioteca-card" key={d.id}>
              <div className="biblioteca-card-topo">
                <span>{d.tipo.replaceAll('_', ' ')}</span>
                <span>v{d.versao}</span>
              </div>
              <h3>{d.titulo}</h3>
              <p>{d.descricao || 'Documento territorial publicado após revisão técnica.'}</p>
              <dl>
                <div><dt>Órgão</dt><dd>{d.orgao}</dd></div>
                {d.municipio && <div><dt>Território</dt><dd>{d.municipio}</dd></div>}
                <div><dt>Licença</dt><dd>{d.licenca}</dd></div>
                <div><dt>Integridade</dt><dd><code>{d.hash.slice(0, 12)}…</code></dd></div>
              </dl>
              <div className="biblioteca-card-acoes">
                <a className="btn primaria" href={`/api/v1/documentos/versoes/${d.versao_id}/arquivo`}>Abrir documento</a>
                {d.fonte_url && <a href={d.fonte_url} target="_blank" rel="noreferrer">Página oficial</a>}
              </div>
            </article>
          ))}
          {documentos.length === 0 && (
            <div className="biblioteca-vazio">
              <strong>Catálogo aguardando curadoria</strong>
              <p>Arquivos submetidos só aparecem aqui após extração e aprovação humana.</p>
            </div>
          )}
        </div>
      </section>
      <div className="biblioteca-operacao">
        <span>Órgão parceiro ou equipe de curadoria?</span>
        <Link href="/biblioteca/curadoria">Acessar envio e revisão de documentos →</Link>
      </div>
    </div>
  );
}
