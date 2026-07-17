import { carregarSegredos } from './common/cofre';
carregarSegredos(); // cofre AES-256-GCM → process.env, ANTES de qualquer módulo

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

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
  if (erros.length) {
    for (const e of erros) console.error(`[producao] ${e}`);
    process.exit(1);
  }
}

async function bootstrap() {
  validarConfiguracaoProducao();
  const app = await NestFactory.create(AppModule);
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
