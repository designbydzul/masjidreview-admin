import { useState, useEffect, useMemo } from 'react';
import { ScrollText, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getChangelogs, createChangelog, updateChangelog, deleteChangelog, toggleChangelogStatus } from '../api';
import FilterTabs from '../components/FilterTabs';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { formatDate, truncate } from '../utils/format';

const CATEGORY_OPTIONS = [
  { value: 'public_app', label: 'Public App' },
  { value: 'admin', label: 'Admin' },
  { value: 'worker', label: 'Worker' },
  { value: 'database', label: 'Database' },
  { value: 'deployment', label: 'Deployment' },
  { value: 'docs', label: 'Docs' },
];

const CATEGORY_COLORS = {
  public_app: 'bg-blue-50 text-blue-700 border-blue-200',
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  worker: 'bg-amber-50 text-amber-700 border-amber-200',
  database: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  deployment: 'bg-rose-50 text-rose-700 border-rose-200',
  docs: 'bg-gray-100 text-gray-600 border-gray-200',
};

const emptyForm = { version: '', title: '', details: '', categories: [] };

export default function ChangelogPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchEntries = () => {
    setLoading(true);
    getChangelogs()
      .then(setEntries)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEntries(); }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.status === filter);
  }, [entries, filter]);

  const tabs = useMemo(() => [
    { key: 'all', label: 'Semua', count: entries.length },
    { key: 'draft', label: 'Draft', count: entries.filter((e) => e.status === 'draft').length },
    { key: 'published', label: 'Published', count: entries.filter((e) => e.status === 'published').length },
  ], [entries]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [filter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowDialog(true);
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    let cats = [];
    try { cats = JSON.parse(entry.categories || '[]'); } catch { cats = []; }
    setForm({
      version: entry.version,
      title: entry.title,
      details: entry.details || '',
      categories: cats,
    });
    setErrors({});
    setShowDialog(true);
  };

  const handleCategoryToggle = (value) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(value)
        ? prev.categories.filter((c) => c !== value)
        : [...prev.categories, value],
    }));
  };

  const handleSave = async () => {
    const errs = {};
    if (!form.version.trim()) errs.version = 'Version wajib diisi';
    if (!form.title.trim()) errs.title = 'Title wajib diisi';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        version: form.version.trim(),
        title: form.title.trim(),
        details: form.details.trim() || null,
        categories: form.categories,
      };
      if (editingId) {
        await updateChangelog(editingId, payload);
        showToast('Changelog diperbarui');
      } else {
        await createChangelog(payload);
        showToast('Changelog ditambahkan');
      }
      setShowDialog(false);
      fetchEntries();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (entry) => {
    const newStatus = entry.status === 'published' ? 'draft' : 'published';
    try {
      await toggleChangelogStatus(entry.id, newStatus);
      showToast(newStatus === 'published' ? 'Changelog dipublish' : 'Changelog di-unpublish');
      fetchEntries();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (entry) => {
    const ok = await confirm({
      title: 'Hapus Changelog',
      message: `Yakin hapus "${entry.version} - ${entry.title}"?`,
      confirmLabel: 'Hapus',
      confirmStyle: 'red',
    });
    if (!ok) return;
    try {
      await deleteChangelog(entry.id);
      showToast('Changelog dihapus');
      fetchEntries();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const parseCategories = (cats) => {
    try { return JSON.parse(cats || '[]'); } catch { return []; }
  };

  const columns = [
    {
      key: 'version',
      label: 'Version',
      render: (row) => <span className="font-semibold text-text">{row.version}</span>,
    },
    {
      key: 'title',
      label: 'Title',
      render: (row) => <span className="text-text">{truncate(row.title, 60)}</span>,
    },
    {
      key: 'categories',
      label: 'Categories',
      render: (row) => {
        const cats = parseCategories(row.categories);
        if (cats.length === 0) return <span className="text-text-3">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <span
                key={c}
                className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${CATEGORY_COLORS[c] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
              >
                {CATEGORY_OPTIONS.find((o) => o.value === c)?.label || c}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    {
      key: 'created_at',
      label: 'Tanggal',
      render: (row) => <span className="text-text-2 text-sm">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => openEdit(row)}>Edit</Button>
          {row.status === 'draft' ? (
            <Button size="sm" onClick={() => handleToggleStatus(row)}>Publish</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => handleToggleStatus(row)}>Unpublish</Button>
          )}
          {admin?.role === 'super_admin' && (
            <Button variant="outline" size="sm" className="text-red hover:border-red" onClick={() => handleDelete(row)}>
              Hapus
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border-2 rounded w-48" />
          <div className="h-10 bg-border-2 rounded w-full" />
          <div className="h-10 bg-border-2 rounded w-full" />
          <div className="h-10 bg-border-2 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading font-bold text-xl text-text">Changelog</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tambah Changelog
        </Button>
      </div>

      <FilterTabs tabs={tabs} activeTab={filter} onTabChange={setFilter} />

      <DataTable
        columns={columns}
        data={paginatedData}
        emptyIcon={ScrollText}
        emptyText="Belum ada changelog"
      />

      <Pagination
        currentPage={page}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) setShowDialog(false); }}>
        <DialogContent className="max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Changelog' : 'Tambah Changelog'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Version</Label>
              <Input
                placeholder="e.g. v16"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
              />
              {errors.version && <p className="text-red text-xs mt-1">{errors.version}</p>}
            </div>
            <div>
              <Label>Title</Label>
              <Input
                placeholder="Ringkasan singkat perubahan"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              {errors.title && <p className="text-red text-xs mt-1">{errors.title}</p>}
            </div>
            <div>
              <Label>Details</Label>
              <Textarea
                placeholder="Deskripsi lengkap perubahan (markdown supported)"
                className="min-h-[200px]"
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Categories</Label>
              <div className="flex flex-wrap gap-3">
                {CATEGORY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.categories.includes(opt.value)}
                      onCheckedChange={() => handleCategoryToggle(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
