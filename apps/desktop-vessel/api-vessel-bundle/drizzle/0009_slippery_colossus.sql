CREATE TABLE `crew_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`crew_member_id` text NOT NULL,
	`certificate_type` text NOT NULL,
	`number` text,
	`issued_at` text,
	`expires_at` text,
	`issued_by` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`crew_member_id`) REFERENCES `crew_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `crew_certificates_tenant_vessel_crew_idx` ON `crew_certificates` (`tenant_id`,`vessel_id`,`crew_member_id`);--> statement-breakpoint
CREATE INDEX `crew_certificates_tenant_expires_idx` ON `crew_certificates` (`tenant_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `crew_members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`rank` text NOT NULL,
	`nationality` text,
	`date_of_birth` text,
	`email` text,
	`phone` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`sign_on_date` text,
	`sign_off_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `crew_members_tenant_vessel_idx` ON `crew_members` (`tenant_id`,`vessel_id`);--> statement-breakpoint
CREATE INDEX `crew_members_tenant_vessel_status_idx` ON `crew_members` (`tenant_id`,`vessel_id`,`status`);--> statement-breakpoint
CREATE TABLE `rest_hour_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`crew_member_id` text NOT NULL,
	`date` text NOT NULL,
	`hours_worked_json` text NOT NULL,
	`mlc_valid` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`crew_member_id`) REFERENCES `crew_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rest_hour_entries_tenant_vessel_crew_idx` ON `rest_hour_entries` (`tenant_id`,`vessel_id`,`crew_member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rest_hour_entries_unique_day` ON `rest_hour_entries` (`tenant_id`,`vessel_id`,`crew_member_id`,`date`);--> statement-breakpoint
CREATE TABLE `rotations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`crew_member_id` text NOT NULL,
	`planned_sign_on` text NOT NULL,
	`planned_sign_off` text NOT NULL,
	`actual_sign_on` text,
	`actual_sign_off` text,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`crew_member_id`) REFERENCES `crew_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rotations_tenant_vessel_crew_idx` ON `rotations` (`tenant_id`,`vessel_id`,`crew_member_id`);--> statement-breakpoint
CREATE INDEX `rotations_tenant_vessel_status_idx` ON `rotations` (`tenant_id`,`vessel_id`,`status`);