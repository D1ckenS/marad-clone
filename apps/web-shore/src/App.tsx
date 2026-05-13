import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@fleetops/ui-kit';
import { useAuth } from './context/AuthContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { ComponentsPage } from './pages/ComponentsPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { JobInstancesPage } from './pages/JobInstancesPage.js';
import { PurchasePage } from './pages/PurchasePage.js';

const NAV = [
  { label: 'Components', href: '/components', icon: '🔧' },
  { label: 'Jobs', href: '/jobs', icon: '🗂️' },
  { label: 'Inventory', href: '/inventory', icon: '📦' },
  { label: 'Purchase', href: '/purchase', icon: '🛒' },
];

function ProtectedLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppShell
      nav={NAV}
      currentPath={location.pathname}
      onNavClick={(href) => navigate(href)}
      userEmail={user.email}
      onLogout={logout}
    >
      <Routes>
        <Route path="components" element={<ComponentsPage />} />
        <Route path="jobs" element={<JobInstancesPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="purchase" element={<PurchasePage />} />
        <Route path="*" element={<Navigate to="components" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/components" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
