import { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MasjidTypeahead({ masjids = [], value, onChange, placeholder = 'Cari masjid...', className, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(() => masjids.find((m) => m.id === value), [masjids, value]);

  const filtered = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return masjids.filter((m) => m.name?.toLowerCase().includes(q) || m.city?.toLowerCase().includes(q)).slice(0, 30);
  }, [masjids, query]);

  useEffect(() => { setHighlightIdx(0); }, [filtered]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (m) => {
    onChange(m.id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlightIdx]) handleSelect(filtered[highlightIdx]); }
    if (e.key === 'Escape') { setOpen(false); }
  };

  if (selected && !open) {
    return (
      <div className={cn('flex items-center gap-2 h-9 w-full rounded-sm border border-border bg-white px-3 text-sm', disabled && 'opacity-50', className)}>
        <MapPin className="h-3.5 w-3.5 text-text-3 shrink-0" />
        <span className="truncate flex-1">{selected.name}{selected.city ? ` – ${selected.city}` : ''}</span>
        {!disabled && (
          <button type="button" onClick={handleClear} className="p-0.5 rounded hover:bg-gray-100 shrink-0">
            <X className="h-3.5 w-3.5 text-text-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value) setOpen(true); else setOpen(false); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex h-9 w-full rounded-sm border border-border bg-white pl-9 pr-3 py-2 text-sm transition-colors placeholder:text-text-3 focus:outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul ref={listRef} className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-border rounded-sm shadow-lg py-1">
          {filtered.map((m, idx) => (
            <li
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(m); }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors',
                idx === highlightIdx ? 'bg-emerald-50 text-green' : 'hover:bg-gray-50'
              )}
            >
              <MapPin className="h-3 w-3 text-text-3 shrink-0" />
              <span className="truncate">{m.name}</span>
              {m.city && <span className="text-xs text-text-3 shrink-0">– {m.city}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-sm shadow-lg py-3 text-center text-sm text-text-3">
          Tidak ditemukan
        </div>
      )}
    </div>
  );
}
