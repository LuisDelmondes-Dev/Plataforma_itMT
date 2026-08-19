// Pacote oficial F2: amplia o catálogo com séries municipais do IBGE/SIDRA.
// Indicadores novos permanecem EM_ANALISE: ingestão técnica não substitui RG-09.
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const anoCenso = '2022';
const defs = [];
const add = (tema, subtema, agregado, variavel, nome, unidade, tipo = 'SOMA', classificacao, ano = anoCenso) =>
  defs.push({ tema, subtema, agregado, variavel, nome, unidade, tipo, classificacao, ano });

add('Geografia', 'Território', '4714', '6318', 'Área territorial municipal', 'km²', 'SOMA');
add('Geografia', 'Território', '4714', '614', 'Densidade demográfica municipal', 'hab./km²', 'NAO_AGREGAVEL');

for (const [id, rotulo] of [
  [72144, 'Rede geral usada como abastecimento principal'], [72145, 'Rede geral disponível, mas outra fonte principal'],
  [72146, 'Abastecimento principal por poço profundo com rede disponível'], [72147, 'Abastecimento principal por poço raso com rede disponível'],
  [72148, 'Abastecimento principal por nascente com rede disponível'], [72149, 'Abastecimento principal por carro-pipa com rede disponível'],
  [72150, 'Abastecimento principal por água de chuva com rede disponível'], [72151, 'Abastecimento principal por águas superficiais com rede disponível'],
  [72153, 'Domicílios sem ligação à rede geral de água'], [72154, 'Domicílios sem rede abastecidos por poço profundo'],
]) add('Infraestrutura Macro', 'Abastecimento de água', '6803', '381', rotulo, 'domicílios', 'SOMA', `1821[${id}]`);

for (const [id, rotulo] of [
  [46290, 'Esgotamento por rede ou fossa ligada à rede'], [72110, 'Esgotamento por rede geral ou pluvial'],
  [72111, 'Fossa séptica ligada à rede'], [72112, 'Fossa séptica não ligada à rede'],
  [72113, 'Esgotamento por fossa rudimentar'], [92858, 'Esgotamento por vala'],
  [72114, 'Esgotamento em rio, lago, córrego ou mar'], [72115, 'Outra forma de esgotamento'],
  [92861, 'Domicílios sem banheiro nem sanitário'],
]) add('Infraestrutura Urbana', 'Esgotamento sanitário', '6805', '381', rotulo, 'domicílios', 'SOMA', `11558[${id}]`);

for (const [id, faixa] of [[99749, '0 a 3 anos'], [47813, '4 a 5 anos'], [31615, '6 a 14 anos'], [2792, '15 a 17 anos'], [100052, '18 a 24 anos'], [108866, '25 anos ou mais']])
  add('Educação', 'Frequência escolar', '10056', '3795', `Taxa de frequência escolar — ${faixa}`, '%', 'NAO_AGREGAVEL', `58[${id}]|2[6794]|86[95251]`);

for (const [id, nivel] of [[95301, 'creche'], [107454, 'pré-escola'], [7905, 'alfabetização de jovens e adultos'], [7906, 'ensino fundamental regular'], [7907, 'EJA fundamental'], [7908, 'ensino médio regular'], [7909, 'EJA médio'], [95307, 'graduação']])
  add('Educação', 'Pessoas que frequentavam escola', '10058', '13283', `Estudantes de 6 a 17 anos — ${nivel}`, 'pessoas', 'SOMA', `11798[${id}]|58[95253]|2[6794]|86[95251]`);

for (const [variavel, nome, unidade, tipo] of [
  ['706', 'Unidades locais ativas', 'unidades', 'SOMA'], ['367', 'Empresas e organizações atuantes', 'organizações', 'SOMA'],
  ['707', 'Pessoal ocupado total', 'pessoas', 'SOMA'], ['708', 'Pessoal ocupado assalariado — CEMPRE', 'pessoas', 'SOMA'],
  ['5944', 'Pessoal assalariado médio', 'pessoas', 'SOMA'], ['662', 'Salários e outras remunerações', 'R$ mil', 'SOMA'],
  ['1606', 'Salário médio mensal em salários mínimos', 'salários mínimos', 'NAO_AGREGAVEL'], ['10143', 'Salário médio mensal em reais', 'R$', 'NAO_AGREGAVEL'],
]) add('Economia — Setor Privado', 'Estrutura empresarial e emprego', '1685', variavel, nome, unidade, tipo, undefined, '2021');

for (const [id, cultura] of [[40124, 'soja'], [40122, 'milho'], [40099, 'algodão'], [40106, 'cana-de-açúcar'], [40102, 'arroz'], [40112, 'feijão'], [40119, 'mandioca'], [40125, 'sorgo']])
  add('Agronegócio', 'Produção agrícola por cultura', '5457', '214', `Quantidade produzida — ${cultura}`, 'toneladas', 'SOMA', `782[${id}]`, '2024');

const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://itmt_app:itmt_app@localhost:5432/itmt' });
await db.connect();
const subtemas = new Map();
try {
  for (const d of defs) {
    const chave = `${d.tema}\0${d.subtema}`;
    if (!subtemas.has(chave)) {
      const r = await db.query(
        `INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
         SELECT t."TemaConsulta_Id",$2,'SEM_FONTE' FROM "TemaConsulta" t
          WHERE t."TemaConsulta_Nome"=$1 AND NOT EXISTS (
            SELECT 1 FROM "SubtemaConsulta" s
             WHERE s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"=$2
          )`, [d.tema, d.subtema]);
      const s = await db.query(
        `SELECT s."SubtemaConsulta_Id" AS id FROM "SubtemaConsulta" s JOIN "TemaConsulta" t
           ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
         WHERE t."TemaConsulta_Nome"=$1 AND s."SubtemaConsulta_Nome"=$2`, [d.tema, d.subtema]);
      if (!s.rows[0]) throw new Error(`Taxonomia inexistente: ${d.tema} / ${d.subtema}`);
      subtemas.set(chave, s.rows[0].id);
    }
  }
} finally { await db.end(); }

let ok = 0;
for (const [i, d] of defs.entries()) {
  console.log(`\n[F2 ${i + 1}/${defs.length}] ${d.nome}`);
  const args = ['scripts/ingestar-ibge-agregado.mjs', 'custom', d.ano,
    '--agregado', d.agregado, '--variavel', d.variavel, '--indicador', d.nome,
    '--unidade', d.unidade, '--tipo', d.tipo, '--subtema', String(subtemas.get(`${d.tema}\0${d.subtema}`))];
  if (d.classificacao) args.push('--classificacao', d.classificacao);
  const r = spawnSync(process.execPath, args, { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Falha ao ingerir ${d.nome}.`);
  ok++;
}
console.log(`\nPacote F2 ingerido: ${ok}/${defs.length} indicadores oficiais. Pareceres RG-09 continuam pendentes.`);
