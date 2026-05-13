import { Module } from '@nestjs/common';
import { ApprovalFlowController } from './approval-flow.controller';
import { ApprovalFlowService } from './approval-flow.service';

@Module({
  controllers: [ApprovalFlowController],
  providers: [ApprovalFlowService],
  exports: [ApprovalFlowService],
})
export class ApprovalFlowModule {}
