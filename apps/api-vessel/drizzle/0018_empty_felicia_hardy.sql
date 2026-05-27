ALTER TABLE `outbox` ADD `actor_user_id` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `sync_records` ADD `actor_user_id` text DEFAULT 'system' NOT NULL;