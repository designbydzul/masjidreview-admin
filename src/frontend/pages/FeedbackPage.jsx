import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, Search, Trash2, Clock, Paperclip, FileText, X, Upload } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getFeedback, createFeedback, updateFeedback, deleteFeedback, uploadFile, getAdmins } from '../api';
import { useConfirm } from '../contexts/ConfirmContext';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select } from '../components/ui/select';
import { formatDate, formatWA } from '../utils/format';
import { cn } from '../lib/utils';

// ── Constants ──

const COLUMNS = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'Dikerjakan' },
  { id: 'done', label: 'Selesai' },
];

const STATUS_CONFIG = {
  todo: { label: 'Todo', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  in_progress: { label: 'Dikerjakan', className: 'bg-blue-50 text-blue-700 border-blue-300' },
  done: { label: 'Selesai', className: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
};

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

// ── Inline Badge Helpers ──

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
  if (!config) return null;
  return (
    <span className={cn('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border', config.className)}>
      {config.label}
    </span>
  );
}

// ── Draggable Card ──

function FeedbackCard({ item, isDraggable = false, isDragOverlay = false, onClick, onStatusChange, isSuperAdmin }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !isDraggable,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const attachments = (() => { try { return JSON.parse(item.attachments || '[]'); } catch { return []; } })();
  const isOverdue = item.due_date && item.status !== 'done' && new Date(item.due_date) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      onClick={onClick}
      className={cn(
        'bg-white border border-border rounded-sm p-3 cursor-pointer hover:border-green transition-colors',
        isDragging && 'opacity-40',
        isDragOverlay && 'shadow-lg rotate-[2deg] border-green',
        isDraggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <TypeBadge type={item.type || 'feedback'} />
        <CategoryBadge category={item.category} />
        {item.priority && <PriorityBadge priority={item.priority} />}
      </div>
      <p className="text-sm text-text mb-2 line-clamp-2">{item.message}</p>

      {/* Metadata indicators */}
      {(item.due_date || item.assigned_to_name || attachments.length > 0) && (
        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
          {item.due_date && (
            <span className={cn('flex items-center gap-1 text-[11px]', isOverdue ? 'text-rose-600 font-medium' : 'text-text-3')}>
              <Clock className="h-3 w-3" />
              {new Date(item.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {item.assigned_to_name && (
            <span className="text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
              {item.assigned_to_name}
            </span>
          )}
          {attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-text-3">
              <Paperclip className="h-3 w-3" />
              {attachments.length}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-text-3">
        <span>{item.name || 'Anonim'}</span>
        <span>{formatDate(item.created_at)}</span>
      </div>

      {/* Quick status buttons */}
      {isSuperAdmin && !isDragOverlay && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-border">
          {COLUMNS.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); if (item.status !== col.id) onStatusChange(item.id, col.id); }}
              className={cn(
                'flex-1 text-[10px] font-medium py-1 rounded border transition-colors',
                item.status === col.id
                  ? STATUS_CONFIG[col.id].className
                  : 'bg-white text-text-3 border-border hover:border-green hover:text-green'
              )}
            >
              {col.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Droppable Column ──

function KanbanColumn({ column, isSuperAdmin, onCardClick, onStatusChange }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-[260px] bg-bg rounded-sm border border-border flex flex-col',
        isOver && 'border-green bg-green-light'
      )}
    >
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-text">{column.label}</span>
        <span className="text-xs font-medium text-text-3 bg-border-2 px-1.5 py-0.5 rounded-full">
          {column.items.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {column.items.map((item) => (
          <FeedbackCard
            key={item.id}
            item={item}
            isDraggable={isSuperAdmin}
            isSuperAdmin={isSuperAdmin}
            onClick={() => onCardClick(item)}
            onStatusChange={onStatusChange}
          />
        ))}
        {column.items.length === 0 && (
          <p className="text-center text-text-3 text-xs py-8">Kosong</p>
        )}
      </div>
    </div>
  );
}

// ── Detail Dialog (fully editable for super_admin) ──

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
                <Input
                  value={editForm.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Nama pengirim"
                />
              </div>
              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">WhatsApp</Label>
                <Input
                  value={editForm.wa_number}
                  onChange={(e) => updateField('wa_number', e.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
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

          {/* Date + Status (read-only for non-super_admin) */}
          {!isSuperAdmin && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-3 text-xs block">Tanggal</span>
                <span className="text-text">{formatDate(item.created_at)}</span>
              </div>
              <div>
                <span className="text-text-3 text-xs block">Status</span>
                <span className="text-text">{COLUMNS.find((c) => c.id === item.status)?.label || item.status}</span>
              </div>
            </div>
          )}

          {/* Date (always shown for super_admin too) */}
          {isSuperAdmin && (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tanggal</Label>
              <span className="text-sm text-text">{formatDate(item.created_at)}</span>
            </div>
          )}

          {/* Priority (super_admin editable) */}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
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

          {/* Status (super_admin editable) */}
          {isSuperAdmin && (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Status</Label>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => updateField('status', col.id)}
                    disabled={saving}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      editForm.status === col.id
                        ? 'bg-green-light text-green border-green'
                        : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {col.label}
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
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Batal
              </Button>
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
  const [activeCard, setActiveCard] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({ type: 'feedback', category: 'umum', message: '', name: '', wa_number: '', priority: '', status: 'todo', due_date: '', assigned_to: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = admin?.role === 'super_admin';

  const [admins, setAdmins] = useState([]);
  useEffect(() => {
    if (isSuperAdmin) getAdmins().then(setAdmins).catch(() => {});
  }, [isSuperAdmin]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchItems = useCallback(() => {
    setLoading(true);
    getFeedback()
      .then(setItems)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const typeTabs = useMemo(() => [
    { key: 'all', label: 'Semua', count: items.length },
    { key: 'feedback', label: 'Feedback', count: items.filter((i) => (i.type || 'feedback') === 'feedback').length },
    { key: 'idea', label: 'Idea', count: items.filter((i) => (i.type || 'feedback') === 'idea').length },
  ], [items]);

  const columns = useMemo(() => {
    let filtered = typeFilter === 'all'
      ? items
      : items.filter((item) => (item.type || 'feedback') === typeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((item) =>
        item.message?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    }

    return COLUMNS.map((col) => ({
      ...col,
      items: filtered
        .filter((item) => item.status === col.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    }));
  }, [items, typeFilter, searchQuery]);

  const handleDragStart = (event) => {
    const item = items.find((i) => i.id === event.active.id);
    setActiveCard(item || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const feedbackId = active.id;
    const newStatus = over.id;

    const item = items.find((i) => i.id === feedbackId);
    if (!item || item.status === newStatus) return;

    // Check the drop target is a valid column
    if (!COLUMNS.some((c) => c.id === newStatus)) return;

    // Optimistic update
    const prevItems = [...items];
    setItems((prev) => prev.map((i) => (i.id === feedbackId ? { ...i, status: newStatus } : i)));

    try {
      await updateFeedback(feedbackId, { status: newStatus });
      showToast('Status diperbarui');
    } catch (err) {
      setItems(prevItems);
      showToast(err.message, 'error');
    }
  };

  const handleItemUpdate = (updated) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedItem(null);
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: 'Hapus Feedback',
      message: `Yakin ingin menghapus feedback dari "${item.name || 'Anonim'}"? Tindakan ini tidak dapat dibatalkan.`,
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

  const handleQuickStatusChange = async (feedbackId, newStatus) => {
    const prevItems = [...items];
    setItems((prev) => prev.map((i) => (i.id === feedbackId ? { ...i, status: newStatus } : i)));
    try {
      await updateFeedback(feedbackId, { status: newStatus });
      showToast('Status diperbarui');
    } catch (err) {
      setItems(prevItems);
      showToast(err.message, 'error');
    }
  };

  const openCreateDialog = () => {
    setForm({ type: 'feedback', category: 'umum', message: '', name: '', wa_number: '', priority: '', status: 'todo', due_date: '', assigned_to: '' });
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border-2 rounded w-48" />
          <div className="flex gap-4 overflow-x-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[260px] bg-border-2 rounded-sm h-[400px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="font-heading font-bold text-xl text-text">Feedback Hub</h1>
        <Button onClick={() => openCreateDialog()}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tambah
        </Button>
      </div>

      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <div className="flex gap-2">
          {typeTabs.map((tab) => {
            const isActive = tab.key === typeFilter;
            return (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-green text-white border-green'
                    : 'bg-white text-text-2 border-border hover:border-green hover:text-green'
                )}
              >
                {tab.label}
                <span className={cn(
                  'text-[11px] font-bold px-1.5 py-0 rounded-full',
                  isActive ? 'bg-white/25 text-white' : 'bg-border-2 text-text-3'
                )}>
                  {tab.count}
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-2">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              isSuperAdmin={isSuperAdmin}
              onCardClick={setSelectedItem}
              onStatusChange={handleQuickStatusChange}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? <FeedbackCard item={activeCard} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {selectedItem && (
        <FeedbackDetailDialog
          item={selectedItem}
          open={!!selectedItem}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
          isSuperAdmin={isSuperAdmin}
          onUpdate={handleItemUpdate}
          onDelete={handleDelete}
          admins={admins}
        />
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Tambah {form.type === 'idea' ? 'Idea' : 'Feedback'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type */}
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

            {/* Category */}
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

            {/* Message */}
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

            {/* Name */}
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Nama (opsional)</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama pengirim"
              />
            </div>

            {/* WA Number */}
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">No. WhatsApp (opsional)</Label>
              <Input
                value={form.wa_number}
                onChange={(e) => setForm((f) => ({ ...f, wa_number: e.target.value }))}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {/* Priority */}
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

            {/* Status */}
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Status</Label>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: col.id }))}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      form.status === col.id
                        ? 'bg-green-light text-green border-green'
                        : 'bg-white text-text-2 border-border hover:border-green'
                    )}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date (create) */}
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tenggat Waktu (opsional)</Label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="h-9 w-full px-3 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
              />
            </div>

            {/* Assigned To (create) */}
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
