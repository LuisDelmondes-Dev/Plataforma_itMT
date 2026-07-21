import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

interface LoginDto {
  email: string;
  senha: string;
}

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
}
