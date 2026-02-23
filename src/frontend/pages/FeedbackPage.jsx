import { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
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
import { getFeedback, updateFeedback } from '../api';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { formatDate, formatWA } from '../utils/format';
import { cn } from '../lib/utils';

// ── Constants ──

const COLUMNS = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'Sedang Diproses' },
  { id: 'hold', label: 'Ditahan' },
  { id: 'done', label: 'Selesai' },
  { id: 'archived', label: 'Diarsipkan' },
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

// ── Inline Badge Helpers ──

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

function FeedbackCard({ item, isDraggable = false, isDragOverlay = false, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !isDraggable,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

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
        <CategoryBadge category={item.category} />
        {item.priority && <PriorityBadge priority={item.priority} />}
      </div>
      <p className="text-sm text-text mb-2 line-clamp-2">{item.message}</p>
      <div className="flex items-center justify-between text-xs text-text-3">
        <span>{item.name || 'Anonim'}</span>
        <span>{formatDate(item.created_at)}</span>
      </div>
    </div>
  );
}

// ── Droppable Column ──

function KanbanColumn({ column, isSuperAdmin, onCardClick }) {
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
            onClick={() => onCardClick(item)}
          />
        ))}
        {column.items.length === 0 && (
          <p className="text-center text-text-3 text-xs py-8">Kosong</p>
        )}
      </div>
    </div>
  );
}

// ── Detail Dialog ──

function FeedbackDetailDialog({ item, open, onOpenChange, isSuperAdmin, onUpdate }) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      const updated = await updateFeedback(item.id, { status: newStatus });
      onUpdate(updated);
      showToast('Status diperbarui');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    setSaving(true);
    try {
      const updated = await updateFeedback(item.id, { priority: newPriority });
      onUpdate(updated);
      showToast('Prioritas diperbarui');
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
          <DialogTitle>Detail Feedback</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CategoryBadge category={item.category} />
            {item.priority && <PriorityBadge priority={item.priority} />}
          </div>

          <div>
            <Label className="text-text-3 text-xs">Pesan</Label>
            <p className="text-sm text-text mt-1 whitespace-pre-wrap">{item.message}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-text-3 text-xs block">Nama</span>
              <span className="text-text">{item.name || 'Anonim'}</span>
            </div>
            <div>
              <span className="text-text-3 text-xs block">WhatsApp</span>
              <span className="text-text">{item.wa_number ? formatWA(item.wa_number) : '-'}</span>
            </div>
            <div>
              <span className="text-text-3 text-xs block">Tanggal</span>
              <span className="text-text">{formatDate(item.created_at)}</span>
            </div>
            <div>
              <span className="text-text-3 text-xs block">Status</span>
              <span className="text-text">{COLUMNS.find((c) => c.id === item.status)?.label || item.status}</span>
            </div>
          </div>

          {isSuperAdmin && (
            <>
              <Separator />
              <div>
                <Label className="text-xs text-text-3 mb-1.5 block">Prioritas</Label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      disabled={saving}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                        item.priority === p
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
                <Label className="text-xs text-text-3 mb-1.5 block">Pindah ke</Label>
                <div className="flex flex-wrap gap-2">
                  {COLUMNS.filter((c) => c.id !== item.status).map((col) => (
                    <Button
                      key={col.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(col.id)}
                      disabled={saving}
                    >
                      {col.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──

export default function FeedbackPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const isSuperAdmin = admin?.role === 'super_admin';

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

  const columns = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      items: items
        .filter((item) => item.status === col.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    }));
  }, [items]);

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
    setSelectedItem(updated);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border-2 rounded w-48" />
          <div className="flex gap-4 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[260px] bg-border-2 rounded-sm h-[400px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading font-bold text-xl text-text">Feedback</h1>
        <span className="text-sm text-text-3">{items.length} total</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 180px)' }}>
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              isSuperAdmin={isSuperAdmin}
              onCardClick={setSelectedItem}
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
        />
      )}
    </div>
  );
}
