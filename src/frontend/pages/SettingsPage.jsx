import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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

// ── Draggable Facility Card (simplified — clickable, no action buttons) ──

function FacilityCard({ fac, isDraggable = false, isDragOverlay = false, onClick }) {
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
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      onClick={() => !isDragging && onClick?.(fac)}
      className={cn(
        'bg-white border border-border rounded-sm p-3 transition-colors',
        isDragging && 'opacity-40',
        isDragOverlay && 'shadow-lg rotate-[2deg] border-green',
        isDraggable && 'cursor-grab active:cursor-grabbing',
        !isDraggable && onClick && 'cursor-pointer',
        'hover:border-green'
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', fac.is_active ? 'bg-green' : 'bg-border-2')} />
        <span className={cn('text-sm font-medium truncate flex-1', fac.is_active ? 'text-text' : 'text-text-3 line-through')}>
          {fac.name}
        </span>
        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', TYPE_BADGE_STYLES[fac.input_type] || TYPE_BADGE_STYLES.toggle)}>
          {TYPE_LABELS[fac.input_type]}
        </span>
      </div>
      {fac.input_type === 'dropdown' && fac.options && (
        <div className="mt-1.5 pl-[18px]">
          <span className="text-[11px] text-text-3">
            Pilihan: {(() => { try { return JSON.parse(fac.options).join(', '); } catch { return fac.options; } })()}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Facility Detail Dialog ──

function FacilityDetailDialog({ fac, open, onOpenChange, groups, isSuperAdmin, onUpdate, onDelete }) {
  const [form, setForm] = useState({ name: '', grp: '', input_type: 'toggle', options: '', is_active: 1 });

  useEffect(() => {
    if (fac) {
      const opts = fac.options ? (() => { try { return JSON.parse(fac.options).join(', '); } catch { return fac.options; } })() : '';
      setForm({
        name: fac.name,
        grp: fac.grp,
        input_type: fac.input_type,
        options: opts,
        is_active: fac.is_active ? 1 : 0,
      });
    }
  }, [fac]);

  if (!fac) return null;

  const handleSave = () => {
    if (!form.name.trim()) return;
    const updated = {
      ...fac,
      name: form.name.trim(),
      grp: form.grp,
      input_type: form.input_type,
      options: form.input_type === 'dropdown' && form.options.trim()
        ? JSON.stringify(form.options.split(',').map((s) => s.trim()).filter(Boolean))
        : null,
      is_active: form.is_active,
    };
    onUpdate(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Detail Fasilitas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Nama Fasilitas *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Takjil" />
          </div>
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Tipe Input</Label>
            <Select value={form.input_type} onChange={(e) => setForm((f) => ({ ...f, input_type: e.target.value }))}>
              <option value="toggle">Toggle (Ya/Tidak)</option>
              <option value="dropdown">Dropdown (Pilihan)</option>
              <option value="number">Angka</option>
            </Select>
          </div>
          {form.input_type === 'dropdown' && (
            <div>
              <Label className="text-xs text-text-3 mb-1.5 block">Pilihan (pisahkan dengan koma)</Label>
              <Input
                value={form.options}
                onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                placeholder="contoh: 11, 23"
              />
            </div>
          )}
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Grup</Label>
            <Select value={form.grp} onChange={(e) => setForm((f) => ({ ...f, grp: e.target.value }))}>
              {groups.map((g) => (
                <option key={g.grp} value={g.grp}>{g.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-xs text-text-3 mb-1.5 block">Status</Label>
            <ToggleSwitch
              label={form.is_active ? 'Aktif' : 'Nonaktif'}
              checked={!!form.is_active}
              onChange={(checked) => setForm((f) => ({ ...f, is_active: checked ? 1 : 0 }))}
            />
          </div>
        </div>
        <DialogFooter className="flex !justify-between">
          {isSuperAdmin ? (
            <Button variant="destructive" size="sm" onClick={() => { onDelete(fac); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Hapus
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>Simpan</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Droppable Column ──

function GroupColumn({ column, onAddFacility, onCardClick }) {
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
        <Button variant="ghost" size="sm" onClick={() => onAddFacility(column.grp)} className="h-7 w-7 p-0 text-text-3 hover:text-green">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {column.items.map((fac) => (
          <FacilityCard
            key={fac.id}
            fac={fac}
            isDraggable
            onClick={onCardClick}
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
  const { confirm } = useConfirm();

  // Server snapshots (never mutated during editing)
  const [serverGroups, setServerGroups] = useState([]);
  const [serverFacilities, setServerFacilities] = useState([]);

  // Working copies (mutated by user actions)
  const [groups, setGroups] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);

  // Pending creates/deletes
  const [pendingCreates, setPendingCreates] = useState([]); // facility IDs that are new
  const [pendingDeletes, setPendingDeletes] = useState([]); // facility IDs to delete
  const [pendingGroupCreates, setPendingGroupCreates] = useState([]); // group grp keys that are new

  // Detail dialog
  const [selectedFac, setSelectedFac] = useState(null);

  // Add facility dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addFormState, setAddFormState] = useState({ name: '', grp: '', input_type: 'toggle', options: '' });

  // Add group dialog
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState('');

  const [saving, setSaving] = useState(false);

  const isSuperAdmin = admin?.role === 'super_admin';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Has Changes ──
  const hasChanges = useMemo(() => {
    if (pendingCreates.length > 0) return true;
    if (pendingDeletes.length > 0) return true;
    if (pendingGroupCreates.length > 0) return true;
    if (JSON.stringify(facilities) !== JSON.stringify(serverFacilities)) return true;
    if (JSON.stringify(groups) !== JSON.stringify(serverGroups)) return true;
    return false;
  }, [facilities, serverFacilities, groups, serverGroups, pendingCreates, pendingDeletes, pendingGroupCreates]);

  // ── Navigation Guard: beforeunload ──
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);


  // ── Load Data ──
  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([getFacilityGroups(), getFacilities()])
      .then(([grps, facs]) => {
        setServerGroups(JSON.parse(JSON.stringify(grps)));
        setServerFacilities(JSON.parse(JSON.stringify(facs)));
        setGroups(grps);
        setFacilities(facs);
        // Clear all pending
        setPendingCreates([]);
        setPendingDeletes([]);
        setPendingGroupCreates([]);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Columns ──
  const columns = useMemo(() => {
    return [...groups]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((grp) => ({
        ...grp,
        items: facilities
          .filter((f) => f.grp === grp.grp)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
  }, [groups, facilities]);

  // ── Drag & Drop (local only, no API) ──

  const handleDragStart = (event) => {
    const fac = facilities.find((f) => f.id === event.active.id);
    setActiveCard(fac || null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const facId = active.id;
    const targetGrp = over.id;
    const fac = facilities.find((f) => f.id === facId);
    if (!fac) return;
    if (!groups.some((g) => g.grp === targetGrp)) return;
    if (fac.grp === targetGrp) return;

    // Calculate new sort_order at end of target group
    const targetItems = facilities.filter((f) => f.grp === targetGrp);
    const maxOrder = targetItems.length > 0 ? Math.max(...targetItems.map((f) => f.sort_order)) + 1 : 0;

    setFacilities((prev) => prev.map((f) =>
      f.id === facId ? { ...f, grp: targetGrp, sort_order: maxOrder } : f
    ));
  };

  // ── Card Click → Detail Dialog ──

  const handleCardClick = (fac) => {
    setSelectedFac(fac);
  };

  const handleFacUpdate = (updated) => {
    setFacilities((prev) => prev.map((f) => f.id === updated.id ? updated : f));
  };

  const handleFacDelete = (fac) => {
    // If it's a pending create, just remove it entirely
    if (pendingCreates.includes(fac.id)) {
      setPendingCreates((prev) => prev.filter((id) => id !== fac.id));
    } else {
      // Existing facility: mark for deletion
      setPendingDeletes((prev) => [...prev, fac.id]);
    }
    setFacilities((prev) => prev.filter((f) => f.id !== fac.id));
    setSelectedFac(null);
  };

  // ── Add Facility (local) ──

  const openAddDialog = (grp) => {
    setAddFormState({ name: '', grp, input_type: 'toggle', options: '' });
    setShowAddDialog(true);
  };

  const handleAddFacility = () => {
    if (!addFormState.name.trim()) {
      showToast('Nama wajib diisi', 'error');
      return;
    }
    const grpItems = facilities.filter((f) => f.grp === addFormState.grp);
    const maxOrder = grpItems.length > 0 ? Math.max(...grpItems.map((f) => f.sort_order)) + 1 : 0;
    const tempId = 'temp_' + crypto.randomUUID();
    const newFac = {
      id: tempId,
      name: addFormState.name.trim(),
      grp: addFormState.grp,
      input_type: addFormState.input_type,
      options: addFormState.input_type === 'dropdown' && addFormState.options.trim()
        ? JSON.stringify(addFormState.options.split(',').map((s) => s.trim()).filter(Boolean))
        : null,
      sort_order: maxOrder,
      is_active: 1,
    };
    setFacilities((prev) => [...prev, newFac]);
    setPendingCreates((prev) => [...prev, tempId]);
    setShowAddDialog(false);
  };

  // ── Add Group (local) ──

  const handleAddGroup = () => {
    if (!groupName.trim()) {
      showToast('Nama grup wajib diisi', 'error');
      return;
    }
    const grpKey = groupName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (groups.some((g) => g.grp === grpKey)) {
      showToast('Grup sudah ada', 'error');
      return;
    }
    const maxOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.sort_order)) + 1 : 0;
    const newGroup = { grp: grpKey, label: groupName.trim(), sort_order: maxOrder };
    setGroups((prev) => [...prev, newGroup]);
    setPendingGroupCreates((prev) => [...prev, grpKey]);
    setShowGroupDialog(false);
    setGroupName('');
  };

  // ── Discard Changes ──

  const handleDiscard = () => {
    setGroups(JSON.parse(JSON.stringify(serverGroups)));
    setFacilities(JSON.parse(JSON.stringify(serverFacilities)));
    setPendingCreates([]);
    setPendingDeletes([]);
    setPendingGroupCreates([]);
  };

  // ── Batch Save ──

  const handleBatchSave = async () => {
    const ok = await confirm({
      title: 'Simpan Perubahan',
      message: 'Perubahan akan diterapkan ke seluruh aplikasi. Lanjutkan?',
      confirmLabel: 'Simpan',
    });
    if (!ok) return;

    setSaving(true);
    try {
      // 1. Create new groups
      for (const grpKey of pendingGroupCreates) {
        const grp = groups.find((g) => g.grp === grpKey);
        if (grp) {
          await createFacilityGroup({ label: grp.label });
        }
      }

      // 2. Delete facilities
      for (const id of pendingDeletes) {
        await deleteFacility(id);
      }

      // 3. Create new facilities
      for (const tempId of pendingCreates) {
        const fac = facilities.find((f) => f.id === tempId);
        if (fac) {
          await createFacility({
            name: fac.name,
            grp: fac.grp,
            input_type: fac.input_type,
            options: fac.options ? (typeof fac.options === 'string' ? JSON.parse(fac.options) : fac.options) : null,
            sort_order: fac.sort_order,
          });
          // Toggle if inactive (new facilities default to no is_active column in POST, so handle via separate call if needed)
          // Actually the API doesn't accept is_active in POST, it defaults to 1. If user set inactive, we toggle after create.
        }
      }

      // 4. Update existing facilities that changed
      for (const fac of facilities) {
        if (pendingCreates.includes(fac.id)) continue; // already handled
        const serverFac = serverFacilities.find((sf) => sf.id === fac.id);
        if (!serverFac) continue; // shouldn't happen
        // Build diff payload
        const payload = {};
        if (fac.name !== serverFac.name) payload.name = fac.name;
        if (fac.grp !== serverFac.grp) payload.grp = fac.grp;
        if (fac.input_type !== serverFac.input_type) payload.input_type = fac.input_type;
        if (fac.sort_order !== serverFac.sort_order) payload.sort_order = fac.sort_order;
        if (fac.is_active !== serverFac.is_active) payload.is_active = fac.is_active;
        if (JSON.stringify(fac.options) !== JSON.stringify(serverFac.options)) {
          payload.options = fac.options ? (typeof fac.options === 'string' ? JSON.parse(fac.options) : fac.options) : null;
        }
        if (Object.keys(payload).length > 0) {
          await updateFacility(fac.id, payload);
        }
      }

      // 5. Update group sort_orders that changed
      for (const grp of groups) {
        if (pendingGroupCreates.includes(grp.grp)) continue; // already created with correct order
        const serverGrp = serverGroups.find((sg) => sg.grp === grp.grp);
        if (!serverGrp) continue;
        if (grp.sort_order !== serverGrp.sort_order) {
          await updateFacilityGroup(grp.grp, { sort_order: grp.sort_order });
        }
      }

      showToast('Perubahan disimpan');
      loadData(); // Reload fresh from server
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
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
        <div className={cn('flex gap-4 overflow-x-auto flex-1 min-h-0 pb-2', hasChanges && 'pb-16')}>
          {columns.map((col) => (
            <GroupColumn
              key={col.grp}
              column={col}
              onAddFacility={openAddDialog}
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <FacilityCard fac={activeCard} isDragOverlay onClick={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Sticky Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-[200px] right-0 bg-white border-t border-border px-6 py-3 flex items-center justify-between z-50 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <span className="text-sm text-text-2">Ada perubahan yang belum disimpan</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDiscard} disabled={saving}>Batal</Button>
            <Button onClick={handleBatchSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedFac && (
        <FacilityDetailDialog
          fac={selectedFac}
          open={!!selectedFac}
          onOpenChange={(open) => { if (!open) setSelectedFac(null); }}
          groups={groups}
          isSuperAdmin={isSuperAdmin}
          onUpdate={handleFacUpdate}
          onDelete={handleFacDelete}
        />
      )}

      {/* Add Facility Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) setShowAddDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Fasilitas</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Fasilitas *</Label>
              <Input value={addFormState.name} onChange={(e) => setAddFormState((f) => ({ ...f, name: e.target.value }))} placeholder="Contoh: Takjil" />
            </div>
            <div>
              <Label>Grup</Label>
              <Select value={addFormState.grp} onChange={(e) => setAddFormState((f) => ({ ...f, grp: e.target.value }))}>
                {groups.map((g) => (
                  <option key={g.grp} value={g.grp}>{g.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Tipe Input</Label>
              <Select value={addFormState.input_type} onChange={(e) => setAddFormState((f) => ({ ...f, input_type: e.target.value }))}>
                <option value="toggle">Toggle (Ya/Tidak)</option>
                <option value="dropdown">Dropdown (Pilihan)</option>
                <option value="number">Angka</option>
              </Select>
            </div>
            {addFormState.input_type === 'dropdown' && (
              <div>
                <Label>Pilihan (pisahkan dengan koma)</Label>
                <Input
                  value={addFormState.options}
                  onChange={(e) => setAddFormState((f) => ({ ...f, options: e.target.value }))}
                  placeholder="contoh: 11, 23"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
            <Button onClick={handleAddFacility} className="font-semibold">Simpan</Button>
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
            <Button onClick={handleAddGroup} className="font-semibold">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
