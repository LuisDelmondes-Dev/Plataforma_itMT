'use client';

import { useState } from 'react';
import type { Procedencia } from '@/lib/api';
import { formatarData } from '@/lib/format';
import { TermoExplicado } from '@/components/TermoExplicado';

/** As citações da Xingú carregam o quinteto sem a data de extração. */
type ProcedenciaExibivel = Omit<Procedencia, 'data_extracao'> & { data_extracao?: string };

function Fonte({ p }: { p: ProcedenciaExibivel }) {
  return p.url ? (
    <a href={p.url} target="_blank" rel="noreferrer">
      {p.fonte}
    </a>
  ) : (
    <>{p.fonte}</>
  );
}

/**
 * Régua de procedência — elemento-assinatura do Meridiano (PRD §15.0).
 * Materializa o quinteto de procedência (§12.1): onde ela não couber,
 * o número não pode aparecer.
 *
 * Onda B: fechada, é uma linha em português; "entenda" abre o painel com
 * as frases completas, a explicação do código de integridade e as fontes
 * secundárias (+N), que antes nunca eram exibíveis.
 */
export function ReguaProcedencia({
  procedencia,
  animada = false,
}: {
  procedencia: ProcedenciaExibivel[];
  animada?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const p = procedencia[0];
  if (!p) return null;
  const extras = procedencia.slice(1);

  return (
    <div className={`regua${animada ? ' animada' : ''}`}>
      <div className="trilho" aria-hidden="true" />
      <div className="legenda regua-resumo">
        <span>
          Fonte: <Fonte p={p} /> · dados de {p.data_referencia.slice(0, 4)}
          {extras.length > 0 ? ` · +${extras.length} fonte${extras.length > 1 ? 's' : ''}` : ''}
        </span>
        <button
          type="button"
          className="regua-entenda"
          aria-expanded={aberta}
          onClick={() => setAberta((v) => !v)}
        >
          {aberta ? 'fechar' : 'entenda'}
        </button>
      </div>
      {aberta && (
        <div className="regua-detalhe">
          <p>
            Este número vem de <Fonte p={p} />, referente a{' '}
            <TermoExplicado id="referencia">{p.data_referencia.slice(0, 4)}</TermoExplicado>
            {p.data_extracao ? (
              <>
                {' '}
                e foi <TermoExplicado id="extracao">copiado da fonte</TermoExplicado> em{' '}
                {formatarData(p.data_extracao)}
              </>
            ) : null}
            . Publicado sob a <TermoExplicado id="licenca">licença</TermoExplicado>{' '}
            <span className="mono">{p.licenca}</span>.
          </p>
          <p>
            <TermoExplicado id="hash">Código de integridade</TermoExplicado>:{' '}
            <span className="mono" title={p.hash}>
              {p.hash.slice(0, 16)}…
            </span>{' '}
            — permite conferir que o dado não foi alterado desde a coleta.
          </p>
          {extras.map((e, i) => (
            <p key={i} className="regua-fonte-extra">
              Fonte adicional: <Fonte p={e} /> · dados de {e.data_referencia.slice(0, 4)}
              {e.data_extracao ? ` · copiado em ${formatarData(e.data_extracao)}` : ''} · lic.{' '}
              <span className="mono">{e.licenca}</span> ·{' '}
              <span className="mono" title={e.hash}>
                {e.hash.slice(0, 12)}…
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
