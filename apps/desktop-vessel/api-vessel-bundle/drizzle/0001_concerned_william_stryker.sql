CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload` text,
	`hlc` text NOT NULL,
	`node_id` text NOT NULL,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_pending_idx` ON `outbox` (`sent_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `outbox_entity_idx` ON `outbox` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `sync_records` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`hlc` text NOT NULL,
	`deleted_at` text,
	`fields` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_records_pk` ON `sync_records` (`entity_type`,`entity_id`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `hlc` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `hlc` text;--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `vessels` ADD `hlc` text;--> statement-breakpoint
ALTER TABLE `vessels` ADD `deleted_at` text;