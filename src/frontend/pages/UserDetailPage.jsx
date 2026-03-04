import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, LogOut, Trash2, MessageSquare, Building2, Wrench } from 'lucide-react';
import { getUser, updateUser, forceLogout, deleteUser, getMasjids, getFacilitySuggestions } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import ActionMenu from '../components/ActionMenu';
import Badge from '../components/Badge';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { SkeletonDetailPage } from '../components/Skeleton';
import { formatWA, formatDate, truncate } from '../utils/format';
import { cn } from '../lib/utils';

const AGE_OPTIONS = ['<15', '16-20', '21-25', '26-30', '31-40', '41-50', '50+'];

function ReviewCell({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-text-3 text-xs">-</span>;
  const isLong = text.length > 50;
  if (!isLong) return <span className="text-xs text-text-2">{text}</span>;
  return (
    <div>
      <span className="text-xs text-text-2">{expanded ? text : text.slice(0, 50) + '...'}</span>
      <button type="button" onClick={() => setExpanded(!expanded)} className="ml-1 text-xs text-green hover:underline">
        {expanded ? 'Tutup' : 'Lihat'}
      </button>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [user, setUser] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [masjids, setMasjids] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reviews');

  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAgeRange, setEditAgeRange] = useState('');
  const [editGender, setEditGender] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getUser(id);
      setUser(data.user);
      setReviews(data.reviews || []);

      // Load masjids submitted by this user
      const masjidData = await getMasjids({ submitted_by: id });
      setMasjids(masjidData);

      // Load facility suggestions by this user's WA
      if (data.user?.wa_number) {
        const facData = await getFacilitySuggestions({ submitted_by_wa: data.user.wa_number });
        setFacilities(facData);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleEditOpen = () => {
    setEditName(user.name || '');
    setEditCity(user.city || '');
    setEditAgeRange(user.age_range || '');
    setEditGender(user.gender || '');
    setEditModal(true);
  };

  const handleEditSave = async () => {
    try {
      await updateUser(id, { name: editName, city: editCity, age_range: editAgeRange || null, gender: editGender || null });
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

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Hapus User',
      message: 'Yakin ingin menghapus user ini? Tindakan ini permanen dan tidak dapat dibatalkan.',
      confirmLabel: 'Hapus',
      confirmStyle: 'red',
    });
    if (!ok) return;
    try {
      await deleteUser(id);
      showToast('User berhasil dihapus');
      navigate('/users');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const tabs = [
    { key: 'reviews', label: 'Review', icon: MessageSquare, count: reviews.length },
    { key: 'masjids', label: 'Masjid', icon: Building2, count: masjids.length },
    { key: 'facilities', label: 'Fasilitas', icon: Wrench, count: facilities.length },
  ];

  const reviewColumns = [
    { key: 'masjid_name', label: 'MASJID', render: (row) => <span className="font-medium">{row.masjid_name || '-'}</span> },
    { key: 'rating', label: 'RATING', render: (row) => row.rating ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{row.rating}</span> : '-' },
    { key: 'short_description', label: 'TESTIMONI', render: (row) => <ReviewCell text={row.short_description} /> },
    { key: 'status', label: 'STATUS', render: (row) => <Badge status={row.status} /> },
    { key: 'created_at', label: 'TANGGAL', render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      label: 'AKSI',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate(`/reviews`)}>Lihat</Button>
        </div>
      ),
    },
  ];

  const masjidColumns = [
    { key: 'name', label: 'NAMA MASJID', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'city', label: 'KOTA', render: (row) => row.city || '-' },
    { key: 'status', label: 'STATUS', render: (row) => <Badge status={row.status} /> },
    { key: 'created_at', label: 'TANGGAL SUBMIT', render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      label: 'AKSI',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate(`/masjids/${row.id}/edit`)}>Lihat</Button>
        </div>
      ),
    },
  ];

  const facilityColumns = [
    { key: 'masjid_name', label: 'MASJID', render: (row) => <span className="font-medium">{row.masjid_name || '-'}</span> },
    { key: 'facility_name', label: 'FASILITAS', render: (row) => row.facility_name || '-' },
    { key: 'suggested_value', label: 'NILAI SARAN', render: (row) => <span className="text-text-2 text-sm">{row.suggested_value ?? '-'}</span> },
    { key: 'status', label: 'STATUS', render: (row) => <Badge status={row.status} /> },
    { key: 'created_at', label: 'TANGGAL', render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
  ];

  if (loading) return <SkeletonDetailPage />;
  if (!user) return <p className="text-text-2 text-sm py-8 text-center">User tidak ditemukan</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Button variant="link" onClick={() => navigate('/users')} className="px-0">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Kembali
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEditOpen}>Edit Profil</Button>
          {admin?.role === 'super_admin' && (
            <ActionMenu items={[
              { label: 'Force Logout', icon: LogOut, onClick: handleForceLogout, destructive: true },
              { label: 'Hapus User', icon: Trash2, onClick: handleDelete, destructive: true },
            ]} />
          )}
        </div>
      </div>

      {/* Profile card */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div><span className="text-xs text-text-3 block">Nama</span><span className="text-sm font-medium text-text">{user.name || '-'}</span></div>
            <div><span className="text-xs text-text-3 block">WhatsApp</span><span className="text-sm text-text">{formatWA(user.wa_number)}</span></div>
            <div><span className="text-xs text-text-3 block">Gender</span><span className="text-sm text-text">{user.gender || '-'}</span></div>
            <div><span className="text-xs text-text-3 block">Kota</span><span className="text-sm text-text">{user.city || '-'}</span></div>
            <div><span className="text-xs text-text-3 block">Usia</span><span className="text-sm text-text">{user.age_range || '-'}</span></div>
            <div><span className="text-xs text-text-3 block">Bergabung</span><span className="text-sm text-text">{formatDate(user.created_at)}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-green text-green'
                : 'border-transparent text-text-3 hover:text-text-2 hover:border-gray-300'
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full font-heading font-medium',
              activeTab === tab.key ? 'bg-emerald-50 text-green' : 'bg-gray-100 text-text-3'
            )}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'reviews' && (
        <DataTable columns={reviewColumns} data={reviews} emptyIcon={MessageSquare} emptyText="Belum ada review" />
      )}
      {activeTab === 'masjids' && (
        <DataTable columns={masjidColumns} data={masjids} emptyIcon={Building2} emptyText="Belum ada masjid" />
      )}
      {activeTab === 'facilities' && (
        <DataTable columns={facilityColumns} data={facilities} emptyIcon={Wrench} emptyText="Belum ada saran fasilitas" />
      )}

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
              <Label>Gender</Label>
              <Select value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                <option value="">Belum diatur</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </Select>
            </div>
            <div>
              <Label>Kota</Label>
              <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
            </div>
            <div>
              <Label>Rentang Usia</Label>
              <Select value={editAgeRange} onChange={(e) => setEditAgeRange(e.target.value)}>
                <option value="">Belum diatur</option>
                {AGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
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
