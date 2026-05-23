CREATE TABLE `audit_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`audit_id` text,
	`classification` text NOT NULL,
	`sms_ref` text,
	`title` text NOT NULL,
	`detail` text,
	`owner` text,
	`opened_at` text NOT NULL,
	`due_at` text,
	`closed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_findings_tenant_vessel_idx` ON `audit_findings` (`tenant_id`,`vessel_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text,
	`kind` text NOT NULL,
	`scope` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`auditor` text NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`findings` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audits_tenant_vessel_idx` ON `audits` (`tenant_id`,`vessel_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `conditions_of_class` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`raised_at` text NOT NULL,
	`opened_at` text NOT NULL,
	`due_at` text,
	`closed_at` text,
	`linked_certificate_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `coc_tenant_vessel_idx` ON `conditions_of_class` (`tenant_id`,`vessel_id`,`severity`);--> statement-breakpoint
CREATE TABLE `discharge_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL,
	`location` text NOT NULL,
	`volume` text NOT NULL,
	`notes` text,
	`compliant` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `discharge_logs_tenant_vessel_idx` ON `discharge_logs` (`tenant_id`,`vessel_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `drybms_elements` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`chapter` text NOT NULL,
	`chapter_title` text NOT NULL,
	`name` text NOT NULL,
	`score` integer DEFAULT 1 NOT NULL,
	`stage` text,
	`evidence` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `drybms_elements_tenant_chapter_idx` ON `drybms_elements` (`tenant_id`,`chapter`);--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`inspected_at` text NOT NULL,
	`kind` text NOT NULL,
	`mou` text,
	`port` text NOT NULL,
	`inspector` text NOT NULL,
	`deficiencies` integer DEFAULT 0 NOT NULL,
	`detained` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`findings` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inspections_tenant_vessel_idx` ON `inspections` (`tenant_id`,`vessel_id`,`inspected_at`);--> statement-breakpoint
CREATE TABLE `jhas` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`ref` text NOT NULL,
	`title` text NOT NULL,
	`activity` text,
	`hazards` text NOT NULL,
	`controls` text NOT NULL,
	`residual_l` integer DEFAULT 1 NOT NULL,
	`residual_s` integer DEFAULT 1 NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `jhas_tenant_ref_idx` ON `jhas` (`tenant_id`,`ref`);--> statement-breakpoint
CREATE TABLE `management_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`kind` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`chair` text NOT NULL,
	`attendees` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`actions_total` integer DEFAULT 0 NOT NULL,
	`actions_done` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `management_reviews_tenant_idx` ON `management_reviews` (`tenant_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `qhse_objectives` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`target` text NOT NULL,
	`actual` text NOT NULL,
	`unit` text NOT NULL,
	`status` text DEFAULT 'GREEN' NOT NULL,
	`delta` text,
	`trend` text,
	`period_from` text,
	`period_to` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `qhse_objectives_tenant_cat_idx` ON `qhse_objectives` (`tenant_id`,`category`);--> statement-breakpoint
CREATE TABLE `safety_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`quantity` text NOT NULL,
	`last_check` text,
	`next_check` text,
	`status` text DEFAULT 'GREEN' NOT NULL,
	`flag` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `safety_equipment_tenant_vessel_idx` ON `safety_equipment` (`tenant_id`,`vessel_id`,`category`);--> statement-breakpoint
CREATE TABLE `surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`kind` text NOT NULL,
	`scope` text NOT NULL,
	`surveyor` text NOT NULL,
	`location` text NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`certificate_id` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `surveys_tenant_vessel_idx` ON `surveys` (`tenant_id`,`vessel_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `voyage_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`route` text NOT NULL,
	`departure_at` text NOT NULL,
	`arrival_at` text NOT NULL,
	`nm` numeric NOT NULL,
	`fuel_tonnes` numeric NOT NULL,
	`co2_tonnes` numeric NOT NULL,
	`sox_tonnes` numeric NOT NULL,
	`nox_tonnes` numeric NOT NULL,
	`hours` numeric NOT NULL,
	`mode` text NOT NULL,
	`cargo` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `voyage_legs_tenant_vessel_idx` ON `voyage_legs` (`tenant_id`,`vessel_id`,`departure_at`);