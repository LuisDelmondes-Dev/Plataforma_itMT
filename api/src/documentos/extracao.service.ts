import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export interface ResultadoExtracao {
  texto: string;
  metodo: string;
  confianca: number;
  status: 'PROCESSADO' | 'REVISAO_NECESSARIA';
}

@Injectable()
export class ExtracaoService {
  normalizar(texto: string) {
    return texto.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n').trim().slice(0, 2_000_000);
  }

  extrair(caminho: string, mime: string): ResultadoExtracao {
    if (mime.startsWith('text/') || mime === 'application/json') {
      const texto = this.normalizar(readFileSync(caminho, 'utf8'));
      return texto
        ? { texto, metodo: 'TEXTO_NATIVO', confianca: 1, status: 'PROCESSADO' }
        : { texto: '', metodo: 'TEXTO_NATIVO', confianca: 0, status: 'REVISAO_NECESSARIA' };
    }
    const comando = mime === 'application/pdf' ? 'pdftotext' : 'tesseract';
    const args = mime === 'application/pdf'
      ? ['-layout', caminho, '-']
      : [caminho, 'stdout', '-l', 'por'];
    const r = spawnSync(comando, args, { encoding: 'utf8', timeout: 60_000, maxBuffer: 4_000_000 });
    const texto = this.normalizar(r.stdout ?? '');
    if (r.status === 0 && texto.length >= 20) {
      return {
        texto,
        metodo: mime === 'application/pdf' ? 'PDFTOTEXT' : 'TESSERACT_POR',
        confianca: mime === 'application/pdf' ? 0.95 : 0.75,
        status: mime === 'application/pdf' ? 'PROCESSADO' : 'REVISAO_NECESSARIA',
      };
    }
    return { texto: '', metodo: comando.toUpperCase(), confianca: 0, status: 'REVISAO_NECESSARIA' };
  }
}

