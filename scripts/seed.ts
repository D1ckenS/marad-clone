/**
 * Seed script for local development.
 * Creates: 1 tenant → 1 vessel → 1 CHIEF_ENGINEER (vessel-bound, can log in to web-shore).
 * Run: pnpm run seed
 * Requires api-shore running on http://localhost:3000
 */

const BASE = 'http://localhost:3000/api/v1';

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function main() {
  console.log('🌱 Seeding local database…\n');

  // 0. Bootstrap a SUPER_ADMIN. POST /tenants is now SUPER_ADMIN-gated (B3),
  //    so we need a token from an account with no tenant scope first.
  const bootstrapKey = process.env['PLATFORM_BOOTSTRAP_KEY'];
  if (!bootstrapKey) {
    throw new Error(
      'PLATFORM_BOOTSTRAP_KEY is not set — add it to apps/api-shore/.env and restart api-shore',
    );
  }
  const superAdminEmail = 'seed-superadmin@demo.local';
  const superAdminPassword = 'SuperAdmin1234!';
  try {
    await post('/auth/bootstrap-super-admin', {
      bootstrapKey,
      email: superAdminEmail,
      username: 'seed-superadmin',
      password: superAdminPassword,
    });
    console.log('✓ Super-admin created');
  } catch (err) {
    // 409 if it already exists; that's fine — we'll log in below.
    if (!(err instanceof Error) || !err.message.includes('409')) throw err;
    console.log('✓ Super-admin already exists');
  }
  const superAdminLogin = await post<{ access_token: string }>('/auth/login', {
    identifier: superAdminEmail,
    password: superAdminPassword,
  });
  const superAdminToken = superAdminLogin.access_token;

  // 1. Create tenant + initial TENANT_ADMIN (super-admin authenticated)
  const bootstrap = await post<{ tenant: { id: string }; admin: { id: string } }>(
    '/tenants',
    {
      name: 'Demo Shipping Co.',
      admin: { email: 'admin@demo.local', username: 'demo-admin', password: 'Admin1234!' },
    },
    superAdminToken,
  );
  const tenantId = bootstrap.tenant.id;
  console.log(`✓ Tenant created       id=${tenantId}`);

  // 2. Log in as TENANT_ADMIN to get a token for creating resources
  const adminLogin = await post<{ access_token: string }>('/auth/login', {
    tenantId,
    identifier: 'admin@demo.local',
    password: 'Admin1234!',
  });
  const adminToken = adminLogin.access_token;
  console.log('✓ Admin login OK');

  // 3. Create a vessel
  const vessel = await post<{ id: string }>(
    '/vessels',
    { name: 'MV Demo Vessel', imoNumber: '1234567' },
    adminToken,
  );
  const vesselId = vessel.id;
  console.log(`✓ Vessel created       id=${vesselId}`);

  // 4a. Create a MASTER (Captain) — highest vessel authority, "superuser" for vessel modules
  await post(
    '/users',
    {
      email: 'master@demo.local',
      username: 'demo-master',
      password: 'Master1234!',
      role: 'MASTER',
      vesselId,
    },
    adminToken,
  );
  console.log('✓ Master (Captain) created');

  // 4b. Create a CHIEF_ENGINEER as a second vessel-bound user for testing role differences
  await post(
    '/users',
    {
      email: 'chief@demo.local',
      username: 'demo-chief',
      password: 'Chief1234!',
      role: 'CHIEF_ENGINEER',
      vesselId,
    },
    adminToken,
  );
  console.log('✓ Chief Engineer created');

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Local dev credentials  (http://localhost:5173)

  Organisation ID : ${tenantId}

  ★ Master / Captain  (full vessel access — use this as your superuser)
    Email    : master@demo.local
    Password : Master1234!

  Chief Engineer  (vessel-bound, limited to maintenance/engineering)
    Email    : chief@demo.local
    Password : Chief1234!

  Tenant Admin  (fleet manager — no vessel binding yet, 403 on vessel endpoints)
    Email    : admin@demo.local
    Password : Admin1234!

  Note: fleet-wide TENANT_ADMIN access across vessels is a Fleetview
  (P4-1) feature. Use Master for now.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
