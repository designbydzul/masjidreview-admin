import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';
import { Button } from './ui/button';

export default function Topbar() {
  const { admin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 h-14 bg-white border-b border-border flex items-center justify-between px-5">
      <Logo />
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-2 hidden sm:inline">{admin?.name}</span>
        <Button variant="ghost" size="sm" onClick={logout} className="text-red hover:text-red hover:bg-red/5">
          <LogOut className="h-4 w-4 mr-1.5" />
          Keluar
        </Button>
      </div>
    </header>
  );
}
