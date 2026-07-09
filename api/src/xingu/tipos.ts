import { Recorte } from '../territorio/territorio.service';

/**
 * Plano de consulta estruturado (glossário do PRD):
 * gerado na borda de linguagem e validado contra schema ANTES de
 * qualquer execução (RF-CHAT-003). É exibido ao usuário.
 */
export interface PlanoConsulta {
  acao: 'CONSULTAR';
  recorte: Recorte;
  codigo: string | null;       // codigo_ibge | rgi | rgint | consorcio_id
  indicador_id: number;
  periodo: { referencia: string }; // AAAA-MM-DD
}

export interface Clarificacao {
  pergunta: string;
  opcoes: { rotulo: string; pergunta_sugerida: string }[]; // máx. 2 (RF-CHAT-005)
}

const RECORTES = ['ESTADO', 'MUNICIPIO', 'RGINT', 'RGI', 'CONSORCIO'];

/** Validação estrutural do plano — o "JSON Schema" do RG-02, codificado. */
export function validarPlano(p: unknown): p is PlanoConsulta {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  if (o.acao !== 'CONSULTAR') return false;
  if (!RECORTES.includes(o.recorte as string)) return false;
  if (o.recorte !== 'ESTADO' && (typeof o.codigo !== 'string' || !o.codigo)) return false;
  if (typeof o.indicador_id !== 'number' || !Number.isInteger(o.indicador_id)) return false;
  const per = o.periodo as Record<string, unknown> | undefined;
  if (!per || typeof per.referencia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(per.referencia))
    return false;
  return true;
}
