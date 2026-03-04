import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Trash2, Calendar, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
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
import { useConfirm } from '../contexts/ConfirmContext';
import { getBacklog, createBacklogTask, updateBacklogTask, deleteBacklogTask, setBacklogTaskStatus, getAdmins } from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { formatDate } from '../utils/format';
import { cn } from '../lib/utils';
import AttachmentEditor from '../components/AttachmentEditor';

// ── Constants ──

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', tint: '' },
  { id: 'todo', label: 'Todo', tint: '' },
  { id: 'in_progress', label: 'In Progress', tint: 'border-amber-200 bg-amber-50/30' },
  { id: 'in_review', label: 'In Review', tint: 'border-blue-200 bg-blue-50/30' },
  { id: 'done', label: 'Done', tint: 'border-emerald-200 bg-emerald-50/30' },
];

const CATEGORY_CONFIG = {
  security: { label: 'Security', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  ui: { label: 'UI', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  bug: { label: 'Bug', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  feature: { label: 'Feature', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  tech_debt: { label: 'Tech Debt', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label }));

const PRIORITY_CONFIG = {
  high: { label: 'High', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  medium: { label: 'Medium', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  low: { label: 'Low', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const PRIORITY_OPTIONS = Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label }));

const PRIORITY_ACTIVE = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  medium: 'bg-orange-50 text-orange-700 border-orange-300',
  high: 'bg-rose-50 text-rose-700 border-rose-300',
};

const emptyForm = { title: '', description: '', category: '', priority: '', assignee_id: '', due_date: '', status: 'backlog', attachments: [] };

// ── Badge Helpers ──

function CategoryBadge({ category }) {
  const config = CATEGORY_CONFIG[category];
  if (!config) return null;
  return (
    <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', config.className)}>
      {config.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const config = PRIORITY_CONFIG[priority];
  if (!config) return null;
  return (
    <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', config.className)}>
      {config.label}
    </span>
  );
}

// ── Task Card ──

function TaskCard({ task, isDraggable = false, isDragOverlay = false, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !isDraggable,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();

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
      {/* Badges */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <CategoryBadge category={task.category} />
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-text mb-2 line-clamp-2">{task.title}</p>

      {/* Footer: due date + assignee */}
      <div className="flex items-center justify-between text-[11px] text-text-3">
        {task.due_date ? (
          <span className={cn('flex items-center gap-1', isOverdue ? 'text-rose-600 font-medium' : '')}>
            <Calendar className="h-3 w-3" />
            {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </span>
        ) : (
          <span />
        )}
        {task.assignee_name && (
          <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium truncate max-w-[100px]">
            {task.assignee_name}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Kanban Column ──

function KanbanColumn({ column, collapsed, onToggleCollapse }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-none border-r border-border flex flex-col first:border-l-0 last:border-r-0',
        column.tint || 'bg-bg',
        isOver && 'border-green bg-green-light',
        collapsed ? 'w-10 flex-shrink-0' : 'flex-1 min-w-0'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'border-b border-border flex items-center gap-2 shrink-0',
          collapsed ? 'flex-col py-3 px-1' : 'px-3 py-2.5 justify-between'
        )}
      >
        {collapsed ? (
          <button onClick={onToggleCollapse} className="flex flex-col items-center gap-1.5 w-full">
            <ChevronRight className="h-3.5 w-3.5 text-text-3" />
            <span className="text-xs font-semibold text-text [writing-mode:vertical-rl] rotate-180">
              {column.label}
            </span>
            <span className="text-[10px] font-bold text-text-3 bg-border-2 px-1.5 py-0.5 rounded-full">
              {column.items.length}
            </span>
          </button>
        ) : (
          <>
            <span className="text-sm font-semibold text-text">{column.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-text-3 bg-border-2 px-1.5 py-0.5 rounded-full">
                {column.items.length}
              </span>
              {column.id === 'done' && (
                <button onClick={onToggleCollapse} className="text-text-3 hover:text-text-2">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Cards */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {column.items.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDraggable
              onClick={() => column.onCardClick(task)}
            />
          ))}
          {column.items.length === 0 && (
            <p className="text-center text-text-3 text-xs py-8">Kosong</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail Dialog ──

function TaskDetailDialog({ task, open, onOpenChange, onSave, onDelete, admins, isSuperAdmin }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      let attachments = [];
      try { attachments = JSON.parse(task.attachments || '[]'); } catch { /* ignore */ }
      setForm({
        title: task.title || '',
        description: task.description || '',
        category: task.category || '',
        priority: task.priority || '',
        assignee_id: task.assignee_id || '',
        due_date: task.due_date || '',
        status: task.status || 'backlog',
        attachments,
      });
    }
  }, [task]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      showToast('Judul wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      if (form.title.trim() !== task.title) payload.title = form.title.trim();
      if ((form.description || '') !== (task.description || '')) payload.description = form.description || null;
      if ((form.category || '') !== (task.category || '')) payload.category = form.category || null;
      if ((form.priority || '') !== (task.priority || '')) payload.priority = form.priority || null;
      if ((form.assignee_id || '') !== (task.assignee_id || '')) payload.assignee_id = form.assignee_id || null;
      if ((form.due_date || '') !== (task.due_date || '')) payload.due_date = form.due_date || null;

      const origAttachments = (() => { try { return JSON.parse(task.attachments || '[]'); } catch { return []; } })();
      if (JSON.stringify(form.attachments) !== JSON.stringify(origAttachments)) payload.attachments = form.attachments;

      if (Object.keys(payload).length === 0) {
        showToast('Tidak ada perubahan');
        onOpenChange(false);
        return;
      }

      await updateBacklogTask(task.id, payload);
      showToast('Task diperbarui');
      onOpenChange(false);
      onSave();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!task) return null;

  const statusLabel = COLUMNS.find((c) => c.id === task.status)?.label || task.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detail Task</DialogTitle>
        </DialogHeader>

        <div className="flex gap-6">
          {/* Left column — 60% */}
          <div className="flex-[3] min-w-0 flex flex-col gap-4">
            <div className="shrink-0">
              <Label className="text-xs text-text-3 mb-1.5 block">Judul *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <Label className="text-xs text-text-3 mb-1.5 block shrink-0">Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi task..."
                className="flex-1 min-h-[160px] resize-none"
              />
            </div>
            <AttachmentEditor value={form.attachments} onChange={(a) => setForm((f) => ({ ...f, attachments: a }))} />
          </div>

          {/* Right column — 40% */}
          <div className="flex-[2] min-w-0 space-y-4">
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Kategori</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
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
              <Label className="text-xs text-text-3 mb-1.5 block">Ditugaskan ke</Label>
              <Select value={form.assignee_id} onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}>
                <option value="">Belum ditugaskan</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tenggat Waktu</Label>
              <input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="h-9 w-full px-3 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
              />
            </div>
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Status</Label>
              <span className="text-sm font-medium text-text">{statusLabel}</span>
            </div>
            {task.source_feedback_id && (
              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">Sumber Feedback</Label>
                <a
                  href="/feedback"
                  className="inline-flex items-center gap-1 text-sm text-green hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Lihat feedback asal
                </a>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex !justify-between">
          {isSuperAdmin ? (
            <Button variant="destructive" size="sm" onClick={() => onDelete(task)} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Hapus
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Dialog ──

function CreateTaskDialog({ open, onOpenChange, onSuccess, admins }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(emptyForm);
  }, [open]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      showToast('Judul wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      await createBacklogTask({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category || null,
        priority: form.priority || null,
        assignee_id: form.assignee_id || null,
        due_date: form.due_date || null,
        attachments: form.attachments,
        status: 'backlog',
      });
      showToast('Task ditambahkan');
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
          <DialogTitle>Tambah Task</DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 border-t border-border pt-5">
          {/* Left column — 60% */}
          <div className="flex-[3] min-w-0 flex flex-col gap-4">
            <div className="shrink-0">
              <Label className="text-xs text-text-3 mb-1.5 block">Judul *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Judul task..." />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <Label className="text-xs text-text-3 mb-1.5 block shrink-0">Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi task..."
                className="flex-1 min-h-[160px] resize-none"
              />
            </div>
            <AttachmentEditor value={form.attachments} onChange={(a) => setForm((f) => ({ ...f, attachments: a }))} />
          </div>

          {/* Right column — 40% */}
          <div className="flex-[2] min-w-0 space-y-4">
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Kategori</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
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
              <Label className="text-xs text-text-3 mb-1.5 block">Ditugaskan ke</Label>
              <Select value={form.assignee_id} onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value }))}>
                <option value="">Belum ditugaskan</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Tenggat Waktu</Label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="h-9 w-full px-3 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Tambah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──

export default function BacklogPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [doneCollapsed, setDoneCollapsed] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const isSuperAdmin = admin?.role === 'super_admin';

  const [admins, setAdmins] = useState([]);
  useEffect(() => {
    getAdmins().then(setAdmins).catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchTasks = useCallback(() => {
    setLoading(true);
    getBacklog()
      .then(setTasks)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Filtered tasks
  const filtered = useMemo(() => {
    let result = tasks;
    if (categoryFilter) result = result.filter((t) => t.category === categoryFilter);
    if (priorityFilter) result = result.filter((t) => t.priority === priorityFilter);
    if (assigneeFilter) result = result.filter((t) => t.assignee_id === assigneeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((t) =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, categoryFilter, priorityFilter, assigneeFilter, searchQuery]);

  // Build columns
  const columns = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      items: filtered
        .filter((t) => t.status === col.id)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || new Date(b.created_at) - new Date(a.created_at)),
      onCardClick: setSelectedTask,
    }));
  }, [filtered]);

  // Drag handlers
  const handleDragStart = (event) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveCard(task || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    if (!COLUMNS.some((c) => c.id === newStatus)) return;

    // Optimistic update
    const prev = [...tasks];
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await setBacklogTaskStatus(taskId, newStatus);
      showToast('Status diperbarui');
    } catch (err) {
      setTasks(prev);
      showToast(err.message, 'error');
    }
  };

  // Delete
  const handleDelete = async (task) => {
    const ok = await confirm({
      title: 'Hapus Task',
      message: `Yakin ingin menghapus "${task.title}"?`,
      confirmLabel: 'Hapus',
      confirmStyle: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteBacklogTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setSelectedTask(null);
      showToast('Task dihapus');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border-2 rounded w-48" />
          <div className="h-10 bg-border-2 rounded w-full" />
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 min-w-0 bg-border-2 h-[400px] border-r border-border last:border-r-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 px-6 pt-6">
        <h1 className="font-heading font-bold text-[22px] text-text">Backlog</h1>
        <Button onClick={() => setShowCreate(true)} className="font-semibold">
          <Plus className="h-4 w-4 mr-1" />
          Tambah
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0 flex-wrap px-6">
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={cn('w-[140px]', !categoryFilter && 'text-text-3')}
        >
          <option value="">Semua Kategori</option>
          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className={cn('w-[140px]', !priorityFilter && 'text-text-3')}
        >
          <option value="">Semua Prioritas</option>
          {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className={cn('w-[160px]', !assigneeFilter && 'text-text-3')}
        >
          <option value="">Semua Assignee</option>
          {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <div className="relative flex-shrink-0 ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari task..."
            className="pl-9 w-[200px] h-9"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 min-h-0 border-t border-border">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              collapsed={col.id === 'done' && doneCollapsed}
              onToggleCollapse={() => setDoneCollapsed((c) => !c)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? <TaskCard task={activeCard} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Detail dialog */}
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
          onSave={() => { setSelectedTask(null); fetchTasks(); }}
          onDelete={handleDelete}
          admins={admins}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* Create dialog */}
      <CreateTaskDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={fetchTasks}
        admins={admins}
      />
    </div>
  );
}
