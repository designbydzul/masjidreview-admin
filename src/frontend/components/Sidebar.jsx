import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Star, Users, KeyRound, Settings, MessageSquare, ScrollText, BarChart3, ClipboardList, LogOut, ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import Logo from './Logo';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/masjids', label: 'Masjid', icon: Building2 },
  { to: '/reviews', label: 'Reviews', icon: Star },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/analytics', label: 'Analitik', icon: BarChart3 },
  { to: '/admins', label: 'Admin', icon: KeyRound, superOnly: true },
  { to: '/fasilitas', label: 'Fasilitas', icon: Settings },
  { to: '/feedback', label: 'Feedback Hub', icon: MessageSquare },
  { to: '/changelog', label: 'Changelog', icon: ScrollText },
  { to: '/audit-log', label: 'Audit Log', icon: ClipboardList, superOnly: true },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { admin, logout } = useAuth();

  const items = navItems.filter((item) => !item.superOnly || admin?.role === 'super_admin');

  const navContent = (isMobile) => {
    const isCollapsed = !isMobile && collapsed;
    return (
      <>
        {/* Logo */}
        <div className={cn('flex items-center border-b border-border shrink-0', isCollapsed ? 'justify-center h-14 px-2' : 'h-14 px-4')}>
          {isCollapsed ? (
            <span className="font-heading text-base font-bold text-dark-green">MR</span>
          ) : (
            <div className="scale-[0.85] origin-left">
              <Logo showBadge />
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <div className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={isCollapsed ? item.label : undefined}
                  onClick={isMobile ? onMobileClose : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 py-2.5 text-sm font-medium rounded-sm transition-colors whitespace-nowrap',
                      isCollapsed ? 'justify-center px-2' : 'px-3',
                      isActive
                        ? 'bg-green-light text-green border-l-[3px] border-green'
                        : 'text-text-2 hover:text-green hover:bg-green-light border-l-[3px] border-transparent'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <div className="px-2 pb-1">
            <button
              onClick={onToggle}
              className={cn(
                'flex items-center gap-2 w-full py-2 text-sm font-medium text-text-3 hover:text-text-2 rounded-sm hover:bg-bg transition-colors',
                isCollapsed ? 'justify-center px-2' : 'px-3'
              )}
            >
              {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              {!isCollapsed && <span>Kecilkan</span>}
            </button>
          </div>
        )}

        {/* Logout */}
        <div className="border-t border-border px-2 py-2 shrink-0">
          <button
            onClick={logout}
            className={cn(
              'flex items-center gap-2.5 w-full py-2.5 text-sm font-medium text-red hover:bg-red/5 rounded-sm transition-colors',
              isCollapsed ? 'justify-center px-2' : 'px-3'
            )}
            title={isCollapsed ? 'Keluar' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Keluar</span>}
          </button>
        </div>
      </>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-border h-screen sticky top-0 shrink-0 sidebar-transition overflow-hidden',
          collapsed ? 'w-16' : 'w-[240px]'
        )}
      >
        {navContent(false)}
      </aside>

      {/* Mobile sidebar overlay */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-border flex flex-col md:hidden sidebar-slide',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="absolute top-3 right-3 z-10 p-1 text-text-3 hover:text-text-2 rounded-sm hover:bg-bg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        {navContent(true)}
      </aside>
    </>
  );
}
