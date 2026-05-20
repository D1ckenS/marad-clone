import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Placeholder endpoints for UI tabs whose backend schemas are not yet implemented.
 *
 * The shore web UI references these endpoints from Certificates, Safety and QHSE
 * pages (surveys, conditions of class, inspections, JHAs, safety equipment,
 * QHSE objectives, audits, etc). Returning `[]` keeps the UI silent (no 404 noise
 * in the console, no wasted re-fetches) and lets the affected tabs render their
 * "no records" empty state cleanly.
 *
 * Replace each route with a real module + schema as those features are designed.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class DeferredStubsController {
  // Certificates tabs
  @Get('surveys') surveys() {
    return [];
  }
  @Get('conditions-of-class') conditionsOfClass() {
    return [];
  }
  @Get('inspections') inspections() {
    return [];
  }

  // Safety tabs
  @Get('jhas') jhas() {
    return [];
  }
  @Get('safety-equipment') safetyEquipment() {
    return [];
  }

  // QHSE tabs
  @Get('qhse-objectives') qhseObjectives() {
    return [];
  }
  @Get('audits') audits() {
    return [];
  }
  @Get('audit-findings') auditFindings() {
    return [];
  }
  @Get('voyage-legs') voyageLegs() {
    return [];
  }
  @Get('discharge-logs') dischargeLogs() {
    return [];
  }
  @Get('drybms-elements') drybmsElements() {
    return [];
  }
  @Get('management-reviews') managementReviews() {
    return [];
  }
}
