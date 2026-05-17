CREATE TABLE `certificate_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text,
	`certificate_id` text NOT NULL,
	`file_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`uploaded_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`certificate_id`) REFERENCES `certificates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `certificate_attachments_cert_idx` ON `certificate_attachments` (`tenant_id`,`certificate_id`);--> statement-breakpoint
CREATE TABLE `certificate_types` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`alert_days_json` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `certificate_types_tenant_idx` ON `certificate_types` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text,
	`certificate_type_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
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
	FOREIGN KEY (`certificate_type_id`) REFERENCES `certificate_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `certificates_tenant_vessel_idx` ON `certificates` (`tenant_id`,`vessel_id`);--> statement-breakpoint
CREATE INDEX `certificates_tenant_subject_idx` ON `certificates` (`tenant_id`,`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `certificates_tenant_expires_idx` ON `certificates` (`tenant_id`,`expires_at`);