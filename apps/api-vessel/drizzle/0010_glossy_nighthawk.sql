CREATE TABLE `bunker_delivery_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`fuel_product_id` text,
	`bdn_number` text,
	`delivery_date` text NOT NULL,
	`port` text,
	`supplier_name` text,
	`quantity_mt` numeric NOT NULL,
	`density_kg_m3` numeric,
	`sulphur_pct` numeric,
	`grade` text,
	`viscosity` numeric,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fuel_product_id`) REFERENCES `fuel_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bdn_tenant_vessel_date_idx` ON `bunker_delivery_notes` (`tenant_id`,`vessel_id`,`delivery_date`);--> statement-breakpoint
CREATE TABLE `consumption_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`fuel_product_id` text,
	`log_date` text NOT NULL,
	`consumer_type` text NOT NULL,
	`consumer_name` text,
	`consumption_mt` numeric NOT NULL,
	`voyage_leg` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fuel_product_id`) REFERENCES `fuel_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consumption_logs_tenant_vessel_date_idx` ON `consumption_logs` (`tenant_id`,`vessel_id`,`log_date`);--> statement-breakpoint
CREATE INDEX `consumption_logs_tenant_vessel_consumer_idx` ON `consumption_logs` (`tenant_id`,`vessel_id`,`consumer_type`);--> statement-breakpoint
CREATE TABLE `fuel_products` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`tank_type` text NOT NULL,
	`sulphur_pct` numeric,
	`density_kg_m3` numeric,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fuel_products_tenant_idx` ON `fuel_products` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tank_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`tank_id` text NOT NULL,
	`reading_date` text NOT NULL,
	`rob_mt` numeric NOT NULL,
	`rob_m3` numeric,
	`trim` numeric,
	`notes` text,
	`recorded_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tank_id`) REFERENCES `tanks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tank_readings_tenant_vessel_date_idx` ON `tank_readings` (`tenant_id`,`vessel_id`,`reading_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `tank_readings_unique_day` ON `tank_readings` (`tenant_id`,`vessel_id`,`tank_id`,`reading_date`);--> statement-breakpoint
CREATE TABLE `tanks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`name` text NOT NULL,
	`tank_type` text NOT NULL,
	`fuel_product_id` text,
	`capacity_m3` numeric,
	`frame_position` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fuel_product_id`) REFERENCES `fuel_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tanks_tenant_vessel_idx` ON `tanks` (`tenant_id`,`vessel_id`);