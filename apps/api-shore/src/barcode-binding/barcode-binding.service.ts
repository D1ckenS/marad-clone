import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBarcodeBindingDto } from './dto/create-barcode-binding.dto';

@Injectable()
export class BarcodeBindingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(auth: AuthContext, partId?: string) {
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.barcodeBinding.findMany({
        where: { tenantId: auth.tenantId, deletedAt: null, ...(partId && { partId }) },
        orderBy: { barcode: 'asc' },
      }),
    );
  }

  async create(auth: AuthContext, dto: CreateBarcodeBindingDto) {
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const existing = await tx.barcodeBinding.findFirst({
        where: { tenantId: auth.tenantId, barcode: dto.barcode, deletedAt: null },
      });
      if (existing) throw new ConflictException(`Barcode ${dto.barcode} is already bound`);
      return tx.barcodeBinding.create({
        data: { id: newId(), tenantId: auth.tenantId, partId: dto.partId, barcode: dto.barcode },
      });
    });
  }

  async lookup(auth: AuthContext, barcode: string) {
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.barcodeBinding.findFirst({
        where: { tenantId: auth.tenantId, barcode, deletedAt: null },
        include: { part: true },
      }),
    );
    if (row === null) throw new NotFoundException(`Barcode ${barcode} not found`);
    return row;
  }

  async softDelete(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.barcodeBinding.findFirst({ where: { id, tenantId: auth.tenantId, deletedAt: null } }),
    );
    if (row === null) throw new NotFoundException(`BarcodeBinding ${id} not found`);
    await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.barcodeBinding.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
