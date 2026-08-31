import { BadRequestException, Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { IndicadoresService, RankingMunicipio } from './indicadores.service';
import { TerritorioService, Recorte } from '../territorio/territorio.service';

const RECORTES: Recorte[] = ['ESTADO', 'MUNICIPIO', 'RGINT', 'RGI', 'CONSORCIO'];

function slug(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Linha de exporta\u00e7\u00e3o a partir de uma linha do ranking do motor (P5 rodada 2:
 * indicador RECALCULO n\u00e3o materializa observa\u00e7\u00e3o pr\u00f3pria por munic\u00edpio, ent\u00e3o
 * o detalhe sai do MESMO ranking determin\u00edstico). Mesmas 9 colunas do arquivo
 * atual + `posicao` e `delta_media_estadual` ao FINAL (aditivo). A
 * `data_referencia` da linha \u00e9 a vig\u00eancia mais recente entre as parcelas da
 * proced\u00eancia; parcelas de fontes distintas s\u00e3o declaradas juntas ("A + B") \u2014
 * nunca escolhidas em sil\u00eancio. Fun\u00e7\u00e3o pura, exportada para teste unit\u00e1rio.
 */
export function linhaDeRanking(m: RankingMunicipio, unidade: string): string[] {
  const unico = (vs: string[]) => [...new Set(vs)].join(' + ');
  const dataRef = m.procedencia
    .map((p) => p.data_referencia)
    .reduce((a, b) => (a > b ? a : b));
  return [
    m.nome,
    m.codigo_ibge,
    String(m.valor),
    unidade,
    dataRef,
    unico(m.procedencia.map((p) => p.fonte)),
    unico(m.procedencia.map((p) => p.licenca)),
    unico(m.procedencia.map((p) => p.data_extracao)),
    unico(m.procedencia.map((p) => p.hash)),
    String(m.posicao),
    m.delta_media_estadual === null ? '' : String(m.delta_media_estadual),
  ];
}

/**
 * RF-PORTAL-005: exportação CSV / XLSX / PDF.
 * O arquivo leva a procedência linha a linha — o que é lido na tela é
 * idêntico ao que sai no arquivo (princípio "papel antes de tela", §15.0).
 * Nome do arquivo: itmt_{indicador}_{recorte}_{referencia} (§15.7).
 */
@Controller()
export class ExportacaoController {
  constructor(
    private readonly db: DatabaseService,
    private readonly indicadores: IndicadoresService,
    private readonly territorio: TerritorioService,
  ) {}

  @Get('indicadores/:id/exportacao')
  async exportar(
    @Param('id', ParseIntPipe) id: number,
    @Query('formato') formato: string,
    @Query('recorte') recorte: string,
    @Query('codigo') codigo: string | undefined,
    @Query('referencia') referencia: string | undefined,
    @Res() res: Response,
  ) {
    const fmt = (formato ?? 'csv').toLowerCase();
    if (!['csv', 'xlsx', 'pdf'].includes(fmt))
      throw new BadRequestException('formato deve ser csv, xlsx ou pdf.');
    const rec = (recorte ?? 'ESTADO').toUpperCase() as Recorte;
    if (!RECORTES.includes(rec)) throw new BadRequestException(`recorte inválido.`);
    if (rec !== 'ESTADO' && !codigo) throw new BadRequestException(`recorte ${rec} exige codigo.`);
    const ref = referencia ?? new Date().toISOString().slice(0, 10);

    // Agregado (valida RN-003 e produz o valor com procedência)
    const agregado = await this.indicadores.consultar({
      indicadorId: id, recorte: rec, codigo: codigo ?? null, dataReferencia: ref,
    });

    // Detalhe por município (a mesma consulta determinística, aberta)
    const { codigos } = await this.territorio.resolverRecorte(rec, codigo ?? null, ref);
    const detalhe = await this.db.query<{
      municipio: string; codigo_ibge: string; valor: string; data_referencia: string;
      fonte: string; licenca: string; data_extracao: string; hash: string;
    }>(
      `SELECT DISTINCT ON (o."Observacao_CodigoIbge")
              m."Municipio_Nome" AS municipio, o."Observacao_CodigoIbge" AS codigo_ibge,
              o."Observacao_Valor"::text AS valor, o."Observacao_DataReferencia"::text AS data_referencia,
              f."Fonte_Nome" AS fonte, f."Fonte_Licenca" AS licenca,
              c."Carga_DataExtracao"::text AS data_extracao, c."Carga_HashSha256" AS hash
         FROM "Observacao" o
         JOIN "Municipio" m ON m."Municipio_CodigoIbge" = o."Observacao_CodigoIbge"
         JOIN "Fonte" f ON f."Fonte_Id" = o."Observacao_FonteId"
         JOIN "Carga" c ON c."Carga_Id" = o."Observacao_CargaId"
        WHERE o."Observacao_IndicadorId" = $1
          AND o."Observacao_CodigoIbge" = ANY($2)
          AND o."Observacao_DataReferencia" <= $3::date
        ORDER BY o."Observacao_CodigoIbge", o."Observacao_DataReferencia" DESC`,
      [id, codigos, ref],
    );

    const nome = `itmt_${slug(agregado.indicador)}_${slug(agregado.local)}_${ref}`;
    const colunas = ['municipio', 'codigo_ibge', 'valor', 'unidade', 'data_referencia', 'fonte', 'licenca', 'data_extracao', 'hash_bronze'];
    let linhas: string[][];
    if (agregado.agregacao === 'RECALCULO' || detalhe.rows.length === 0) {
      // RECALCULO (taxa) não materializa observação própria por município —
      // a consulta direta acima volta vazia e o arquivo saía só com o
      // cabeçalho (gap P5 rodada 2). O detalhe vem do MESMO ranking
      // determinístico do motor, filtrado ao recorte pedido; `posicao` e
      // `delta_media_estadual` entram ao FINAL (aditivo, não quebra
      // consumidores). O ramo por vazio cobre também MUNICIPIO+RECALCULO,
      // cujo `agregacao` é VALOR_MUNICIPAL.
      const ranking = await this.indicadores.ranking({ indicadorId: id, referencia: ref });
      const dentro = new Set(codigos);
      colunas.push('posicao', 'delta_media_estadual');
      linhas = ranking.municipios
        .filter((m) => dentro.has(m.codigo_ibge))
        .map((m) => linhaDeRanking(m, agregado.unidade));
    } else {
      linhas = detalhe.rows.map((d) => [
        d.municipio, d.codigo_ibge, d.valor, agregado.unidade, d.data_referencia,
        d.fonte, d.licenca, d.data_extracao, d.hash,
      ]);
    }

    if (fmt === 'csv') {
      const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      const csv = [colunas.join(';'), ...linhas.map((l) => l.map(esc).join(';'))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nome}.csv"`);
      return res.send('\ufeff' + csv); // BOM para Excel pt-BR
    }

    if (fmt === 'xlsx') {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Dados');
      ws.addRow([`${agregado.indicador} — ${agregado.local} (ref. ${ref})`]).font = { bold: true };
      ws.addRow([`Agregação: ${agregado.agregacao} · Valor agregado: ${agregado.valor} ${agregado.unidade}`]);
      ws.addRow([]);
      const cab = ws.addRow(colunas);
      cab.font = { bold: true };
      for (const l of linhas)
        ws.addRow(l.map((v, i) => ((i === 2 || i === 9 || i === 10) && v !== '' ? Number(v) : v)));
      ws.columns.forEach((c) => { c.width = 22; });
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nome}.xlsx"`);
      return res.send(Buffer.from(buf));
    }

    // PDF — com a régua de procedência desenhada (§15.0: onde ela não
    // couber, o número não pode aparecer; portanto, ela vai no PDF)
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}.pdf"`);
    doc.pipe(res);

    const tinta = '#191C1D', cinza = '#43474F', borda = '#C4C6D0';
    doc.fillColor(cinza).fontSize(8).font('Courier')
      .text('+ ITMT — INTELIGENCIA TERRITORIAL DE MATO GROSSO', { characterSpacing: 1 });
    doc.moveDown(0.6);
    doc.fillColor(tinta).font('Helvetica-Bold').fontSize(16)
      .text(`${agregado.indicador} — ${agregado.local}`);
    doc.moveDown(0.8);
    doc.font('Courier-Bold').fontSize(26).text(
      `${new Intl.NumberFormat('pt-BR').format(agregado.valor)} ${agregado.unidade}`,
    );

    // Régua de procedência
    const p = agregado.procedencia[0];
    const y = doc.y + 6, x0 = doc.x, larg = 300;
    doc.moveTo(x0, y).lineTo(x0 + larg, y).lineWidth(1).strokeColor(borda).stroke();
    for (let t = 0; t <= larg; t += 25) {
      doc.moveTo(x0 + t, y - 4).lineTo(x0 + t, y).stroke();
    }
    doc.moveDown(0.4);
    doc.font('Courier').fontSize(8).fillColor(cinza).text(
      `${p.fonte} · ref. ${p.data_referencia.slice(0, 4)} · extraído em ${p.data_extracao.slice(0, 10)} · ${p.licenca}`,
    );
    doc.fontSize(7).text(`hash bronze: ${p.hash}`);
    if (agregado.municipios_agregados) {
      doc.moveDown(0.3).fontSize(8)
        .text(`Agregação ${agregado.agregacao} sobre ${agregado.municipios_agregados} município(s) — RN-003.`);
    }

    // Tabela de detalhe
    doc.moveDown(1.2).fillColor(tinta).font('Helvetica-Bold').fontSize(10).text('Detalhe por município');
    doc.moveDown(0.4);
    const cols = [170, 70, 90, 90];
    const cab2 = ['Município', 'Código', 'Valor', 'Referência'];
    let yy = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    let xx = x0;
    cab2.forEach((c, i) => { doc.text(c, xx, yy, { width: cols[i] }); xx += cols[i]; });
    yy += 14;
    doc.font('Helvetica').fillColor(tinta);
    // `linhas` (não `detalhe.rows`): assim o PDF também cobre RECALCULO,
    // cujo detalhe vem do ranking. Índices 0/1/2/4 = município, código,
    // valor, data_referencia — mesmas colunas do CSV.
    for (const l of linhas) {
      if (yy > 760) { doc.addPage(); yy = 48; }
      xx = x0;
      const vals = [l[0], l[1],
        new Intl.NumberFormat('pt-BR').format(Number(l[2])), l[4]];
      vals.forEach((v, i) => { doc.text(String(v), xx, yy, { width: cols[i] }); xx += cols[i]; });
      yy += 12;
    }
    doc.fontSize(7).fillColor(cinza)
      .text(`Gerado pela Plataforma ITMT em ${new Date().toISOString().slice(0, 10)}. ` +
        `A plataforma é camada de acesso e sempre aponta para a origem.`, x0, 790);
    doc.end();
  }
}
