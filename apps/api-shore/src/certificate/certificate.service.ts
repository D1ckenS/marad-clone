/// <reference types="multer" />
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CreateCertificateDto } from './dto/create-certificate.dto';
import type { UpdateCertificateDto } from './dto/update-certificate.dto';

const DEFAULT_ALERT_DAYS = [90, 60, 30, 7];

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  create(auth: AuthContext, dto: CreateCertificateDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificate.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId ?? null,
          certificateTypeId: dto.certificateTypeId,
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
          number: dto.number ?? null,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          issuedBy: dto.issuedBy ?? null,
          notes: dto.notes ?? null,
        },
        include: { certificateType: true, attachments: true },
      }),
    );
  }

  findAll(
    auth: AuthContext,
    query: {
      subjectType?: string;
      subjectId?: string;
      vesselId?: string;
      expiringWithinDays?: number;
    },
  ) {
    const now = new Date();
    const expiryBefore =
      query.expiringWithinDays !== undefined
        ? new Date(now.getTime() + query.expiringWithinDays * 86_400_000)
        : undefined;

    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificate.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.subjectType && { subjectType: query.subjectType as never }),
          ...(query.subjectId && { subjectId: query.subjectId }),
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(expiryBefore !== undefined && {
            expiresAt: { not: null, lte: expiryBefore, gte: now },
          }),
        },
        include: { certificateType: true, attachments: { where: { deletedAt: null } } },
        orderBy: { expiresAt: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificate.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { certificateType: true, attachments: { where: { deletedAt: null } } },
      }),
    );
    if (!row) throw new NotFoundException(`Certificate ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateCertificateDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificate.update({
        where: { id },
        data: {
          ...(dto.number !== undefined && { number: dto.number }),
          ...(dto.issuedAt !== undefined && { issuedAt: new Date(dto.issuedAt) }),
          ...(dto.expiresAt !== undefined && { expiresAt: new Date(dto.expiresAt) }),
          ...(dto.issuedBy !== undefined && { issuedBy: dto.issuedBy }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        include: { certificateType: true, attachments: { where: { deletedAt: null } } },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificate.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async addAttachment(auth: AuthContext, id: string, file: Express.Multer.File) {
    const cert = await this.findOne(auth, id);
    const key = `certs/${auth.tenantId!}/${id}/${newId()}-${file.originalname}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificateAttachment.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: cert.vesselId,
          certificateId: id,
          fileName: file.originalname,
          storageKey: key,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      }),
    );
  }

  /**
   * Check all certificates in the tenant and create in-app Notification records
   * for any that are expiring within a configured alert threshold (default 90/60/30/7).
   * Skips if a notification for the same (certId, daysRemaining bucket) was already
   * created today. Logs email notifications (stubbed — SMTP wired in P5).
   */
  async checkExpiry(auth: AuthContext): Promise<{ notificationsCreated: number }> {
    const now = new Date();

    const certs = await this.prisma.withTenant(auth.tenantId!, async (tx) =>
      tx.certificate.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          expiresAt: { not: null, gte: now },
        },
        include: { certificateType: true },
      }),
    );

    let notificationsCreated = 0;

    for (const cert of certs) {
      if (!cert.expiresAt) continue;

      const alertDays: number[] = cert.certificateType.alertDaysJson
        ? (JSON.parse(cert.certificateType.alertDaysJson) as number[])
        : DEFAULT_ALERT_DAYS;

      const msRemaining = cert.expiresAt.getTime() - now.getTime();
      const daysRemaining = Math.floor(msRemaining / 86_400_000);

      // Find the smallest matching threshold (most urgent) for this cert.
      const matchingThreshold = alertDays
        .slice()
        .sort((a, b) => a - b)
        .find((t) => daysRemaining <= t);
      if (matchingThreshold === undefined) continue;

      const dedupeRefId = `${cert.id}:${matchingThreshold}`;

      const existing = await this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.notification.findFirst({
          where: { tenantId: auth.tenantId!, type: 'CERTIFICATE_EXPIRY', refId: dedupeRefId },
        }),
      );
      if (existing) continue;

      const title = `Certificate expiring in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
      const message = `"${cert.certificateType.name}" (${cert.number ?? cert.id}) expires on ${cert.expiresAt.toISOString().slice(0, 10)}.`;

      await this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.notification.create({
          data: {
            id: newId(),
            tenantId: auth.tenantId!,
            vesselId: cert.vesselId,
            type: 'CERTIFICATE_EXPIRY',
            title,
            message,
            refId: dedupeRefId,
          },
        }),
      );

      this.logger.log(
        { tenantId: auth.tenantId!, certId: cert.id, daysRemaining },
        `EMAIL_STUB: ${title} — ${message}`,
      );

      notificationsCreated++;
    }

    return { notificationsCreated };
  }
}
