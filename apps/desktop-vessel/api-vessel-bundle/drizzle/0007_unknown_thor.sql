CREATE TABLE `drill_records` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`drill_id` text NOT NULL,
	`participant_name` text NOT NULL,
	`role` text,
	`signed_at` text,
	`signature_hash` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`drill_id`) REFERENCES `drills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `drill_records_tenant_vessel_drill_idx` ON `drill_records` (`tenant_id`,`vessel_id`,`drill_id`);--> statement-breakpoint
CREATE TABLE `drill_types` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `drill_types_tenant_idx` ON `drill_types` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `drill_types_tenant_name_uniq` ON `drill_types` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE `drills` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`drill_type_id` text NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`scheduled_at` text NOT NULL,
	`conducted_at` text,
	`duration_minutes` integer,
	`location` text,
	`lead_officer` text,
	`notes` text,
	`report_key` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`drill_type_id`) REFERENCES `drill_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `drills_tenant_vessel_status_idx` ON `drills` (`tenant_id`,`vessel_id`,`status`);--> statement-breakpoint
CREATE INDEX `drills_tenant_vessel_scheduled_idx` ON `drills` (`tenant_id`,`vessel_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `permit_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`permit_id` text NOT NULL,
	`approved_by` text NOT NULL,
	`role` text NOT NULL,
	`approved_at` text NOT NULL,
	`signature_hash` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permit_id`) REFERENCES `work_permits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `permit_approvals_tenant_vessel_permit_idx` ON `permit_approvals` (`tenant_id`,`vessel_id`,`permit_id`);--> statement-breakpoint
CREATE TABLE `permit_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`permit_type` text NOT NULL,
	`name` text NOT NULL,
	`checklist_items_json` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `permit_templates_tenant_idx` ON `permit_templates` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `work_permits` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`permit_type` text NOT NULL,
	`template_id` text,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`work_description` text,
	`requested_by_user_id` text,
	`valid_from` text,
	`valid_until` text,
	`closed_at` text,
	`risk_assessment_json` text,
	`gas_test_json` text,
	`hazards_json` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `permit_templates`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "work_permits_hot_work_active_needs_risk_chk" CHECK(NOT ("work_permits"."permit_type" = 'HOT_WORK' AND "work_permits"."status" = 'ACTIVE' AND "work_permits"."risk_assessment_json" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `work_permits_tenant_vessel_status_idx` ON `work_permits` (`tenant_id`,`vessel_id`,`status`);--> statement-breakpoint
CREATE INDEX `work_permits_tenant_vessel_type_idx` ON `work_permits` (`tenant_id`,`vessel_id`,`permit_type`);