import type { ReactNode } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface AppShellProps {
  nav: NavItem[];
  currentPath: string;
  onNavClick: (href: string) => void;
  userEmail?: string;
  onLogout?: () => void;
  children: ReactNode;
}

export function AppShell({
  nav,
  currentPath,
  onNavClick,
  userEmail,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-slate-900 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-700">
          <span className="text-white font-bold text-lg tracking-tight">⚓ FleetOps</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = currentPath.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => onNavClick(item.href)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </nav>
        {userEmail && (
          <div className="px-3 py-3 border-t border-slate-700">
            <p className="text-xs text-slate-400 truncate mb-2">{userEmail}</p>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            )}
          </div>
        )}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
