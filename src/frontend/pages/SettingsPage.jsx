import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import { getFacilities, getFacilityGroups, createFacility, updateFacility, deleteFacility, toggleFacility, createFacilityGroup, updateFacilityGroup, deleteFacilityGroup } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import ToggleSwitch from '../components/ToggleSwitch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { cn } from '../lib/utils';

const TYPE_LABELS = { toggle: 'Toggle', dropdown: 'Dropdown', number: 'Angka' };
const TYPE_BADGE_STYLES = {
  toggle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dropdown: 'bg-blue-50 text-blue-700 border-blue-200',
  number: 'bg-amber-50 text-amber-700 border-amber-200',
};

// ── Draggable Facility Card ──

function FacilityCard({ fac, isDraggable = false, isDragOverlay = false, onEdit, onDelete, onToggle, isSuperAdmin }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: fac.id,
    disabled: !isDraggable,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white border border-border rounded-sm p-3 transition-colors',
        isDragging && 'opacity-40',
        isDragOverlay && 'shadow-lg rotate-[2deg] border-green',
        isDraggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1" {...(isDraggable ? { ...listeners, ...attributes } : {})}>
          <ToggleSwitch
            checked={!!fac.is_active}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(fac.id);
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-medium truncate', fac.is_active ? 'text-text' : 'text-text-3 line-through')}>
                {fac.name}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', TYPE_BADGE_STYLES[fac.input_type] || TYPE_BADGE_STYLES.toggle)}>
            {TYPE_LABELS[fac.input_type]}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onEdit(fac)} className="h-7 w-7 p-0">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {isSuperAdmin && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(fac)} className="h-7 w-7 p-0 text-red hover:text-red">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {fac.input_type === 'dropdown' && fac.options && (
        <div className="mt-1.5 pl-[42px]">
          <span className="text-[11px] text-text-3">
            Pilihan: {(() => { try { return JSON.parse(fac.options).join(', '); } catch { return fac.options; } })()}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Droppable Column ──

function GroupColumn({ column, onAddFacility, onEdit, onDelete, onToggle, isSuperAdmin, onDeleteGroup }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.grp });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-[280px] bg-bg rounded-sm border border-border flex flex-col',
        isOver && 'border-green bg-green-light'
      )}
    >
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">{column.label}</span>
          <span className="text-xs font-medium text-text-3 bg-border-2 px-1.5 py-0.5 rounded-full">
            {column.items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onAddFacility(column.grp)} className="h-7 w-7 p-0 text-text-3 hover:text-green">
            <Plus className="h-4 w-4" />
          </Button>
          {isSuperAdmin && column.items.length === 0 && !['ramadhan', 'masjid', 'akhwat'].includes(column.grp) && (
            <Button variant="ghost" size="sm" onClick={() => onDeleteGroup(column)} className="h-7 w-7 p-0 text-text-3 hover:text-red">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {column.items.map((fac) => (
          <FacilityCard
            key={fac.id}
            fac={fac}
            isDraggable
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
            isSuperAdmin={isSuperAdmin}
          />
        ))}
        {column.items.length === 0 && (
          <p className="text-center text-text-3 text-xs py-8">Kosong</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function SettingsPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [groups, setGroups] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);

  // Add/Edit Facility dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingFac, setEditingFac] = useState(null);
  const [formState, setFormState] = useState({ name: '', grp: '', input_type: 'toggle', options: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);

  // Add Group dialog
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  const isSuperAdmin = admin?.role === 'super_admin';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([getFacilityGroups(), getFacilities()])
      .then(([grps, facs]) => {
        setGroups(grps);
        setFacilities(facs);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns = useMemo(() => {
    return groups
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((grp) => ({
        ...grp,
        items: facilities
          .filter((f) => f.grp === grp.grp)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
  }, [groups, facilities]);

  // ── Drag & Drop ──

  const handleDragStart = (event) => {
    const fac = facilities.find((f) => f.id === event.active.id);
    setActiveCard(fac || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const facId = active.id;
    const targetGrp = over.id;

    const fac = facilities.find((f) => f.id === facId);
    if (!fac) return;

    // Check the drop target is a valid group column
    if (!groups.some((g) => g.grp === targetGrp)) return;

    if (fac.grp === targetGrp) return; // No change needed

    // Optimistic update
    const prevFacilities = [...facilities];
    // Calculate new sort_order: place at end of target group
    const targetItems = facilities.filter((f) => f.grp === targetGrp);
    const maxOrder = targetItems.length > 0 ? Math.max(...targetItems.map((f) => f.sort_order)) + 1 : 0;

    setFacilities((prev) => prev.map((f) =>
      f.id === facId ? { ...f, grp: targetGrp, sort_order: maxOrder } : f
    ));

    try {
      await updateFacility(facId, { grp: targetGrp, sort_order: maxOrder });
      showToast('Fasilitas dipindahkan');
    } catch (err) {
      setFacilities(prevFacilities);
      showToast(err.message, 'error');
    }
  };

  // ── Facility CRUD ──

  const openAddDialog = (grp) => {
    setEditingFac(null);
    const grpItems = facilities.filter((f) => f.grp === grp);
    const maxOrder = grpItems.length > 0 ? Math.max(...grpItems.map((f) => f.sort_order)) + 1 : 0;
    setFormState({ name: '', grp, input_type: 'toggle', options: '', sort_order: maxOrder });
    setShowDialog(true);
  };

  const openEditDialog = (fac) => {
    setEditingFac(fac);
    const opts = fac.options ? (() => { try { return JSON.parse(fac.options).join(', '); } catch { return fac.options; } })() : '';
    setFormState({ name: fac.name, grp: fac.grp, input_type: fac.input_type, options: opts, sort_order: fac.sort_order });
    setShowDialog(true);
  };

  const handleSaveDialog = async () => {
    if (!formState.name) {
      showToast('Nama wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formState.name,
        grp: formState.grp,
        input_type: formState.input_type,
        sort_order: formState.sort_order,
        options: formState.input_type === 'dropdown'
          ? formState.options.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
      };
      if (editingFac) {
        await updateFacility(editingFac.id, payload);
        showToast('Fasilitas diperbarui');
      } else {
        await createFacility(payload);
        showToast('Fasilitas ditambahkan');
      }
      setShowDialog(false);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id) => {
    // Optimistic update
    setFacilities((prev) => prev.map((f) =>
      f.id === id ? { ...f, is_active: f.is_active ? 0 : 1 } : f
    ));
    try {
      await toggleFacility(id);
    } catch (err) {
      loadData(); // Revert on error
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (fac) => {
    const ok = await confirm({
      title: 'Hapus Fasilitas',
      message: `Yakin hapus "${fac.name}"? Semua data fasilitas masjid terkait juga akan dihapus.`,
      confirmLabel: 'Hapus',
      confirmStyle: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteFacility(fac.id);
      setFacilities((prev) => prev.filter((f) => f.id !== fac.id));
      showToast('Fasilitas dihapus');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ── Group CRUD ──

  const handleAddGroup = async () => {
    if (!groupName.trim()) {
      showToast('Nama grup wajib diisi', 'error');
      return;
    }
    setSavingGroup(true);
    try {
      await createFacilityGroup({ label: groupName.trim() });
      showToast('Grup ditambahkan');
      setShowGroupDialog(false);
      setGroupName('');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (col) => {
    const ok = await confirm({
      title: 'Hapus Grup',
      message: `Yakin hapus grup "${col.label}"?`,
      confirmLabel: 'Hapus',
      confirmStyle: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteFacilityGroup(col.grp);
      showToast('Grup dihapus');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border-2 rounded w-48" />
          <div className="flex gap-4 overflow-x-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[280px] bg-border-2 rounded-sm h-[400px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="font-heading font-bold text-xl text-text">Fasilitas</h1>
        <Button onClick={() => { setGroupName(''); setShowGroupDialog(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tambah Group
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-2">
          {columns.map((col) => (
            <GroupColumn
              key={col.grp}
              column={col}
              onAddFacility={openAddDialog}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              onToggle={handleToggleActive}
              isSuperAdmin={isSuperAdmin}
              onDeleteGroup={handleDeleteGroup}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <FacilityCard
              fac={activeCard}
              isDragOverlay
              onEdit={() => {}}
              onDelete={() => {}}
              onToggle={() => {}}
              isSuperAdmin={false}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add/Edit Facility Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) setShowDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFac ? 'Edit Fasilitas' : 'Tambah Fasilitas'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Fasilitas *</Label>
              <Input value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} placeholder="Contoh: Takjil" />
            </div>
            <div>
              <Label>Grup</Label>
              <Select value={formState.grp} onChange={(e) => setFormState({ ...formState, grp: e.target.value })}>
                {groups.map((g) => (
                  <option key={g.grp} value={g.grp}>{g.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Tipe Input</Label>
              <Select value={formState.input_type} onChange={(e) => setFormState({ ...formState, input_type: e.target.value })}>
                <option value="toggle">Toggle (Ya/Tidak)</option>
                <option value="dropdown">Dropdown (Pilihan)</option>
                <option value="number">Angka</option>
              </Select>
            </div>
            {formState.input_type === 'dropdown' && (
              <div>
                <Label>Pilihan (pisahkan dengan koma)</Label>
                <Input
                  value={formState.options}
                  onChange={(e) => setFormState({ ...formState, options: e.target.value })}
                  placeholder="contoh: 11, 23"
                />
              </div>
            )}
            <div>
              <Label>Urutan</Label>
              <Input
                type="number"
                value={formState.sort_order}
                onChange={(e) => setFormState({ ...formState, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Batal</Button>
            <Button onClick={handleSaveDialog} disabled={saving} className="font-semibold">
              {saving ? 'Menyimpan...' : (editingFac ? 'Perbarui' : 'Simpan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={(open) => { if (!open) setShowGroupDialog(false); }}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Tambah Group</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nama Grup *</Label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Contoh: Ramadhan, Masjid"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>Batal</Button>
            <Button onClick={handleAddGroup} disabled={savingGroup} className="font-semibold">
              {savingGroup ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
