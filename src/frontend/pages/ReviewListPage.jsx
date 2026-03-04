import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, Plus, Pencil, XCircle, X, Trash2, Search, Loader2, Image as ImageIcon } from 'lucide-react';
import { getReviews, createReview, getReview, updateReview, getMasjids, getUsers, setReviewStatus, bulkReviewStatus, deleteReview, uploadFile } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import ActionMenu from '../components/ActionMenu';
import BulkBar from '../components/BulkBar';
import Pagination from '../components/Pagination';
import MasjidTypeahead from '../components/MasjidTypeahead';
import usePagination from '../hooks/usePagination';
import useClientSort from '../hooks/useClientSort';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { SkeletonTablePage } from '../components/Skeleton';
import { formatDate } from '../utils/format';
import { cn } from '../lib/utils';

const RATING_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const PLATFORM_OPTIONS = ['web', 'wa_bot', 'ig', 'x', 'threads', 'form'];

const STATUS_PILLS = [
  { key: 'pending', label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { key: 'approved', label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  { key: 'rejected', label: 'Rejected', color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

const TIME_OPTIONS = [
  { value: '', label: 'Semua Waktu' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
];

const emptyCreateForm = { masjid_id: '', reviewer_name: '', rating: '', short_description: '', source_platform: '', source_url: '', photo_urls: [] };

function parsePhotoUrls(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

// ─── Photo Lightbox ──────────────────────────────────────────
function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 z-10">
        <X className="h-6 w-6" />
      </button>
      <img src={src} alt="Preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ─── Expandable Review Cell with Photo Thumbnails ────────────
function ReviewCell({ text, photoUrls, onPhotoClick }) {
  const [expanded, setExpanded] = useState(false);
  const urls = parsePhotoUrls(photoUrls);
  const hasText = !!text;
  const isLong = text && text.length > 50;

  return (
    <div>
      {hasText ? (
        isLong ? (
          <div>
            <span className="text-xs text-text-2">{expanded ? text : text.slice(0, 50) + '...'}</span>
            <button type="button" onClick={() => setExpanded(!expanded)} className="ml-1 text-xs text-green hover:underline">
              {expanded ? 'Tutup' : 'Lihat'}
            </button>
          </div>
        ) : (
          <span className="text-xs text-text-2">{text}</span>
        )
      ) : (
        <span className="text-text-3 text-xs">-</span>
      )}
      {urls.length > 0 && (
        <div className="flex gap-1.5 mt-1.5">
          {urls.slice(0, 2).map((url, i) => (
            <button key={i} type="button" onClick={() => onPhotoClick(url)} className="shrink-0 rounded border border-border hover:border-green transition-colors overflow-hidden">
              <img src={url} alt="" className="w-10 h-10 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Masjid Filter Typeahead ─────────────────────────────────
function MasjidFilterTypeahead({ options, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((name) => name.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (value) {
    return (
      <button
        type="button"
        onClick={() => onChange('')}
        className="flex items-center gap-1.5 h-9 px-3 text-sm border border-green bg-emerald-50 text-green rounded-sm hover:bg-emerald-100 transition-colors w-[160px] truncate"
      >
        <span className="truncate flex-1 text-left">{value}</span>
        <X className="h-3.5 w-3.5 shrink-0" />
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Semua Masjid"
        className="flex h-9 w-[160px] rounded-sm border border-border bg-white px-3 py-2 text-sm transition-colors placeholder:text-text-3 focus:outline-none focus:border-green"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-[220px] max-h-48 overflow-y-auto bg-white border border-border rounded-sm shadow-lg py-1">
          {filtered.slice(0, 20).map((name) => (
            <li
              key={name}
              onMouseDown={(e) => { e.preventDefault(); onChange(name); setQuery(''); setOpen(false); }}
              className="px-3 py-1.5 text-sm cursor-pointer hover:bg-emerald-50 hover:text-green transition-colors truncate"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── User Typeahead (for reviewer name) ──────────────────────
function UserTypeahead({ users = [], value, onChange, placeholder, disabled }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return users.filter((u) => u.name?.toLowerCase().includes(q)).slice(0, 20);
  }, [users, query]);

  useEffect(() => { setHighlightIdx(0); }, [filtered]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (u) => {
    onChange(u.name);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[highlightIdx]) { e.preventDefault(); handleSelect(filtered[highlightIdx]); }
    if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        type="text"
        value={open ? query : (value || '')}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); if (e.target.value) setOpen(true); else setOpen(false); }}
        onFocus={() => { if (value) setQuery(value); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {open && filtered.length > 0 && (
        <ul ref={listRef} className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-border rounded-sm shadow-lg py-1">
          {filtered.map((u, idx) => (
            <li
              key={u.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(u); }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={cn(
                'px-3 py-1.5 text-sm cursor-pointer transition-colors',
                idx === highlightIdx ? 'bg-emerald-50 text-green' : 'hover:bg-gray-50'
              )}
            >
              <span className="truncate">{u.name}</span>
              {u.city && <span className="text-xs text-text-3 ml-1.5">– {u.city}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Photo Upload (multi, max 2) ────────────────────────────
function PhotoField({ urls, onChange, disabled }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (urls.length >= 2) return;
    setUploading(true);
    try {
      const res = await uploadFile(file, 'review');
      onChange([...urls, res.url]);
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (idx) => {
    onChange(urls.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className="flex gap-2">
          {urls.map((url, idx) => (
            <div key={idx} className="relative group">
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-sm border border-border" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow border border-border p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-red" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {urls.length < 2 && !disabled && (
        <label className={cn(
          'inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium border border-border rounded-sm cursor-pointer hover:border-green hover:text-green transition-colors',
          uploading && 'opacity-50 pointer-events-none'
        )}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><ImageIcon className="h-3.5 w-3.5" />Upload Foto</>}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}

// ─── Create / Edit Review Dialog ────────────────────────────
function ReviewDialog({ open, onOpenChange, masjids, users, review, onSaved }) {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const isEdit = !!review;

  const [form, setForm] = useState(emptyCreateForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (review) {
      setForm({
        masjid_id: review.masjid_id || '',
        reviewer_name: review.reviewer_name || '',
        rating: review.rating || '',
        short_description: review.short_description || '',
        source_platform: review.source_platform || '',
        source_url: review.source_url || '',
        photo_urls: parsePhotoUrls(review.photo_urls),
      });
    } else {
      setForm(emptyCreateForm);
    }
    setErrors({});
  }, [open, review]);

  const setField = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.masjid_id) errs.masjid_id = 'Masjid wajib dipilih';
    if (!form.source_platform) errs.source_platform = 'Platform wajib dipilih';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        reviewer_name: form.reviewer_name.trim() || admin?.name || 'Admin',
        rating: form.rating ? Number(form.rating) : null,
        photo_urls: form.photo_urls,
      };
      if (isEdit) {
        await updateReview(review.id, payload);
        showToast('Review diperbarui');
      } else {
        await createReview(payload);
        showToast('Review ditambahkan');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Review' : 'Tambah Review'}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-6">
          {/* Left column — testimoni + photo */}
          <div className="flex-[3] flex flex-col gap-3">
            <div className="flex-1 flex flex-col">
              <Label>Testimoni</Label>
              <Textarea
                value={form.short_description}
                onChange={(e) => setField('short_description', e.target.value)}
                placeholder="Isi testimoni review..."
                className="flex-1 min-h-[120px] resize-none"
              />
            </div>
            <div>
              <Label>Foto Review (maks 2)</Label>
              <PhotoField urls={form.photo_urls} onChange={(urls) => setField('photo_urls', urls)} />
              {form.photo_urls.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {form.photo_urls.map((url, i) => (
                    <button key={i} type="button" onClick={() => setLightboxSrc(url)} className="text-xs text-green hover:underline">Lihat foto {i + 1}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — fields */}
          <div className="flex-[2] space-y-3">
            <div>
              <Label>Masjid *</Label>
              <MasjidTypeahead masjids={masjids} value={form.masjid_id} onChange={(id) => setField('masjid_id', id)} />
              {errors.masjid_id && <p className="text-red text-xs mt-1">{errors.masjid_id}</p>}
            </div>
            <div>
              <Label>Nama Reviewer</Label>
              <UserTypeahead
                users={users}
                value={form.reviewer_name}
                onChange={(name) => setField('reviewer_name', name)}
                placeholder={`Kosongkan untuk default "${admin?.name || 'Admin'}"`}
              />
            </div>
            <div>
              <Label>Rating (1-5)</Label>
              <Select value={form.rating} onChange={(e) => setField('rating', e.target.value)}>
                <option value="">-- Tidak ada --</option>
                {RATING_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
            <div>
              <Label>Platform *</Label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORM_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setField('source_platform', form.source_platform === p ? '' : p)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      form.source_platform === p ? 'bg-emerald-50 text-green border-emerald-300' : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {errors.source_platform && <p className="text-red text-xs mt-1">{errors.source_platform}</p>}
            </div>
            <div>
              <Label>Source URL</Label>
              <Input
                value={form.source_url}
                onChange={(e) => setField('source_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving} className="font-semibold">
            {saving ? 'Menyimpan...' : isEdit ? 'Perbarui' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function ReviewListPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [searchParams] = useSearchParams();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(() => {
    const s = searchParams.get('status');
    return s && ['approved', 'pending', 'rejected'].includes(s) ? s : 'all';
  });
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [masjidFilter, setMasjidFilter] = useState('');

  // Dialogs & data
  const [masjids, setMasjids] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editReview, setEditReview] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const loadData = async () => {
    try {
      const data = await getReviews();
      setReviews(data);
    } catch (err) {
      showToast('Gagal memuat data review', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMasjids = async () => {
    if (masjids.length > 0) return;
    try {
      const data = await getMasjids({ status: 'approved' });
      setMasjids(data);
    } catch {
      showToast('Gagal memuat data masjid', 'error');
    }
  };

  const loadUsers = async () => {
    if (users.length > 0) return;
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadData();
    loadMasjids();
    loadUsers();
  }, []);

  // Derived data
  const masjidOptions = useMemo(() => {
    const names = [...new Set(reviews.map((r) => r.masjid_name).filter(Boolean))].sort();
    return names;
  }, [reviews]);

  const counts = {
    pending: reviews.filter((r) => r.status === 'pending').length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
  };

  const dateRange = useMemo(() => {
    if (!timeFilter) return { from: null, to: null };
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (timeFilter === 'today') return { from: todayStr, to: todayStr };
    if (timeFilter === 'yesterday') { const y = new Date(now - 86400000).toISOString().split('T')[0]; return { from: y, to: y }; }
    if (timeFilter === '7d') return { from: new Date(now - 7 * 86400000).toISOString().split('T')[0], to: todayStr };
    if (timeFilter === '30d') return { from: new Date(now - 30 * 86400000).toISOString().split('T')[0], to: todayStr };
    return { from: null, to: null };
  }, [timeFilter]);

  const filtered = useMemo(() => {
    let result = reviews;
    if (filter !== 'all') result = result.filter((r) => r.status === filter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.reviewer_name?.toLowerCase().includes(q) || r.masjid_name?.toLowerCase().includes(q));
    }
    if (masjidFilter) result = result.filter((r) => r.masjid_name === masjidFilter);
    if (dateRange.from) result = result.filter((r) => r.created_at >= dateRange.from);
    if (dateRange.to) result = result.filter((r) => r.created_at <= dateRange.to + 'T23:59:59');
    return result;
  }, [reviews, filter, searchQuery, masjidFilter, dateRange]);

  const { sortedData, sortConfig, requestSort } = useClientSort(filtered);

  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(
    sortedData,
    [filter, searchQuery, masjidFilter, timeFilter, sortConfig]
  );

  // Handlers
  const handleStatus = async (id, status) => {
    try {
      await setReviewStatus(id, status);
      showToast('Status review diperbarui');
      setSelectedIds(new Set());
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulk = async (status) => {
    try {
      await bulkReviewStatus([...selectedIds], status);
      showToast(`${selectedIds.size} review di-${status}`);
      setSelectedIds(new Set());
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Hapus Review', message: 'Yakin hapus review ini?', confirmLabel: 'Hapus', confirmStyle: 'red' });
    if (!ok) return;
    try {
      await deleteReview(id);
      showToast('Review dihapus');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenEdit = async (id) => {
    setEditLoading(true);
    try {
      const data = await getReview(id);
      setEditReview(data);
    } catch (err) {
      showToast('Gagal memuat review', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const buildMenuItems = (row) => {
    const items = [];
    if (row.status === 'pending') {
      items.push({ label: 'Edit', icon: Pencil, onClick: () => handleOpenEdit(row.id) });
    }
    if (row.status === 'approved') {
      items.push({ label: 'Reject', icon: XCircle, onClick: () => handleStatus(row.id, 'rejected') });
    }
    if (admin?.role === 'super_admin') {
      items.push({ label: 'Hapus', icon: Trash2, onClick: () => handleDelete(row.id), destructive: true });
    }
    return items;
  };

  const columns = [
    { key: 'reviewer_name', label: 'REVIEWER', sortable: true, render: (row) => (
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{row.reviewer_name || '-'}</span>
        {!row.user_id && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-text-3 border border-gray-200">Tamu</span>
        )}
      </div>
    )},
    { key: 'masjid_name', label: 'MASJID', sortable: true, render: (row) => row.masjid_name || '-' },
    { key: 'rating', label: 'RATING', sortable: true, render: (row) => row.rating ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{row.rating}</span> : '-' },
    { key: 'short_description', label: 'REVIEW', render: (row) => <ReviewCell text={row.short_description} photoUrls={row.photo_urls} onPhotoClick={setLightboxSrc} /> },
    { key: 'created_at', label: 'TANGGAL', sortable: true, render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    { key: 'status', label: 'STATUS', render: (row) => {
      const pill = STATUS_PILLS.find((p) => p.key === row.status);
      return pill ? <span className={cn('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border', pill.color)}>{pill.label}</span> : row.status;
    }},
    { key: 'actions', label: 'AKSI', className: 'text-right', render: (row) => (
      <div className="flex items-center justify-end gap-1.5">
        {row.status === 'pending' && (
          <>
            <Button size="sm" onClick={() => handleStatus(row.id, 'approved')}>Approve</Button>
            <Button variant="outline" size="sm" onClick={() => handleStatus(row.id, 'rejected')} className="hover:border-red hover:text-red">Reject</Button>
          </>
        )}
        {row.status === 'approved' && (
          <Button variant="outline" size="sm" onClick={() => handleOpenEdit(row.id)}>Edit</Button>
        )}
        {row.status === 'rejected' && (
          <>
            <Button size="sm" onClick={() => handleStatus(row.id, 'approved')}>Approve</Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenEdit(row.id)}>Edit</Button>
          </>
        )}
        <ActionMenu items={buildMenuItems(row)} />
      </div>
    )},
  ];

  if (loading) return <SkeletonTablePage columns={7} hasButton />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Kelola Review</h1>
        <Button onClick={() => setShowCreate(true)} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />Tambah
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_PILLS.map((pill) => {
            const isActive = filter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => { setFilter((f) => f === pill.key ? 'all' : pill.key); setSelectedIds(new Set()); }}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border whitespace-nowrap transition-colors',
                  isActive ? pill.color : 'bg-white text-text-2 border-border hover:border-green hover:text-green'
                )}
              >
                {pill.label}
                <span className={cn('text-[11px] font-bold px-1.5 py-0 rounded-full', isActive ? 'bg-black/10 text-inherit' : 'bg-border-2 text-text-3')}>
                  {counts[pill.key]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <Select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className={cn('w-[140px]', !timeFilter && 'text-text-3')}>
            {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <MasjidFilterTypeahead options={masjidOptions} value={masjidFilter} onChange={setMasjidFilter} />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari review..." className="pl-9 w-[200px] h-9" />
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      <BulkBar
        count={selectedIds.size}
        onApprove={() => handleBulk('approved')}
        onReject={() => handleBulk('rejected')}
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        selectable
        selectableFilter={(row) => row.status === 'pending'}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyIcon={Star}
        emptyText="Tidak ada review"
        sortConfig={sortConfig}
        onSort={requestSort}
      />

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={(page) => { goToPage(page); setSelectedIds(new Set()); }}
      />

      {/* Create review dialog */}
      <ReviewDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        masjids={masjids}
        users={users}
        review={null}
        onSaved={loadData}
      />

      {/* Edit review dialog */}
      <ReviewDialog
        open={!!editReview}
        onOpenChange={(open) => { if (!open) setEditReview(null); }}
        masjids={masjids}
        users={users}
        review={editReview}
        onSaved={loadData}
      />

      {/* Edit loading overlay */}
      {editLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-lg p-4 flex items-center gap-2 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-green" />
            <span className="text-sm">Memuat review...</span>
          </div>
        </div>
      )}

      {/* Table photo lightbox */}
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
