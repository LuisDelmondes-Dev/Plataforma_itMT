import { carregarSegredos } from './common/cofre';
carregarSegredos(); // cofre AES-256-GCM → process.env, ANTES de qualquer módulo

import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';

const PRODUCAO = process.env.NODE_ENV === 'production';

/**
 * Fail-fast de produção (RNF-05): subir com configuração de dev em
 * produção é erro de implantação, não estado degradado aceitável.
 */
function validarConfiguracaoProducao() {
  if (!PRODUCAO) return;
  const erros: string[] = [];
  const token = process.env.ADMIN_TOKEN ?? '';
  if (!token || token === 'itmt-admin-dev' || token.length < 24)
    erros.push('ADMIN_TOKEN ausente, default de dev ou curto demais (mínimo 24 caracteres).');
  const db = process.env.DATABASE_URL ?? '';
  if (!db) erros.push('DATABASE_URL ausente.');
  else {
    const usuario = new URL(db).username;
    if (usuario !== 'itmt_app')
      erros.push(`DATABASE_URL conecta como "${usuario}" — produção exige o role itmt_app ` +
        '(RG-10: a trilha só é imutável se a API não for dona do banco; ver db/08-seguranca.sql).');
  }
  if (!process.env.CORS_ORIGEM)
    erros.push('CORS_ORIGEM ausente (lista de origens permitidas, separadas por vírgula).');
  const sessao = process.env.SESSION_SECRET ?? '';
  if (sessao.length < 32)
    erros.push('SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).');
  const senhaInicial = process.env.ADMIN_SENHA_INICIAL ?? '';
  if (senhaInicial.length < 16)
    erros.push('ADMIN_SENHA_INICIAL ausente ou curta demais (mínimo 16 caracteres).');
  if ((process.env.API_KEY_PEPPER ?? '').length < 32)
    erros.push('API_KEY_PEPPER ausente ou curto demais (mínimo 32 caracteres).');
  if (process.env.OBJECT_STORAGE_DRIVER !== 's3')
    erros.push('OBJECT_STORAGE_DRIVER deve ser s3 em produção (volume local não é custódia durável).');
  if (!process.env.OBJECT_STORAGE_BUCKET)
    erros.push('OBJECT_STORAGE_BUCKET ausente.');
  if ((process.env.METRICS_TOKEN ?? '').length < 32)
    erros.push('METRICS_TOKEN ausente ou curto demais (mÃ­nimo 32 caracteres).');
  if (erros.length) {
    for (const e of erros) console.error(`[producao] ${e}`);
    process.exit(1);
  }
}

async function validarConteudoProducao(app: INestApplication) {
  if (!PRODUCAO) return;
  const db = app.get(DatabaseService);
  const r = await db.query<{ categoria: string; total: string }>(`
    SELECT categoria, total::text FROM (
      SELECT 'fontes demonstrativas' AS categoria, count(*) AS total
        FROM "Fonte"
       WHERE lower("Fonte_Nome") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
          OR lower("Fonte_Origem") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
      UNION ALL
      SELECT 'cargas demonstrativas', count(*)
        FROM "Carga"
       WHERE "Carga_CaminhoBronze" ILIKE '%/demo/%' OR "Carga_CaminhoBronze" LIKE 's3://t/%'
      UNION ALL
      SELECT 'consorcios demonstrativos', count(*)
        FROM "Consorcio"
       WHERE "Consorcio_Status" = 'DEMONSTRACAO'
      UNION ALL
      SELECT 'midias demonstrativas publicadas', count(*)
        FROM "AtivoMidia"
       WHERE "AtivoMidia_StatusPublicacao" = 'PUBLICADO'
         AND ("AtivoMidia_CaminhoObjeto" ILIKE '%/demo/%' OR "AtivoMidia_CaminhoObjeto" LIKE 's3://t/%')
      UNION ALL
      SELECT 'produtos GIS demonstrativos publicados', count(*)
        FROM "ProdutoGeografico"
       WHERE "ProdutoGeografico_StatusPublicacao" = 'PUBLICADO'
         AND ("ProdutoGeografico_CaminhoObjeto" ILIKE '%/demo/%' OR "ProdutoGeografico_CaminhoObjeto" LIKE 's3://t/%')
    ) inventario WHERE total > 0
  `);
  if (r.rows.length) {
    const inventario = r.rows.map((x) => `${x.categoria}: ${x.total}`).join('; ');
    throw new Error(
      `Publicacao bloqueada: o banco contem fixtures demonstrativas (${inventario}). ` +
      'Carregue fontes oficiais e remova as fixtures antes de iniciar em producao.',
    );
  }
}

async function bootstrap() {
  validarConfiguracaoProducao();
  const app = await NestFactory.create(AppModule);
  try {
    await validarConteudoProducao(app);
  } catch (erro) {
    console.error(`[producao] ${(erro as Error).message}`);
    await app.close();
    process.exit(1);
  }
  app.setGlobalPrefix('v1'); // RF-API-001: versionamento por caminho
  app.use(helmet());
  if (process.env.CORS_ORIGEM) {
    app.enableCors({ origin: process.env.CORS_ORIGEM.split(',').map((o) => o.trim()) });
  } else {
    app.enableCors(); // dev
  }
  // Atrás do proxy TLS, o rate limit precisa ver o IP real
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}
bootstrap();
