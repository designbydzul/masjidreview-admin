import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ActionMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!items || items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center h-8 w-8 rounded-sm text-text-3 hover:text-text hover:bg-bg transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[160px] bg-white border border-border rounded-sm shadow-lg z-20 py-1">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors text-left',
                  item.destructive
                    ? 'text-red hover:bg-red/5'
                    : 'text-text hover:bg-bg'
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
