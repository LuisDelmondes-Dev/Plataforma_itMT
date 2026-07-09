// ============================================================
// ingestar-ibge-territorio.mjs — CONECTOR 1
// Malha territorial oficial: municípios de MT com suas Regiões
// Geográficas Imediatas e Intermediárias (códigos reais do IBGE).
//
// Fonte: API de Localidades do IBGE (dado aberto, sem chave)
//   https://servicodados.ibge.gov.br/api/v1/localidades/estados/51/municipios
//
// Uso:
//   node scripts/ingestar-ibge-territorio.mjs                  # busca ao vivo
//   node scripts/ingestar-ibge-territorio.mjs --from-bronze <arquivo.json>
//                                                              # reprocessa um bruto
//                                                              # já capturado (RF-INGEST-006)
// Idempotente: pode rodar quantas vezes quiser sem duplicar.
// ============================================================
import {
  pool, registrarFonte, salvarBronze, lerBronze, registrarCarga, auditar, baixar,
  verificarEsquema, quarentenar,
} from './lib-ingest.mjs';

const URL_IBGE =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/51/municipios';

const db = pool();

try {
  // 1) Fonte com base legal — sem isso o pipeline falha (RG-06)
  const fonteId = await registrarFonte(db, {
    nome: 'IBGE — API de Localidades (municípios de MT)',
    origem: 'Instituto Brasileiro de Geografia e Estatística',
    url: URL_IBGE,
    baseLegal: 'DADO_ABERTO',
    licenca: 'Dados abertos IBGE (Lei 12.527/2011)',
    periodicidade: 'EVENTUAL',
  });

  // 2) BRONZE: capturar (ou reler) o bruto imutável
  const argBronze = process.argv.indexOf('--from-bronze');
  let bruto, caminho, hash;
  if (argBronze > -1) {
    const arq = process.argv[argBronze + 1];
    if (!arq) throw new Error('Informe o arquivo: --from-bronze <caminho.json>');
    ({ conteudo: bruto, hash } = lerBronze(arq));
    caminho = arq;
    console.log(`↻ Reprocessando Bronze existente: ${arq}`);
  } else {
    console.log(`↓ Baixando ${URL_IBGE} …`);
    bruto = await baixar(URL_IBGE);
    ({ caminho, hash } = salvarBronze(
      `ibge-municipios-mt-${new Date().toISOString().slice(0, 10)}.json`,
      bruto,
    ));
    console.log(`✓ Bronze gravado: ${caminho}`);
  }
  console.log(`  SHA-256: ${hash}`);

  // 3) PRATA: normalizar e validar
  const municipios = JSON.parse(bruto);
  if (!Array.isArray(municipios) || municipios.length < 1) {
    throw new Error('Validação Prata falhou: resposta não é uma lista de municípios.');
  }
  // 4) Carga registrada (linhagem: RF-INGEST-009)
  const cargaId = await registrarCarga(db, {
    fonteId, hash, caminhoBronze: caminho, linhasLidas: municipios.length,
  });

  // RF-INGEST-005: contrato de esquema — drift bloqueia a promoção
  await verificarEsquema(db, {
    fonteId, cargaId, amostra: municipios[0],
    aceitarNovo: process.argv.includes('--aceitar-esquema'),
  });

  const linhas = [];
  for (const m of municipios) {
    const rgi = m['regiao-imediata'];
    const rgint = rgi?.['regiao-intermediaria'];
    const codigo = String(m.id ?? '');
    if (!/^\d{7}$/.test(codigo) || !m.nome || !rgi?.id || !rgint?.id) {
      // RF-INGEST-010: registro inválido vai à quarentena sem parar a carga
      await quarentenar(db, cargaId, m, 'Campos obrigatórios ausentes/ inválidos (id 7 dígitos, nome, RGI, RGInt)');
      continue;
    }
    linhas.push({
      codigo,
      nome: m.nome,
      rgi: String(rgi.id),
      rgiNome: rgi.nome,
      rgint: String(rgint.id),
      rgintNome: rgint.nome,
    });
  }
  if (!linhas.length) throw new Error('Validação Prata: nenhum registro válido — tudo em quarentena.');
  console.log(`✓ Prata: ${linhas.length} válidos, ${municipios.length - linhas.length} em quarentena.`);
  await auditar(db, 'ingest', 'INGESTAO_BRONZE', 'Carga', String(cargaId), {
    fonte: 'IBGE Localidades', hash, linhas: linhas.length,
  });

  // 5) OURO: upsert determinístico (idempotente — RF-INGEST-006)
  const cli = await db.connect();
  try {
    await cli.query('BEGIN');
    for (const l of linhas) {
      await cli.query(
        `INSERT INTO "RegiaoIntermediaria" VALUES ($1,$2)
         ON CONFLICT ("RegiaoIntermediaria_Codigo") DO UPDATE SET "RegiaoIntermediaria_Nome" = EXCLUDED."RegiaoIntermediaria_Nome"`,
        [l.rgint, l.rgintNome],
      );
      await cli.query(
        `INSERT INTO "RegiaoImediata" VALUES ($1,$2,$3)
         ON CONFLICT ("RegiaoImediata_Codigo") DO UPDATE
           SET "RegiaoImediata_Nome" = EXCLUDED."RegiaoImediata_Nome",
               "RegiaoImediata_CodigoRgint" = EXCLUDED."RegiaoImediata_CodigoRgint"`,
        [l.rgi, l.rgiNome, l.rgint],
      );
      await cli.query(
        `INSERT INTO "Municipio" ("Municipio_CodigoIbge","Municipio_Nome","Municipio_CodigoRgi","Municipio_CodigoRgint")
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("Municipio_CodigoIbge") DO UPDATE
           SET "Municipio_Nome" = EXCLUDED."Municipio_Nome",
               "Municipio_CodigoRgi" = EXCLUDED."Municipio_CodigoRgi",
               "Municipio_CodigoRgint" = EXCLUDED."Municipio_CodigoRgint"`,
        [l.codigo, l.nome, l.rgi, l.rgint],
      );
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
  }

  await auditar(db, 'ingest', 'PROMOCAO_OURO', 'Municipio', 'MT', {
    carga_id: cargaId, municipios: linhas.length,
  });

  const tot = await db.query(`SELECT count(*)::int AS n FROM "Municipio"`);
  console.log(`✓ Ouro: malha territorial promovida. Municípios na base: ${tot.rows[0].n}.`);
} catch (e) {
  console.error(`✗ Pipeline abortado: ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
