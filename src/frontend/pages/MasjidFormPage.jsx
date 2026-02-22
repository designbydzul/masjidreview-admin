import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus } from 'lucide-react';
import { getMasjid, getMasjids, createMasjid, updateMasjid, getFacilities } from '../api';
import { useToast } from '../contexts/ToastContext';
import FormCard from '../components/FormCard';
import ToggleSwitch from '../components/ToggleSwitch';
import PhotoUpload from '../components/PhotoUpload';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

const GROUP_LABELS = {
  ramadhan: 'Fasilitas Ramadhan',
  masjid: 'Fasilitas Masjid',
  akhwat: 'Fasilitas Akhwat',
};

const emptyForm = {
  name: '', city: '', address: '', photo_url: '', google_maps_url: '', latitude: '', longitude: '', ig_post_url: '',
  info_label: '', info_photos: '[]',
};

export default function MasjidFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = !!id;

  const [form, setForm] = useState(emptyForm);
  const [infoPhotos, setInfoPhotos] = useState(['']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // City autocomplete
  const [cityOptions, setCityOptions] = useState([]);

  // Dynamic facilities
  const [facilities, setFacilities] = useState([]);
  const [facilityValues, setFacilityValues] = useState({});

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [facData, allMasjids] = await Promise.all([getFacilities(), getMasjids()]);
        setFacilities(facData.filter((f) => f.is_active));
        const cities = [...new Set(allMasjids.map((m) => m.city).filter(Boolean))].sort();
        setCityOptions(cities);

        if (isEdit) {
          const data = await getMasjid(id);
          setForm(data);
          if (data.facilities) setFacilityValues(data.facilities);
          try {
            const photos = JSON.parse(data.info_photos || '[]');
            setInfoPhotos(photos.length > 0 ? photos : ['']);
          } catch { setInfoPhotos(['']); }
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [id]);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const setFacValue = (facId, value) => {
    setFacilityValues((prev) => ({ ...prev, [facId]: value }));
  };

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
      const payload = {
        ...form,
        info_photos: JSON.stringify(infoPhotos.filter(Boolean)),
        facilities: facilityValues,
      };
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

  // Group facilities by grp
  const facilityGroups = {};
  for (const fac of facilities) {
    if (!facilityGroups[fac.grp]) facilityGroups[fac.grp] = [];
    facilityGroups[fac.grp].push(fac);
  }

  const renderFacilityInput = (fac) => {
    const value = facilityValues[fac.id] || '';

    if (fac.input_type === 'toggle') {
      return (
        <ToggleSwitch
          key={fac.id}
          label={fac.name}
          checked={value === 'ya'}
          onChange={() => setFacValue(fac.id, value === 'ya' ? '' : 'ya')}
        />
      );
    }

    if (fac.input_type === 'dropdown') {
      let options = [];
      try { options = JSON.parse(fac.options || '[]'); } catch {}
      return (
        <div key={fac.id}>
          <Label>{fac.name}</Label>
          <Select value={value} onChange={(e) => setFacValue(fac.id, e.target.value)}>
            <option value="">-- Pilih --</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </div>
      );
    }

    if (fac.input_type === 'number') {
      return (
        <div key={fac.id}>
          <Label>{fac.name}</Label>
          <Input
            type="number"
            value={value}
            onChange={(e) => setFacValue(fac.id, e.target.value)}
          />
        </div>
      );
    }

    return null;
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
              <Input list="city-options" value={form.city} onChange={(e) => set('city', e.target.value)} />
              <datalist id="city-options">
                {cityOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
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

        {['ramadhan', 'masjid', 'akhwat'].map((grp) => {
          const groupFacs = facilityGroups[grp];
          if (!groupFacs || groupFacs.length === 0) return null;

          const toggles = groupFacs.filter((f) => f.input_type === 'toggle');
          const others = groupFacs.filter((f) => f.input_type !== 'toggle');

          return (
            <FormCard key={grp} title={GROUP_LABELS[grp]}>
              {toggles.length > 0 && (
                <div className={others.length > 0 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
                  {toggles.map((fac) => renderFacilityInput(fac))}
                </div>
              )}
              {others.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {others.map((fac) => renderFacilityInput(fac))}
                </div>
              )}
            </FormCard>
          );
        })}
      </form>
    </div>
  );
}
