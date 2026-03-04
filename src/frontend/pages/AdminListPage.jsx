import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Plus, Search } from 'lucide-react';
import { getAdmins, searchUsers, changeUserRole } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import ActionMenu from '../components/ActionMenu';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { SkeletonTablePage } from '../components/Skeleton';
import { formatWA, formatDate } from '../utils/format';
import { cn } from '../lib/utils';

const ROLE_PILLS = [
  { key: 'admin', label: 'Admin', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { key: 'super_admin', label: 'Super Admin', color: 'bg-rose-50 text-rose-700 border-rose-300' },
];

export default function AdminListPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showPromote, setShowPromote] = useState(false);
  const [promoteSearchQuery, setPromoteSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [promoteRole, setPromoteRole] = useState('admin');
  const debounceRef = useRef(null);

  const counts = useMemo(() => {
    const result = { admin: 0, super_admin: 0 };
    admins.forEach((a) => {
      if (result[a.role] !== undefined) result[a.role]++;
    });
    return result;
  }, [admins]);

  const filteredAdmins = useMemo(() => {
    let result = admins;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.name?.toLowerCase().includes(q));
    }
    if (roleFilter) {
      result = result.filter((a) => a.role === roleFilter);
    }
    return result;
  }, [admins, searchQuery, roleFilter]);

  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(
    filteredAdmins,
    [searchQuery, roleFilter]
  );

  const loadData = () => {
    getAdmins()
      .then(setAdmins)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handlePromoteSearch = (q) => {
    setPromoteSearchQuery(q);
    clearTimeout(debounceRef.current);
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(q);
        setSearchResults(results);
      } catch { setSearchResults([]); }
    }, 300);
  };

  const handlePromote = async (userId) => {
    try {
      await changeUserRole(userId, promoteRole);
      showToast('User dipromosikan');
      setShowPromote(false);
      setPromoteSearchQuery('');
      setSearchResults([]);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await changeUserRole(userId, newRole);
      showToast('Role diperbarui');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDemote = async (userId, name) => {
    const ok = await confirm({ title: 'Demote Admin', message: `Yakin demote "${name}" menjadi user biasa? Semua sesi admin akan dihapus.`, confirmLabel: 'Demote', confirmStyle: 'red' });
    if (!ok) return;
    try {
      await changeUserRole(userId, 'user');
      showToast('Admin di-demote');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const columns = [
    { key: 'name', label: 'NAMA', render: (row) => <span className="font-medium">{row.name || '-'}</span> },
    { key: 'wa_number', label: 'WHATSAPP', render: (row) => <span className="text-text-2">{formatWA(row.wa_number)}</span> },
    { key: 'email', label: 'EMAIL', render: (row) => <span className="text-text-2 text-xs">{row.email || '-'}</span> },
    { key: 'city', label: 'KOTA', render: (row) => row.city || '-' },
    { key: 'role', label: 'ROLE', render: (row) => {
      const pill = ROLE_PILLS.find((p) => p.key === row.role);
      return pill ? <span className={cn('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border', pill.color)}>{pill.label}</span> : row.role;
    }},
    { key: 'review_count', label: 'REVIEWS', render: (row) => <span className="font-heading font-medium">{row.review_count || 0}</span> },
    { key: 'created_at', label: 'BERGABUNG', render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    { key: 'actions', label: 'AKSI', className: 'text-right', render: (row) => {
      if (row.id === admin?.id) return <span className="text-xs text-text-3 italic">Anda</span>;
      const items = [];
      if (row.role === 'admin') {
        items.push({ label: 'Jadikan Super Admin', onClick: () => handleRoleChange(row.id, 'super_admin') });
      }
      if (row.role === 'super_admin') {
        items.push({ label: 'Jadikan Admin', onClick: () => handleRoleChange(row.id, 'admin') });
      }
      items.push({ label: 'Demote', onClick: () => handleDemote(row.id, row.name), destructive: true });
      items.push({ label: 'Detail', onClick: () => navigate(`/users/${row.id}`) });
      return (
        <div className="flex justify-end">
          <ActionMenu items={items} />
        </div>
      );
    }},
  ];

  if (loading) return <SkeletonTablePage columns={8} hasButton />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Kelola Admin</h1>
        <Button onClick={() => setShowPromote(true)} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />Tambah
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          {ROLE_PILLS.map((pill) => {
            const isActive = roleFilter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => setRoleFilter((f) => f === pill.key ? '' : pill.key)}
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
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama admin..." className="pl-9 w-[220px] h-9" />
        </div>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={paginatedData} emptyIcon={KeyRound} emptyText="Tidak ada admin" />

      <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={goToPage} />

      {/* Promote dialog */}
      <Dialog open={showPromote} onOpenChange={(open) => {
        setShowPromote(open);
        if (!open) { setPromoteSearchQuery(''); setSearchResults([]); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote User ke Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cari user (nama atau nomor WA)</Label>
              <Input
                value={promoteSearchQuery}
                onChange={(e) => handlePromoteSearch(e.target.value)}
                placeholder="Min 3 karakter..."
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={promoteRole} onChange={(e) => setPromoteRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </Select>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2 bg-bg rounded-sm">
                  <div>
                    <div className="text-sm font-medium text-text">{u.name || '-'}</div>
                    <div className="text-xs text-text-3">{formatWA(u.wa_number)}</div>
                  </div>
                  <Button size="sm" onClick={() => handlePromote(u.id)} className="font-semibold">Promote</Button>
                </div>
              ))}
            </div>
          )}

          {promoteSearchQuery.length >= 3 && searchResults.length === 0 && (
            <p className="text-text-3 text-sm mt-3 text-center">Tidak ada user ditemukan</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
