import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { cn } from '../lib/utils';

export default function MultiSelectDropdown({ label, options, selected = [], onChange }) {
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

  const toggle = (value) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  };

  const displayLabel = selected.length > 0
    ? `${label} (${selected.length})`
    : label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 h-9 px-3 rounded-sm border text-sm transition-colors whitespace-nowrap',
          selected.length > 0
            ? 'border-green text-green bg-green-light'
            : 'border-border text-text-3 bg-white hover:border-green'
        )}
      >
        {displayLabel}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[220px] bg-white border border-border rounded-sm shadow-lg z-20 py-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-bg cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
