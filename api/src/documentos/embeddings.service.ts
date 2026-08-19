import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const DIMENSOES = 1536;

@Injectable()
export class EmbeddingsService {
  get modelo() { return process.env.EMBEDDINGS_MODELO ?? 'text-embedding-3-small'; }
  get habilitado() { return ['openai', 'hash-test'].includes(process.env.EMBEDDINGS_PROVIDER ?? 'disabled'); }

  async gerar(textos: string[]): Promise<number[][]> {
    if (!textos.length) return [];
    const provedor = process.env.EMBEDDINGS_PROVIDER ?? 'disabled';
    if (provedor === 'hash-test' && process.env.NODE_ENV === 'test') return textos.map((t) => this.hashEmbedding(t));
    if (provedor !== 'openai') throw new Error('Provedor de embeddings desabilitado.');
    const chave = process.env.OPENAI_API_KEY;
    if (!chave) throw new Error('OPENAI_API_KEY ausente para gerar embeddings.');
    const r = await fetch(process.env.EMBEDDINGS_URL ?? 'https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.modelo, input: textos, encoding_format: 'float' }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) {
      const corpo = await r.text();
      throw new Error(`Embeddings falharam (${r.status}): ${corpo.slice(0, 300)}`);
    }
    const d = await r.json() as { data?: Array<{ index: number; embedding: number[] }> };
    const ordenados = [...(d.data ?? [])].sort((a, b) => a.index - b.index).map((x) => x.embedding);
    if (ordenados.length !== textos.length || ordenados.some((v) => v.length !== DIMENSOES || v.some((n) => !Number.isFinite(n))))
      throw new Error(`Resposta de embeddings incompatível; esperado vetor(${DIMENSOES}).`);
    return ordenados;
  }

  hashConteudo(texto: string) { return createHash('sha256').update(texto).digest('hex'); }

  private hashEmbedding(texto: string) {
    const vetor = new Array<number>(DIMENSOES).fill(0);
    for (const token of texto.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]{2,}/g) ?? []) {
      const h = createHash('sha256').update(token).digest();
      const indice = h.readUInt16BE(0) % DIMENSOES;
      vetor[indice] += h[2] % 2 ? 1 : -1;
    }
    const norma = Math.sqrt(vetor.reduce((s, n) => s + n * n, 0)) || 1;
    return vetor.map((n) => n / norma);
  }
}

