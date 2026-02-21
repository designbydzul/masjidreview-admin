import { useState, useEffect, useRef, useMemo } from 'react';
import { KeyRound, Plus } from 'lucide-react';
import { getAdmins, searchUsers, changeUserRole } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import SearchFilter, { useSearchFilter } from '../components/SearchFilter';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { formatWA, formatDate } from '../utils/format';

export default function AdminListPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPromote, setShowPromote] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [promoteRole, setPromoteRole] = useState('admin');
  const debounceRef = useRef(null);
  const { search: listSearch, debouncedSearch: listDebouncedSearch, filterValues: listFilterValues, handleSearchChange: handleListSearchChange, handleFilterChange: handleListFilterChange } = useSearchFilter();

  const loadData = () => {
    getAdmins()
      .then(setAdmins)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleSearch = (q) => {
    setSearchQuery(q);
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
      setSearchQuery('');
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

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'super_admin', label: 'Super Admin' },
  ];

  const filteredAdmins = useMemo(() => {
    let result = admins;
    if (listDebouncedSearch) {
      const q = listDebouncedSearch.toLowerCase();
      result = result.filter((a) => a.name?.toLowerCase().includes(q));
    }
    if (listFilterValues.role) result = result.filter((a) => a.role === listFilterValues.role);
    return result;
  }, [admins, listDebouncedSearch, listFilterValues]);

  const columns = [
    { key: 'name', label: 'Nama', render: (row) => <span className="font-medium">{row.name || '-'}</span> },
    { key: 'wa_number', label: 'WhatsApp', render: (row) => <span className="text-text-2">{formatWA(row.wa_number)}</span> },
    { key: 'role', label: 'Role', render: (row) => <Badge status={row.role} /> },
    { key: 'created_at', label: 'Bergabung', render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => {
        if (row.id === admin?.id) return <span className="text-xs text-text-3">Anda</span>;
        return (
          <div className="flex gap-1.5 flex-wrap">
            {row.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={() => handleRoleChange(row.id, 'super_admin')} className="text-green hover:border-green">Jadikan Super Admin</Button>
            )}
            {row.role === 'super_admin' && (
              <Button variant="outline" size="sm" onClick={() => handleRoleChange(row.id, 'admin')}>Jadikan Admin</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => handleDemote(row.id, row.name)} className="text-red hover:border-red">Demote</Button>
          </div>
        );
      },
    },
  ];

  if (loading) return <p className="text-text-2 text-sm py-8 text-center">Memuat data admin...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Kelola Admin</h1>
        <Button onClick={() => setShowPromote(true)} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />
          Promote User
        </Button>
      </div>

      <SearchFilter
        searchPlaceholder="Cari nama admin..."
        searchValue={listSearch}
        onSearchChange={handleListSearchChange}
        filters={[
          { key: 'role', label: 'Role', options: roleOptions },
        ]}
        filterValues={listFilterValues}
        onFilterChange={handleListFilterChange}
      />

      <DataTable columns={columns} data={filteredAdmins} emptyIcon={KeyRound} emptyText="Tidak ada admin" />

      {/* Promote dialog */}
      <Dialog open={showPromote} onOpenChange={(open) => {
        setShowPromote(open);
        if (!open) { setSearchQuery(''); setSearchResults([]); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote User ke Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cari user (nama atau nomor WA)</Label>
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
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

          {searchQuery.length >= 3 && searchResults.length === 0 && (
            <p className="text-text-3 text-sm mt-3 text-center">Tidak ada user ditemukan</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
