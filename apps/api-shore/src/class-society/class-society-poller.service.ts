import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClassSocietyService } from './class-society.service';

/**
 * Cron-driven poller for class-society submissions in flight (H9).
 *
 * Walks the oldest-polled SUBMITTED rows every 6 hours, asks the society
 * for its current decision, and transitions to ACCEPTED / REJECTED when
 * the response says so. Designed to coexist with the inbound webhook
 * path — both are wired against the same service method on the same
 * submission rows, so whichever signal arrives first wins.
 *
 * Disabled with CLASS_SOCIETY_POLLER_DISABLED=1 in test env so e2e tests
 * can drive `pollPendingSubmissions()` synchronously without the cron
 * racing them.
 */
@Injectable()
export class ClassSocietyPollerService {
  private readonly log = new Logger(ClassSocietyPollerService.name);

  constructor(private readonly svc: ClassSocietyService) {}

  @Cron(CronExpression.EVERY_6_HOURS, { name: 'class-society-poller' })
  async tick(): Promise<void> {
    if (process.env['CLASS_SOCIETY_POLLER_DISABLED'] === '1') return;
    try {
      const r = await this.svc.pollPendingSubmissions();
      if (r.polled > 0) {
        this.log.log(
          `polled ${r.polled} submissions → ${r.accepted} accepted, ${r.rejected} rejected, ${r.errors} errors`,
        );
      }
    } catch (err) {
      this.log.error(`poller tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
