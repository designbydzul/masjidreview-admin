import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Star, Users, KeyRound, Settings, MessageSquare, ScrollText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/masjids', label: 'Masjid', icon: Building2 },
  { to: '/reviews', label: 'Reviews', icon: Star },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/admins', label: 'Admin', icon: KeyRound, superOnly: true },
  { to: '/fasilitas', label: 'Fasilitas', icon: Settings },
  { to: '/feedback', label: 'Feedback Hub', icon: MessageSquare },
  { to: '/changelog', label: 'Changelog', icon: ScrollText },
];

export default function Sidebar() {
  const { admin } = useAuth();

  const items = navItems.filter((item) => !item.superOnly || admin?.role === 'super_admin');

  return (
    <nav className="md:w-[220px] md:sticky md:top-14 md:h-[calc(100vh-56px)] md:overflow-y-auto md:border-r md:border-border bg-white flex md:flex-col overflow-x-auto md:overflow-x-visible border-b md:border-b-0 border-border">
      <div className="flex md:flex-col md:py-3 md:px-2 gap-0.5 min-w-max md:min-w-0">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-sm transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-green-light text-green'
                    : 'text-text-2 hover:text-green hover:bg-green-light'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
