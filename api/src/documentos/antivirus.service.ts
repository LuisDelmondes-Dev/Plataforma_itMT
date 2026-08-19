import { Injectable } from '@nestjs/common';
import { createReadStream, readFileSync } from 'node:fs';
import { connect } from 'node:net';

export interface ResultadoAntivirus {
  limpo: boolean;
  assinatura: string;
  detalhe: string;
}

@Injectable()
export class AntivirusService {
  async verificar(caminho: string): Promise<ResultadoAntivirus> {
    const modo = process.env.ANTIVIRUS_MODE ?? 'clamav';
    if (modo === 'mock' && process.env.NODE_ENV === 'test') {
      const infectado = readFileSync(caminho).includes(Buffer.from('ITMT-MOCK-MALWARE-SENTINEL'));
      return infectado
        ? { limpo: false, assinatura: 'Eicar-Signature', detalhe: 'stream: Eicar-Signature FOUND' }
        : { limpo: true, assinatura: 'mock-test', detalhe: 'stream: OK' };
    }
    if (modo !== 'clamav') throw new Error('Antivírus indisponível: configure CLAMAV_HOST.');
    return this.clamavInstream(caminho);
  }

  private clamavInstream(caminho: string): Promise<ResultadoAntivirus> {
    const host = process.env.CLAMAV_HOST ?? '127.0.0.1';
    const port = Number(process.env.CLAMAV_PORT ?? 3310);
    return new Promise((resolve, reject) => {
      const socket = connect({ host, port });
      const arquivo = createReadStream(caminho, { highWaterMark: 64 * 1024 });
      let resposta = '';
      let finalizado = false;
      const concluir = (erro?: Error) => {
        if (finalizado) return;
        finalizado = true;
        clearTimeout(timeout);
        arquivo.destroy();
        socket.destroy();
        if (erro) reject(erro);
      };
      const timeout = setTimeout(() => concluir(new Error('ClamAV excedeu 90 segundos.')), 90_000);
      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        arquivo.on('data', (parte: Buffer) => {
          arquivo.pause();
          const tamanho = Buffer.allocUnsafe(4);
          tamanho.writeUInt32BE(parte.length);
          socket.write(Buffer.concat([tamanho, parte]), () => arquivo.resume());
        });
        arquivo.on('end', () => socket.write(Buffer.alloc(4)));
        arquivo.on('error', (e) => concluir(e));
      });
      socket.on('data', (d) => { resposta += d.toString('utf8'); });
      socket.on('end', () => {
        if (finalizado) return;
        finalizado = true;
        clearTimeout(timeout);
        const detalhe = resposta.replace(/\0/g, '').trim();
        if (/\bOK$/i.test(detalhe)) {
          resolve({ limpo: true, assinatura: 'clamav', detalhe });
        } else if (/\bFOUND$/i.test(detalhe)) {
          const assinatura = detalhe.replace(/^.*?:\s*/, '').replace(/\s+FOUND$/i, '') || 'malware';
          resolve({ limpo: false, assinatura, detalhe });
        } else {
          reject(new Error(`Resposta inválida do ClamAV: ${detalhe || 'vazia'}`));
        }
      });
      socket.on('error', (e) => concluir(e));
    });
  }
}
