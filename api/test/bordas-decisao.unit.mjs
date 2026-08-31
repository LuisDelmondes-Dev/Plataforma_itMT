// Bordas de decisão sem cobertura até EV-20260822-053.
//
// A15 (governador de gasto) e o dossiê RG-09 decidem, respectivamente, se a
// plataforma gasta com LLM e o que o parecerista humano vê antes de publicar.
// Nenhum dos dois tinha teste dedicado — e ambos tinham falha real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CustoService } from '../dist/xingu/custo.service.js';
import { ValidacaoTecnicaService } from '../dist/admin/validacao-tecnica.service.js';

/** Consumo fixo: 600k no dia (acima do teto diário padrão de 500k) e no mês
 *  (muito abaixo do teto mensal de 5M) — isola a decisão do teto DIÁRIO. */
const consumoAcimaDoDia = { query: async () => ({ rows: [{ dia: '600000', mes: '600000' }] }) };

async function comEnv(valor, fn) {
  const anterior = process.env.XINGU_TETO_TOKENS_DIA;
  if (valor === null) delete process.env.XINGU_TETO_TOKENS_DIA;
  else process.env.XINGU_TETO_TOKENS_DIA = valor;
  try {
    // o teto é lido na construção — instanciar aqui é essencial
    return await fn(new CustoService(consumoAcimaDoDia));
  } finally {
    if (anterior === undefined) delete process.env.XINGU_TETO_TOKENS_DIA;
    else process.env.XINGU_TETO_TOKENS_DIA = anterior;
  }
}

test('A15: teto malformado no env NÃO desliga o governador de gasto', async () => {
  // Antes: Number('500k') = NaN, e NaN é falsy — o `if (this.tetoDia && ...)`
  // era pulado e o teto do dia sumia em silêncio. Um typo virava gasto livre.
  for (const ruim of ['500k', 'quinhentos mil', 'abc', '1e', 'NaN', '-1', '-500000']) {
    const dentro = await comEnv(ruim, (s) => s.dentroDoOrcamento());
    assert.equal(dentro, false,
      `XINGU_TETO_TOKENS_DIA="${ruim}" deixou gastar com o teto diário estourado (fail-open)`);
  }
});

test('A15: teto válido barra, e 0 continua significando ilimitado', async () => {
  assert.equal(await comEnv('500000', (s) => s.dentroDoOrcamento()), false, 'teto válido deve barrar');
  assert.equal(await comEnv('700000', (s) => s.dentroDoOrcamento()), true, 'abaixo do teto deve liberar');
  // semântica documentada no cabeçalho do serviço: teto 0 = ilimitado
  assert.equal(await comEnv('0', (s) => s.dentroDoOrcamento()), true, '0 é ilimitado por contrato');
  assert.equal(await comEnv(null, (s) => s.dentroDoOrcamento()), false, 'sem env, vale o padrão 500k');
});

/** Banco de mentira para o dossiê: devolve as estatísticas pedidas e um catálogo mínimo. */
function dbDossie({
  cargasBloqueadas = 0, cargasCandidatas = 0, fontesSemLicenca = 0, refFuturas = 0, obs = 100,
}) {
  return {
    query: async (sql) => {
      if (sql.includes('"Indicador_Nome" AS nome'))
        return { rows: [{ nome: 'Indicador de prova', unidade: 'unid.', tipo: 'SOMA', status: 'EM_ANALISE' }] };
      if (sql.includes('AS cargas_bloqueadas'))
        return { rows: [{ obs, municipios: 141, min: '0', max: '10', ref_recente: '2025-12-31',
          ref_futuras: refFuturas, fontes: 1, fontes_sem_licenca: fontesSemLicenca,
          cargas: 2, cargas_bloqueadas: cargasBloqueadas, cargas_candidatas: cargasCandidatas }] };
      if (sql.includes('FROM "Municipio"')) return { rows: [{ n: 142 }] };
      return { rows: [] };
    },
  };
}
const checagem = (r, prefixo) => r.checagens.find((c) => c.nome.startsWith(prefixo));

test('dossiê RG-09: nenhuma checagem é decorativa — todas podem reprovar', async () => {
  // Antes: "Fonte presente" e "Data de referência presente" contavam colunas
  // NOT NULL — impossíveis de falhar. O parecerista via 6/6 achando que 6
  // coisas foram verificadas; só 4 eram. Cada checagem agora tem um cenário
  // que a derruba.
  const svc = new ValidacaoTecnicaService(dbDossie({}));
  const limpo = await svc.validar(1);
  assert.equal(limpo.aprovado_tecnicamente, true, 'cenário íntegro deveria passar');

  const cenarios = [
    ['Cargas confirmadas', dbDossie({ cargasBloqueadas: 1 })],
    ['Fonte com licença', dbDossie({ fontesSemLicenca: 1 })],
    ['Datas de referência', dbDossie({ refFuturas: 3 })],
    ['Tem observações', dbDossie({ obs: 0 })],
  ];
  for (const [prefixo, db] of cenarios) {
    const r = await new ValidacaoTecnicaService(db).validar(1);
    assert.equal(checagem(r, prefixo)?.ok, false, `"${prefixo}" precisa reprovar no seu cenário`);
    assert.equal(r.aprovado_tecnicamente, false, `"${prefixo}" reprovado deve derrubar o veredicto`);
  }
});

test('dossiê RG-09: carga não confirmada chega ao parecerista com motivo', async () => {
  // RF-INGEST-005 bloqueia a promoção, mas se observações de uma carga
  // bloqueada estiverem vivas, quem decide publicar precisa saber.
  const r = await new ValidacaoTecnicaService(dbDossie({ cargasBloqueadas: 1 })).validar(1);
  const c = checagem(r, 'Cargas confirmadas');
  assert.equal(c.ok, false);
  assert.match(c.detalhe, /não confirmada|nao confirmada/i, 'o detalhe precisa dizer o que houve');
  assert.match(c.detalhe, /revise antes de publicar/i, 'e o que fazer a respeito');

  // E18 (db/63): o vocabulário ganhou 'CANDIDATA' — carga que baixou o bruto
  // e nunca completou o Ouro. Ela é tão problemática quanto a bloqueada por
  // drift, e o dossiê precisa DISTINGUIR as duas para o revisor humano.
  const candidata = await new ValidacaoTecnicaService(
    dbDossie({ cargasBloqueadas: 1, cargasCandidatas: 1 }),
  ).validar(1);
  const cc = checagem(candidata, 'Cargas confirmadas');
  assert.equal(cc.ok, false);
  assert.match(cc.detalhe, /CANDIDATA/,
    'carga não confirmada não pode se passar por drift: o parecerista precisa saber qual é o caso');
});
