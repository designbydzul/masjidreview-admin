import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, Search, Trash2, Pencil, X, Upload, FileText, ArrowRightCircle, RotateCcw, MessageSquareOff, MessageSquarePlus, Link2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getFeedback, createFeedback, updateFeedback, deleteFeedback, uploadFile, getAdmins, setFeedbackStatus, setFeedbackGroup, createFeedbackGroup, createBacklogTask } from '../api';
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

const TYPE_CONFIG = {
  feedback: { label: 'Feedback', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  idea: { label: 'Idea', className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const TYPE_ACTIVE = {
  feedback: 'bg-blue-50 text-blue-700 border-blue-300',
  idea: 'bg-purple-50 text-purple-700 border-purple-300',
};

// ── Badge Helpers ──

function TypeBadge({ type }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.feedback;
  return (
    <span className={cn('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border', config.className)}>
      {config.label}
    </span>
  );
}

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

function PromoteBacklogDialog({ item, open, onOpenChange, onSuccess }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ title: '', category: '', priority: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && open) {
      setForm({
        title: (item.message || '').slice(0, 80),
        category: item.category || 'umum',
        priority: item.priority || 'medium',
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
        category: form.category,
        priority: form.priority,
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
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Pindahkan ke Backlog</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Judul Task *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Judul task..."
            />
          </div>
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Kategori</Label>
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Prioritas</Label>
            <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </Select>
          </div>
        </div>
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (item) {
      let attachments = [];
      try { attachments = JSON.parse(item.attachments || '[]'); } catch { /* ignore */ }
      setEditForm({
        type: item.type || 'feedback',
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

  const handleAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const current = editForm.attachments || [];
    if (current.length + files.length > 5) {
      showToast('Maksimal 5 lampiran', 'error');
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          showToast(`${file.name} terlalu besar (maks 5MB)`, 'error');
          continue;
        }
        const result = await uploadFile(file, 'feedback');
        uploaded.push({ url: result.url, name: file.name, type: file.type });
      }
      updateField('attachments', [...current, ...uploaded]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (idx) => {
    updateField('attachments', (editForm.attachments || []).filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!editForm.message?.trim()) {
      showToast('Pesan tidak boleh kosong', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      if (editForm.type !== (item.type || 'feedback')) payload.type = editForm.type;
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
          <DialogTitle>Detail {(item.type || 'feedback') === 'idea' ? 'Idea' : 'Feedback'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          {isSuperAdmin ? (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tipe</Label>
              <div className="flex gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateField('type', key)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      editForm.type === key
                        ? TYPE_ACTIVE[key]
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
              <TypeBadge type={item.type || 'feedback'} />
            </div>
          )}

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
            {(editForm.attachments || []).length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {(editForm.attachments || []).map((att, idx) => (
                  <div key={idx} className="relative group border border-border rounded-sm overflow-hidden">
                    {att.type?.startsWith('image/') ? (
                      <a href={att.url} target="_blank" rel="noopener noreferrer">
                        <img src={att.url} alt={att.name} className="w-full h-20 object-cover" />
                      </a>
                    ) : (
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-20 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <FileText className="h-6 w-6 text-text-3 mb-1" />
                        <span className="text-[10px] text-text-3 px-1 truncate w-full text-center">{att.name || 'PDF'}</span>
                      </a>
                    )}
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50"
                      >
                        <X className="h-3 w-3 text-rose-600" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isSuperAdmin && (editForm.attachments || []).length < 5 && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.pdf"
                  multiple
                  onChange={handleAttachmentUpload}
                  className="hidden"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {uploading ? 'Mengupload...' : 'Upload Lampiran'}
                </Button>
                <p className="text-[11px] text-text-3 mt-1">Maks 5 file, 5MB/file (JPG, PNG, WebP, PDF)</p>
              </div>
            )}
            {!isSuperAdmin && (editForm.attachments || []).length === 0 && (
              <p className="text-sm text-text-2">Tidak ada lampiran</p>
            )}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedItem, setSelectedItem] = useState(null);
  const [promoteItem, setPromoteItem] = useState(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({ type: 'feedback', category: 'umum', message: '', name: '', wa_number: '', priority: '', status: 'baru', due_date: '', assigned_to: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = admin?.role === 'super_admin';

  const [admins, setAdmins] = useState([]);
  useEffect(() => {
    if (isSuperAdmin) getAdmins().then(setAdmins).catch(() => {});
  }, [isSuperAdmin]);

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

  const filtered = useMemo(() => {
    let result = items;
    if (statusFilter !== 'all') result = result.filter((i) => i.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) =>
        i.message?.toLowerCase().includes(q) ||
        i.name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, statusFilter, searchQuery]);

  const { sortedData, sortConfig, requestSort } = useClientSort(filtered);
  const { currentPage, totalItems, pageSize, paginatedData, goToPage } = usePagination(sortedData, [statusFilter, searchQuery, sortConfig]);

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
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{row.name || 'Anonim'}</span>
          <TypeBadge type={row.type || 'feedback'} />
        </div>
      ),
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
    setForm({ type: 'feedback', category: 'umum', message: '', name: '', wa_number: '', priority: '', status: 'baru', due_date: '', assigned_to: '' });
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
        type: form.type,
        category: form.category,
        message: form.message.trim(),
        name: form.name.trim() || null,
        wa_number: form.wa_number.trim() || null,
        priority: form.priority || null,
        status: form.status,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
      });
      showToast(form.type === 'idea' ? 'Idea ditambahkan' : 'Feedback ditambahkan');
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
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari feedback..."
            className="pl-9 w-[220px] h-9"
          />
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
        <DialogContent className="max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Tambah {form.type === 'idea' ? 'Idea' : 'Feedback'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tipe</Label>
              <div className="flex gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: key }))}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      form.type === key
                        ? TYPE_ACTIVE[key]
                        : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

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
              <Label className="text-xs text-text-3 mb-1.5 block">Pesan *</Label>
              <Textarea
                value={form.message}
                onChange={(e) => { setForm((f) => ({ ...f, message: e.target.value })); setErrors((er) => ({ ...er, message: undefined })); }}
                placeholder="Tulis feedback..."
                className="min-h-[150px]"
              />
              {errors.message && <p className="text-xs text-rose-600 mt-1">{errors.message}</p>}
            </div>

            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Nama (opsional)</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama pengirim" />
            </div>

            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">No. WhatsApp (opsional)</Label>
              <Input value={form.wa_number} onChange={(e) => setForm((f) => ({ ...f, wa_number: e.target.value }))} placeholder="08xxxxxxxxxx" />
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

            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tenggat Waktu (opsional)</Label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="h-9 w-full px-3 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
              />
            </div>

            {isSuperAdmin && admins.length > 0 && (
              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">Ditugaskan ke (opsional)</Label>
                <Select value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">Belum ditugaskan</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
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
