import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@fleetops/ui-kit';
import { useAuth } from './context/AuthContext.js';
import { VesselProvider, useVessel } from './context/VesselContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ComponentsPage } from './pages/ComponentsPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { PurchasePage } from './pages/PurchasePage.js';
import { CrewingPage } from './pages/CrewingPage.js';
import { CertificatesPage } from './pages/CertificatesPage.js';
import { SafetyPage } from './pages/SafetyPage.js';
import { QHSEPage } from './pages/QHSEPage.js';
import { VesselsPage } from './pages/VesselsPage.js';
import { CompaniesPage } from './pages/CompaniesPage.js';
import { ComingSoonPage } from './pages/ComingSoonPage.js';
import type { NavItem } from '@fleetops/ui-kit';

// ─── Role helpers ─────────────────────────────────────────────────────────────

const VESSEL_ADMIN_ROLES = ['TENANT_ADMIN']; // SUPER_ADMIN has no tenant, can't manage vessels
const SUPER_ADMIN_ONLY = ['SUPER_ADMIN'];

function isRole(role: string | undefined, allowed: string[]) {
  return Boolean(role && allowed.includes(role));
}

// ─── Route guards ────────────────────────────────────────────────────────────

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// Vessel-scoped modules need a vessel selected. Tenant admins must pick one from
// the vessel picker in the sidebar before these modules will work.
function RequireVessel({ children }: { children: React.ReactNode }) {
  const { selectedVesselId, vessels, isVesselLocked, setSelectedVesselId } = useVessel();
  if (selectedVesselId) return <>{children}</>;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: 16,
        color: '#0A1F33',
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8893A0"
        strokeWidth="1.5"
      >
        <path d="M3 17l2-8h14l2 8H3z" />
        <path d="M7 9V6a5 5 0 0 1 10 0v3" />
        <line x1="12" y1="12" x2="12" y2="15" />
      </svg>
      <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>No vessel selected</p>
      <p style={{ fontSize: 13, color: '#8893A0', margin: 0 }}>
        Choose a vessel from the sidebar to view this module.
      </p>
      {!isVesselLocked && vessels.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {vessels.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVesselId(v.id)}
              style={{
                padding: '8px 20px',
                border: '1px solid #E5E3DA',
                borderRadius: 8,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: '#0A1F33',
              }}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Protected layout (needs VesselContext inside) ────────────────────────────

function ProtectedContent() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { companyName, vessels, selectedVesselId, setSelectedVesselId, isVesselLocked } =
    useVessel();

  if (!user) return <Navigate to="/login" replace />;

  const role = user.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // SUPER_ADMIN only sees Companies; company users see the full module nav
  const moduleNav: NavItem[] = isSuperAdmin
    ? []
    : [
        { label: 'Start', href: '/dashboard', code: 'ST' },
        { label: 'Maintenance', href: '/components', code: 'MA' },
        { label: 'Inventory', href: '/inventory', code: 'IN' },
        { label: 'Purchase', href: '/purchase', code: 'PO' },
        { label: 'Certificates', href: '/certificates', code: 'CR' },
        { label: 'Safety', href: '/safety', code: 'SF' },
        { label: 'QHSE', href: '/qhse', code: 'QH' },
        { label: 'Crewing', href: '/crewing', code: 'CW' },
        { label: 'FLGO', href: '/flgo', code: 'FL' },
      ];

  const adminNav: NavItem[] = [
    ...(isRole(role, VESSEL_ADMIN_ROLES)
      ? [{ label: 'Vessels & Users', href: '/vessels', code: 'VS' }]
      : []),
    ...(isRole(role, SUPER_ADMIN_ONLY)
      ? [{ label: 'Companies', href: '/companies', code: 'CO' }]
      : []),
  ];

  const nav: NavItem[] = [...moduleNav, ...adminNav];

  return (
    <AppShell
      nav={nav}
      currentPath={location.pathname}
      onNavClick={(href) => navigate(href)}
      userEmail={user.email}
      userDisplayName={user.username ?? undefined}
      onLogout={logout}
      companyName={isSuperAdmin ? 'Platform Admin' : companyName}
      vessels={isSuperAdmin ? [] : vessels}
      selectedVesselId={isSuperAdmin ? null : selectedVesselId}
      {...(!isSuperAdmin && { onVesselChange: setSelectedVesselId })}
      isVesselLocked={isVesselLocked}
    >
      <Routes>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="components"
          element={
            <RequireVessel>
              <ComponentsPage />
            </RequireVessel>
          }
        />
        <Route path="jobs" element={<Navigate to="/components?tab=jobs" replace />} />
        <Route
          path="inventory"
          element={
            <RequireVessel>
              <InventoryPage />
            </RequireVessel>
          }
        />
        <Route
          path="purchase"
          element={
            <RequireVessel>
              <PurchasePage />
            </RequireVessel>
          }
        />
        <Route
          path="certificates"
          element={
            <RequireVessel>
              <CertificatesPage />
            </RequireVessel>
          }
        />
        <Route
          path="safety"
          element={
            <RequireVessel>
              <SafetyPage />
            </RequireVessel>
          }
        />
        <Route
          path="qhse"
          element={
            <RequireVessel>
              <QHSEPage />
            </RequireVessel>
          }
        />
        <Route
          path="crewing"
          element={
            <RequireVessel>
              <CrewingPage />
            </RequireVessel>
          }
        />
        <Route
          path="flgo"
          element={
            <RequireVessel>
              <ComingSoonPage module="FLGO" phase="Phase 3 (P3-1)" />
            </RequireVessel>
          }
        />
        <Route
          path="vessels"
          element={
            <RequireRole roles={VESSEL_ADMIN_ROLES}>
              <VesselsPage />
            </RequireRole>
          }
        />
        <Route
          path="companies"
          element={
            <RequireRole roles={SUPER_ADMIN_ONLY}>
              <CompaniesPage />
            </RequireRole>
          }
        />
        <Route
          path="*"
          element={<Navigate to={isSuperAdmin ? 'companies' : 'dashboard'} replace />}
        />
      </Routes>
    </AppShell>
  );
}

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <VesselProvider>
      <ProtectedContent />
    </VesselProvider>
  );
}

export function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
