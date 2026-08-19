import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { conferirSenha, gerarHashSenha } from './senha';
import { emitirToken, Papel, Sessao } from './token';

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
      const criado = await this.db.query<{ id: string }>(
        `INSERT INTO "Usuario" ("Usuario_Email","Usuario_SenhaHash","Usuario_Papel")
         VALUES ($1,$2,'ADMIN') ON CONFLICT ("Usuario_Email") DO UPDATE SET "Usuario_Ativo"=true
         RETURNING "Usuario_Id"::text AS id`,
        [email, gerarHashSenha(senha)],
      );
      if (criado.rows[0]) await this.db.query(`SELECT "GarantirMembroPlataforma"($1)`, [criado.rows[0].id]);
      this.log.log(`Admin inicial garantido: ${email}`);
    } catch (e) {
      // Produção é fail-closed: API sem identidade funcional não pode parecer saudável.
      if (process.env.NODE_ENV === 'production') throw e;
      // Banco sem a migração 11 ainda (ex.: ambiente legado de desenvolvimento).
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
    // Papéis de contribuição (escrita externa) têm sessão mais curta: o
    // token é stateless (não revalida no banco), então o TTL é o freio.
    const ttl = u.papel === 'PARCEIRO' || u.papel === 'UNIVERSIDADE' ? 4 * 3600 : 8 * 3600;
    return { token: emitirToken(email, u.papel, ttl), papel: u.papel, email };
  }

  /** Criação de conta por ADMIN (RF012): parceiro/universidade/curador. */
  async criarUsuario(email: string, senha: string, papel: Papel): Promise<{ id: number }> {
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "Usuario" ("Usuario_Email","Usuario_SenhaHash","Usuario_Papel")
       VALUES ($1,$2,$3)
       ON CONFLICT ("Usuario_Email") DO UPDATE
         SET "Usuario_SenhaHash" = EXCLUDED."Usuario_SenhaHash",
             "Usuario_Papel" = EXCLUDED."Usuario_Papel",
             "Usuario_Ativo" = true
       RETURNING "Usuario_Id" AS id`,
      [email, gerarHashSenha(senha), papel],
    );
    await this.db.query(`SELECT "GarantirMembroPlataforma"($1)`, [r.rows[0].id]);
    return { id: r.rows[0].id };
  }

  private async usuarioId(email: string): Promise<string> {
    const r = await this.db.query<{ id: string }>(
      `SELECT "Usuario_Id"::text AS id FROM "Usuario" WHERE "Usuario_Email"=$1 AND "Usuario_Ativo"`,
      [email],
    );
    if (!r.rows[0]) throw new UnauthorizedException('Sessão sem identidade ativa.');
    return r.rows[0].id;
  }

  async listarOrganizacoes(email: string) {
    const userId = await this.usuarioId(email);
    return this.db.withIdentityTransaction(userId, async (client) => {
      const r = await client.query(
        `SELECT m."OrganizacaoMembro_TenantId"::text AS tenant_id,
                m."OrganizacaoMembro_OrganizacaoId"::text AS organization_id,
                o."Organizacao_Slug" AS slug, o."Organizacao_Nome" AS nome,
                m."OrganizacaoMembro_Papel" AS papel,
                m."OrganizacaoMembro_Versao"::int AS membership_version
           FROM "OrganizacaoMembro" m
           JOIN "Organizacao" o
             ON o."Organizacao_TenantId"=m."OrganizacaoMembro_TenantId"
            AND o."Organizacao_Id"=m."OrganizacaoMembro_OrganizacaoId"
          WHERE m."OrganizacaoMembro_UsuarioId"=$1
            AND m."OrganizacaoMembro_Status"='ATIVO' AND o."Organizacao_Status"='ATIVA'
          ORDER BY o."Organizacao_Nome"`,
        [userId],
      );
      return r.rows;
    });
  }

  async selecionarContexto(sessao: Sessao, organizationId: string) {
    const organizacoes = await this.listarOrganizacoes(sessao.sub) as Array<{
      tenant_id: string; organization_id: string; membership_version: number; papel: string;
    }>;
    const organizacao = organizacoes.find((item) => item.organization_id === organizationId);
    if (!organizacao) throw new UnauthorizedException('Organização indisponível para esta identidade.');
    const userId = await this.usuarioId(sessao.sub);
    const ttl = sessao.papel === 'PARCEIRO' || sessao.papel === 'UNIVERSIDADE' ? 4 * 3600 : 8 * 3600;
    return {
      token: emitirToken(sessao.sub, sessao.papel, ttl, {
        uid: userId,
        tid: organizacao.tenant_id,
        oid: organizacao.organization_id,
        membershipVersion: organizacao.membership_version,
      }),
      organization_id: organizacao.organization_id,
      tenant_id: organizacao.tenant_id,
      membership_papel: organizacao.papel,
    };
  }
}
