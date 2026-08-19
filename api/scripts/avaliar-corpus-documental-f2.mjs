// Avalia corpus homologado de OCR/RAG sem esconder ausência de evidência real.
// Uso: node scripts/avaliar-corpus-documental-f2.mjs <manifest.json> [--saida resultado.json]
import { readFileSync, writeFileSync } from 'node:fs';

const arquivo = process.argv[2];
if (!arquivo) throw new Error('Informe o manifest.json do corpus homologado.');
const corpus = JSON.parse(readFileSync(arquivo, 'utf8'));
if (!corpus.homologado_por || !corpus.homologado_em || !Array.isArray(corpus.documentos) || !Array.isArray(corpus.consultas)) {
  throw new Error('Corpus inválido: exige homologado_por, homologado_em, documentos[] e consultas[].');
}

function distancia(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev.splice(0, prev.length, ...cur);
  }
  return prev[b.length];
}
const normalizar = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const taxas = corpus.documentos.map((d) => {
  const esperado = normalizar(d.texto_referencia);
  const obtido = normalizar(d.texto_extraido);
  const ep = esperado.split(' ').filter(Boolean), op = obtido.split(' ').filter(Boolean);
  return { id: d.id, cer: distancia([...esperado], [...obtido]) / Math.max(esperado.length, 1), wer: distancia(ep, op) / Math.max(ep.length, 1) };
});
const buscas = corpus.consultas.map((q) => {
  const relevantes = new Set(q.relevantes.map(String));
  const obtidos = q.recuperados.slice(0, 5).map(String);
  const contexto = new Set(obtidos);
  const acertos = obtidos.filter((id) => relevantes.has(id)).length;
  let dcg = 0;
  obtidos.forEach((id, i) => { if (relevantes.has(id)) dcg += 1 / Math.log2(i + 2); });
  let idcg = 0;
  for (let i = 0; i < Math.min(relevantes.size, 5); i++) idcg += 1 / Math.log2(i + 2);
  const afirmacoes = Array.isArray(q.afirmacoes) ? q.afirmacoes : [];
  let fieis = 0, grounded = 0, citacoesCorretas = 0, denominadorCitacoes = 0;
  for (const a of afirmacoes) {
    const suportes = new Set((a.fontes_suporte ?? []).map(String));
    const citacoes = [...new Set((a.citacoes ?? []).map(String))];
    if (a.suportada === true) fieis++;
    if ([...suportes].some((id) => contexto.has(id))) grounded++;
    citacoesCorretas += citacoes.filter((id) => suportes.has(id)).length;
    // Toda afirmação factual precisa de ao menos uma citação; ausência vale zero.
    denominadorCitacoes += Math.max(citacoes.length, 1);
  }
  return {
    id: q.id,
    recall_5: acertos / Math.max(relevantes.size, 1),
    precision_5: acertos / 5,
    ndcg_5: dcg / Math.max(idcg, 1),
    anotada: afirmacoes.length > 0,
    faithfulness: fieis / Math.max(afirmacoes.length, 1),
    groundedness: grounded / Math.max(afirmacoes.length, 1),
    citation_correctness: citacoesCorretas / Math.max(denominadorCitacoes, 1),
  };
});
const media = (xs, campo) => xs.reduce((s, x) => s + x[campo], 0) / Math.max(xs.length, 1);
const LIMIARES_NORMATIVOS = Object.freeze({
  cer_max: 0.05,
  wer_max: 0.10,
  recall_5_min: 0.80,
  precision_5_min: 0.80,
  ndcg_5_min: 0.75,
  faithfulness_min: 0.95,
  groundedness_min: 0.95,
  citation_correctness_min: 0.95,
});

// O corpus pode tornar o gate mais rigoroso, nunca reduzir o patamar do programa.
const limiaresSolicitados = corpus.limiares ?? {};
const limiares = Object.fromEntries(Object.entries(LIMIARES_NORMATIVOS).map(([chave, normativo]) => {
  const solicitado = Number(limiaresSolicitados[chave]);
  if (!Number.isFinite(solicitado)) return [chave, normativo];
  return [chave, chave.endsWith('_max')
    ? Math.min(normativo, solicitado)
    : Math.max(normativo, solicitado)];
}));
const resultado = {
  corpus: corpus.nome, homologado_por: corpus.homologado_por, homologado_em: corpus.homologado_em,
  amostra_ocr: taxas.length, consultas_rag: buscas.length,
  consultas_rag_anotadas: buscas.filter((x) => x.anotada).length,
  metricas: {
    cer: media(taxas, 'cer'), wer: media(taxas, 'wer'),
    recall_5: media(buscas, 'recall_5'), precision_5: media(buscas, 'precision_5'), ndcg_5: media(buscas, 'ndcg_5'),
    faithfulness: media(buscas, 'faithfulness'), groundedness: media(buscas, 'groundedness'),
    citation_correctness: media(buscas, 'citation_correctness'),
  },
  limiares,
};
resultado.aprovado = resultado.amostra_ocr >= 20 && resultado.consultas_rag >= 30 &&
  resultado.consultas_rag_anotadas === resultado.consultas_rag &&
  resultado.metricas.cer <= resultado.limiares.cer_max && resultado.metricas.wer <= resultado.limiares.wer_max &&
  resultado.metricas.recall_5 >= resultado.limiares.recall_5_min &&
  resultado.metricas.precision_5 >= resultado.limiares.precision_5_min &&
  resultado.metricas.ndcg_5 >= resultado.limiares.ndcg_5_min &&
  resultado.metricas.faithfulness >= resultado.limiares.faithfulness_min &&
  resultado.metricas.groundedness >= resultado.limiares.groundedness_min &&
  resultado.metricas.citation_correctness >= resultado.limiares.citation_correctness_min;
const saidaI = process.argv.indexOf('--saida');
if (saidaI > -1) writeFileSync(process.argv[saidaI + 1], JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado, null, 2));
process.exit(resultado.aprovado ? 0 : 1);
