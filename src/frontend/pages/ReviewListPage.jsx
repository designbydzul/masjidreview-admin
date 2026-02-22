import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Star, Plus } from 'lucide-react';
import { getReviews, createReview, getMasjids, setReviewStatus, bulkReviewStatus, deleteReview } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import FilterTabs from '../components/FilterTabs';
import BulkBar from '../components/BulkBar';
import Badge from '../components/Badge';
import ExpandableText from '../components/ExpandableText';
import SearchFilter, { useSearchFilter } from '../components/SearchFilter';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { SkeletonTablePage } from '../components/Skeleton';
import { formatDate } from '../utils/format';

const emptyCreateForm = {
  masjid_id: '',
  reviewer_name: '',
  rating: '',
  short_description: '',
  source_platform: '',
  source_url: '',
};

const RATING_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const PLATFORM_OPTIONS = ['web', 'wa_bot', 'ig', 'x', 'threads', 'form'];

export default function ReviewListPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState(() => {
    const s = searchParams.get('status');
    return s && ['approved', 'pending', 'rejected'].includes(s) ? s : 'all';
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const { search, debouncedSearch, filterValues, handleSearchChange, handleFilterChange } = useSearchFilter();

  // Create review state
  const [showCreate, setShowCreate] = useState(false);
  const [masjids, setMasjids] = useState([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [createErrors, setCreateErrors] = useState({});

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

  useEffect(() => { loadData(); }, []);

  const handleOpenCreate = async () => {
    setCreateForm(emptyCreateForm);
    setCreateErrors({});
    setShowCreate(true);
    if (masjids.length === 0) {
      try {
        const data = await getMasjids('approved');
        setMasjids(data);
      } catch {
        showToast('Gagal memuat data masjid', 'error');
      }
    }
  };

  const setField = (key, val) => {
    setCreateForm((prev) => ({ ...prev, [key]: val }));
    if (createErrors[key]) setCreateErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleCreateSubmit = async () => {
    const errors = {};
    if (!createForm.masjid_id) errors.masjid_id = 'Masjid wajib dipilih';
    if (!createForm.source_platform) errors.source_platform = 'Platform wajib dipilih';
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setCreateSaving(true);
    try {
      await createReview({
        ...createForm,
        reviewer_name: createForm.reviewer_name.trim() || admin?.name || 'Admin',
        rating: createForm.rating ? Number(createForm.rating) : null,
      });
      showToast('Review ditambahkan');
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreateSaving(false);
    }
  };

  const platformOptions = useMemo(() => {
    const platforms = [...new Set(reviews.map((r) => r.source_platform).filter(Boolean))].sort();
    return platforms.map((p) => ({ value: p, label: p }));
  }, [reviews]);

  const filtered = useMemo(() => {
    let result = reviews;
    if (filter !== 'all') result = result.filter((r) => r.status === filter);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((r) => r.reviewer_name?.toLowerCase().includes(q) || r.masjid_name?.toLowerCase().includes(q));
    }
    if (filterValues.platform) result = result.filter((r) => r.source_platform === filterValues.platform);
    return result;
  }, [reviews, filter, debouncedSearch, filterValues]);

  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(
    filtered,
    [filter, debouncedSearch, filterValues]
  );

  const counts = {
    all: reviews.length,
    approved: reviews.filter((r) => r.status === 'approved').length,
    pending: reviews.filter((r) => r.status === 'pending').length,
    rejected: reviews.filter((r) => r.status === 'rejected').length,
  };

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

  const columns = [
    { key: 'reviewer_name', label: 'Reviewer', render: (row) => <span className="font-medium">{row.reviewer_name || '-'}</span> },
    { key: 'masjid_name', label: 'Masjid', render: (row) => row.masjid_name || '-' },
    { key: 'rating', label: 'Rating', render: (row) => row.rating ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{row.rating}</span> : '-' },
    { key: 'short_description', label: 'Testimoni', render: (row) => <ExpandableText text={row.short_description} /> },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
    { key: 'created_at', label: 'Tanggal', render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate(`/reviews/${row.id}/edit`)}>Edit</Button>
          {row.status === 'pending' && (
            <>
              <Button size="sm" onClick={() => handleStatus(row.id, 'approved')}>Approve</Button>
              <Button variant="outline" size="sm" onClick={() => handleStatus(row.id, 'rejected')} className="hover:border-red hover:text-red">Reject</Button>
            </>
          )}
          {row.status === 'rejected' && (
            <Button size="sm" onClick={() => handleStatus(row.id, 'approved')}>Approve</Button>
          )}
          {row.status === 'approved' && (
            <Button variant="outline" size="sm" onClick={() => handleStatus(row.id, 'rejected')} className="hover:border-red hover:text-red">Reject</Button>
          )}
          {admin?.role === 'super_admin' && (
            <Button variant="outline" size="sm" onClick={() => handleDelete(row.id)} className="text-red hover:border-red">Hapus</Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <SkeletonTablePage columns={6} hasFilterTabs hasButton />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Kelola Review</h1>
        <Button onClick={handleOpenCreate} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />
          Tambah Review
        </Button>
      </div>

      <FilterTabs
        tabs={[
          { key: 'all', label: 'Semua', count: counts.all },
          { key: 'approved', label: 'Approved', count: counts.approved },
          { key: 'pending', label: 'Pending', count: counts.pending },
          { key: 'rejected', label: 'Rejected', count: counts.rejected },
        ]}
        activeTab={filter}
        onTabChange={(t) => { setFilter(t); setSelectedIds(new Set()); }}
      />

      <SearchFilter
        searchPlaceholder="Cari reviewer atau masjid..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filters={[
          { key: 'platform', label: 'Platform', options: platformOptions },
        ]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
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
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyIcon={Star}
        emptyText="Tidak ada review"
      />

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={(page) => { goToPage(page); setSelectedIds(new Set()); }}
      />

      {/* Create review dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) setShowCreate(false); }}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tambah Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Masjid *</Label>
              <Select value={createForm.masjid_id} onChange={(e) => setField('masjid_id', e.target.value)}>
                <option value="">-- Pilih Masjid --</option>
                {masjids.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} – {m.city}</option>
                ))}
              </Select>
              {createErrors.masjid_id && <p className="text-red text-xs mt-1">{createErrors.masjid_id}</p>}
            </div>
            <div>
              <Label>Nama Reviewer</Label>
              <Input
                value={createForm.reviewer_name}
                onChange={(e) => setField('reviewer_name', e.target.value)}
                placeholder={`Kosongkan untuk default "${admin?.name || 'Admin'}"`}
              />
            </div>
            <div>
              <Label>Rating (1-5)</Label>
              <Select value={createForm.rating} onChange={(e) => setField('rating', e.target.value)}>
                <option value="">-- Tidak ada --</option>
                {RATING_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Platform *</Label>
              <Select value={createForm.source_platform} onChange={(e) => setField('source_platform', e.target.value)}>
                <option value="">-- Pilih Platform --</option>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              {createErrors.source_platform && <p className="text-red text-xs mt-1">{createErrors.source_platform}</p>}
            </div>
            <div>
              <Label>Testimoni</Label>
              <Textarea
                value={createForm.short_description}
                onChange={(e) => setField('short_description', e.target.value)}
                rows={3}
                placeholder="Isi testimoni review..."
              />
            </div>
            <div>
              <Label>Source URL</Label>
              <Input
                value={createForm.source_url}
                onChange={(e) => setField('source_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreateSubmit} disabled={createSaving} className="font-semibold">
              {createSaving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
