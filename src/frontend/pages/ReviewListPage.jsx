import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { getReviews, setReviewStatus, bulkReviewStatus, deleteReview } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import FilterTabs from '../components/FilterTabs';
import BulkBar from '../components/BulkBar';
import Badge from '../components/Badge';
import { Button } from '../components/ui/button';
import { truncate, formatDate } from '../utils/format';

export default function ReviewListPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

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

  const filtered = filter === 'all' ? reviews : reviews.filter((r) => r.status === filter);
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
    { key: 'short_description', label: 'Testimoni', render: (row) => <span className="text-text-2">{truncate(row.short_description)}</span> },
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

  if (loading) return <p className="text-text-2 text-sm py-8 text-center">Memuat data review...</p>;

  return (
    <div>
      <h1 className="font-heading text-[22px] font-bold text-text mb-5">Kelola Review</h1>

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

      <BulkBar
        count={selectedIds.size}
        onApprove={() => handleBulk('approved')}
        onReject={() => handleBulk('rejected')}
      />

      <DataTable
        columns={columns}
        data={filtered}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyIcon={Star}
        emptyText="Tidak ada review"
      />
    </div>
  );
}
