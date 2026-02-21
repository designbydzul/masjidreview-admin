import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus } from 'lucide-react';
import { getMasjid, createMasjid, updateMasjid } from '../api';
import { useToast } from '../contexts/ToastContext';
import FormCard from '../components/FormCard';
import ToggleSwitch from '../components/ToggleSwitch';
import PhotoUpload from '../components/PhotoUpload';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

const emptyForm = {
  name: '', city: '', address: '', photo_url: '', google_maps_url: '', latitude: '', longitude: '', ig_post_url: '',
  info_label: '', info_photos: '[]',
  ramadan_takjil: 0, ramadan_makanan_berat: 0, ramadan_ceramah_tarawih: 0, ramadan_mushaf_alquran: 0, ramadan_itikaf: 0, ramadan_parkir: 0,
  ramadan_rakaat: '', ramadan_tempo: '',
  akhwat_wudhu_private: 0, akhwat_mukena_available: 0, akhwat_ac_available: 0, akhwat_safe_entrance: 0,
};

export default function MasjidFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = !!id;

  const [form, setForm] = useState(emptyForm);
  const [infoPhotos, setInfoPhotos] = useState(['']);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getMasjid(id)
        .then((data) => {
          setForm(data);
          try {
            const photos = JSON.parse(data.info_photos || '[]');
            setInfoPhotos(photos.length > 0 ? photos : ['']);
          } catch { setInfoPhotos(['']); }
        })
        .catch((err) => showToast(err.message, 'error'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));
  const toggle = (key) => set(key, form[key] ? 0 : 1);

  const addInfoPhoto = () => {
    if (infoPhotos.length < 5) setInfoPhotos([...infoPhotos, '']);
  };

  const removeInfoPhoto = (idx) => {
    setInfoPhotos(infoPhotos.filter((_, i) => i !== idx));
  };

  const updateInfoPhoto = (idx, val) => {
    const next = [...infoPhotos];
    next[idx] = val;
    setInfoPhotos(next);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.city) {
      showToast('Nama dan kota wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, info_photos: JSON.stringify(infoPhotos.filter(Boolean)) };
      if (isEdit) {
        await updateMasjid(id, payload);
        showToast('Masjid diperbarui');
      } else {
        await createMasjid(payload);
        showToast('Masjid ditambahkan');
      }
      navigate('/masjids');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-text-2 text-sm py-8 text-center">Memuat data...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">{isEdit ? 'Edit Masjid' : 'Tambah Masjid'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/masjids')}>Batal</Button>
          <Button onClick={handleSave} disabled={saving} className="font-semibold">{saving ? 'Menyimpan...' : (isEdit ? 'Perbarui' : 'Simpan')}</Button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <FormCard title="Informasi Dasar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nama Masjid *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <Label>Kota *</Label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <Label>Alamat</Label>
            <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="mt-4">
            <Label>Foto Utama</Label>
            <PhotoUpload value={form.photo_url} onChange={(v) => set('photo_url', v)} prefix="masjid" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Google Maps URL</Label>
              <Input value={form.google_maps_url || ''} onChange={(e) => set('google_maps_url', e.target.value)} />
            </div>
            <div>
              <Label>IG Post URL</Label>
              <Input value={form.ig_post_url || ''} onChange={(e) => set('ig_post_url', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Latitude</Label>
              <Input value={form.latitude || ''} onChange={(e) => set('latitude', e.target.value)} />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={form.longitude || ''} onChange={(e) => set('longitude', e.target.value)} />
            </div>
          </div>
        </FormCard>

        <FormCard title="Informasi Umum">
          <div>
            <Label>Info Label</Label>
            <Input value={form.info_label || ''} onChange={(e) => set('info_label', e.target.value)} />
          </div>
          <div className="mt-4">
            <Label className="mb-2">Info Photos (maks 5)</Label>
            {infoPhotos.map((url, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <div className="flex-1">
                  <PhotoUpload value={url} onChange={(v) => updateInfoPhoto(idx, v)} prefix="info" />
                </div>
                {infoPhotos.length > 1 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => removeInfoPhoto(idx)} className="text-red hover:border-red self-start mt-0.5">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {infoPhotos.length < 5 && (
              <Button type="button" variant="link" size="sm" onClick={addInfoPhoto} className="px-0">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tambah foto
              </Button>
            )}
          </div>
        </FormCard>

        <FormCard title="Fasilitas Ramadhan">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <ToggleSwitch label="Takjil" checked={!!form.ramadan_takjil} onChange={() => toggle('ramadan_takjil')} />
            <ToggleSwitch label="Makanan Berat" checked={!!form.ramadan_makanan_berat} onChange={() => toggle('ramadan_makanan_berat')} />
            <ToggleSwitch label="Ceramah Tarawih" checked={!!form.ramadan_ceramah_tarawih} onChange={() => toggle('ramadan_ceramah_tarawih')} />
            <ToggleSwitch label="Mushaf Al-Quran" checked={!!form.ramadan_mushaf_alquran} onChange={() => toggle('ramadan_mushaf_alquran')} />
            <ToggleSwitch label="I'tikaf" checked={!!form.ramadan_itikaf} onChange={() => toggle('ramadan_itikaf')} />
            <ToggleSwitch label="Parkir Luas" checked={!!form.ramadan_parkir} onChange={() => toggle('ramadan_parkir')} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Rakaat Tarawih</Label>
              <Select value={form.ramadan_rakaat || ''} onChange={(e) => set('ramadan_rakaat', e.target.value)}>
                <option value="">-- Pilih --</option>
                <option value="11">11 Rakaat</option>
                <option value="23">23 Rakaat</option>
              </Select>
            </div>
            <div>
              <Label>Tempo Shalat</Label>
              <Select value={form.ramadan_tempo || ''} onChange={(e) => set('ramadan_tempo', e.target.value)}>
                <option value="">-- Pilih --</option>
                <option value="khusyuk">Khusyuk (Pelan)</option>
                <option value="sedang">Sedang</option>
                <option value="cepat">Cepat</option>
              </Select>
            </div>
          </div>
        </FormCard>

        <FormCard title="Fasilitas Akhwat">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ToggleSwitch label="Wudhu Terpisah" checked={!!form.akhwat_wudhu_private} onChange={() => toggle('akhwat_wudhu_private')} />
            <ToggleSwitch label="Mukena Tersedia" checked={!!form.akhwat_mukena_available} onChange={() => toggle('akhwat_mukena_available')} />
            <ToggleSwitch label="AC" checked={!!form.akhwat_ac_available} onChange={() => toggle('akhwat_ac_available')} />
            <ToggleSwitch label="Pintu Masuk Aman" checked={!!form.akhwat_safe_entrance} onChange={() => toggle('akhwat_safe_entrance')} />
          </div>
        </FormCard>
      </form>
    </div>
  );
}
