import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { PurchaseOrder, POLine, Supplier, Vessel } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

type PoWithRelations = PurchaseOrder & {
  supplier: Pick<Supplier, 'name' | 'contactEmail'> | null;
  vessel: Pick<Vessel, 'name'>;
  lines: Pick<POLine, 'description' | 'quantity' | 'unitPrice' | 'totalPrice' | 'currency'>[];
};

type ExportFormat = 'csv' | 'exact' | 'xlsx';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  getConfig(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.accountingConnector.findFirst({ where: { tenantId: auth.tenantId! } }),
    );
  }

  upsertConfig(
    auth: AuthContext,
    dto: { provider: string; config?: Record<string, unknown>; enabled?: boolean },
  ) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.accountingConnector.upsert({
        where: { tenantId: auth.tenantId! },
        create: {
          id: newId(),
          tenantId: auth.tenantId!,
          provider: dto.provider as never,
          config: (dto.config as never) ?? {},
          enabled: dto.enabled ?? true,
        },
        update: {
          provider: dto.provider as never,
          ...(dto.config !== undefined && { config: dto.config as never }),
          ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        },
      }),
    );
  }

  async exportPos(
    auth: AuthContext,
    from: string,
    to: string,
    format: ExportFormat,
  ): Promise<string | Buffer> {
    const pos: PoWithRelations[] = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.purchaseOrder.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          status: { notIn: ['DRAFT'] },
          createdAt: { gte: new Date(from), lte: new Date(`${to}T23:59:59Z`) },
        },
        include: {
          supplier: { select: { name: true, contactEmail: true } },
          vessel: { select: { name: true } },
          lines: {
            where: { deletedAt: null },
            select: {
              description: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              currency: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );

    if (format === 'xlsx') return this.toXlsx(pos);
    if (format === 'csv') return this.toCsv(pos);
    return this.toExactOnline(pos);
  }

  // ── Formatters ─────────────────────────────────────────────────────────────

  private toCsv(pos: PoWithRelations[]) {
    const header = 'PO Number,Title,Status,Supplier,Vessel,Total Amount,Currency,Created Date';
    const rows = pos.map((p) =>
      [
        p.poNumber ?? '',
        `"${p.title.replace(/"/g, '""')}"`,
        p.status,
        `"${(p.supplier?.name ?? '').replace(/"/g, '""')}"`,
        `"${p.vessel.name.replace(/"/g, '""')}"`,
        p.totalAmount.toString(),
        p.currency,
        p.createdAt.toISOString().split('T')[0],
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  private toExactOnline(pos: PoWithRelations[]) {
    // Exact Online purchase journal import format (simplified XML).
    const lines = pos
      .map(
        (po) => `  <PurchaseEntry>
    <Journal>20</Journal>
    <EntryDate>${po.createdAt.toISOString().split('T')[0]}</EntryDate>
    <ExternalLinkDescription>${po.poNumber ?? po.id}</ExternalLinkDescription>
    <Supplier>${po.supplier?.name ?? 'Unknown'}</Supplier>
    <Lines>
${po.lines
  .map(
    (l) => `      <Line>
        <Description>${l.description}</Description>
        <Quantity>${l.quantity}</Quantity>
        <UnitPrice>${l.unitPrice}</UnitPrice>
        <AmountDC>${l.totalPrice}</AmountDC>
        <Currency>${l.currency}</Currency>
      </Line>`,
  )
  .join('\n')}
    </Lines>
  </PurchaseEntry>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ExactOnlineImport xmlns="urn:exact:finance:purchase:v1" version="1.0">
${lines}
</ExactOnlineImport>`;
  }

  private async toXlsx(pos: PoWithRelations[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'FleetOps';
    wb.created = new Date();

    const ws = wb.addWorksheet('Purchase Orders');

    // Header row
    ws.columns = [
      { header: 'PO Number', key: 'poNumber', width: 18 },
      { header: 'Title', key: 'title', width: 36 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Supplier', key: 'supplier', width: 28 },
      { header: 'Vessel', key: 'vessel', width: 22 },
      { header: 'Total Amount', key: 'totalAmount', width: 16 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Created Date', key: 'createdAt', width: 14 },
    ];

    // Style header row — navy background, white bold text
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1F33' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle' };
    });
    ws.getRow(1).height = 22;

    // Data rows
    for (const p of pos) {
      ws.addRow({
        poNumber: p.poNumber ?? '',
        title: p.title,
        status: p.status,
        supplier: p.supplier?.name ?? '',
        vessel: p.vessel.name,
        totalAmount: parseFloat(p.totalAmount.toString()),
        currency: p.currency,
        createdAt: p.createdAt.toISOString().split('T')[0],
      });
    }

    // Format the Total Amount column as a number
    ws.getColumn('totalAmount').numFmt = '#,##0.00';

    // Alternating row fill for readability
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const fill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowNum % 2 === 0 ? 'FFF4F2EC' : 'FFFFFFFF' },
      };
      row.eachCell((cell) => {
        cell.fill = fill;
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFEEEBE2' } },
        };
      });
    });

    // Summary row — total amount
    if (pos.length > 0) {
      const sumRow = ws.addRow({
        poNumber: '',
        title: 'TOTAL',
        status: '',
        supplier: '',
        vessel: '',
        totalAmount: pos.reduce((s, p) => s + parseFloat(p.totalAmount.toString()), 0),
        currency: pos[0]!.currency,
        createdAt: '',
      });
      sumRow.getCell('title').font = { bold: true };
      sumRow.getCell('totalAmount').font = { bold: true };
      sumRow.getCell('totalAmount').numFmt = '#,##0.00';
    }

    // Freeze header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    return wb.xlsx.writeBuffer() as Promise<unknown> as Promise<Buffer>;
  }
}
