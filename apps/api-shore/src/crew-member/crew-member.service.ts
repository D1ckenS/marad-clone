import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCrewMemberDto, UpdateCrewMemberDto } from './dto/create-crew-member.dto';

@Injectable()
export class CrewMemberService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateCrewMemberDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewMember.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          rank: dto.rank,
          nationality: dto.nationality ?? null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          signOnDate: dto.signOnDate ? new Date(dto.signOnDate) : null,
        },
        include: {
          rotations: { where: { deletedAt: null } },
          crewCertificates: { where: { deletedAt: null } },
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; status?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewMember.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.status && { status: query.status as never }),
        },
        include: {
          rotations: { where: { deletedAt: null } },
          crewCertificates: { where: { deletedAt: null } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewMember.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: {
          rotations: { where: { deletedAt: null } },
          crewCertificates: { where: { deletedAt: null } },
          restHourEntries: { where: { deletedAt: null }, orderBy: { date: 'desc' }, take: 14 },
        },
      }),
    );
    if (!row) throw new NotFoundException(`CrewMember ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateCrewMemberDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewMember.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.rank !== undefined && { rank: dto.rank }),
          ...(dto.nationality !== undefined && { nationality: dto.nationality }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.status !== undefined && { status: dto.status as never }),
          ...(dto.signOnDate !== undefined && {
            signOnDate: dto.signOnDate ? new Date(dto.signOnDate) : null,
          }),
          ...(dto.signOffDate !== undefined && {
            signOffDate: dto.signOffDate ? new Date(dto.signOffDate) : null,
          }),
        },
        include: {
          rotations: { where: { deletedAt: null } },
          crewCertificates: { where: { deletedAt: null } },
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewMember.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
