import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus, Check, AlertTriangle, Camera, Trash2, MapPin, Loader2 } from 'lucide-react';
import { getMasjid, getMasjids, createMasjid, updateMasjid, setMasjidStatus, getFacilities, handleFacilityCorrections, getFacilityNotes, searchPlaces, downloadPlacesPhoto, uploadFile } from '../api';
import { useToast } from '../contexts/ToastContext';
import FormCard from '../components/FormCard';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { SkeletonFormPage } from '../components/Skeleton';
import { formatDate, formatWA } from '../utils/format';
import { resolvePhotoUrl } from '../utils/url';
import { cn } from '../lib/utils';

const GROUP_META = {
  ramadhan: { label: 'Ramadhan', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  masjid: { label: 'Masjid', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  akhwat: { label: 'Akhwat', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
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
  const [infoPhotos, setInfoPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cityOptions, setCityOptions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [facilityValues, setFacilityValues] = useState({});
  const [pendingCorrections, setPendingCorrections] = useState({});
  const [facilityNotes, setFacilityNotes] = useState([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [coordMsg, setCoordMsg] = useState('');
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesResults, setPlacesResults] = useState([]);
  const [showPlacesModal, setShowPlacesModal] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState({});
  const [photoDownloading, setPhotoDownloading] = useState(false);

  // Photo upload
  const mainPhotoRef = useRef(null);
  const infoPhotoRef = useRef(null);
  const [mainPhotoUploading, setMainPhotoUploading] = useState(false);

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
            setInfoPhotos(photos.filter(Boolean));
          } catch { setInfoPhotos([]); }
          try { const notes = await getFacilityNotes(id); setFacilityNotes(notes); } catch {}

          // Auto-fill from Google Places for pending submissions
          if (data.status === 'pending' && data.name && data.city) {
            const needsAutoFill = !data.address || !data.latitude || !data.longitude || !data.google_maps_url;
            if (needsAutoFill) {
              setPlacesLoading(true);
              try {
                const placesData = await searchPlaces(data.name, data.city);
                if (placesData.found && placesData.results?.length === 1) {
                  const r = placesData.results[0];
                  setForm((prev) => ({
                    ...prev,
                    address: r.address || prev.address,
                    google_maps_url: r.google_maps_url || prev.google_maps_url,
                    latitude: r.latitude ?? prev.latitude,
                    longitude: r.longitude ?? prev.longitude,
                    photo_url: prev.photo_url || r.photo_url || prev.photo_url,
                  }));
                  showToast('Data dari Google Maps berhasil diisi otomatis');
                }
              } catch {} finally { setPlacesLoading(false); }
            }
          }
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
    // Auto-dismiss inline badge when admin changes value
    if (pendingCorrections[facId]) {
      setPendingCorrections((prev) => {
        const next = { ...prev };
        delete next[facId];
        return next;
      });
    }
  };

  const applyPlacesResult = (result) => {
    setForm((prev) => ({
      ...prev,
      address: result.address || prev.address,
      google_maps_url: result.google_maps_url || prev.google_maps_url,
      latitude: result.latitude ?? prev.latitude,
      longitude: result.longitude ?? prev.longitude,
      photo_url: prev.photo_url || result.photo_url || prev.photo_url,
    }));
    // Flash green highlight on filled fields
    const fields = {};
    if (result.address) fields.address = true;
    if (result.google_maps_url) fields.google_maps_url = true;
    if (result.latitude) fields.latitude = true;
    if (result.longitude) fields.longitude = true;
    setHighlightedFields(fields);
    setTimeout(() => setHighlightedFields({}), 2000);
  };

  const fetchPlacesPhoto = async (photoRef) => {
    if (!photoRef) return;
    setPhotoDownloading(true);
    try {
      const data = await downloadPlacesPhoto(photoRef);
      if (data.photo_url) {
        set('photo_url', data.photo_url);
      }
    } catch {
      // Photo download failed silently — user can upload manually
    } finally {
      setPhotoDownloading(false);
    }
  };

  const handlePlacesSearch = async () => {
    setPlacesLoading(true);
    try {
      const data = await searchPlaces(form.name, form.city);
      if (!data.found || !data.results?.length) {
        showToast('Tidak ditemukan di Google Maps. Isi data secara manual.', 'error');
        return;
      }
      if (data.results.length === 1) {
        applyPlacesResult(data.results[0]);
        showToast('Data dari Google Maps berhasil diisi');
      } else {
        setPlacesResults(data.results);
        setShowPlacesModal(true);
      }
    } catch (err) {
      showToast('Gagal menghubungi Google Maps. Coba lagi.', 'error');
    } finally {
      setPlacesLoading(false);
    }
  };

  const handleSave = async (e, alsoApprove = false) => {
    e?.preventDefault();
    if (!form.name || !form.city) { showToast('Nama dan kota wajib diisi', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        info_photos: JSON.stringify(infoPhotos.filter(Boolean)),
        facilities: facilityValues,
      };
      if (isEdit) {
        await updateMasjid(id, payload);
        if (alsoApprove) await setMasjidStatus(id, 'approved');
        showToast(alsoApprove ? 'Masjid disimpan & disetujui' : 'Masjid disimpan');
      } else {
        await createMasjid(payload);
        showToast('Masjid ditambahkan');
      }
      navigate('/masjids');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Corrections bulk actions ──

  const handleCorrectionsAction = async (action) => {
    setCorrectionsLoading(true);
    try {
      await handleFacilityCorrections(id, action);
      showToast(action === 'accept_all' ? 'Koreksi diterima' : 'Koreksi ditolak');
      const data = await getMasjid(id);
      if (data.facilities) setFacilityValues(data.facilities);
      setPendingCorrections(data.pending_corrections || {});
    } catch (err) { showToast(err.message, 'error'); }
    finally { setCorrectionsLoading(false); }
  };

  // ── Photo handlers ──

  const handleMainPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMainPhotoUploading(true);
    try {
      const data = await uploadFile(file, 'masjid');
      set('photo_url', data.url);
    } catch (err) { showToast('Upload gagal: ' + err.message, 'error'); }
    finally { setMainPhotoUploading(false); if (mainPhotoRef.current) mainPhotoRef.current.value = ''; }
  };

  const handleInfoPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await uploadFile(file, 'info');
      setInfoPhotos((prev) => [...prev, data.url]);
    } catch (err) { showToast('Upload gagal: ' + err.message, 'error'); }
    finally { if (infoPhotoRef.current) infoPhotoRef.current.value = ''; }
  };

  // ── Group facilities ──

  const facilityGroups = {};
  for (const fac of facilities) {
    if (!facilityGroups[fac.grp]) facilityGroups[fac.grp] = [];
    facilityGroups[fac.grp].push(fac);
  }

  const pendingCount = Object.keys(pendingCorrections).length;

  // ── Render inline correction badge ──

  const renderBadge = (facId) => {
    const corr = pendingCorrections[facId];
    if (!corr) return null;
    const currentVal = facilityValues[facId] || '';
    if (corr.pending_value === currentVal) return null;
    const name = corr.submitted_by_name || (corr.submitted_by ? formatWA(corr.submitted_by) : 'Guest');
    return (
      <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 ml-auto shrink-0">
        <span className="truncate max-w-[140px]">Saran: {corr.pending_value} — {name}</span>
      </span>
    );
  };

  // ── Render facility input ──

  const renderFacilityInput = (fac) => {
    const value = facilityValues[fac.id] || '';
    const badge = renderBadge(fac.id);

    if (fac.input_type === 'toggle') {
      return (
        <div key={fac.id} className="flex items-center gap-2 min-h-[32px]">
          <Switch checked={value === 'ya'} onCheckedChange={() => setFacValue(fac.id, value === 'ya' ? '' : 'ya')} />
          <span className="text-sm text-text">{fac.name}</span>
          {badge}
        </div>
      );
    }

    if (fac.input_type === 'dropdown') {
      let options = [];
      try { options = JSON.parse(fac.options || '[]'); } catch {}
      return (
        <div key={fac.id} className="flex items-center gap-2 min-h-[32px]">
          <Label className="text-sm text-text whitespace-nowrap shrink-0">{fac.name}</Label>
          <Select value={value} onChange={(e) => setFacValue(fac.id, e.target.value)} className="h-8 text-xs w-[140px]">
            <option value="">-- Pilih --</option>
            {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          {badge}
        </div>
      );
    }

    if (fac.input_type === 'number') {
      return (
        <div key={fac.id} className="flex items-center gap-2 min-h-[32px]">
          <Label className="text-sm text-text whitespace-nowrap shrink-0">{fac.name}</Label>
          <Input type="number" value={value} onChange={(e) => setFacValue(fac.id, e.target.value)} className="h-8 text-xs w-[100px]" />
          {badge}
        </div>
      );
    }
    return null;
  };

  if (loading) return <SkeletonFormPage />;

  return (
    <div>
      {/* Header */}
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* ══════════ LEFT COLUMN (4/5 = 80%) ══════════ */}
          <div className="lg:col-span-4 space-y-4">

            {/* ── Informasi Dasar ── */}
            <FormCard title={
              <div className="flex items-center justify-between w-full">
                <span>Informasi Dasar</span>
                <Button type="button" variant="outline" size="sm" disabled={!form.name || !form.city || placesLoading} onClick={handlePlacesSearch} className="text-xs h-7">
                  {placesLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Mencari...</> : <><MapPin className="h-3.5 w-3.5 mr-1" />Isi Otomatis</>}
                </Button>
              </div>
            }>
              {isEdit && (form.submitted_by_name || form.submitted_by) && (
                <div className="mb-4 pb-3 border-b border-border/50">
                  <p className="text-xs text-text-3">
                    Diajukan oleh:{' '}
                    {form.submitted_by_name ? (
                      <>
                        <button type="button" onClick={() => navigate(`/users/${form.submitted_by}`)} className="text-green hover:underline font-medium">
                          {form.submitted_by_name}
                        </button>
                        {form.submitted_by_wa ? (
                          <span className="text-text-3 ml-1">({formatWA(form.submitted_by_wa)})</span>
                        ) : form.submitted_by_email ? (
                          <span className="text-text-3 ml-1">({form.submitted_by_email})</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="italic">Admin</span>
                    )}
                  </p>
                </div>
              )}

              {/* Row 1: Nama + Kota */}
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

              {/* Row 2: Alamat */}
              <div className="mt-3">
                <Label>Alamat</Label>
                <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} className={cn(highlightedFields.address && 'ring-2 ring-green/40 bg-green-light transition-all duration-500')} />
              </div>

              {/* Auto-fill warning */}
              {isEdit && form.status === 'pending' && form.name && form.city && (!form.address || !form.latitude) && !placesLoading && (
                <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Data lokasi belum lengkap. Gunakan tombol untuk mencari dari Google Maps.</p>
                </div>
              )}

              {/* Row 3: GMaps + IG + Lat + Lng + Auto button */}
              <div className="grid grid-cols-10 gap-2 mt-3">
                <div className="col-span-10 md:col-span-3">
                  <Label>Google Maps URL</Label>
                  <Input value={form.google_maps_url || ''} onChange={(e) => handleMapsUrlChange(e.target.value)} className={cn('text-xs', highlightedFields.google_maps_url && 'ring-2 ring-green/40 bg-green-light transition-all duration-500')} />
                  {coordMsg && <p className={cn('text-[10px] mt-0.5', coordMsg.startsWith('Koordinat') ? 'text-green' : 'text-amber-600')}>{coordMsg}</p>}
                </div>
                <div className="col-span-10 md:col-span-3">
                  <Label>IG Post URL</Label>
                  <Input value={form.ig_post_url || ''} onChange={(e) => set('ig_post_url', e.target.value)} className="text-xs" />
                </div>
                <div className="col-span-5 md:col-span-2">
                  <Label>Lat</Label>
                  <Input value={form.latitude || ''} onChange={(e) => set('latitude', e.target.value)} className={cn('text-xs', highlightedFields.latitude && 'ring-2 ring-green/40 bg-green-light transition-all duration-500')} />
                </div>
                <div className="col-span-5 md:col-span-2">
                  <Label>Long</Label>
                  <Input value={form.longitude || ''} onChange={(e) => set('longitude', e.target.value)} className={cn('text-xs', highlightedFields.longitude && 'ring-2 ring-green/40 bg-green-light transition-all duration-500')} />
                </div>
              </div>
            </FormCard>

            {/* ── Informasi Umum ── */}
            <FormCard title="Informasi Umum">
              <Label>Info Label</Label>
              <Input value={form.info_label || ''} onChange={(e) => set('info_label', e.target.value)} />

              {/* Info Photos (inline) */}
              <div className="mt-4 pt-3 border-t border-border/50">
                <Label className="mb-2 block">Info Photos</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {infoPhotos.map((url, idx) => (
                    <div key={idx} className="relative group w-16 h-16 shrink-0">
                      <img src={resolvePhotoUrl(url)} alt={`Info ${idx + 1}`} className="w-full h-full object-cover rounded-sm border border-border" />
                      <button
                        type="button"
                        onClick={() => setInfoPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1.5 -right-1.5 bg-red text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {infoPhotos.length < 5 && (
                    <button
                      type="button"
                      onClick={() => infoPhotoRef.current?.click()}
                      className="w-16 h-16 shrink-0 rounded-sm border-2 border-dashed border-border flex items-center justify-center bg-bg hover:border-green hover:bg-green-light transition-colors"
                    >
                      <Plus className="h-4 w-4 text-text-3" />
                    </button>
                  )}
                </div>
                <input ref={infoPhotoRef} type="file" accept="image/*" onChange={handleInfoPhotoUpload} className="hidden" />
                {infoPhotos.length === 0 && (
                  <p className="text-xs text-text-3 mt-1.5">Belum ada info photos. Maks 5 foto.</p>
                )}
              </div>
            </FormCard>

            {/* ── Fasilitas (Unified Card) ── */}
            <FormCard title={
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2">
                  Fasilitas
                  {isEdit && pendingCount > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {pendingCount} pending
                    </span>
                  )}
                </span>
                {isEdit && pendingCount > 0 && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => handleCorrectionsAction('accept_all')} disabled={correctionsLoading} className="font-semibold text-xs h-7">
                      <Check className="h-3 w-3 mr-1" />Terima Semua
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleCorrectionsAction('reject_all')} disabled={correctionsLoading} className="font-semibold text-xs h-7 hover:border-red hover:text-red">
                      <X className="h-3 w-3 mr-1" />Tolak Semua
                    </Button>
                  </div>
                )}
              </div>
            }>
              {['ramadhan', 'masjid', 'akhwat'].map((grp) => {
                const groupFacs = facilityGroups[grp];
                if (!groupFacs || groupFacs.length === 0) return null;
                const meta = GROUP_META[grp];
                const toggles = groupFacs.filter((f) => f.input_type === 'toggle');
                const others = groupFacs.filter((f) => f.input_type !== 'toggle');

                return (
                  <div key={grp} className="mb-4 last:mb-0">
                    <div className={cn('flex items-center gap-2 mb-3 pb-1.5 border-b', meta.border)}>
                      <span className={cn('text-xs font-semibold uppercase tracking-wider', meta.color)}>{meta.label}</span>
                    </div>
                    {toggles.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-2">
                        {toggles.map((fac) => renderFacilityInput(fac))}
                      </div>
                    )}
                    {others.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {others.map((fac) => renderFacilityInput(fac))}
                      </div>
                    )}
                  </div>
                );
              })}
            </FormCard>

          </div>

          {/* ══════════ RIGHT COLUMN (1/5 = 20%) ══════════ */}
          <div className="lg:col-span-1 space-y-4">

            {/* ── Foto Utama ── */}
            <FormCard title="Foto Utama">
              {form.photo_url ? (
                <div className="space-y-3">
                  <img
                    src={resolvePhotoUrl(form.photo_url)}
                    alt="Foto Utama"
                    className="w-full aspect-[4/3] object-cover rounded-sm border border-border"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" size="sm" onClick={() => mainPhotoRef.current?.click()} disabled={mainPhotoUploading} className="font-semibold text-xs">
                      <Camera className="h-3.5 w-3.5 mr-1" />{mainPhotoUploading ? 'Uploading...' : 'Ganti Foto'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => set('photo_url', '')} className="text-red hover:border-red text-xs">
                      <Trash2 className="h-3.5 w-3.5 mr-1" />Hapus
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-full aspect-[4/3] rounded-sm border-2 border-dashed border-border flex items-center justify-center bg-bg">
                    {photoDownloading ? (
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 text-green mx-auto mb-2 animate-spin" />
                        <p className="text-xs text-text-3">Mengunduh foto...</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Camera className="h-8 w-8 text-text-3 mx-auto mb-2" />
                        <p className="text-xs text-text-3">Belum ada foto</p>
                      </div>
                    )}
                  </div>
                  <Button type="button" size="sm" onClick={() => mainPhotoRef.current?.click()} disabled={mainPhotoUploading || photoDownloading} className="w-full font-semibold text-xs">
                    <Camera className="h-3.5 w-3.5 mr-1" />{mainPhotoUploading ? 'Uploading...' : 'Upload Foto'}
                  </Button>
                </div>
              )}
              <input ref={mainPhotoRef} type="file" accept="image/*" onChange={handleMainPhotoUpload} className="hidden" />
              <div className="mt-2">
                <Input type="text" value={form.photo_url || ''} onChange={(e) => set('photo_url', e.target.value)} placeholder="Atau masukkan URL foto..." className="text-xs" />
              </div>
            </FormCard>

            {/* ── Catatan dari Jamaah ── */}
            {isEdit && facilityNotes.length > 0 && (
              <FormCard title="Catatan dari Jamaah">
                <div className="space-y-2">
                  {facilityNotes.map((note) => (
                    <div key={note.id} className="p-2.5 bg-bg rounded-sm border border-border/50">
                      <p className="text-sm text-text italic">"{note.text}"</p>
                      <p className="text-[11px] text-text-3 mt-1">
                        {note.submitted_by || 'Anonim'} &middot; {formatDate(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </FormCard>
            )}

          </div>
        </div>
      </form>

      {/* ── Google Places Suggestion Modal ── */}
      <Dialog open={showPlacesModal} onOpenChange={setShowPlacesModal}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Pilih Masjid yang Sesuai</DialogTitle>
            <DialogDescription asChild>
              <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-700">Ditemukan {placesResults.length} masjid serupa. Pilih yang sesuai:</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {placesResults.map((result, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-bg rounded-sm border border-border/50 hover:border-green/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{result.name}</p>
                  <p className="text-xs text-text-3 mt-0.5 line-clamp-2">{result.address}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 text-xs h-8"
                  onClick={() => {
                    applyPlacesResult(result);
                    if (result.photo_ref && !form.photo_url) fetchPlacesPhoto(result.photo_ref);
                    setShowPlacesModal(false);
                    setPlacesResults([]);
                    showToast('Data dari Google Maps berhasil diisi');
                  }}
                >
                  Pilih
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 text-center">
            <button
              type="button"
              className="text-xs text-text-3 hover:text-text underline"
              onClick={() => { setShowPlacesModal(false); setPlacesResults([]); }}
            >
              Tidak ada yang sesuai? Isi manual
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
