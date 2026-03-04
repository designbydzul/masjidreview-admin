import { useState, useEffect, useMemo } from 'react';
import { ScrollText, Search, Pencil, Eye, EyeOff, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getChangelogs, createChangelog, updateChangelog, deleteChangelog, toggleChangelogStatus } from '../api';
import DataTable from '../components/DataTable';
import ActionMenu from '../components/ActionMenu';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import useClientSort from '../hooks/useClientSort';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { SkeletonTablePage } from '../components/Skeleton';
import { formatDate } from '../utils/format';
import { cn } from '../lib/utils';

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

const STATUS_PILLS = [
  { key: 'draft', label: 'Draft', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { key: 'published', label: 'Published', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
];

const emptyForm = { version: '', title: '', details: '', categories: [] };

function parseCategories(cats) {
  try { return JSON.parse(cats || '[]'); } catch { return []; }
}

function CategoryTags({ cats }) {
  const parsed = parseCategories(cats);
  if (parsed.length === 0) return <span className="text-text-3">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parsed.map((c) => (
        <span key={c} className={cn('inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full border', CATEGORY_COLORS[c] || 'bg-gray-100 text-gray-600 border-gray-200')}>
          {CATEGORY_OPTIONS.find((o) => o.value === c)?.label || c}
        </span>
      ))}
    </div>
  );
}

// ─── Simple Markdown Renderer ────────────────────────────────
function MarkdownContent({ text }) {
  if (!text) return <p className="text-text-3 text-sm">Tidak ada detail.</p>;

  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;

  const flushList = () => {
    if (listItems.length > 0) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      const cls = listType === 'ol' ? 'list-decimal' : 'list-disc';
      elements.push(<Tag key={elements.length} className={cn(cls, 'pl-5 mb-3 space-y-1 text-sm text-text-2')}>{listItems.map((li, i) => <li key={i}>{renderInline(li)}</li>)}</Tag>);
      listItems = [];
      listType = null;
    }
  };

  const renderInline = (str) => {
    // Bold, inline code, links
    const parts = [];
    let remaining = str;
    let key = 0;
    const regex = /(\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
    let match;
    let lastIdx = 0;
    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIdx) parts.push(<span key={key++}>{remaining.slice(lastIdx, match.index)}</span>);
      if (match[2]) parts.push(<strong key={key++} className="font-semibold text-text">{match[2]}</strong>);
      else if (match[3]) parts.push(<code key={key++} className="bg-gray-100 text-rose-600 px-1 py-0.5 rounded text-xs font-mono">{match[3]}</code>);
      else if (match[4] && match[5]) parts.push(<a key={key++} href={match[5]} className="text-green underline" target="_blank" rel="noopener noreferrer">{match[4]}</a>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < remaining.length) parts.push(<span key={key++}>{remaining.slice(lastIdx)}</span>);
    return parts.length > 0 ? parts : str;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith('### ')) { flushList(); elements.push(<h4 key={elements.length} className="font-heading font-semibold text-sm text-text mt-4 mb-1">{line.slice(4)}</h4>); continue; }
    if (line.startsWith('## ')) { flushList(); elements.push(<h3 key={elements.length} className="font-heading font-semibold text-base text-text mt-4 mb-1">{line.slice(3)}</h3>); continue; }
    if (line.startsWith('# ')) { flushList(); elements.push(<h2 key={elements.length} className="font-heading font-bold text-lg text-text mt-4 mb-2">{line.slice(2)}</h2>); continue; }

    // Unordered list
    if (/^[-*] /.test(line)) { listType = listType || 'ul'; listItems.push(line.slice(2)); continue; }
    // Ordered list
    if (/^\d+\. /.test(line)) { listType = listType || 'ol'; listItems.push(line.replace(/^\d+\.\s*/, '')); continue; }

    flushList();

    // Empty line
    if (line.trim() === '') { continue; }

    // Code block start/end — just treat as preformatted
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(<pre key={elements.length} className="bg-gray-50 border border-border rounded-sm p-3 text-xs font-mono text-text-2 overflow-x-auto mb-3 whitespace-pre-wrap">{codeLines.join('\n')}</pre>);
      continue;
    }

    // Normal paragraph
    elements.push(<p key={elements.length} className="text-sm text-text-2 mb-2">{renderInline(line)}</p>);
  }
  flushList();

  return <div>{elements}</div>;
}

// ─── View Popup ──────────────────────────────────────────────
function ViewDialog({ entry, onClose, onEdit, onToggleStatus, onDelete, isSuperAdmin }) {
  if (!entry) return null;
  const cats = parseCategories(entry.categories);
  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm bg-gray-100 text-text px-2 py-0.5 rounded">{entry.version}</span>
            <Badge status={entry.status} />
            <span className="text-xs text-text-3 ml-auto">{formatDate(entry.created_at)}</span>
          </div>
          <DialogTitle className="text-lg mt-2">{entry.title}</DialogTitle>
          {cats.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {cats.map((c) => (
                <span key={c} className={cn('inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full border', CATEGORY_COLORS[c] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                  {CATEGORY_OPTIONS.find((o) => o.value === c)?.label || c}
                </span>
              ))}
            </div>
          )}
        </DialogHeader>
        <div className="border-t border-border my-2" />
        <div className="flex-1 overflow-y-auto pr-1">
          <MarkdownContent text={entry.details} />
        </div>
        <div className="border-t border-border pt-3 flex items-center gap-2">
          <Button size="sm" onClick={() => { onClose(); onEdit(entry); }}>
            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => onToggleStatus(entry)}>
            {entry.status === 'published' ? <><EyeOff className="h-3.5 w-3.5 mr-1" />Unpublish</> : <><Eye className="h-3.5 w-3.5 mr-1" />Publish</>}
          </Button>
          {isSuperAdmin && (
            <Button variant="outline" size="sm" className="text-red hover:border-red ml-auto" onClick={() => { onClose(); onDelete(entry); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Hapus
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function ChangelogPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // View dialog
  const [viewEntry, setViewEntry] = useState(null);

  const fetchEntries = () => {
    setLoading(true);
    getChangelogs()
      .then(setEntries)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEntries(); }, []);

  const counts = useMemo(() => ({
    draft: entries.filter((e) => e.status === 'draft').length,
    published: entries.filter((e) => e.status === 'published').length,
  }), [entries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (filter !== 'all') result = result.filter((e) => e.status === filter);
    if (categoryFilter) result = result.filter((e) => parseCategories(e.categories).includes(categoryFilter));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.title?.toLowerCase().includes(q) || e.version?.toLowerCase().includes(q));
    }
    return result;
  }, [entries, filter, categoryFilter, searchQuery]);

  const { sortedData, sortConfig, requestSort } = useClientSort(filtered);
  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(sortedData, [filter, categoryFilter, searchQuery, sortConfig]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowDialog(true);
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      version: entry.version,
      title: entry.title,
      details: entry.details || '',
      categories: parseCategories(entry.categories),
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
      setViewEntry(null);
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

  const buildMenuItems = (row) => {
    const items = [
      { label: 'Edit', icon: Pencil, onClick: () => openEdit(row) },
      { label: row.status === 'published' ? 'Unpublish' : 'Publish', icon: row.status === 'published' ? EyeOff : Eye, onClick: () => handleToggleStatus(row) },
    ];
    if (admin?.role === 'super_admin') {
      items.push({ label: 'Hapus', icon: Trash2, onClick: () => handleDelete(row), destructive: true });
    }
    return items;
  };

  const columns = [
    { key: 'version', label: 'VERSION', sortable: true, render: (row) => <span className="font-heading font-bold text-sm text-text">{row.version}</span> },
    { key: 'title', label: 'TITLE', sortable: true, render: (row) => (
      <button type="button" onClick={() => setViewEntry(row)} className="text-left text-blue-600 hover:underline font-medium text-sm">
        {row.title}
      </button>
    )},
    { key: 'categories', label: 'CATEGORIES', render: (row) => <CategoryTags cats={row.categories} /> },
    { key: 'status', label: 'STATUS', render: (row) => <Badge status={row.status} /> },
    { key: 'created_at', label: 'TANGGAL', sortable: true, render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    { key: 'actions', label: 'AKSI', className: 'text-right', render: (row) => (
      <div className="flex justify-end">
        <ActionMenu items={buildMenuItems(row)} />
      </div>
    )},
  ];

  if (loading) return <SkeletonTablePage columns={6} hasButton />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Changelog</h1>
        <Button onClick={openCreate} className="font-semibold">Tambah</Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          {STATUS_PILLS.map((pill) => {
            const isActive = filter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => setFilter((f) => f === pill.key ? 'all' : pill.key)}
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
        <div className="flex items-center gap-2 ml-auto">
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={cn('w-[160px]', !categoryFilter && 'text-text-3')}>
            <option value="">Semua Kategori</option>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari changelog..." className="pl-9 w-[200px] h-9" />
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        emptyIcon={ScrollText}
        emptyText="Belum ada changelog"
        sortConfig={sortConfig}
        onSort={requestSort}
      />

      <Pagination currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={goToPage} />

      {/* View dialog */}
      <ViewDialog
        entry={viewEntry}
        onClose={() => setViewEntry(null)}
        onEdit={openEdit}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
        isSuperAdmin={admin?.role === 'super_admin'}
      />

      {/* Edit/Create dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) setShowDialog(false); }}>
        <DialogContent className="max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Changelog' : 'Tambah Changelog'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Version</Label>
              <Input placeholder="e.g. v16" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
              {errors.version && <p className="text-red text-xs mt-1">{errors.version}</p>}
            </div>
            <div>
              <Label>Title</Label>
              <Input placeholder="Ringkasan singkat perubahan" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              {errors.title && <p className="text-red text-xs mt-1">{errors.title}</p>}
            </div>
            <div>
              <Label>Details</Label>
              <Textarea placeholder="Deskripsi lengkap perubahan (markdown supported)" className="min-h-[200px]" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            </div>
            <div>
              <Label className="mb-2 block">Categories</Label>
              <div className="flex flex-wrap gap-3">
                {CATEGORY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.categories.includes(opt.value)} onCheckedChange={() => handleCategoryToggle(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="font-semibold">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
