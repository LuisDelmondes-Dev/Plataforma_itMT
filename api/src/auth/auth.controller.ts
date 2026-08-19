import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Papeis, PapeisGuard } from './papeis.guard';
import { Papel, Sessao } from './token';

interface LoginDto {
  email: string;
  senha: string;
}
interface UsuarioDto {
  email: string;
  senha: string;
  papel: Papel;
}
interface ContextoDto { organization_id: string }

const PAPEIS_VALIDOS: Papel[] = ['ADMIN', 'CURADOR', 'PUBLICO', 'PARCEIRO', 'UNIVERSIDADE'];

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** RF012: emite token de sessão a partir de e-mail+senha. */
  @Post('login')
  login(@Body() dto: LoginDto) {
    if (!dto?.email || !dto?.senha || typeof dto.email !== 'string' || typeof dto.senha !== 'string') {
      throw new BadRequestException('Envie { email, senha }.');
    }
    return this.auth.login(dto.email, dto.senha);
  }

  @Get('organizacoes')
  @UseGuards(PapeisGuard)
  listarOrganizacoes(@Req() req: { usuario: Sessao }) {
    return this.auth.listarOrganizacoes(req.usuario.sub);
  }

  @Post('contexto')
  @UseGuards(PapeisGuard)
  selecionarContexto(@Req() req: { usuario: Sessao }, @Body() dto: ContextoDto) {
    if (!dto?.organization_id || typeof dto.organization_id !== 'string')
      throw new BadRequestException('Envie { organization_id }.');
    return this.auth.selecionarContexto(req.usuario, dto.organization_id);
  }

  /** Criação de conta (parceiro/universidade/curador) — só ADMIN. */
  @Post('usuarios')
  @UseGuards(PapeisGuard)
  @Papeis('ADMIN')
  criarUsuario(@Body() dto: UsuarioDto) {
    if (!dto?.email || !dto?.senha || !PAPEIS_VALIDOS.includes(dto?.papel)) {
      throw new BadRequestException(`Envie { email, senha, papel ∈ ${PAPEIS_VALIDOS.join('|')} }.`);
    }
    if (dto.senha.length < 8) throw new BadRequestException('Senha com pelo menos 8 caracteres.');
    return this.auth.criarUsuario(dto.email, dto.senha, dto.papel);
  }
}
