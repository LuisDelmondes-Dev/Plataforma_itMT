// ============================================================
// gancho-teste.ts — sabotagem do narrador que prova o veto A06
// (KR3.2) em test/xingu.e2e.mjs. O payload NÃO vive no caminho de
// produção: o módulo fia GanchoSabotagemA06 apenas com
// NODE_ENV=test; qualquer outro ambiente compõe o no-op. Antes
// (D-03 da fotografia de dívida), o gancho ficava no orquestrador
// atrás de NODE_ENV !== 'production' — armado em todo ambiente que
// esquecesse a variável, um denylist onde cabia composição.
// ============================================================
import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class GanchoTesteNarrativa {
  abstract aplicar(narrativa: string, sabotar: boolean): string;
}

@Injectable()
export class GanchoInerte extends GanchoTesteNarrativa {
  aplicar(narrativa: string): string {
    return narrativa;
  }
}

@Injectable()
export class GanchoSabotagemA06 extends GanchoTesteNarrativa {
  aplicar(narrativa: string, sabotar: boolean): string {
    if (!sabotar) return narrativa;
    return `${narrativa} Estima-se ainda cerca de 999999 casos adicionais.`;
  }
}
