ALTER TABLE `part_categories` ADD `vessel_id` text REFERENCES `vessels`(`id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `part_categories_tenant_idx`;
--> statement-breakpoint
CREATE INDEX `part_categories_tenant_vessel_idx` ON `part_categories` (`tenant_id`,`vessel_id`);
