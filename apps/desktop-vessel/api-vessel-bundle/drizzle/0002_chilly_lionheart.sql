CREATE TABLE `components` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`parent_id` text,
	`master_id` text,
	`name` text NOT NULL,
	`description` text,
	`sfi` text,
	`running_hours` numeric DEFAULT '0' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`master_id`) REFERENCES `master_components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `components_tenant_vessel_idx` ON `components` (`tenant_id`,`vessel_id`);--> statement-breakpoint
CREATE INDEX `components_tenant_vessel_parent_idx` ON `components` (`tenant_id`,`vessel_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `job_histories` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`job_instance_id` text NOT NULL,
	`job_id` text NOT NULL,
	`component_id` text NOT NULL,
	`completed_at` text NOT NULL,
	`completed_by_user_id` text NOT NULL,
	`hours_worked` numeric,
	`notes` text,
	`signature_hash` text,
	`parts_consumed` text,
	`photos` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_instance_id`) REFERENCES `job_instances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `job_histories_tenant_vessel_completed_idx` ON `job_histories` (`tenant_id`,`vessel_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `job_histories_tenant_vessel_instance_idx` ON `job_histories` (`tenant_id`,`vessel_id`,`job_instance_id`);--> statement-breakpoint
CREATE TABLE `job_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`job_id` text NOT NULL,
	`component_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`due_at` text,
	`due_at_running_hours` numeric,
	`assigned_to_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `job_instances_tenant_vessel_status_due_idx` ON `job_instances` (`tenant_id`,`vessel_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `job_instances_tenant_vessel_component_idx` ON `job_instances` (`tenant_id`,`vessel_id`,`component_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`component_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`interval_days` integer,
	`interval_running_hours` numeric,
	`estimated_hours` numeric,
	`priority` text DEFAULT 'NORMAL' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "jobs_interval_required_chk" CHECK(("jobs"."interval_days" IS NOT NULL OR "jobs"."interval_running_hours" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `jobs_tenant_vessel_component_idx` ON `jobs` (`tenant_id`,`vessel_id`,`component_id`);--> statement-breakpoint
CREATE TABLE `master_components` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sfi` text,
	`category` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `master_components_tenant_idx` ON `master_components` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `running_hour_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`component_id` text NOT NULL,
	`value` numeric NOT NULL,
	`source` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `running_hour_readings_tenant_vessel_component_recorded_idx` ON `running_hour_readings` (`tenant_id`,`vessel_id`,`component_id`,`recorded_at`);--> statement-breakpoint
-- ── job_histories immutability ──────────────────────────────────────────────
-- Mirror of the Postgres trigger in api-shore migration 20260506173034.
-- §9.1: closed JobHistory records are immutable. Only sync metadata
-- (deleted_at, hlc, updated_at) may change after insert. SQLite uses RAISE(ABORT)
-- to surface a clear error to the caller.
CREATE TRIGGER `job_histories_immutable`
  BEFORE UPDATE ON `job_histories`
  FOR EACH ROW
  WHEN (
    NEW.id IS NOT OLD.id
    OR NEW.tenant_id IS NOT OLD.tenant_id
    OR NEW.vessel_id IS NOT OLD.vessel_id
    OR NEW.job_instance_id IS NOT OLD.job_instance_id
    OR NEW.job_id IS NOT OLD.job_id
    OR NEW.component_id IS NOT OLD.component_id
    OR NEW.completed_at IS NOT OLD.completed_at
    OR NEW.completed_by_user_id IS NOT OLD.completed_by_user_id
    OR NEW.hours_worked IS NOT OLD.hours_worked
    OR NEW.notes IS NOT OLD.notes
    OR NEW.signature_hash IS NOT OLD.signature_hash
    OR NEW.parts_consumed IS NOT OLD.parts_consumed
    OR NEW.photos IS NOT OLD.photos
    OR NEW.created_at IS NOT OLD.created_at
  )
BEGIN
  SELECT RAISE(ABORT, 'job_histories rows are immutable; only deleted_at, hlc, updated_at may be modified after insert');
END;