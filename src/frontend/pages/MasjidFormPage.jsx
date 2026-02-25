import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus, Check, AlertTriangle } from 'lucide-react';
import { getMasjid, getMasjids, createMasjid, updateMasjid, setMasjidStatus, getFacilities, handleFacilityCorrections, getFacilityNotes } from '../api';
import { useToast } from '../contexts/ToastContext';
import FormCard from '../components/FormCard';
import ToggleSwitch from '../components/ToggleSwitch';
import PhotoUpload from '../components/PhotoUpload';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { SkeletonFormPage } from '../components/Skeleton';
import { formatDate, formatWA } from '../utils/format';

const GROUP_LABELS = {
  ramadhan: 'Fasilitas Ramadhan',
  masjid: 'Fasilitas Masjid',
  akhwat: 'Fasilitas Akhwat',
};

const emptyForm = {
  name: '', city: '', address: '', photo_url: '', google_maps_url: '', latitude: '', longitude: '', ig_post_url: '',
  info_label: '', info_photos: '[]',
};

const resolvePhotoUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('/images/')) return 'https://masjidreview.id' + url;
  return url;
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

  // Pending corrections & notes (edit mode only)
  const [pendingCorrections, setPendingCorrections] = useState({});
  const [facilityNotes, setFacilityNotes] = useState([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);

  // Coordinate extraction message
  const [coordMsg, setCoordMsg] = useState('');

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
          if (data.pending_corrections) setPendingCorrections(data.pending_corrections);
          try {
            const photos = JSON.parse(data.info_photos || '[]');
            setInfoPhotos(photos.length > 0 ? photos : ['']);
          } catch { setInfoPhotos(['']); }
          // Load facility notes
          try {
            const notes = await getFacilityNotes(id);
            setFacilityNotes(notes);
          } catch { /* ignore */ }
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

  const handleMapsUrlChange = (value) => {
    const atMatch = value.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const qMatch = value.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const match = atMatch || qMatch;

    if (match) {
      setForm((prev) => ({ ...prev, google_maps_url: value, latitude: match[1], longitude: match[2] }));
      setCoordMsg('Koordinat terdeteksi');
      setTimeout(() => setCoordMsg(''), 3000);
    } else {
      set('google_maps_url', value);
      if (value.includes('maps.app.goo.gl') || value.includes('goo.gl/maps')) {
        setCoordMsg('Gunakan URL lengkap dari Google Maps untuk deteksi koordinat otomatis');
        setTimeout(() => setCoordMsg(''), 5000);
      } else {
        setCoordMsg('');
      }
    }
  };

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

  const hasPendingCorrections = Object.keys(pendingCorrections).length > 0;

  const handleCorrectionsAction = async (action) => {
    setCorrectionsLoading(true);
    try {
      await handleFacilityCorrections(id, action);
      showToast(action === 'accept_all' ? 'Koreksi diterima' : 'Koreksi ditolak');
      const data = await getMasjid(id);
      if (data.facilities) setFacilityValues(data.facilities);
      setPendingCorrections(data.pending_corrections || {});
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCorrectionsLoading(false);
    }
  };

  const handleSave = async (e, alsoApprove = false) => {
    e?.preventDefault();
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
        if (alsoApprove) {
          await setMasjidStatus(id, 'approved');
        }
        showToast(alsoApprove ? 'Masjid disimpan & disetujui' : 'Masjid disimpan');
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
    const correction = pendingCorrections[fac.id];
    const showCorrection = correction && correction.pending_value !== value;

    if (fac.input_type === 'toggle') {
      return (
        <div key={fac.id}>
          <ToggleSwitch
            label={fac.name}
            checked={value === 'ya'}
            onChange={() => setFacValue(fac.id, value === 'ya' ? '' : 'ya')}
          />
          {showCorrection && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1" title={`Diajukan oleh ${correction.submitted_by || 'Anonim'} pada ${formatDate(correction.created_at)}`}>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Saran: {correction.pending_value}
            </p>
          )}
        </div>
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
          {showCorrection && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1" title={`Diajukan oleh ${correction.submitted_by || 'Anonim'} pada ${formatDate(correction.created_at)}`}>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Saran: {correction.pending_value}
            </p>
          )}
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
          {showCorrection && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1" title={`Diajukan oleh ${correction.submitted_by || 'Anonim'} pada ${formatDate(correction.created_at)}`}>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Saran: {correction.pending_value}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  if (loading) return <SkeletonFormPage />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">{isEdit ? 'Edit Masjid' : 'Tambah Masjid'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/masjids')}>Batal</Button>
          <Button onClick={handleSave} disabled={saving} className="font-semibold">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          {isEdit && form.status === 'pending' && (
            <Button onClick={(e) => handleSave(e, true)} disabled={saving} className="font-semibold bg-green hover:bg-green/90">
              {saving ? 'Menyimpan...' : 'Simpan & Approve'}
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave}>
        <FormCard title="Informasi Dasar">
          {isEdit && (
            <div className="mb-4 pb-4 border-b border-border/50">
              <Label className="text-text-2">Diajukan Oleh</Label>
              <p className="text-sm mt-1">
                {form.submitted_by_name ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`/users/${form.submitted_by}`)}
                      className="text-green hover:underline font-medium"
                    >
                      {form.submitted_by_name}
                    </button>
                    {form.submitted_by_wa && (
                      <span className="text-text-3 ml-2">({formatWA(form.submitted_by_wa)})</span>
                    )}
                  </>
                ) : (
                  <span className="text-text-3 italic">Admin / tidak diketahui</span>
                )}
              </p>
            </div>
          )}
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
            <PhotoUpload value={form.photo_url} onChange={(v) => set('photo_url', v)} prefix="masjid" resolveUrl={resolvePhotoUrl} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Google Maps URL</Label>
              <Input value={form.google_maps_url || ''} onChange={(e) => handleMapsUrlChange(e.target.value)} />
              {coordMsg && (
                <p className={`text-xs mt-1 ${coordMsg.startsWith('Koordinat') ? 'text-green' : 'text-amber-600'}`}>
                  {coordMsg}
                </p>
              )}
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
                  <PhotoUpload value={url} onChange={(v) => updateInfoPhoto(idx, v)} prefix="info" resolveUrl={resolvePhotoUrl} />
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

        {/* Pending Corrections Summary */}
        {isEdit && hasPendingCorrections && (
          <FormCard title={
            <span className="flex items-center gap-2">
              Koreksi Fasilitas
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {Object.keys(pendingCorrections).length} pending
              </span>
            </span>
          }>
            <p className="text-sm text-text-2 mb-3">
              {Object.keys(pendingCorrections).length} koreksi fasilitas dari jamaah menunggu review.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => handleCorrectionsAction('accept_all')}
                disabled={correctionsLoading}
                className="font-semibold"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Terima Semua
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCorrectionsAction('reject_all')}
                disabled={correctionsLoading}
                className="font-semibold hover:border-red hover:text-red"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Tolak Semua
              </Button>
            </div>
          </FormCard>
        )}

        {/* Catatan dari Jamaah */}
        {isEdit && facilityNotes.length > 0 && (
          <FormCard title="Catatan dari Jamaah">
            <div className="space-y-3">
              {facilityNotes.map((note) => (
                <div key={note.id} className="p-3 bg-bg rounded-sm border border-border/50">
                  <p className="text-sm text-text">{note.text}</p>
                  <p className="text-xs text-text-3 mt-1.5">
                    {note.submitted_by || 'Anonim'} &middot; {formatDate(note.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </FormCard>
        )}
      </form>
    </div>
  );
}
