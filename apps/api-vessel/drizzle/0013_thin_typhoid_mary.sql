ALTER TABLE `parts` ADD `vessel_id` text REFERENCES vessels(id);--> statement-breakpoint
CREATE INDEX `parts_tenant_vessel_idx` ON `parts` (`tenant_id`,`vessel_id`);