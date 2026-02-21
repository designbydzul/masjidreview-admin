import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { getMasjids, setMasjidStatus, bulkMasjidStatus, deleteMasjid, getSimilarMasjids } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import FilterTabs from '../components/FilterTabs';
import BulkBar from '../components/BulkBar';
import Badge from '../components/Badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

export default function MasjidListPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();

  const [masjids, setMasjids] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [similarData, setSimilarData] = useState(null);

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

  const filtered = filter === 'all' ? masjids : masjids.filter((m) => m.status === filter);
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

  const columns = [
    { key: 'name', label: 'Nama', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'city', label: 'Kota' },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate(`/masjids/${row.id}/edit`)}>Edit</Button>
          {row.status === 'pending' && (
            <>
              <Button size="sm" onClick={() => handleStatus(row.id, 'approved')}>Approve</Button>
              <Button variant="outline" size="sm" onClick={() => handleStatus(row.id, 'rejected')} className="hover:border-red hover:text-red">Reject</Button>
              <Button size="sm" onClick={() => handleCheckSimilar(row.id)} className="bg-amber-50 text-amber-600 border border-amber-200 hover:opacity-80">Cek Duplikat</Button>
            </>
          )}
          {admin?.role === 'super_admin' && (
            <Button variant="outline" size="sm" onClick={() => handleDelete(row.id, row.name)} className="text-red hover:border-red">Hapus</Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <p className="text-text-2 text-sm py-8 text-center">Memuat data masjid...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Kelola Masjid</h1>
        <Button onClick={() => navigate('/masjids/new')} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />
          Tambah Masjid
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
        emptyIcon={Building2}
        emptyText="Tidak ada masjid"
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
