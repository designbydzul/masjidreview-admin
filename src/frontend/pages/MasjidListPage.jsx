import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import { Building2, Plus, ImageIcon, Pencil, XCircle, Search as SearchIcon, Trash2, ExternalLink } from 'lucide-react';
import { getMasjids, setMasjidStatus, bulkMasjidStatus, deleteMasjid, getSimilarMasjids } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import ActionMenu from '../components/ActionMenu';
import BulkBar from '../components/BulkBar';
import Badge from '../components/Badge';
import SearchFilter, { useSearchFilter } from '../components/SearchFilter';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import useClientSort from '../hooks/useClientSort';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { SkeletonTablePage } from '../components/Skeleton';

export default function MasjidListPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [masjids, setMasjids] = useState([]);
  const [filter, setFilter] = useState(() => {
    const s = searchParams.get('status');
    return s && ['approved', 'pending', 'rejected'].includes(s) ? s : 'all';
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [similarData, setSimilarData] = useState(null);
  const { search, debouncedSearch, filterValues, handleSearchChange, handleFilterChange } = useSearchFilter();

  const loadData = async () => {
    try {
      const data = await getMasjids();
      setMasjids(data);
    } catch (err) {
      showToast('Gagal memuat data masjid', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
    if (filter !== 'all') result = result.filter((m) => m.status === filter);
    if (debouncedSearch) {
      const matchedIds = new Set(fuse.search(debouncedSearch).map((r) => r.item.id));
      result = result.filter((m) => matchedIds.has(m.id));
    }
    if (filterValues.city) result = result.filter((m) => m.city === filterValues.city);
    return result;
  }, [masjids, fuse, filter, debouncedSearch, filterValues]);

  const { sortedData, sortConfig, requestSort } = useClientSort(filtered);

  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(
    sortedData,
    [filter, debouncedSearch, filterValues, sortConfig]
  );

  const counts = {
    all: masjids.length,
    approved: masjids.filter((m) => m.status === 'approved').length,
    pending: masjids.filter((m) => m.status === 'pending').length,
    rejected: masjids.filter((m) => m.status === 'rejected').length,
  };

  const handleStatus = async (id, status) => {
    try {
      await setMasjidStatus(id, status);
      showToast('Status masjid diperbarui');
      setSelectedIds(new Set());
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulk = async (status) => {
    try {
      await bulkMasjidStatus([...selectedIds], status);
      showToast(`${selectedIds.size} masjid di-${status}`);
      setSelectedIds(new Set());
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({ title: 'Hapus Masjid', message: `Yakin hapus "${name}"? Semua review terkait juga akan dihapus.`, confirmLabel: 'Hapus', confirmStyle: 'red' });
    if (!ok) return;
    try {
      await deleteMasjid(id);
      showToast('Masjid dihapus');
      loadData();
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

  const buildMenuItems = (row) => {
    const items = [];
    if (row.status === 'pending') {
      items.push({ label: 'Edit', icon: Pencil, onClick: () => navigate(`/masjids/${row.id}/edit`) });
    }
    if (row.status === 'approved') {
      items.push({ label: 'Reject', icon: XCircle, onClick: () => handleStatus(row.id, 'rejected') });
    }
    items.push({ label: 'Cek Duplikat', icon: SearchIcon, onClick: () => handleCheckSimilar(row.id) });
    if (admin?.role === 'super_admin') {
      items.push({ label: 'Hapus', icon: Trash2, onClick: () => handleDelete(row.id, row.name), destructive: true });
    }
    return items;
  };

  const columns = [
    {
      key: 'photo_url',
      label: 'Foto',
      render: (row) => row.photo_url
        ? <img src={row.photo_url} alt={row.name} className="w-10 h-10 rounded object-cover" />
        : <div className="w-10 h-10 rounded bg-bg-2 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-text-3" /></div>,
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
              {row.pending_corrections > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full bg-orange-100 text-orange-700 border border-orange-200 shrink-0"
                  title={`${row.pending_corrections} koreksi fasilitas menunggu review`}
                >
                  {row.pending_corrections}
                </span>
              )}
            </div>
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
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.status === 'pending' && (
            <>
              <Button size="sm" onClick={() => handleStatus(row.id, 'approved')}>Approve</Button>
              <Button variant="outline" size="sm" onClick={() => handleStatus(row.id, 'rejected')} className="hover:border-red hover:text-red">Reject</Button>
            </>
          )}
          {row.status === 'approved' && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/masjids/${row.id}/edit`)}>Edit</Button>
          )}
          {row.status === 'rejected' && (
            <>
              <Button size="sm" onClick={() => handleStatus(row.id, 'approved')}>Approve</Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/masjids/${row.id}/edit`)}>Edit</Button>
            </>
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
          Tambah Masjid
        </Button>
      </div>

      <SearchFilter
        searchPlaceholder="Cari nama masjid..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'approved', label: `Approved (${counts.approved})` },
              { value: 'pending', label: `Pending (${counts.pending})` },
              { value: 'rejected', label: `Rejected (${counts.rejected})` },
            ],
            allLabel: `Semua Status (${counts.all})`,
          },
          { key: 'city', label: 'Kota', options: cityOptions },
        ]}
        filterValues={{ ...filterValues, status: filter === 'all' ? '' : filter }}
        onFilterChange={(key, value) => {
          if (key === 'status') {
            setFilter(value || 'all');
            setSelectedIds(new Set());
          } else {
            handleFilterChange(key, value);
          }
        }}
      />

      <BulkBar
        count={selectedIds.size}
        onApprove={() => handleBulk('approved')}
        onReject={() => handleBulk('rejected')}
      />

      <DataTable
        columns={columns}
        data={paginatedData}
        selectable
        selectableFilter={(row) => row.status === 'pending'}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyIcon={Building2}
        emptyText="Tidak ada masjid"
        sortConfig={sortConfig}
        onSort={requestSort}
      />

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
