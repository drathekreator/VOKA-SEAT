import React from 'react';
import { useAdminAuth } from '../admin/auth/useAdminAuth';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'orders', label: 'Orders', icon: 'shopping_cart' },
  { id: 'bar', label: 'Bar View', icon: 'local_bar' },
  { id: 'tablespace', label: 'Tablespace', icon: 'table_restaurant' },
  { id: 'inventory', label: 'Inventory', icon: 'inventory_2' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { username, logout } = useAdminAuth();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-[240px] bg-white border-r border-[#E5E7EB] flex flex-col z-20"
      aria-label="Main navigation"
    >
      {/* Brand Logo */}
      <div className="px-6 py-6">
        <img
          src="/logo-vokafe.svg"
          alt="VOKAFE Logo"
          className="h-10 w-auto"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 mt-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition-colors duration-200 ${
                isActive
                  ? 'bg-[#D81B60] text-white'
                  : 'text-[#475569] hover:bg-[#F3F4F6] hover:text-[#1E293B]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer: signed-in admin + logout */}
      <div className="px-3 pb-5 border-t border-[#E5E7EB] pt-4 flex flex-col gap-2">
        {username && (
          <div className="px-2 text-xs text-[#475569]">
            <div className="text-[10px] uppercase tracking-wider">Signed in as</div>
            <div className="truncate font-semibold text-[#1E293B]">{username}</div>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          data-testid="admin-sidebar-logout"
          className="flex items-center gap-3 px-4 py-2.5 w-full text-left rounded-lg text-[#475569] hover:bg-[#F3F4F6] hover:text-[#1E293B] transition-colors duration-200"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
