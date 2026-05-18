import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId, checkMlcRestHours } from '@fleetops/domain';
import type { RestHourDay } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateRestHourEntryDto,
  UpdateRestHourEntryDto,
} from './dto/create-rest-hour-entry.dto';

@Injectable()
export class RestHourEntryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AuthContext, dto: CreateRestHourEntryDto) {
    const hoursWorked: boolean[] = JSON.parse(dto.hoursWorkedJson) as boolean[];
    if (!Array.isArray(hoursWorked) || hoursWorked.length !== 24) {
      throw new BadRequestException('hoursWorkedJson must be a JSON array of exactly 24 booleans');
    }

    const existing = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.restHourEntry.findMany({
        where: { crewMemberId: dto.crewMemberId, tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { date: 'desc' },
        take: 6,
      }),
    );

    const window: RestHourDay[] = [
      ...existing.map((e) => ({
        date: e.date,
        hoursWorked: JSON.parse(e.hoursWorkedJson) as boolean[],
      })),
      { date: dto.date, hoursWorked },
    ];
    const mlcResult = checkMlcRestHours(window);

    if (!mlcResult.valid) {
      throw new BadRequestException({
        message: 'MLC 2006 rest-hour violation',
        violations: mlcResult.violations,
      });
    }

    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.restHourEntry.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          crewMemberId: dto.crewMemberId,
          date: dto.date,
          hoursWorkedJson: dto.hoursWorkedJson,
          mlcValid: mlcResult.valid,
          notes: dto.notes ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; crewMemberId?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.restHourEntry.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.crewMemberId && { crewMemberId: query.crewMemberId }),
        },
        orderBy: { date: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.restHourEntry.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`RestHourEntry ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateRestHourEntryDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.restHourEntry.update({
        where: { id },
        data: {
          ...(dto.hoursWorkedJson !== undefined && { hoursWorkedJson: dto.hoursWorkedJson }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.restHourEntry.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
