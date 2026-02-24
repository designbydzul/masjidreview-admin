import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus, Check } from 'lucide-react';
import { getMasjid, getMasjids, createMasjid, updateMasjid, getFacilities, getFacilitySuggestions, actionFacilitySuggestion, bulkFacilitySuggestionStatus } from '../api';
import { useToast } from '../contexts/ToastContext';
import FormCard from '../components/FormCard';
import BulkBar from '../components/BulkBar';
import Badge from '../components/Badge';
import { Checkbox } from '../components/ui/checkbox';
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

  // Facility suggestions (edit mode only)
  const [suggestions, setSuggestions] = useState([]);
  const [sugFilter, setSugFilter] = useState('pending');
  const [selectedSugIds, setSelectedSugIds] = useState(new Set());

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
          try {
            const photos = JSON.parse(data.info_photos || '[]');
            setInfoPhotos(photos.length > 0 ? photos : ['']);
          } catch { setInfoPhotos(['']); }
          // Load facility suggestions
          try {
            const sugs = await getFacilitySuggestions({ masjid_id: id });
            setSuggestions(sugs);
          } catch { /* ignore if table doesn't exist yet */ }
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

  const reloadSuggestions = async () => {
    try {
      const sugs = await getFacilitySuggestions({ masjid_id: id });
      setSuggestions(sugs);
    } catch {}
  };

  const handleSuggestionAction = async (sugId, action) => {
    try {
      await actionFacilitySuggestion(sugId, action);
      showToast(action === 'approve' ? 'Saran disetujui' : 'Saran ditolak');
      await reloadSuggestions();
      // If approved, refresh facility values to reflect the change
      if (action === 'approve') {
        const data = await getMasjid(id);
        if (data.facilities) setFacilityValues(data.facilities);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkSuggestion = async (status) => {
    try {
      await bulkFacilitySuggestionStatus([...selectedSugIds], status);
      showToast(`${selectedSugIds.size} saran di-${status === 'approved' ? 'setujui' : 'tolak'}`);
      setSelectedSugIds(new Set());
      await reloadSuggestions();
      if (status === 'approved') {
        const data = await getMasjid(id);
        if (data.facilities) setFacilityValues(data.facilities);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const pendingCount = useMemo(() => suggestions.filter((s) => s.status === 'pending').length, [suggestions]);

  const filteredSuggestions = useMemo(() => {
    if (sugFilter === 'all') return suggestions;
    return suggestions.filter((s) => s.status === sugFilter);
  }, [suggestions, sugFilter]);

  const pendingSugIds = useMemo(
    () => filteredSuggestions.filter((s) => s.status === 'pending').map((s) => s.id),
    [filteredSuggestions]
  );

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

  if (loading) return <SkeletonFormPage />;

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
            <PhotoUpload value={form.photo_url} onChange={(v) => set('photo_url', v)} prefix="masjid" />
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

        {/* Saran Fasilitas — edit mode only */}
        {isEdit && suggestions.length > 0 && (
          <FormCard title={
            <span className="flex items-center gap-2">
              Saran Fasilitas
              {pendingCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {pendingCount} pending
                </span>
              )}
            </span>
          }>
            <div className="mb-4">
              <Select
                value={sugFilter}
                onChange={(e) => { setSugFilter(e.target.value); setSelectedSugIds(new Set()); }}
                className="sm:w-[180px]"
              >
                <option value="pending">Pending</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
                <option value="all">Semua</option>
              </Select>
            </div>

            <BulkBar
              count={selectedSugIds.size}
              onApprove={() => handleBulkSuggestion('approved')}
              onReject={() => handleBulkSuggestion('rejected')}
            />

            {filteredSuggestions.length === 0 ? (
              <p className="text-text-3 text-sm py-4 text-center">Tidak ada saran dengan status ini.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-2">
                      <th className="py-2 px-2 w-10">
                        <Checkbox
                          checked={
                            pendingSugIds.length > 0 && pendingSugIds.every((sid) => selectedSugIds.has(sid))
                              ? true
                              : pendingSugIds.some((sid) => selectedSugIds.has(sid))
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={() => {
                            if (pendingSugIds.every((sid) => selectedSugIds.has(sid))) {
                              setSelectedSugIds(new Set());
                            } else {
                              setSelectedSugIds(new Set(pendingSugIds));
                            }
                          }}
                          disabled={pendingSugIds.length === 0}
                        />
                      </th>
                      <th className="py-2 px-2 font-medium">Fasilitas</th>
                      <th className="py-2 px-2 font-medium">Nilai Saran</th>
                      <th className="py-2 px-2 font-medium">Diajukan Oleh</th>
                      <th className="py-2 px-2 font-medium">Tanggal</th>
                      <th className="py-2 px-2 font-medium">Status</th>
                      <th className="py-2 px-2 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuggestions.map((sug) => (
                      <tr key={sug.id} className="border-b border-border/50 hover:bg-gray-50">
                        <td className="py-2.5 px-2 w-10">
                          {sug.status === 'pending' ? (
                            <Checkbox
                              checked={selectedSugIds.has(sug.id)}
                              onCheckedChange={() => {
                                const next = new Set(selectedSugIds);
                                if (next.has(sug.id)) next.delete(sug.id);
                                else next.add(sug.id);
                                setSelectedSugIds(next);
                              }}
                            />
                          ) : null}
                        </td>
                        <td className="py-2.5 px-2 font-medium text-text">{sug.facility_name || <span className="text-text-3 italic">Lainnya</span>}</td>
                        <td className="py-2.5 px-2 text-text">{sug.suggested_value}</td>
                        <td className="py-2.5 px-2 text-text-2">{sug.submitted_by_wa ? formatWA(sug.submitted_by_wa) : '—'}</td>
                        <td className="py-2.5 px-2 text-text-2 whitespace-nowrap">{formatDate(sug.created_at)}</td>
                        <td className="py-2.5 px-2"><Badge status={sug.status} /></td>
                        <td className="py-2.5 px-2">
                          {sug.status === 'pending' && (
                            <div className="flex gap-1.5">
                              {sug.facility_id && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSuggestionAction(sug.id, 'approve')}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Setujui
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuggestionAction(sug.id, 'reject')}
                                className="h-7 px-2 text-xs text-red hover:border-red"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Tolak
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormCard>
        )}
      </form>
    </div>
  );
}
