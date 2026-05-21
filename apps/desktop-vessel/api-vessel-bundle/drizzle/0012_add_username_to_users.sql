PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`vessel_id` text,
	`username` text,
	`email` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'OFFICER' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "tenant_id", "vessel_id", "username", "email", "password_hash", "role", "created_at", "updated_at", "hlc", "deleted_at") SELECT "id", "tenant_id", "vessel_id", NULL AS "username", "email", "password_hash", "role", "created_at", "updated_at", "hlc", "deleted_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_email_uniq` ON `users` (`tenant_id`,`email`);