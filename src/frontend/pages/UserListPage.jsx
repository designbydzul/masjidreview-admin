import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { getUsers, createUser } from '../api';
import { useToast } from '../contexts/ToastContext';
import DataTable from '../components/DataTable';
import SearchFilter, { useSearchFilter } from '../components/SearchFilter';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import useClientSort from '../hooks/useClientSort';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { SkeletonTablePage } from '../components/Skeleton';
import { formatWA, formatDate } from '../utils/format';

const emptyCreateForm = { name: '', wa_number: '', city: '', age_range: '' };
const AGE_OPTIONS = ['<15', '16-20', '21-25', '26-30', '31-40', '41-50', '50+'];

function normalizeWA(val) {
  let n = val.replace(/[\s\-\+\(\)]/g, '');
  if (n.startsWith('08')) n = '62' + n.slice(1);
  if (n.startsWith('8') && !n.startsWith('62')) n = '62' + n;
  return n;
}

export default function UserListPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { search, debouncedSearch, filterValues, handleSearchChange, handleFilterChange } = useSearchFilter();

  // Create user state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [createErrors, setCreateErrors] = useState({});

  const loadData = () => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(users.map((u) => u.city).filter(Boolean))].sort();
    return cities.map((c) => ({ value: c, label: c }));
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((u) => u.name?.toLowerCase().includes(q) || u.wa_number?.includes(q));
    }
    if (filterValues.city) result = result.filter((u) => u.city === filterValues.city);
    return result;
  }, [users, debouncedSearch, filterValues]);

  const { sortedData, sortConfig, requestSort } = useClientSort(filteredUsers);

  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(
    sortedData,
    [debouncedSearch, filterValues, sortConfig]
  );

  const handleOpenCreate = () => {
    setCreateForm(emptyCreateForm);
    setCreateErrors({});
    setShowCreate(true);
  };

  const setField = (key, val) => {
    setCreateForm((prev) => ({ ...prev, [key]: val }));
    if (createErrors[key]) setCreateErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleCreateSubmit = async () => {
    const errors = {};
    if (!createForm.name.trim()) errors.name = 'Nama wajib diisi';

    if (!createForm.wa_number.trim()) {
      errors.wa_number = 'Nomor WA wajib diisi';
    } else {
      const normalized = normalizeWA(createForm.wa_number);
      if (!/^62\d{8,13}$/.test(normalized)) {
        errors.wa_number = 'Format nomor WA tidak valid (harus 628xxx, 10-15 digit)';
      } else {
        const duplicate = users.find((u) => u.wa_number === normalized);
        if (duplicate) {
          errors.wa_number = 'Nomor WA sudah terdaftar';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setCreateSaving(true);
    try {
      await createUser({
        name: createForm.name.trim(),
        wa_number: normalizeWA(createForm.wa_number),
        city: createForm.city.trim() || null,
        age_range: createForm.age_range || null,
      });
      showToast('User ditambahkan');
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      loadData();
    } catch (err) {
      if (err.message === 'Nomor WA sudah terdaftar') {
        setCreateErrors({ wa_number: err.message });
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setCreateSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nama', sortable: true, render: (row) => <span className="font-medium">{row.name || '-'}</span> },
    { key: 'wa_number', label: 'WhatsApp', render: (row) => <span className="text-text-2">{formatWA(row.wa_number)}</span> },
    { key: 'email', label: 'Email', render: (row) => <span className="text-text-2 text-xs">{row.email || '-'}</span> },
    { key: 'city', label: 'Kota', sortable: true, render: (row) => row.city || '-' },
    { key: 'age_range', label: 'Usia', sortable: true, render: (row) => row.age_range || '-' },
    { key: 'review_count', label: 'Reviews', sortable: true, render: (row) => <span className="font-heading font-medium">{row.review_count || 0}</span> },
    { key: 'created_at', label: 'Bergabung', sortable: true, render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => navigate(`/users/${row.id}`)}>
          Detail
        </Button>
      ),
    },
  ];

  if (loading) return <SkeletonTablePage columns={8} hasButton />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Kelola Users</h1>
        <Button onClick={handleOpenCreate} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />
          Tambah User
        </Button>
      </div>
      <SearchFilter
        searchPlaceholder="Cari nama atau nomor WA..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filters={[
          { key: 'city', label: 'Kota', options: cityOptions },
        ]}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
      />
      <DataTable
        columns={columns}
        data={paginatedData}
        emptyIcon={Users}
        emptyText="Tidak ada user"
        sortConfig={sortConfig}
        onSort={requestSort}
      />

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={goToPage}
      />

      {/* Create user dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) setShowCreate(false); }}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Tambah User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Nama lengkap"
              />
              {createErrors.name && <p className="text-red text-xs mt-1">{createErrors.name}</p>}
            </div>
            <div>
              <Label>Nomor WhatsApp *</Label>
              <Input
                value={createForm.wa_number}
                onChange={(e) => setField('wa_number', e.target.value)}
                placeholder="Contoh: 6281234567890"
              />
              {createErrors.wa_number
                ? <p className="text-red text-xs mt-1">{createErrors.wa_number}</p>
                : <p className="text-text-3 text-xs mt-1">Format: 628xxx (tanpa spasi/strip)</p>
              }
            </div>
            <div>
              <Label>Kota</Label>
              <Input
                list="city-options"
                value={createForm.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="Ketik atau pilih kota"
              />
              <datalist id="city-options">
                {cityOptions.map((c) => (
                  <option key={c.value} value={c.value} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Rentang Usia</Label>
              <Select value={createForm.age_range} onChange={(e) => setField('age_range', e.target.value)}>
                <option value="">Belum diatur</option>
                {AGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
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
