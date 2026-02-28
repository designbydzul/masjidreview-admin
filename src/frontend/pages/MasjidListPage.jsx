import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import { Building2, Plus, ImageIcon, Pencil, XCircle, Search, X, Trash2, ExternalLink, ChevronDown, CheckCircle2 } from 'lucide-react';
import { getMasjids, setMasjidStatus, bulkMasjidStatus, bulkDeleteMasjids, deleteMasjid, getSimilarMasjids } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import ActionMenu from '../components/ActionMenu';
import Badge from '../components/Badge';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import useClientSort from '../hooks/useClientSort';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { SkeletonTablePage } from '../components/Skeleton';
import { resolvePhotoUrl } from '../utils/url';
import { cn } from '../lib/utils';

const KELENGKAPAN_OPTIONS = [
  { value: 'address', label: 'Belum ada Alamat' },
  { value: 'google_maps_url', label: 'Belum ada Link Maps' },
  { value: 'coordinates', label: 'Belum ada Koordinat' },
  { value: 'photo', label: 'Belum ada Foto' },
  { value: 'facilities', label: 'Belum ada Fasilitas' },
  { value: 'corrections', label: 'Ada Koreksi Fasilitas' },
];

export default function MasjidListPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [masjids, setMasjids] = useState([]);
  const [filter, setFilter] = useState(() => {
    const s = searchParams.get('status');
    return s && ['approved', 'pending', 'rejected'].includes(s) ? s : '';
  });
  const [cityFilter, setCityFilter] = useState('');
  const [missingFilter, setMissingFilter] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [similarData, setSimilarData] = useState(null);

  // Kota searchable dropdown
  const [kotaOpen, setKotaOpen] = useState(false);
  const [kotaSearch, setKotaSearch] = useState('');
  const kotaRef = useRef(null);
  const kotaSearchRef = useRef(null);

  useEffect(() => {
    if (!kotaOpen) { setKotaSearch(''); return; }
    setTimeout(() => kotaSearchRef.current?.focus(), 50);
    const handleClick = (e) => { if (kotaRef.current && !kotaRef.current.contains(e.target)) setKotaOpen(false); };
    const handleKey = (e) => { if (e.key === 'Escape') setKotaOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [kotaOpen]);

  // Search with debounce
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);
  const searchInputRef = useRef(null);

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const loadData = async (params = {}) => {
    try {
      const data = await getMasjids(params);
      setMasjids(data);
    } catch (err) {
      showToast('Gagal memuat data masjid', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reload when missing filter changes (server-side filter)
  useEffect(() => {
    const params = {};
    if (missingFilter.length > 0) params.missing = missingFilter.join(',');
    loadData(params);
  }, [missingFilter]);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(masjids.map((m) => m.city).filter(Boolean))].sort();
    return cities.map((c) => ({ value: c, label: c }));
  }, [masjids]);

  const fuse = useMemo(() => new Fuse(masjids, {
    keys: ['name', 'city'],
    threshold: 0.35,
  }), [masjids]);

  const filtered = useMemo(() => {
    let result = masjids;
    if (filter) result = result.filter((m) => m.status === filter);
    if (debouncedSearch) {
      const matchedIds = new Set(fuse.search(debouncedSearch).map((r) => r.item.id));
      result = result.filter((m) => matchedIds.has(m.id));
    }
    if (cityFilter) result = result.filter((m) => m.city === cityFilter);
    return result;
  }, [masjids, fuse, filter, debouncedSearch, cityFilter]);

  const { sortedData, sortConfig, requestSort } = useClientSort(filtered);

  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(
    sortedData,
    [filter, debouncedSearch, cityFilter, missingFilter, sortConfig]
  );

  const counts = useMemo(() => ({
    approved: masjids.filter((m) => m.status === 'approved').length,
    pending: masjids.filter((m) => m.status === 'pending').length,
    rejected: masjids.filter((m) => m.status === 'rejected').length,
  }), [masjids]);

  // ── Handlers ──

  const handleStatus = async (id, status) => {
    try {
      await setMasjidStatus(id, status);
      showToast('Status masjid diperbarui');
      setSelectedIds(new Set());
      loadData(missingFilter.length > 0 ? { missing: missingFilter.join(',') } : {});
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkStatus = async (status) => {
    if (status === 'rejected') {
      const ok = await confirm({ title: 'Tolak Masjid', message: `Yakin ingin menolak ${selectedIds.size} masjid?`, confirmLabel: 'Tolak', confirmStyle: 'red' });
      if (!ok) return;
    }
    try {
      await bulkMasjidStatus([...selectedIds], status);
      showToast(`${selectedIds.size} masjid di-${status}`);
      setSelectedIds(new Set());
      loadData(missingFilter.length > 0 ? { missing: missingFilter.join(',') } : {});
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({ title: 'Hapus Masjid', message: `Yakin ingin menghapus ${selectedIds.size} masjid?`, confirmLabel: 'Hapus', confirmStyle: 'red' });
    if (!ok) return;
    try {
      await bulkDeleteMasjids([...selectedIds]);
      showToast(`${selectedIds.size} masjid dihapus`);
      setSelectedIds(new Set());
      loadData(missingFilter.length > 0 ? { missing: missingFilter.join(',') } : {});
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({ title: 'Hapus Masjid', message: `Yakin hapus "${name}"?`, confirmLabel: 'Hapus', confirmStyle: 'red' });
    if (!ok) return;
    try {
      await deleteMasjid(id);
      showToast('Masjid dihapus');
      loadData(missingFilter.length > 0 ? { missing: missingFilter.join(',') } : {});
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCheckSimilar = async (id) => {
    try {
      const data = await getSimilarMasjids(id);
      if (data.length === 0) {
        showToast('Tidak ada masjid serupa ditemukan');
      } else {
        setSimilarData(data);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ── Three-dot menu items per status ──

  const buildMenuItems = (row) => {
    const items = [];
    if (row.status === 'pending') {
      items.push({ label: 'Edit', icon: Pencil, onClick: () => navigate(`/masjids/${row.id}/edit`) });
    }
    if (row.status === 'approved') {
      items.push({ label: 'Reject', icon: XCircle, onClick: () => handleStatus(row.id, 'rejected') });
    }
    if (row.status === 'rejected') {
      items.push({ label: 'Edit', icon: Pencil, onClick: () => navigate(`/masjids/${row.id}/edit`) });
      items.push({ label: 'Approve', icon: CheckCircle2, onClick: () => handleStatus(row.id, 'approved') });
    }
    if (admin?.role === 'super_admin' && row.status !== 'rejected') {
      items.push({ label: 'Hapus', icon: Trash2, onClick: () => handleDelete(row.id, row.name), destructive: true });
    }
    return items;
  };

  // ── Selectable logic: pending + rejected only when their pill is active ──

  const showCheckboxes = filter === 'pending' || filter === 'rejected';
  const selectableFilter = (row) => row.status === filter;

  // ── Table columns ──

  const columns = [
    {
      key: 'photo_url',
      label: 'Foto',
      render: (row) => row.photo_url
        ? <img src={resolvePhotoUrl(row.photo_url)} alt={row.name} className="w-10 h-10 rounded object-cover" />
        : <div className="w-10 h-10 rounded bg-bg flex items-center justify-center"><ImageIcon className="h-4 w-4 text-text-3" /></div>,
    },
    {
      key: 'name',
      label: 'Nama',
      sortable: true,
      render: (row) => {
        const missing = [];
        if (!row.address) missing.push('Alamat');
        if (!row.photo_url) missing.push('Foto');
        if (!row.google_maps_url) missing.push('Google Maps');
        if (!row.latitude && !row.longitude) missing.push('Koordinat');

        return (
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/masjids/${row.id}/edit`)}
                className="font-medium text-text hover:text-green hover:underline text-left"
              >
                {row.name}
              </button>
              {row.status === 'pending' ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCheckSimilar(row.id); }}
                  className="text-text-3 hover:text-orange-600 shrink-0"
                  title="Cek Duplikat"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              ) : (
                <a
                  href={`https://masjidreview.id/masjids/${row.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-text-3 hover:text-green shrink-0"
                  title="Buka halaman publik"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {row.pending_corrections > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full bg-orange-100 text-orange-700 border border-orange-200 shrink-0"
                  title={`${row.pending_corrections} koreksi fasilitas menunggu review`}
                >
                  {row.pending_corrections}
                </span>
              )}
            </div>
            {row.status === 'pending' && row.address && (
              <p className="text-[11px] text-text-3 mt-0.5">{row.address}</p>
            )}
            {missing.length > 0 && (
              <p className="text-[11px] text-amber-600 mt-0.5">
                Belum lengkap: {missing.join(', ')}
              </p>
            )}
          </div>
        );
      },
    },
    { key: 'city', label: 'Kota', sortable: true },
    {
      key: 'views_30d',
      label: 'Views',
      sortable: true,
      render: (row) => <span className="text-text-2 tabular-nums">{row.views_30d > 0 ? row.views_30d : '-'}</span>,
    },
    {
      key: 'review_count',
      label: 'Reviews',
      sortable: true,
      render: (row) => <span className="text-text-2 tabular-nums">{row.review_count > 0 ? row.review_count : '-'}</span>,
    },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <Badge status={row.status} /> },
    {
      key: 'actions',
      label: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.status === 'pending' && (
            <>
              <Button size="sm" onClick={() => handleStatus(row.id, 'approved')}>Approve</Button>
              <Button variant="outline" size="sm" onClick={() => handleStatus(row.id, 'rejected')} className="hover:border-red hover:text-red">Reject</Button>
            </>
          )}
          {row.status === 'approved' && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/masjids/${row.id}/edit`)}>Edit</Button>
          )}
          {row.status === 'rejected' && admin?.role === 'super_admin' && (
            <Button variant="outline" size="sm" onClick={() => handleDelete(row.id, row.name)} className="text-red hover:border-red hover:bg-red/5">
              <Trash2 className="h-3.5 w-3.5 mr-1" />Hapus
            </Button>
          )}
          <ActionMenu items={buildMenuItems(row)} />
        </div>
      ),
    },
  ];

  if (loading) return <SkeletonTablePage columns={7} hasButton />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Kelola Masjid</h1>
        <Button onClick={() => navigate('/masjids/new')} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />
          Tambah
        </Button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Status pills */}
        {[
          { value: 'pending', label: 'Pending', count: counts.pending, activeClass: 'bg-orange-50 border-orange-300 text-orange-700', dotClass: 'bg-orange-500' },
          { value: 'approved', label: 'Approved', count: counts.approved, activeClass: 'bg-emerald-50 border-emerald-300 text-emerald-700', dotClass: 'bg-emerald-500' },
          { value: 'rejected', label: 'Rejected', count: counts.rejected, activeClass: 'bg-gray-100 border-gray-400 text-gray-700', dotClass: 'bg-gray-500' },
        ].map((pill) => (
          <button
            key={pill.value}
            onClick={() => {
              setFilter((prev) => prev === pill.value ? '' : pill.value);
              setSelectedIds(new Set());
            }}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3 rounded-sm border text-sm font-medium transition-colors',
              filter === pill.value
                ? pill.activeClass
                : 'bg-white border-border text-text-2 hover:border-text-3'
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', filter === pill.value ? pill.dotClass : 'bg-text-3')} />
            {pill.label}
            <span className={cn(
              'text-xs tabular-nums',
              filter === pill.value ? 'opacity-80' : 'text-text-3'
            )}>
              {pill.count}
            </span>
          </button>
        ))}

        {/* Kota searchable dropdown */}
        <div ref={kotaRef} className="relative">
          <button
            onClick={() => setKotaOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1.5 h-9 px-3 rounded-sm border text-sm transition-colors whitespace-nowrap sm:w-[160px] justify-between',
              cityFilter ? 'border-green text-green bg-green-light' : 'border-border text-text-3 bg-white hover:border-green'
            )}
          >
            <span className="truncate">{cityFilter || 'Semua Kota'}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', kotaOpen && 'rotate-180')} />
          </button>
          {kotaOpen && (
            <div className="absolute left-0 top-full mt-1 w-[220px] bg-white border border-border rounded-sm shadow-lg z-20">
              <div className="p-2 border-b border-border">
                <input
                  ref={kotaSearchRef}
                  type="text"
                  value={kotaSearch}
                  onChange={(e) => setKotaSearch(e.target.value)}
                  placeholder="Cari kota..."
                  className="w-full h-8 px-2.5 text-sm border border-border rounded-sm focus:outline-none focus:border-green placeholder:text-text-3"
                />
              </div>
              <div className="max-h-[240px] overflow-y-auto py-1">
                <button
                  onClick={() => { setCityFilter(''); setKotaOpen(false); }}
                  className={cn('flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg', !cityFilter && 'text-green font-medium')}
                >
                  Semua Kota
                  {!cityFilter && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-green" />}
                </button>
                {cityOptions
                  .filter((opt) => !kotaSearch || opt.label.toLowerCase().includes(kotaSearch.toLowerCase()))
                  .map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setCityFilter(opt.value); setKotaOpen(false); }}
                      className={cn('flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg', cityFilter === opt.value && 'text-green font-medium')}
                    >
                      {opt.label}
                      {cityFilter === opt.value && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-green" />}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Kelengkapan multi-select */}
        <MultiSelectDropdown
          label="Kelengkapan"
          options={KELENGKAPAN_OPTIONS}
          selected={missingFilter}
          onChange={setMissingFilter}
        />

        {/* Search input — pushed to right */}
        <div className="relative flex-1 min-w-[180px] ml-auto max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cari masjid..."
            className="flex h-9 w-full rounded-sm border border-border bg-white pl-8 pr-8 py-2 text-sm transition-colors placeholder:text-text-3 focus:outline-none focus:border-green"
          />
          {searchValue && (
            <button
              onClick={() => { handleSearchChange(''); searchInputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-3 hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-4 bg-emerald-50 border border-emerald-200 rounded-sm">
          <span className="text-sm font-medium text-green">{selectedIds.size} dipilih</span>
          <div className="flex gap-2 ml-auto">
            {filter === 'pending' && (
              <>
                <Button size="sm" onClick={() => handleBulkStatus('approved')} className="font-semibold">
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatus('rejected')} className="font-semibold hover:border-red hover:text-red">
                  Reject
                </Button>
              </>
            )}
            {filter === 'rejected' && admin?.role === 'super_admin' && (
              <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="font-semibold">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Hapus
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
        <div className="px-4 sm:px-6 lg:px-8">
          <DataTable
            columns={columns}
            data={paginatedData}
            selectable={showCheckboxes}
            selectableFilter={selectableFilter}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            emptyIcon={Building2}
            emptyText="Tidak ada masjid"
            sortConfig={sortConfig}
            onSort={requestSort}
          />
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={(page) => { goToPage(page); setSelectedIds(new Set()); }}
      />

      {/* Similar masjid dialog */}
      <Dialog open={!!similarData} onOpenChange={(open) => { if (!open) setSimilarData(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Masjid Serupa</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {similarData?.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 bg-bg rounded-sm">
                <div>
                  <div className="text-sm font-medium text-text">{s.name}</div>
                  <div className="text-xs text-text-3">{s.city}</div>
                </div>
                <Badge status={s.status} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
