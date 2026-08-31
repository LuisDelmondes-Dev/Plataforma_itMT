// Dez indicadores oficiais do pacote mínimo F1 via API SIDRA/IBGE.
// Bronze imutável -> contrato de esquema -> Prata -> qualidade dos 10 pilotos -> Ouro.
import {
  auditar, baixar, pool, promoverObservacoes, quarentenar, registrarCarga,
  registrarFonte, salvarBronze, sha256, verificarEsquema,
} from './lib-ingest.mjs';

const DATASETS = [
  {
    slug: 'censo-territorio', agregado: '4714', periodo: '2022', ref: '2022-08-01',
    variaveis: [
      { id: '93', indicador: 'População residente — Censo 2022' },
      { id: '614', indicador: 'Densidade demográfica' },
    ],
    fonte: 'IBGE — Censo Demográfico 2022 (SIDRA 4714)',
    pagina: 'https://sidra.ibge.gov.br/tabela/4714',
  },
  {
    slug: 'censo-frequencia-escolar', agregado: '10056', periodo: '2022', ref: '2022-08-01',
    classificacao: '58[31615]|2[6794]|86[95251]',
    variaveis: [
      { id: '3795', indicador: 'Taxa de frequência escolar bruta — 6 a 14 anos' },
    ],
    fonte: 'IBGE — Censo Demográfico 2022, frequência escolar (SIDRA 10056)',
    pagina: 'https://sidra.ibge.gov.br/tabela/10056',
  },
  {
    slug: 'censo-populacao-escolar', agregado: '10058', periodo: '2022', ref: '2022-08-01',
    classificacao: '11798[95300]|58[95253]|2[6794]|86[95251]',
    variaveis: [
      { id: '13283', indicador: 'Pessoas de 6 a 17 anos que frequentavam escola' },
    ],
    fonte: 'IBGE — Censo Demográfico 2022, população escolar (SIDRA 10058)',
    pagina: 'https://sidra.ibge.gov.br/tabela/10058',
  },
  {
    slug: 'pam', agregado: '5457', periodo: '2024', ref: '2024-12-31',
    classificacao: '782[0]',
    variaveis: [
      { id: '8331', indicador: 'Área plantada' },
      { id: '215', indicador: 'Valor da produção agrícola' },
    ],
    fonte: 'IBGE — Produção Agrícola Municipal (SIDRA 5457)',
    pagina: 'https://sidra.ibge.gov.br/tabela/5457',
  },
  {
    slug: 'cempre', agregado: '1685', periodo: '2021', ref: '2021-12-31',
    variaveis: [
      { id: '706', indicador: 'Unidades locais de empresas e organizações' },
      { id: '708', indicador: 'Pessoal ocupado assalariado' },
    ],
    fonte: 'IBGE — Cadastro Central de Empresas (SIDRA 1685)',
    pagina: 'https://sidra.ibge.gov.br/tabela/1685',
  },
  {
    slug: 'censo-agua', agregado: '6803', periodo: '2022', ref: '2022-08-01',
    classificacao: '1821[72144]',
    variaveis: [{ id: '1000381', indicador: 'Domicílios ligados à rede geral de água' }],
    fonte: 'IBGE — Censo 2022, abastecimento de água (SIDRA 6803)',
    pagina: 'https://sidra.ibge.gov.br/tabela/6803',
  },
  {
    slug: 'censo-esgoto', agregado: '6805', periodo: '2022', ref: '2022-08-01',
    classificacao: '11558[46290]',
    variaveis: [{ id: '1000381', indicador: 'Domicílios com esgotamento ligado à rede' }],
    fonte: 'IBGE — Censo 2022, esgotamento sanitário (SIDRA 6805)',
    pagina: 'https://sidra.ibge.gov.br/tabela/6805',
  },
];

const filtro = (() => {
  const i = process.argv.indexOf('--dataset');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const selecionados = filtro ? DATASETS.filter((d) => d.slug === filtro) : DATASETS;
if (!selecionados.length) {
  console.error(`Dataset desconhecido: ${filtro}. Opções: ${DATASETS.map((d) => d.slug).join(', ')}`);
  process.exit(1);
}

function urlDe(d) {
  const vars = d.variaveis.map((v) => v.id).join('|');
  return `https://servicodados.ibge.gov.br/api/v3/agregados/${d.agregado}/periodos/${d.periodo}` +
    `/variaveis/${vars}?localidades=N6[N3[51]]` +
    (d.classificacao ? `&classificacao=${d.classificacao}` : '');
}

function seriesDaVariavel(corpo, variavelId) {
  const item = corpo.find((v) => String(v.id) === String(variavelId));
  return (item?.resultados ?? []).flatMap((r) => r.series ?? []);
}

function normalizar(series, periodo) {
  const validas = [];
  const invalidas = [];
  for (const s of series) {
    const codigo = String(s?.localidade?.id ?? '');
    const bruto = s?.serie?.[periodo];
    // Na simbologia SIDRA, '-' significa zero absoluto. '...' é ausência/supressão.
    const valor = bruto === '-' ? 0 : Number(String(bruto).replace(',', '.'));
    if (!/^51\d{5}$/.test(codigo) || !Number.isFinite(valor) || valor < 0 || bruto === '...') {
      invalidas.push({ registro: s, motivo: `valor ausente/inválido em ${codigo || 'sem código'}: ${bruto}` });
    } else {
      validas.push({ codigo, valor });
    }
  }
  return { validas, invalidas };
}

const db = pool();
let falhas = 0;
try {
  const pilotosR = await db.query(
    `SELECT "MunicipioPilotoF1_CodigoIbge" AS codigo FROM "MunicipioPilotoF1" ORDER BY "MunicipioPilotoF1_Ordem"`,
  );
  const pilotos = new Set(pilotosR.rows.map((r) => r.codigo));
  if (pilotos.size !== 10) throw new Error(`Catálogo F1 inválido: esperados 10 municípios piloto, encontrados ${pilotos.size}.`);

  for (const d of selecionados) {
    try {
      const fonteId = await registrarFonte(db, {
        nome: d.fonte,
        origem: 'Instituto Brasileiro de Geografia e Estatística',
        url: d.pagina,
        baseLegal: 'API_PUBLICA',
        licenca: 'Dados públicos oficiais do IBGE; citar a tabela SIDRA e a data de extração.',
        periodicidade: 'ANUAL',
      });
      const url = urlDe(d);
      console.log(`↓ ${d.slug}: ${url}`);
      const bruto = await baixar(url);
      const hash = sha256(bruto);
      const { caminho } = salvarBronze(`ibge-${d.slug}-${d.periodo}-${hash.slice(0, 12)}.json`, bruto);
      const corpo = JSON.parse(bruto);
      if (!Array.isArray(corpo) || corpo.length !== d.variaveis.length) {
        throw new Error(`${d.slug}: resposta não contém as ${d.variaveis.length} variáveis contratadas.`);
      }
      const totalLinhas = d.variaveis.reduce((n, v) => n + seriesDaVariavel(corpo, v.id).length, 0);
      const cargaId = await registrarCarga(db, {
        fonteId, hash, caminhoBronze: caminho, linhasLidas: totalLinhas,
      });
      await verificarEsquema(db, {
        fonteId, cargaId,
        amostra: { resposta: corpo[0], variaveis_contratadas: d.variaveis.map((v) => v.id) },
        aceitarNovo: process.argv.includes('--aceitar-esquema'),
      });
      await auditar(db, 'ingest-f1', 'INGESTAO_BRONZE', 'Carga', String(cargaId), {
        dataset: d.slug, agregado: d.agregado, periodo: d.periodo, url, hash, linhas: totalLinhas,
      });

      for (const v of d.variaveis) {
        const indicadorR = await db.query(
          `SELECT "Indicador_Id" AS id, "Indicador_SubtemaId" AS subtema_id
             FROM "Indicador" WHERE "Indicador_Nome" = $1`, [v.indicador],
        );
        if (!indicadorR.rows[0]) throw new Error(`Indicador do pacote não cadastrado: ${v.indicador}. Aplique a migração 19.`);
        const { validas, invalidas } = normalizar(seriesDaVariavel(corpo, v.id), d.periodo);
        for (const q of invalidas) await quarentenar(db, cargaId, q.registro, q.motivo);

        const presentes = new Set(validas.map((l) => l.codigo));
        const pilotosPresentes = [...pilotos].filter((codigo) => presentes.has(codigo));
        const ausentes = [...pilotos].filter((codigo) => !presentes.has(codigo));
        const coberturaPct = pilotosPresentes.length * 10;
        const qualidadeOk = coberturaPct === 100 && invalidas.length < totalLinhas;

        // E18 (db/63): promoverObservacoes confirma a carga
        // (CANDIDATA⇒PROMOVIDA) no MESMO comando do Ouro. Uma carga do
        // pacote alimenta várias variáveis: a primeira que gravar
        // observação confirma; se nenhuma gravar, a carga fica CANDIDATA.
        const promovida = await promoverObservacoes(db, {
          indicadorId: indicadorR.rows[0].id, fonteId, cargaId,
          dataReferencia: d.ref, linhas: validas,
        });
        await db.query(
          `INSERT INTO "ResultadoQualidadeIndicador"
             ("ResultadoQualidadeIndicador_IndicadorId","ResultadoQualidadeIndicador_CargaId",
              "ResultadoQualidadeIndicador_Status","ResultadoQualidadeIndicador_CoberturaPct",
              "ResultadoQualidadeIndicador_Checagens")
           VALUES ($1,$2,$3,$4,$5::jsonb)`,
          [indicadorR.rows[0].id, cargaId, qualidadeOk ? 'APROVADO_TECNICAMENTE' : 'BLOQUEADO',
           coberturaPct, JSON.stringify({ pilotos_esperados: 10, pilotos_presentes: pilotosPresentes.length,
             municipios_ausentes: ausentes, registros_validos: validas.length,
             registros_quarentena: invalidas.length, hash_sha256: hash })],
        );
        await db.query(
          `UPDATE "SubtemaConsulta" SET "SubtemaConsulta_Status" = 'EM_CONSTRUCAO'
            WHERE "SubtemaConsulta_Id" = $1 AND "SubtemaConsulta_Status" = 'SEM_FONTE'`,
          [indicadorR.rows[0].subtema_id],
        );
        await auditar(db, 'ingest-f1', 'PROMOCAO_OURO', 'Indicador', String(indicadorR.rows[0].id), {
          indicador: v.indicador, carga_id: cargaId, referencia: d.ref,
          gravadas: promovida.gravadas, sem_malha: promovida.semMalha,
          cobertura_pilotos_pct: coberturaPct, qualidade: qualidadeOk ? 'APROVADO_TECNICAMENTE' : 'BLOQUEADO',
        });
        console.log(`${qualidadeOk ? '✓' : '⚠'} ${v.indicador}: ${promovida.gravadas} observações; pilotos ${pilotosPresentes.length}/10.`);
      }
    } catch (e) {
      falhas++;
      console.error(`✗ ${d.slug}: ${e.message}`);
    }
  }
} finally {
  await db.end();
}

if (falhas) process.exitCode = 1;
