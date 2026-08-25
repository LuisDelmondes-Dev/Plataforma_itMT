/**
 * Glossário do portal (Onda B): cada termo que a interface usa e o cidadão
 * não tem obrigação de conhecer. O código/sigla NUNCA é apagado — é
 * traduzido no lugar (transparência sem jargão). Molde de lib/direitos.ts.
 */
export interface Termo {
  termo: string;
  curta: string;
  longa?: string;
}

export const GLOSSARIO: Record<string, Termo> = {
  rgi: {
    termo: 'Região Imediata',
    curta: 'Grupo de municípios vizinhos que compartilham serviços do dia a dia (divisão do IBGE, 2017).',
    longa:
      'Região Geográfica Imediata: agrupamento do IBGE em torno de um centro urbano próximo, onde a população busca comércio, saúde e ensino. Substitui as antigas microrregiões desde 2017.',
  },
  rgint: {
    termo: 'Região Intermediária',
    curta: 'Conjunto de Regiões Imediatas em torno de uma cidade-polo maior (divisão do IBGE, 2017).',
    longa:
      'Região Geográfica Intermediária: reúne várias Regiões Imediatas em torno de um polo com serviços de maior complexidade, como hospitais de referência e universidades. Substitui as antigas mesorregiões.',
  },
  consorcio: {
    termo: 'Consórcio intermunicipal',
    curta: 'Associação formal de municípios para atuar juntos em saúde, resíduos, estradas e outros serviços.',
    longa:
      'A composição de um consórcio muda com o tempo; por isso a plataforma resolve o conjunto de municípios NA DATA da consulta (RN-002) — o valor de 2020 usa a composição de 2020.',
  },
  agregacao: {
    termo: 'Como o valor regional é calculado',
    curta: 'Cada indicador declara a regra: somar municípios, recalcular a taxa ou ponderar pela população.',
    longa:
      'Somar faz sentido para contagens (leitos, matrículas); taxas são recalculadas a partir das parcelas (nunca somadas); médias são ponderadas pela população. Indicador que não admite agregação responde que não é agregável em vez de inventar um número.',
  },
  referencia: {
    termo: 'Data de referência',
    curta: 'O período a que o dado se refere — não a data em que foi coletado.',
    longa:
      'Um censo coletado em 2022 e baixado por nós em 2025 tem referência 2022 e extração 2025. A referência diz de quando é a fotografia; a extração, quando a copiamos da fonte.',
  },
  extracao: {
    termo: 'Data de extração',
    curta: 'Quando a plataforma copiou o dado da fonte oficial.',
  },
  licenca: {
    termo: 'Licença de uso',
    curta: 'As condições em que o dado pode ser reutilizado — em geral, livre com citação da fonte.',
    longa:
      'Licenças como CC-BY 4.0 e dados abertos oficiais permitem reusar, publicar e cruzar o dado, desde que a fonte seja citada. A licença exibida vem registrada da própria fonte.',
  },
  hash: {
    termo: 'Código de integridade',
    curta: 'Impressão digital do dado: permite provar que este número não foi alterado desde a coleta.',
    longa:
      'É um resumo criptográfico (SHA-256) do arquivo original. Qualquer alteração de um único byte muda o código por completo — quem quiser pode recalcular e conferir que o dado exibido é exatamente o que a fonte publicou.',
  },
  'rn-005': {
    termo: 'Ausência é resposta',
    curta: 'Quando não há dado, a plataforma diz isso — nunca estima, nunca mostra zero no lugar.',
    longa:
      'Regra RN-005: ano sem dado é omitido (não vira zero), município sem as duas parcelas de uma taxa fica fora do recálculo, e a resposta sempre informa a referência mais próxima disponível.',
  },
  'rg-09': {
    termo: 'Aprovado por parecer humano',
    curta: 'Nenhum dado vira oficial automaticamente: um curador analisa e assina um parecer antes da publicação.',
    longa:
      'Regra RG-09: todo indicador nasce em análise e só aparece no portal depois de parecer favorável de uma pessoa responsável, registrado em trilha de auditoria imutável.',
  },
  a06: {
    termo: 'Auditoria de números',
    curta: 'Todo numeral que a IA escreve é conferido contra o resultado do motor — divergiu, é vetado.',
    longa:
      'O auditor A06 compara cada número do texto com o conjunto autorizado pela consulta. Um numeral que o motor não produziu bloqueia a resposta inteira, que é substituída pela frase determinística.',
  },
  semaforo: {
    termo: 'Semáforo de disponibilidade',
    curta: 'Atual = dado dentro da validade; Desatualizado = existe mas venceu; Sem dados = ainda não coberto.',
  },
  observado: {
    termo: 'Observado × projeção',
    curta: 'Linha cheia é dado real medido; linha tracejada é projeção ou cenário — hipótese declarada, nunca dado.',
  },
  dcat: {
    termo: 'Catálogo aberto (DCAT)',
    curta: 'Formato internacional que permite a outros sistemas descobrirem e reusarem nossos dados automaticamente.',
  },
  sirgas: {
    termo: 'SIRGAS 2000',
    curta: 'O sistema oficial de coordenadas do Brasil — garante que os mapas se alinhem com precisão.',
  },
  gsd: {
    termo: 'GSD',
    curta: 'Tamanho do pixel no chão: GSD de 5 cm significa que cada pixel da imagem cobre 5 cm do terreno.',
  },
  bronze: {
    termo: 'Bronze → Prata → Ouro',
    curta: 'O caminho do dado: bruto como veio da fonte → validado e normalizado → publicado com procedência.',
    longa:
      'O arquivo bruto (Bronze) é guardado com sua impressão digital; a etapa Prata valida e normaliza; só a etapa Ouro publica. Se o formato da fonte mudar de repente, a promoção é bloqueada até revisão humana.',
  },
  em_analise: {
    termo: 'Em análise',
    curta: 'Dado já carregado, aguardando o parecer humano que autoriza a publicação.',
  },
};
