import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ActionMenu({ items }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0, openUp: false });

  // Close on outside click, Escape, or any scroll (fixed position won't follow scroll)
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (buttonRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 200;
      setPos({
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? (window.innerHeight - rect.top + 4) : undefined,
        right: window.innerWidth - rect.right,
        openUp,
      });
    }
    setOpen((o) => !o);
  }, [open]);

  if (!items || items.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="inline-flex items-center justify-center h-8 w-8 rounded-sm text-text-3 hover:text-text hover:bg-bg transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            bottom: pos.bottom,
            right: pos.right,
            zIndex: 9999,
          }}
          className="min-w-[160px] bg-white border border-border rounded-sm shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
        >
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
        </div>,
        document.body
      )}
    </>
  );
}
