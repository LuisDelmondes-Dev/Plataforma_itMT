import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { IndicadoresService } from './indicadores.service';
import { Recorte } from '../territorio/territorio.service';

/**
 * Onda 5 — Projeção determinística e auditável.
 *
 * Regressão linear (OLS) sobre a série histórica anual produzida pelo
 * motor (serie()), portanto cada ponto de entrada já obedece RN-003 e
 * carrega procedência. A projeção:
 *   - é ARITMÉTICA PURA: mesma série ⇒ mesma projeção (nenhum LLM,
 *     nenhuma aleatoriedade — RG-03 preservado por construção);
 *   - declara o MÉTODO e o ajuste (R²) no próprio corpo da resposta;
 *   - é categoria PROJECAO — distinta de dado observado. RN-005 segue
 *     intacto: ausência continua sendo ausência; isto aqui é um modelo
 *     declarado, nunca um "dado" silenciosamente estimado.
 */
export interface Projecao {
  indicador: string;
  unidade: string;
  local: string;
  categoria: 'PROJECAO';
  metodo: string;
  r2: number;
  observados: { ano: number; valor: number }[];
  projetados: { ano: number; valor: number }[];
  aviso: string;
}

export interface Cenarios {
  indicador: string;
  unidade: string;
  local: string;
  categoria: 'CENARIO';
  base: { ano: number; valor: number };
  observados: { ano: number; valor: number }[];
  cenarios: {
    rotulo: string;
    metodo: string;
    pontos: { ano: number; valor: number }[];
  }[];
  aviso: string;
}

@Injectable()
export class ProjecaoService {
  constructor(private readonly indicadores: IndicadoresService) {}

  async projetar(params: {
    indicadorId: number;
    recorte: Recorte;
    codigo: string | null;
    horizonte: number;
  }): Promise<Projecao> {
    const serie = await this.indicadores.serie(params);
    const pontos = serie.pontos;
    const MINIMO = 4;
    if (pontos.length < MINIMO) {
      throw new UnprocessableEntityException(
        `Projeção exige série com pelo menos ${MINIMO} pontos observados — este recorte tem ${pontos.length}. ` +
          `Sem base suficiente, nenhum número é estimado (RN-005).`,
      );
    }

    // OLS: valor = a + b·ano
    const n = pontos.length;
    const mediaX = pontos.reduce((s, p) => s + p.ano, 0) / n;
    const mediaY = pontos.reduce((s, p) => s + p.valor, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (const p of pontos) {
      sxy += (p.ano - mediaX) * (p.valor - mediaY);
      sxx += (p.ano - mediaX) ** 2;
      syy += (p.valor - mediaY) ** 2;
    }
    const b = sxy / sxx;
    const a = mediaY - b * mediaX;
    const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);

    const ultimoAno = pontos[pontos.length - 1].ano;
    const h = Math.min(Math.max(1, params.horizonte), 5);
    const projetados = Array.from({ length: h }, (_, i) => {
      const ano = ultimoAno + i + 1;
      // grandeza física não fica negativa: o piso 0 é declarado no método
      const valor = Math.max(0, Math.round((a + b * ano) * 100) / 100);
      return { ano, valor };
    });

    return {
      indicador: serie.indicador,
      unidade: serie.unidade,
      local: serie.local,
      categoria: 'PROJECAO',
      metodo:
        `Regressão linear (OLS) sobre ${pontos[0].ano}–${ultimoAno} (${n} pontos anuais do motor determinístico); ` +
        `R² = ${Math.round(r2 * 10000) / 10000}; piso 0 para grandezas não-negativas.`,
      r2: Math.round(r2 * 10000) / 10000,
      observados: pontos,
      projetados,
      aviso:
        'PROJEÇÃO declarada — não é dado observado (RN-005). Número calculado pelo motor determinístico, nunca por LLM (RG-03).',
    };
  }

  /**
   * Simulador de cenários (apoio à decisão): "e se crescer X% ao ano?".
   * Cada taxa vira uma trajetória de crescimento COMPOSTO a partir do
   * último valor observado; a tendência OLS entra como cenário de
   * referência quando a série permite (>= 4 pontos). Tudo aritmética
   * declarada — mesmos insumos ⇒ mesmos cenários; nenhum número nasce
   * fora do motor (RG-03), e cenário jamais vira "dado" (RN-005).
   */
  async cenarios(params: {
    indicadorId: number;
    recorte: Recorte;
    codigo: string | null;
    horizonte: number;
    taxas: number[];
  }): Promise<Cenarios> {
    const serie = await this.indicadores.serie(params);
    if (!serie.pontos.length) {
      throw new UnprocessableEntityException(
        'Sem observação para este recorte — sem base, nenhum cenário é simulado (RN-005).',
      );
    }
    const base = serie.pontos[serie.pontos.length - 1];
    const h = Math.min(Math.max(1, params.horizonte), 10);

    const cenarios = params.taxas.map((taxa) => ({
      rotulo: `${taxa >= 0 ? '+' : ''}${taxa}% a.a.`,
      metodo:
        `Crescimento composto de ${taxa}% ao ano sobre o último valor observado ` +
        `(${base.ano}: ${base.valor} ${serie.unidade}).`,
      pontos: Array.from({ length: h }, (_, i) => ({
        ano: base.ano + i + 1,
        valor: Math.max(0, Math.round(base.valor * Math.pow(1 + taxa / 100, i + 1) * 100) / 100),
      })),
    }));

    // Cenário de referência: a tendência OLS da própria série, quando há base.
    if (serie.pontos.length >= 4) {
      const p = await this.projetar({ ...params, horizonte: h });
      cenarios.unshift({
        rotulo: 'Tendência (OLS)',
        metodo: p.metodo,
        pontos: p.projetados,
      });
    }

    return {
      indicador: serie.indicador,
      unidade: serie.unidade,
      local: serie.local,
      categoria: 'CENARIO',
      base,
      observados: serie.pontos,
      cenarios,
      aviso:
        'CENÁRIOS declarados para apoio à decisão — hipóteses, não dados observados (RN-005). ' +
        'Cada trajetória cita o próprio método; nada aqui passou por LLM (RG-03).',
    };
  }
}
