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

// ─── Route guard ─────────────────────────────────────────────────────────────

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
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
        <Route path="components" element={<ComponentsPage />} />
        <Route path="jobs" element={<Navigate to="/components?tab=jobs" replace />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="purchase" element={<PurchasePage />} />
        <Route path="certificates" element={<CertificatesPage />} />
        <Route path="safety" element={<SafetyPage />} />
        <Route path="qhse" element={<QHSEPage />} />
        <Route path="crewing" element={<CrewingPage />} />
        <Route path="flgo" element={<ComingSoonPage module="FLGO" phase="Phase 3 (P3-1)" />} />
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
