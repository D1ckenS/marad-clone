CREATE TABLE `blob_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`sent_at` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `blob_outbox_pending_idx` ON `blob_outbox` (`sent_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `blob_outbox_key_idx` ON `blob_outbox` (`key`);