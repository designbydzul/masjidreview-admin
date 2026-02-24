import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 h-12 bg-white border-b border-border flex items-center px-4 gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-1 -ml-1 text-text-2 hover:text-text">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-heading text-base">
            <span className="font-normal text-text-2">Masjid</span>
            <span className="font-bold text-dark-green">Review</span>
          </span>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
