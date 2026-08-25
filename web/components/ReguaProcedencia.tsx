import type { Procedencia } from '@/lib/api';
import { formatarData } from '@/lib/format';

/** As citações da Xingú carregam o quinteto sem a data de extração. */
type ProcedenciaExibivel = Omit<Procedencia, 'data_extracao'> & { data_extracao?: string };

/**
 * Régua de procedência — elemento-assinatura do Meridiano (PRD §15.0).
 * Materializa o quinteto de procedência (§12.1): onde ela não couber,
 * o número não pode aparecer.
 */
export function ReguaProcedencia({
  procedencia,
  animada = false,
}: {
  procedencia: ProcedenciaExibivel[];
  animada?: boolean;
}) {
  const p = procedencia[0];
  if (!p) return null;
  return (
    <div className={`regua${animada ? ' animada' : ''}`}>
      <div className="trilho" aria-hidden="true" />
      <div className="legenda">
        {p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer">
            {p.fonte}
          </a>
        ) : (
          p.fonte
        )}
        {' · ref. '}
        {p.data_referencia.slice(0, 4)}
        {p.data_extracao ? ` · extraído em ${formatarData(p.data_extracao)}` : ''}
        {' · lic. '}
        {p.licenca}
        {' · '}
        <span className="mono" title={p.hash}>
          {p.hash.slice(0, 12)}…
        </span>
        {procedencia.length > 1 ? ` · +${procedencia.length - 1} fonte(s)` : ''}
      </div>
    </div>
  );
}
