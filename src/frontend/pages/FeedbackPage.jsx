import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Trash2, Pencil, X, ArrowRightCircle, RotateCcw, MessageSquareOff, MessageSquarePlus, Link2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getFeedback, createFeedback, updateFeedback, deleteFeedback, getAdmins, setFeedbackStatus, setFeedbackGroup, createFeedbackGroup, createBacklogTask } from '../api';
import DataTable from '../components/DataTable';
import ActionMenu from '../components/ActionMenu';
import ExpandableText from '../components/ExpandableText';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import useClientSort from '../hooks/useClientSort';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { SkeletonTablePage } from '../components/Skeleton';
import { formatDate, formatWA } from '../utils/format';
import { cn } from '../lib/utils';
import AttachmentEditor from '../components/AttachmentEditor';

// ── Constants ──

const STATUS_TABS = [
  { key: 'baru', label: 'Baru', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { key: 'dibahas', label: 'Dibahas', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { key: 'dipindahkan', label: 'Dipindahkan', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  { key: 'ditolak', label: 'Ditolak', color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

const CATEGORY_CONFIG = {
  bug: { label: 'Bug', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  saran: { label: 'Saran', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  idea: { label: 'Idea', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  umum: { label: 'Umum', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  high: { label: 'High', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const PRIORITY_ACTIVE = {
  low: 'bg-gray-100 text-gray-700 border-gray-300',
  medium: 'bg-amber-50 text-amber-700 border-amber-300',
  high: 'bg-rose-50 text-rose-700 border-rose-300',
};

// ── Badge Helpers ──

function CategoryBadge({ category }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.umum;
  return (
    <span className={cn('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border', config.className)}>
      {config.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const config = PRIORITY_CONFIG[priority];
  if (!config) return <span className="text-text-3 text-xs">-</span>;
  return (
    <span className={cn('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border', config.className)}>
      {config.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const tab = STATUS_TABS.find((t) => t.key === status);
  if (!tab) return <span className="text-text-3 text-xs">{status}</span>;
  return (
    <span className={cn('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border', tab.color)}>
      {tab.label}
    </span>
  );
}

// ── Promote to Backlog Dialog ──

const BACKLOG_CATEGORY_CONFIG = {
  security: { label: 'Security', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  ui: { label: 'UI', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  bug: { label: 'Bug', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  feature: { label: 'Feature', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  tech_debt: { label: 'Tech Debt', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const BACKLOG_PRIORITY_ACTIVE = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  medium: 'bg-orange-50 text-orange-700 border-orange-300',
  high: 'bg-rose-50 text-rose-700 border-rose-300',
};

function autoTitle(message) {
  if (!message) return '';
  const end = Math.min(
    ...[message.indexOf('.'), message.indexOf('\n'), 50].filter((i) => i > 0),
    message.length,
  );
  const title = message.slice(0, end).trim();
  return end < message.length ? title + '...' : title;
}

function PromoteBacklogDialog({ item, open, onOpenChange, onSuccess, admins = [] }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ title: '', description: '', category: '', priority: '', assignee_id: '', due_date: '', attachments: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && open) {
      let attachments = [];
      try { attachments = JSON.parse(item.attachments || '[]'); } catch { /* ignore */ }
      setForm({
        title: autoTitle(item.message),
        description: item.message || '',
        category: item.category === 'bug' ? 'bug' : '',
        priority: item.priority || 'medium',
        assignee_id: '',
        due_date: '',
        attachments,
      });
    }
  }, [item, open]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      showToast('Judul wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      await createBacklogTask({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        assignee_id: form.assignee_id || null,
        due_date: form.due_date || null,
        attachments: form.attachments,
        source_feedback_id: item.id,
      });
      showToast('Dipindahkan ke Backlog');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pindahkan ke Backlog</DialogTitle>
        </DialogHeader>
        <div className="border-t border-border" />
        <div className="flex gap-6 min-h-[340px]">
          {/* Left column — Judul + Deskripsi */}
          <div className="flex-[3] flex flex-col gap-4 min-w-0">
            <div className="shrink-0">
              <Label className="text-xs text-text-3 mb-1.5 block">Judul Task *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Judul task..."
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <Label className="text-xs text-text-3 mb-1.5 block">Deskripsi</Label>
              <textarea
                className="flex-1 min-h-[160px] resize-none w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi task..."
              />
            </div>
            <AttachmentEditor value={form.attachments} onChange={(a) => setForm((f) => ({ ...f, attachments: a }))} />
          </div>
          {/* Right column — metadata */}
          <div className="flex-[2] space-y-4 min-w-0">
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Kategori</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(BACKLOG_CATEGORY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: f.category === key ? '' : key }))}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      form.category === key
                        ? cfg.className
                        : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Prioritas</Label>
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: f.priority === p ? '' : p }))}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      form.priority === p
                        ? BACKLOG_PRIORITY_ACTIVE[p]
                        : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Ditugaskan ke</Label>
              <Select value={form.assignee_id} onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}>
                <option value="">— Belum ditugaskan —</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>{a.name || a.email}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tenggat Waktu</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <div className="border-t border-border" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Memproses...' : 'Pindahkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Gabungkan (Group) Dialog ──

function GroupDialog({ selectedIds, open, onOpenChange, onSuccess }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setTitle('');
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast('Nama grup wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      const group = await createFeedbackGroup(title.trim());
      for (const id of selectedIds) {
        await setFeedbackGroup(id, group.id);
      }
      showToast(`${selectedIds.size} feedback digabungkan`);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Gabungkan {selectedIds.size} Feedback</DialogTitle>
        </DialogHeader>
        <div>
          <Label className="text-xs text-text-3 mb-1.5 block">Nama Grup *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nama grup feedback..."
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Memproses...' : 'Gabungkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Dialog ──

function FeedbackDetailDialog({ item, open, onOpenChange, isSuperAdmin, onUpdate, onDelete, admins }) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (item) {
      let attachments = [];
      try { attachments = JSON.parse(item.attachments || '[]'); } catch { /* ignore */ }
      setEditForm({
        category: item.category,
        message: item.message,
        name: item.name || '',
        wa_number: item.wa_number || '',
        priority: item.priority || '',
        status: item.status,
        due_date: item.due_date || '',
        assigned_to: item.assigned_to || '',
        attachments,
      });
    }
  }, [item]);

  const updateField = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editForm.message?.trim()) {
      showToast('Pesan tidak boleh kosong', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      if (editForm.category !== item.category) payload.category = editForm.category;
      if (editForm.message.trim() !== item.message) payload.message = editForm.message.trim();
      if ((editForm.name || null) !== (item.name || null)) payload.name = editForm.name || null;
      if ((editForm.wa_number || null) !== (item.wa_number || null)) payload.wa_number = editForm.wa_number || null;
      if ((editForm.priority || null) !== (item.priority || null)) payload.priority = editForm.priority || null;
      if (editForm.status !== item.status) payload.status = editForm.status;
      if ((editForm.due_date || null) !== (item.due_date || null)) payload.due_date = editForm.due_date || null;
      if ((editForm.assigned_to || null) !== (item.assigned_to || null)) payload.assigned_to = editForm.assigned_to || null;

      const origAttachments = (() => { try { return JSON.parse(item.attachments || '[]'); } catch { return []; } })();
      if (JSON.stringify(editForm.attachments) !== JSON.stringify(origAttachments)) payload.attachments = editForm.attachments;

      if (Object.keys(payload).length === 0) {
        showToast('Tidak ada perubahan');
        onOpenChange(false);
        return;
      }

      const updated = await updateFeedback(item.id, payload);
      onUpdate(updated);
      showToast('Feedback diperbarui');
      onOpenChange(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Detail Feedback</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category */}
          {isSuperAdmin ? (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Kategori</Label>
              <div className="flex gap-2">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateField('category', key)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      editForm.category === key
                        ? cfg.className
                        : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CategoryBadge category={item.category} />
              {item.priority && <PriorityBadge priority={item.priority} />}
            </div>
          )}

          {/* Message */}
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Pesan</Label>
            {isSuperAdmin ? (
              <Textarea
                value={editForm.message}
                onChange={(e) => updateField('message', e.target.value)}
                className="min-h-[100px]"
              />
            ) : (
              <p className="text-sm text-text mt-1 whitespace-pre-wrap">{item.message}</p>
            )}
          </div>

          {/* Name + WA */}
          {isSuperAdmin ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">Nama</Label>
                <Input value={editForm.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Nama pengirim" />
              </div>
              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">WhatsApp</Label>
                <Input value={editForm.wa_number} onChange={(e) => updateField('wa_number', e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-3 text-xs block">Nama</span>
                <span className="text-text">{item.name || 'Anonim'}</span>
              </div>
              <div>
                <span className="text-text-3 text-xs block">WhatsApp</span>
                <span className="text-text">{item.wa_number ? formatWA(item.wa_number) : '-'}</span>
              </div>
            </div>
          )}

          {/* Date + Status (read-only) */}
          {!isSuperAdmin && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-3 text-xs block">Tanggal</span>
                <span className="text-text">{formatDate(item.created_at)}</span>
              </div>
              <div>
                <span className="text-text-3 text-xs block">Status</span>
                <StatusBadge status={item.status} />
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tanggal</Label>
              <span className="text-sm text-text">{formatDate(item.created_at)}</span>
            </div>
          )}

          {/* Priority */}
          {isSuperAdmin && (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Prioritas</Label>
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateField('priority', editForm.priority === p ? '' : p)}
                    disabled={saving}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      editForm.priority === p
                        ? PRIORITY_ACTIVE[p]
                        : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Due Date */}
          {isSuperAdmin ? (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tenggat Waktu</Label>
              <input
                type="datetime-local"
                value={editForm.due_date || ''}
                onChange={(e) => updateField('due_date', e.target.value)}
                className="h-9 w-full px-3 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
              />
            </div>
          ) : item.due_date ? (
            <div className="text-sm">
              <span className="text-text-3 text-xs block">Tenggat Waktu</span>
              <span className="text-text">{formatDate(item.due_date)}</span>
            </div>
          ) : null}

          {/* Assigned To */}
          {isSuperAdmin ? (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Ditugaskan ke</Label>
              <Select value={editForm.assigned_to || ''} onChange={(e) => updateField('assigned_to', e.target.value)}>
                <option value="">Belum ditugaskan</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
          ) : item.assigned_to_name ? (
            <div className="text-sm">
              <span className="text-text-3 text-xs block">Ditugaskan ke</span>
              <span className="text-blue-600 font-medium">{item.assigned_to_name}</span>
            </div>
          ) : null}

          {/* Attachments */}
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Lampiran</Label>
            <AttachmentEditor
              value={editForm.attachments || []}
              onChange={(a) => updateField('attachments', a)}
              disabled={!isSuperAdmin}
            />
          </div>

          {/* Status */}
          {isSuperAdmin && (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => updateField('status', tab.key)}
                    disabled={saving}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      editForm.status === tab.key
                        ? tab.color
                        : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {isSuperAdmin && (
          <DialogFooter className="flex !justify-between">
            <Button variant="destructive" size="sm" onClick={() => onDelete(item)} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Hapus
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──

export default function FeedbackPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedItem, setSelectedItem] = useState(null);
  const [promoteItem, setPromoteItem] = useState(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({ category: 'umum', message: '', name: '', priority: '', status: 'baru', attachments: [] });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = admin?.role === 'super_admin';

  const [admins, setAdmins] = useState([]);
  useEffect(() => {
    getAdmins().then(setAdmins).catch(() => {});
  }, []);

  const fetchItems = useCallback(() => {
    setLoading(true);
    getFeedback()
      .then(setItems)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const counts = useMemo(() => {
    const c = { all: items.length, baru: 0, dibahas: 0, dipindahkan: 0, ditolak: 0 };
    items.forEach((i) => { if (c[i.status] !== undefined) c[i.status]++; });
    return c;
  }, [items]);

  const sourceOptions = useMemo(() => {
    const names = new Set();
    items.forEach((i) => names.add(i.name || 'Anonim'));
    return [...names].sort();
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (statusFilter !== 'all') result = result.filter((i) => i.status === statusFilter);
    if (categoryFilter) result = result.filter((i) => i.category === categoryFilter);
    if (sourceFilter) result = result.filter((i) => (i.name || 'Anonim') === sourceFilter);
    if (priorityFilter) result = result.filter((i) => i.priority === priorityFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) =>
        i.message?.toLowerCase().includes(q) ||
        i.name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, statusFilter, categoryFilter, sourceFilter, priorityFilter, searchQuery]);

  const { sortedData, sortConfig, requestSort } = useClientSort(filtered);
  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(sortedData, [statusFilter, categoryFilter, sourceFilter, priorityFilter, searchQuery, sortConfig]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await setFeedbackStatus(id, newStatus);
      showToast('Status diperbarui');
      fetchItems();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: 'Hapus Feedback',
      message: `Yakin ingin menghapus feedback dari "${item.name || 'Anonim'}"?`,
      confirmLabel: 'Hapus',
      confirmStyle: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteFeedback(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedItem(null);
      showToast('Feedback dihapus');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleItemUpdate = (updated) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedItem(null);
  };

  const buildMenuItems = (row) => {
    const menuItems = [];
    if (row.status === 'baru') {
      menuItems.push({ label: 'Tandai Dibahas', icon: MessageSquarePlus, onClick: () => handleStatusChange(row.id, 'dibahas') });
    }
    if (row.status === 'dibahas') {
      menuItems.push({ label: 'Tandai Baru', icon: RotateCcw, onClick: () => handleStatusChange(row.id, 'baru') });
    }
    if (row.status === 'baru' || row.status === 'dibahas') {
      menuItems.push({ label: 'Edit', icon: Pencil, onClick: () => setSelectedItem(row) });
    }
    if (row.status === 'ditolak') {
      menuItems.push({ label: 'Pulihkan', icon: RotateCcw, onClick: () => handleStatusChange(row.id, 'baru') });
    }
    if (isSuperAdmin) {
      menuItems.push({ label: 'Hapus', icon: Trash2, onClick: () => handleDelete(row), destructive: true });
    }
    return menuItems;
  };

  const columns = [
    {
      key: 'created_at', label: 'Tanggal', sortable: true,
      render: (row) => <span className="text-text-3 text-xs whitespace-nowrap">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'category', label: 'Kategori',
      render: (row) => <CategoryBadge category={row.category} />,
    },
    {
      key: 'message', label: 'Pesan',
      render: (row) => (
        <div>
          <ExpandableText text={row.message} maxLen={120} />
          {row.group_id && row.group_title && (
            <span className="ml-1.5 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              <Link2 className="h-2.5 w-2.5 inline mr-0.5" />
              {row.group_title}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'name', label: 'Sumber', sortable: true,
      render: (row) => <span className="text-sm">{row.name || 'Anonim'}</span>,
    },
    {
      key: 'priority', label: 'Prioritas',
      render: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      key: 'status', label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions', label: 'Aksi',
      render: (row) => {
        if (row.status === 'dipindahkan') {
          return <StatusBadge status="dipindahkan" />;
        }
        if (row.status === 'ditolak') {
          return (
            <div className="flex items-center gap-1.5">
              <ActionMenu items={buildMenuItems(row)} />
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => setPromoteItem(row)}>
              <ArrowRightCircle className="h-3.5 w-3.5 mr-1" />
              Backlog
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatusChange(row.id, 'ditolak')} className="hover:border-red hover:text-red">
              Tolak
            </Button>
            <ActionMenu items={buildMenuItems(row)} />
          </div>
        );
      },
    },
  ];

  const openCreateDialog = () => {
    setForm({ category: 'umum', message: '', name: '', priority: '', status: 'baru' });
    setErrors({});
    setShowCreateDialog(true);
  };

  const handleCreate = async () => {
    const errs = {};
    if (!form.message.trim()) errs.message = 'Pesan wajib diisi';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      await createFeedback({
        category: form.category,
        message: form.message.trim(),
        name: form.name.trim() || null,
        priority: form.priority || null,
        status: form.status,
        attachments: form.attachments,
      });
      showToast('Feedback ditambahkan');
      setShowCreateDialog(false);
      fetchItems();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonTablePage columns={7} hasButton />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Feedback Hub</h1>
        <Button onClick={openCreateDialog} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />
          Tambah
        </Button>
      </div>

      {/* Status tabs + Search */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setStatusFilter('all'); setSelectedIds(new Set()); }}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border whitespace-nowrap transition-colors',
              statusFilter === 'all'
                ? 'bg-green text-white border-green'
                : 'bg-white text-text-2 border-border hover:border-green hover:text-green'
            )}
          >
            Semua
            <span className={cn('text-[11px] font-bold px-1.5 py-0 rounded-full', statusFilter === 'all' ? 'bg-white/25 text-white' : 'bg-border-2 text-text-3')}>
              {counts.all}
            </span>
          </button>
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setSelectedIds(new Set()); }}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border whitespace-nowrap transition-colors',
                  isActive
                    ? tab.color
                    : 'bg-white text-text-2 border-border hover:border-green hover:text-green'
                )}
              >
                {tab.label}
                <span className={cn('text-[11px] font-bold px-1.5 py-0 rounded-full', isActive ? 'bg-black/10 text-inherit' : 'bg-border-2 text-text-3')}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={cn('w-[150px]', !categoryFilter && 'text-text-3')}
          >
            <option value="">Semua Kategori</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </Select>
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className={cn('w-[150px]', !sourceFilter && 'text-text-3')}
          >
            <option value="">Semua Sumber</option>
            {sourceOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </Select>
          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={cn('w-[150px]', !priorityFilter && 'text-text-3')}
          >
            <option value="">Semua Prioritas</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari feedback..."
              className="pl-9 w-[220px] h-9"
            />
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-4 bg-emerald-50 border border-emerald-200 rounded-sm">
          <span className="text-sm font-medium text-green">{selectedIds.size} dipilih</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" onClick={() => setShowGroupDialog(true)} className="font-semibold">
              <Link2 className="h-3.5 w-3.5 mr-1" />
              Gabungkan
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        selectable
        selectableFilter={(row) => row.status === 'baru' || row.status === 'dibahas'}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyIcon={MessageSquareOff}
        emptyText="Tidak ada feedback"
        sortConfig={sortConfig}
        onSort={requestSort}
      />

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={goToPage}
      />

      {/* Detail dialog */}
      {selectedItem && (
        <FeedbackDetailDialog
          item={selectedItem}
          open={!!selectedItem}
          onOpenChange={(open) => { if (!open) setSelectedItem(null); }}
          isSuperAdmin={isSuperAdmin}
          onUpdate={handleItemUpdate}
          onDelete={handleDelete}
          admins={admins}
        />
      )}

      {/* Promote to Backlog dialog */}
      <PromoteBacklogDialog
        item={promoteItem}
        open={!!promoteItem}
        onOpenChange={(open) => { if (!open) setPromoteItem(null); }}
        onSuccess={() => { setPromoteItem(null); fetchItems(); }}
        admins={admins}
      />

      {/* Group dialog */}
      <GroupDialog
        selectedIds={selectedIds}
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        onSuccess={() => { setSelectedIds(new Set()); setShowGroupDialog(false); fetchItems(); }}
      />

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tambah Feedback</DialogTitle>
          </DialogHeader>

          <div className="flex gap-6 border-t border-border pt-5">
            {/* Left column — 60% */}
            <div className="flex-[3] min-w-0 flex flex-col">
              <Label className="text-xs text-text-3 mb-1.5 block shrink-0">Pesan *</Label>
              <Textarea
                value={form.message}
                onChange={(e) => { setForm((f) => ({ ...f, message: e.target.value })); setErrors((er) => ({ ...er, message: undefined })); }}
                placeholder="Tulis feedback..."
                className="flex-1 min-h-[200px] resize-none"
              />
              {errors.message && <p className="text-xs text-rose-600 mt-1">{errors.message}</p>}
              <AttachmentEditor value={form.attachments} onChange={(a) => setForm((f) => ({ ...f, attachments: a }))} />
            </div>

            {/* Right column — 40% */}
            <div className="flex-[2] min-w-0 space-y-4">
              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">Kategori</Label>
                <div className="flex gap-2">
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: key }))}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                        form.category === key
                          ? cfg.className
                          : 'bg-white text-text-2 border-border hover:border-green'
                      )}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">Nama (opsional)</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama pengirim" />
              </div>

              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">Prioritas (opsional)</Label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, priority: f.priority === p ? '' : p }))}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                        form.priority === p
                          ? PRIORITY_ACTIVE[p]
                          : 'bg-white text-text-2 border-border hover:border-green'
                      )}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: tab.key }))}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                        form.status === tab.key
                          ? tab.color
                          : 'bg-white text-text-2 border-border hover:border-green'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
