import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { getUser, updateUser, forceLogout } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { SkeletonDetailPage } from '../components/Skeleton';
import { formatWA, formatDate, truncate } from '../utils/format';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [user, setUser] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAgeRange, setEditAgeRange] = useState('');

  const loadData = () => {
    setLoading(true);
    getUser(id)
      .then((data) => {
        setUser(data.user);
        setReviews(data.reviews || []);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [id]);

  const handleEditOpen = () => {
    setEditName(user.name || '');
    setEditCity(user.city || '');
    setEditAgeRange(user.age_range || '');
    setEditModal(true);
  };

  const handleEditSave = async () => {
    try {
      await updateUser(id, { name: editName, city: editCity, age_range: editAgeRange || null });
      showToast('User diperbarui');
      setEditModal(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleForceLogout = async () => {
    const ok = await confirm({ title: 'Force Logout', message: `Yakin force logout "${user.name}"? Semua sesi aktif akan dihapus.`, confirmLabel: 'Force Logout', confirmStyle: 'red' });
    if (!ok) return;
    try {
      await forceLogout(id);
      showToast('User berhasil di-logout');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const reviewColumns = [
    { key: 'masjid_name', label: 'Masjid', render: (row) => row.masjid_name || '-' },
    { key: 'rating', label: 'Rating', render: (row) => row.rating ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{row.rating}</span> : '-' },
    { key: 'short_description', label: 'Testimoni', render: (row) => <span className="text-text-2">{truncate(row.short_description)}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
    { key: 'created_at', label: 'Tanggal', render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => navigate(`/reviews/${row.id}/edit`)}>Edit</Button>
      ),
    },
  ];

  if (loading) return <SkeletonDetailPage />;
  if (!user) return <p className="text-text-2 text-sm py-8 text-center">User tidak ditemukan</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Button variant="link" onClick={() => navigate('/users')} className="px-0">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Kembali
          </Button>
          <h1 className="font-heading text-[22px] font-bold text-text">{user.name || 'User'}</h1>
        </div>
        <Button variant="destructive" size="sm" onClick={handleForceLogout}>Force Logout</Button>
      </div>

      {/* User info card */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div><span className="text-xs text-text-3 block">Nama</span><span className="text-sm font-medium text-text">{user.name || '-'}</span></div>
            <div><span className="text-xs text-text-3 block">WhatsApp</span><span className="text-sm text-text">{formatWA(user.wa_number)}</span></div>
            <div><span className="text-xs text-text-3 block">Kota</span><span className="text-sm text-text">{user.city || '-'}</span></div>
            <div><span className="text-xs text-text-3 block">Usia</span><span className="text-sm text-text">{user.age_range || '-'}</span></div>
            <div><span className="text-xs text-text-3 block">Bergabung</span><span className="text-sm text-text">{formatDate(user.created_at)}</span></div>
          </div>
          <Button variant="outline" size="sm" onClick={handleEditOpen} className="mt-4 text-green border-green hover:bg-green hover:text-white">
            Edit Profil
          </Button>
        </CardContent>
      </Card>

      {/* Reviews */}
      <h2 className="font-heading text-base font-semibold text-text mb-3">Review oleh user ini ({reviews.length})</h2>
      <DataTable columns={reviewColumns} data={reviews} emptyIcon={Star} emptyText="Belum ada review" />

      {/* Edit dialog */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Profil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Kota</Label>
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
            </div>
            <div>
              <Label>Rentang Usia</Label>
              <Select value={editAgeRange} onChange={(e) => setEditAgeRange(e.target.value)}>
                <option value="">Belum diatur</option>
                <option value="<15">&lt;15</option>
                <option value="16-20">16-20</option>
                <option value="21-25">21-25</option>
                <option value="26-30">26-30</option>
                <option value="31-40">31-40</option>
                <option value="41-50">41-50</option>
                <option value="50+">50+</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(false)}>Batal</Button>
            <Button onClick={handleEditSave} className="font-semibold">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
