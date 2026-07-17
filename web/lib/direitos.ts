// Rótulos do F4 — Mapa de Direitos (compartilhados entre as páginas).

export const AREAS: Record<string, string> = {
  DOCUMENTACAO: 'Documentação e cidadania',
  ASSISTENCIA_SOCIAL: 'Assistência social',
  RENDA: 'Renda e transferências',
  PREVIDENCIA: 'Previdência Social',
  SAUDE: 'Saúde (SUS)',
  PESSOA_COM_DEFICIENCIA: 'Pessoa com deficiência',
  EDUCACAO: 'Educação',
  TRABALHO: 'Trabalho e emprego',
  HABITACAO: 'Habitação e moradia',
  TRANSPORTE: 'Transporte e mobilidade',
  JUSTICA: 'Justiça e defesa de direitos',
  CONSUMIDOR: 'Direitos do consumidor',
  TRIBUTOS: 'Tributos e isenções',
  SERVICOS_ESSENCIAIS: 'Energia, água e telecom',
  CULTURA_ESPORTE_LAZER: 'Cultura, esporte e lazer',
  ALIMENTACAO: 'Segurança alimentar',
  PROTECAO: 'Proteção de mulheres, crianças e famílias',
  PESSOA_IDOSA: 'Pessoa idosa',
  POVOS_TRADICIONAIS: 'Povos e comunidades tradicionais',
  RURAL_MEIO_AMBIENTE: 'Meio rural e ambiente',
  SERVICOS_DIGITAIS: 'Serviços digitais públicos',
};

/** §10 do prompt mestre — classificação do nível de segurança da informação. */
export const CONFIANCA: Record<string, { rotulo: string; classe: string; forma: string }> = {
  CONFIRMADA: { rotulo: 'Confirmada', classe: 'atual', forma: '●' },
  CONFIRMADA_VARIACAO_LOCAL: { rotulo: 'Confirmada, varia localmente', classe: 'atual', forma: '◐' },
  CONDICIONADA_AVALIACAO: { rotulo: 'Condicionada à avaliação', classe: 'construcao', forma: '▲' },
  JURISPRUDENCIAL: { rotulo: 'Jurisprudencial', classe: 'construcao', forma: '§' },
  EM_REGULAMENTACAO: { rotulo: 'Em regulamentação', classe: 'defasado', forma: '◌' },
  NECESSITA_CONFIRMACAO: { rotulo: 'Necessita confirmação', classe: 'defasado', forma: '?' },
  REVOGADA: { rotulo: 'Revogada', classe: 'sem-dado', forma: '✕' },
};

export const GRATUIDADE: Record<string, string> = {
  GRATUITO: 'Gratuito',
  SUBSIDIADO: 'Subsidiado',
  COPARTICIPACAO: 'Com coparticipação',
  DEPENDE_DE_CRITERIOS: 'Depende de critérios',
};

export interface DireitoResumo {
  id: number;
  nome: string;
  area: string;
  resumo: string;
  gratuidade: string;
  abrangencia: string;
  confianca: string;
  exige_inss: boolean;
  depende_de_renda: boolean;
  automatico: boolean;
  pouco_conhecido: boolean;
  data_verificacao: string | null;
}
