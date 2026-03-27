import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileSearch, Plug, Bell, User, LogOut,
  ChevronRight, Menu, X, Building2,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tenders', icon: FileSearch, label: 'licitapp' },
  { to: '/connectors', icon: Plug, label: 'Conectores' },
  { to: '/alerts', icon: Bell, label: 'Alertas' },
  { to: '/profile', icon: User, label: 'Perfil' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try { await apiClient.post('/auth/logout'); } catch {}
    logout();
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <aside
        className={cn(
          'flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" />
              <span className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                licitapp<br />Chile
              </span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
                {sidebarOpen && active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          {sidebarOpen && user && (
            <div className="px-3 py-2 mb-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
