import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getFacilities, createFacility, updateFacility, deleteFacility, toggleFacility } from '../api';
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

const GROUP_LABELS = { ramadhan: 'Ramadhan', masjid: 'Masjid', akhwat: 'Akhwat' };
const TYPE_LABELS = { toggle: 'Toggle', dropdown: 'Dropdown', number: 'Angka' };
const GROUPS = ['ramadhan', 'masjid', 'akhwat'];

const emptyFormState = { name: '', grp: 'ramadhan', input_type: 'toggle', options: '', sort_order: 0 };

export default function SettingsPage() {
  const { admin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState('ramadhan');
  const [showDialog, setShowDialog] = useState(false);
  const [editingFac, setEditingFac] = useState(null);
  const [formState, setFormState] = useState(emptyFormState);
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    getFacilities()
      .then(setFacilities)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const filtered = facilities.filter((f) => f.grp === activeGroup);

  const openAddDialog = () => {
    setEditingFac(null);
    setFormState({ ...emptyFormState, grp: activeGroup });
    setShowDialog(true);
  };

  const openEditDialog = (fac) => {
    setEditingFac(fac);
    const opts = fac.options ? JSON.parse(fac.options).join(', ') : '';
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
    try {
      await toggleFacility(id);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (fac) => {
    const ok = await confirm({
      title: 'Hapus Fasilitas',
      message: `Yakin hapus "${fac.name}"? Semua data fasilitas masjid terkait juga akan dihapus.`,
      confirmLabel: 'Hapus',
      confirmStyle: 'red',
    });
    if (!ok) return;
    try {
      await deleteFacility(fac.id);
      showToast('Fasilitas dihapus');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) return <p className="text-text-2 text-sm py-8 text-center">Memuat data...</p>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading font-bold text-xl text-text">Fasilitas</h1>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tambah Fasilitas
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        {GROUPS.map((grp) => (
          <button
            key={grp}
            onClick={() => setActiveGroup(grp)}
            className={cn(
              'px-3.5 py-2 text-sm font-medium rounded-full border transition-colors',
              activeGroup === grp
                ? 'bg-green text-white border-green'
                : 'bg-white text-text-2 border-border hover:border-green hover:text-green'
            )}
          >
            {GROUP_LABELS[grp]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-text-3 text-sm text-center py-8">Belum ada fasilitas di grup ini</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((fac) => (
            <div key={fac.id} className="flex items-center justify-between p-3 bg-white border border-border rounded-sm">
              <div className="flex items-center gap-3">
                <ToggleSwitch checked={!!fac.is_active} onChange={() => handleToggleActive(fac.id)} />
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-medium', fac.is_active ? 'text-text' : 'text-text-3 line-through')}>{fac.name}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                    {TYPE_LABELS[fac.input_type]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-3 mr-1">#{fac.sort_order}</span>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(fac)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {admin?.role === 'super_admin' && (
                  <Button variant="outline" size="sm" onClick={() => handleDelete(fac)} className="text-red hover:border-red">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
                <option value="ramadhan">Ramadhan</option>
                <option value="masjid">Masjid</option>
                <option value="akhwat">Akhwat</option>
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
    </div>
  );
}
