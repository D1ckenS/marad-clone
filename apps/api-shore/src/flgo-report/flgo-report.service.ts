import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

// IMO DCS — Data Collection System for fuel oil consumption (MARPOL Annex VI Reg 22A).
// EU MRV — Monitoring, Reporting, Verification of CO2 (EU Reg 2015/757).
// CII — Carbon Intensity Indicator (annual rating per vessel, IMO MEPC.339(76)).

@Injectable()
export class FlgoReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getImoDcsXml(auth: AuthContext, vesselId: string, year: number): Promise<string> {
    const tenantId = auth.tenantId!;
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const [vessel, bdns, consumptions] = await Promise.all([
      this.prisma.withTenant(tenantId, (tx) =>
        tx.vessel.findFirst({ where: { id: vesselId, tenantId } }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.bunkerDeliveryNote.findMany({
          where: { vesselId, tenantId, deletedAt: null, deliveryDate: { gte: from, lte: to } },
          include: { fuelProduct: true },
          orderBy: { deliveryDate: 'asc' },
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.consumptionLog.findMany({
          where: { vesselId, tenantId, deletedAt: null, logDate: { gte: from, lte: to } },
          include: { fuelProduct: true },
          orderBy: { logDate: 'asc' },
        }),
      ),
    ]);

    if (!vessel) throw new NotFoundException(`Vessel ${vesselId} not found`);

    const totalBunkerMt = bdns.reduce((s, b) => s + parseFloat(b.quantityMt.toString()), 0);
    const totalConsumptionMt = consumptions.reduce(
      (s, c) => s + parseFloat(c.consumptionMt.toString()),
      0,
    );

    // Group consumption by fuel type for MARPOL reporting
    const byFuelType: Record<string, number> = {};
    for (const c of consumptions) {
      const key = c.fuelProduct?.tankType ?? 'OTHER';
      byFuelType[key] = (byFuelType[key] ?? 0) + parseFloat(c.consumptionMt.toString());
    }

    const fuelElements = Object.entries(byFuelType)
      .map(
        ([fuelType, mt]) =>
          `      <FuelConsumption fuelType="${fuelType}" massConsumedMT="${mt.toFixed(3)}" />`,
      )
      .join('\n');

    const bdnElements = bdns
      .map(
        (b) =>
          `      <BunkerDelivery date="${b.deliveryDate}" quantityMT="${b.quantityMt}" sulphurPct="${b.sulphurPct ?? ''}" grade="${b.grade ?? ''}" bdnNumber="${b.bdnNumber ?? ''}" />`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<IMO_DCS version="1.0" reportingYear="${year}">
  <Vessel imoNumber="${vessel.imoNumber ?? ''}" name="${vessel.name}" />
  <ReportingPeriod from="${from}" to="${to}" />
  <FuelOilConsumption totalMT="${totalConsumptionMt.toFixed(3)}">
${fuelElements}
  </FuelOilConsumption>
  <BunkerDeliveries totalMT="${totalBunkerMt.toFixed(3)}">
${bdnElements}
  </BunkerDeliveries>
</IMO_DCS>`;
  }

  async getEuMrvSummary(auth: AuthContext, vesselId: string, year: number) {
    const tenantId = auth.tenantId!;
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const [vessel, consumptions, bdns] = await Promise.all([
      this.prisma.withTenant(tenantId, (tx) =>
        tx.vessel.findFirst({ where: { id: vesselId, tenantId } }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.consumptionLog.findMany({
          where: { vesselId, tenantId, deletedAt: null, logDate: { gte: from, lte: to } },
          include: { fuelProduct: true },
        }),
      ),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.bunkerDeliveryNote.findMany({
          where: { vesselId, tenantId, deletedAt: null, deliveryDate: { gte: from, lte: to } },
          include: { fuelProduct: true },
        }),
      ),
    ]);

    if (!vessel) throw new NotFoundException(`Vessel ${vesselId} not found`);

    // CO2 emission factors (tonnes CO2 per tonne fuel) — IMO MEPC.1/Circ.795
    const co2Factor: Record<string, number> = {
      HFO: 3.114,
      LSFO: 3.114,
      MDO: 3.206,
      MGO: 3.206,
      LSMGO: 3.206,
      ULSFO: 3.151,
      LNG: 2.75,
      OTHER: 3.114,
    };

    const totalConsumptionMt = consumptions.reduce(
      (s, c) => s + parseFloat(c.consumptionMt.toString()),
      0,
    );
    const totalCo2Mt = consumptions.reduce((s, c) => {
      const mt = parseFloat(c.consumptionMt.toString());
      const factor = co2Factor[c.fuelProduct?.tankType ?? 'OTHER'] ?? 3.114;
      return s + mt * factor;
    }, 0);

    const byVoyageLeg = consumptions.reduce<Record<string, number>>((acc, c) => {
      const leg = c.voyageLeg ?? 'UNSPECIFIED';
      acc[leg] = (acc[leg] ?? 0) + parseFloat(c.consumptionMt.toString());
      return acc;
    }, {});

    return {
      vessel: { id: vessel.id, name: vessel.name, imoNumber: vessel.imoNumber },
      reportingYear: year,
      regulation: 'EU MRV (Regulation 2015/757/EU)',
      totalFuelConsumptionMt: parseFloat(totalConsumptionMt.toFixed(3)),
      totalCo2EmissionsMt: parseFloat(totalCo2Mt.toFixed(3)),
      totalBunkeringMt: parseFloat(
        bdns.reduce((s, b) => s + parseFloat(b.quantityMt.toString()), 0).toFixed(3),
      ),
      consumptionByVoyageLeg: byVoyageLeg,
      recordCount: { consumptionLogs: consumptions.length, bunkerDeliveries: bdns.length },
    };
  }

  async getCiiRating(auth: AuthContext, vesselId: string, year: number) {
    const euMrv = await this.getEuMrvSummary(auth, vesselId, year);

    // CII formula: CO2 / (DWT × distance). We don't yet store voyage distance,
    // so we return the CO2 total and mark the rating as PENDING_DISTANCE_DATA.
    // When voyage data is available (P3-2+), CII can be computed precisely.
    return {
      vessel: euMrv.vessel,
      reportingYear: year,
      regulation: 'IMO MEPC.339(76) — CII',
      totalCo2EmissionsMt: euMrv.totalCo2EmissionsMt,
      ciiRating: 'PENDING_DISTANCE_DATA',
      note: 'CII final rating requires voyage distance data. Log consumption per voyage leg to enable full computation.',
    };
  }
}
