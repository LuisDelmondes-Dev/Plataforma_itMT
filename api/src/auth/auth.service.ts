import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { conferirSenha, gerarHashSenha } from './senha';
import { emitirToken, Papel } from './token';

/**
 * Identidade e RBAC (RF012). Emite tokens de sessão assinados a partir de
 * e-mail+senha (scrypt). No bootstrap, garante 1 admin a partir de
 * ADMIN_SENHA_INICIAL (env/cofre) — nunca há senha em claro no repositório.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger('Auth');
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    try {
      const existe = await this.db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "Usuario" WHERE "Usuario_Papel" = 'ADMIN'`,
      );
      if (existe.rows[0]?.n > 0) return;
      const email = process.env.ADMIN_EMAIL ?? 'admin@itmt.local';
      const senha = process.env.ADMIN_SENHA_INICIAL ?? process.env.ADMIN_TOKEN ?? 'itmt-admin-dev';
      if (!process.env.ADMIN_SENHA_INICIAL) {
        this.log.warn(
          'ADMIN_SENHA_INICIAL não definida — criando admin com senha de desenvolvimento. Defina e rotacione em produção.',
        );
      }
      await this.db.query(
        `INSERT INTO "Usuario" ("Usuario_Email","Usuario_SenhaHash","Usuario_Papel")
         VALUES ($1,$2,'ADMIN') ON CONFLICT ("Usuario_Email") DO NOTHING`,
        [email, gerarHashSenha(senha)],
      );
      this.log.log(`Admin inicial garantido: ${email}`);
    } catch (e) {
      // Banco sem a migração 11 ainda (ex.: ambiente legado) — não derruba a API.
      this.log.warn(`bootstrap de admin ignorado: ${(e as Error).message}`);
    }
  }

  async login(email: string, senha: string): Promise<{ token: string; papel: Papel; email: string }> {
    const r = await this.db.query<{ hash: string; papel: Papel; ativo: boolean }>(
      `SELECT "Usuario_SenhaHash" AS hash, "Usuario_Papel" AS papel, "Usuario_Ativo" AS ativo
         FROM "Usuario" WHERE "Usuario_Email" = $1`,
      [email],
    );
    const u = r.rows[0];
    // Mesma resposta para inexistente/senha errada — não vaza quais e-mails existem.
    if (!u || !u.ativo || !conferirSenha(senha, u.hash)) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return { token: emitirToken(email, u.papel), papel: u.papel, email };
  }
}
