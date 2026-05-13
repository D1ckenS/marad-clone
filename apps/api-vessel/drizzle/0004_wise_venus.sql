CREATE TABLE `approval_flows` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `approval_flows_tenant_idx` ON `approval_flows` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `approval_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`flow_id` text NOT NULL,
	`step_order` integer NOT NULL,
	`approver_role` text NOT NULL,
	`limit_amount` numeric,
	`limit_currency` text DEFAULT 'USD' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`flow_id`) REFERENCES `approval_flows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `approval_steps_tenant_idx` ON `approval_steps` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `approval_steps_flow_order_uniq` ON `approval_steps` (`flow_id`,`step_order`);--> statement-breakpoint
CREATE TABLE `goods_receipt_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`po_line_id` text NOT NULL,
	`part_id` text,
	`description` text,
	`quantity_ordered` numeric NOT NULL,
	`quantity_received` numeric NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receipt_id`) REFERENCES `goods_receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_line_id`) REFERENCES `po_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goods_receipt_lines_tenant_vessel_receipt_idx` ON `goods_receipt_lines` (`tenant_id`,`vessel_id`,`receipt_id`);--> statement-breakpoint
CREATE INDEX `goods_receipt_lines_tenant_vessel_po_line_idx` ON `goods_receipt_lines` (`tenant_id`,`vessel_id`,`po_line_id`);--> statement-breakpoint
CREATE TABLE `goods_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`po_id` text NOT NULL,
	`received_by_user_id` text,
	`received_at` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goods_receipts_tenant_vessel_po_idx` ON `goods_receipts` (`tenant_id`,`vessel_id`,`po_id`);--> statement-breakpoint
CREATE TABLE `po_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`po_id` text NOT NULL,
	`part_id` text,
	`description` text NOT NULL,
	`quantity` numeric NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`unit_price` numeric NOT NULL,
	`total_price` numeric NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`requisition_line_id` text,
	`quote_line_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requisition_line_id`) REFERENCES `requisition_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `po_lines_tenant_vessel_po_idx` ON `po_lines` (`tenant_id`,`vessel_id`,`po_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`requisition_id` text,
	`rfq_id` text,
	`supplier_id` text,
	`po_number` text,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`total_amount` numeric DEFAULT '0' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`ordered_by_user_id` text,
	`ordered_at` text,
	`expected_delivery_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requisition_id`) REFERENCES `requisitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchase_orders_non_draft_requires_supplier_chk" CHECK(("purchase_orders"."status" = 'DRAFT' OR "purchase_orders"."supplier_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `purchase_orders_tenant_vessel_status_idx` ON `purchase_orders` (`tenant_id`,`vessel_id`,`status`);--> statement-breakpoint
CREATE INDEX `purchase_orders_tenant_vessel_supplier_idx` ON `purchase_orders` (`tenant_id`,`vessel_id`,`supplier_id`);--> statement-breakpoint
CREATE TABLE `quote_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`quote_id` text NOT NULL,
	`part_id` text,
	`description` text NOT NULL,
	`quantity` numeric NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`unit_price` numeric NOT NULL,
	`total_price` numeric NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quote_lines_tenant_vessel_quote_idx` ON `quote_lines` (`tenant_id`,`vessel_id`,`quote_id`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`rfq_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`valid_until` text,
	`total_amount` numeric DEFAULT '0' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`notes` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quotes_tenant_vessel_rfq_idx` ON `quotes` (`tenant_id`,`vessel_id`,`rfq_id`);--> statement-breakpoint
CREATE TABLE `requisition_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`requisition_id` text NOT NULL,
	`part_id` text,
	`description` text NOT NULL,
	`quantity` numeric NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`estimated_unit_price` numeric,
	`estimated_total_price` numeric,
	`currency` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requisition_id`) REFERENCES `requisitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `requisition_lines_tenant_vessel_req_idx` ON `requisition_lines` (`tenant_id`,`vessel_id`,`requisition_id`);--> statement-breakpoint
CREATE TABLE `requisitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`total_amount` numeric DEFAULT '0' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`requested_by_user_id` text,
	`requested_at` text NOT NULL,
	`approval_flow_id` text,
	`approved_by_user_id` text,
	`approved_at` text,
	`rejected_by_user_id` text,
	`rejected_at` text,
	`rejection_reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approval_flow_id`) REFERENCES `approval_flows`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "requisitions_approved_requires_approver_chk" CHECK(("requisitions"."status" != 'APPROVED' OR "requisitions"."approved_by_user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `requisitions_tenant_vessel_status_idx` ON `requisitions` (`tenant_id`,`vessel_id`,`status`);--> statement-breakpoint
CREATE INDEX `requisitions_tenant_vessel_requested_idx` ON `requisitions` (`tenant_id`,`vessel_id`,`requested_at`);--> statement-breakpoint
CREATE TABLE `rfqs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vessel_id` text NOT NULL,
	`requisition_id` text,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`issued_at` text,
	`due_at` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vessel_id`) REFERENCES `vessels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requisition_id`) REFERENCES `requisitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rfqs_tenant_vessel_status_idx` ON `rfqs` (`tenant_id`,`vessel_id`,`status`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`address` text,
	`country` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`hlc` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `suppliers_tenant_idx` ON `suppliers` (`tenant_id`);