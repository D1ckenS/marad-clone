-- RLS: budgets
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_tenant_isolation" ON "budgets"
  USING (tenant_id = current_setting('app.tenant_id', true));

-- RLS: budget_lines
ALTER TABLE "budget_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_lines_tenant_isolation" ON "budget_lines"
  USING (tenant_id = current_setting('app.tenant_id', true));
