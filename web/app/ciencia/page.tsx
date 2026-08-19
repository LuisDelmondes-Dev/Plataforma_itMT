'use client';

import { useEffect, useState } from 'react';

interface Distribuicao { 'dct:format': string; 'dcat:accessURL': string; }
interface Dataset {
  'dct:identifier': string; 'dct:title': string; 'dct:description': string;
  'dct:modified': string; 'dct:license': string[];
  'prov:wasGeneratedBy': string; 'dcat:distribution': Distribuicao[];
}
interface Catalogo { 'dcat:dataset': Dataset[]; }

const ROTULO_FORMATO: Record<string, string> = {
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/pdf': 'PDF',
};
const hrefPublico = (href: string) => href.startsWith('/v1/') ? `/api${href}` : href;

export default function Ciencia() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/dcat', { signal: controller.signal })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(`Catálogo indisponível (${resposta.status}).`);
        return resposta.json() as Promise<Catalogo>;
      })
      .then(setCatalogo)
      .catch((falha) => {
        if (falha instanceof DOMException && falha.name === 'AbortError') return;
        setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar o catálogo.');
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="science-page">
      <header className="science-hero">
        <p className="science-kicker">Ciência aberta · DCAT · Proveniência</p>
        <h1>Dados que podem ser verificados e reproduzidos.</h1>
        <p>Cada conjunto publicado declara fonte, licença, versão, transformação e código. A publicação exige validação técnica e parecer humano.</p>
        <a className="btn ciencia" href="/api/v1/dcat">Abrir catálogo JSON-LD</a>
      </header>
      <section aria-labelledby="datasets-ciencia">
        <div className="science-heading">
          <div><p className="science-kicker">Catálogo público</p><h2 id="datasets-ciencia">Conjuntos disponíveis</h2></div>
          <span className="science-count" aria-live="polite">{catalogo ? `${catalogo['dcat:dataset'].length} conjuntos` : 'Carregando'}</span>
        </div>
        {erro && <p className="aviso" role="alert">{erro}</p>}
        {!catalogo && !erro && <p role="status">Consultando o catálogo científico…</p>}
        {catalogo && catalogo['dcat:dataset'].length === 0 && <p className="science-empty">Nenhum conjunto aprovado para publicação neste ambiente.</p>}
        <div className="science-grid">
          {catalogo?.['dcat:dataset'].map((dataset, indice) => (
            <article className="science-card" key={dataset['dct:identifier']}>
              <span className="science-index">{String(indice + 1).padStart(2, '0')}</span>
              <h3>{dataset['dct:title']}</h3><p>{dataset['dct:description']}</p>
              <dl>
                <div><dt>Licença</dt><dd>{dataset['dct:license'].join(', ')}</dd></div>
                <div><dt>Atualização</dt><dd>{new Date(dataset['dct:modified']).toLocaleDateString('pt-BR')}</dd></div>
              </dl>
              <div className="science-actions">
                {dataset['dcat:distribution'].map((item) => <a key={item['dct:format']} href={hrefPublico(item['dcat:accessURL'])}>{ROTULO_FORMATO[item['dct:format']] ?? item['dct:format']}</a>)}
                <a href={hrefPublico(dataset['prov:wasGeneratedBy'])}>Reproduzir</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
