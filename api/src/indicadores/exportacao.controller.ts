import { BadRequestException, Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { IndicadoresService } from './indicadores.service';
import { TerritorioService, Recorte } from '../territorio/territorio.service';

const RECORTES: Recorte[] = ['ESTADO', 'MUNICIPIO', 'RGINT', 'RGI', 'CONSORCIO'];

function slug(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
    const linhas = detalhe.rows.map((d) => [
      d.municipio, d.codigo_ibge, d.valor, agregado.unidade, d.data_referencia,
      d.fonte, d.licenca, d.data_extracao, d.hash,
    ]);

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
      for (const l of linhas) ws.addRow(l.map((v, i) => (i === 2 ? Number(v) : v)));
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

    const tinta = '#14181A', cinza = '#6F787E', borda = '#C7CCD1';
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
    for (const d of detalhe.rows) {
      if (yy > 760) { doc.addPage(); yy = 48; }
      xx = x0;
      const vals = [d.municipio, d.codigo_ibge,
        new Intl.NumberFormat('pt-BR').format(Number(d.valor)), d.data_referencia];
      vals.forEach((v, i) => { doc.text(String(v), xx, yy, { width: cols[i] }); xx += cols[i]; });
      yy += 12;
    }
    doc.fontSize(7).fillColor(cinza)
      .text(`Gerado pela Plataforma ITMT em ${new Date().toISOString().slice(0, 10)}. ` +
        `A plataforma é camada de acesso e sempre aponta para a origem.`, x0, 790);
    doc.end();
  }
}
