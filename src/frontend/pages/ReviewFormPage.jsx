import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReview, updateReview, getMasjids } from '../api';
import { useToast } from '../contexts/ToastContext';
import FormCard from '../components/FormCard';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { SkeletonFormPage } from '../components/Skeleton';

export default function ReviewFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    reviewer_name: '', masjid_id: '', rating: '', source_platform: '', short_description: '', source_url: '',
  });
  const [masjids, setMasjids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getReview(id),
      getMasjids('approved'),
    ])
      .then(([review, masjidList]) => {
        setForm({
          reviewer_name: review.reviewer_name || '',
          masjid_id: review.masjid_id || '',
          rating: review.rating || '',
          source_platform: review.source_platform || '',
          short_description: review.short_description || '',
          source_url: review.source_url || '',
        });
        setMasjids(masjidList);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateReview(id, { ...form, rating: form.rating ? Number(form.rating) : null });
      showToast('Review diperbarui');
      navigate('/reviews');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonFormPage />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Edit Review</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/reviews')}>Batal</Button>
          <Button onClick={handleSave} disabled={saving} className="font-semibold">{saving ? 'Menyimpan...' : 'Perbarui'}</Button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <FormCard title="Detail Review">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nama Reviewer</Label>
              <Input value={form.reviewer_name} onChange={(e) => set('reviewer_name', e.target.value)} />
            </div>
            <div>
              <Label>Masjid</Label>
              <Select value={form.masjid_id} onChange={(e) => set('masjid_id', e.target.value)}>
                <option value="">-- Pilih Masjid --</option>
                {masjids.map((m) => <option key={m.id} value={m.id}>{m.name} – {m.city}</option>)}
              </Select>
            </div>
            <div>
              <Label>Rating (1-5)</Label>
              <Select value={form.rating} onChange={(e) => set('rating', e.target.value)}>
                <option value="">-- Pilih --</option>
                {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
            <div>
              <Label>Platform</Label>
              <Select value={form.source_platform} onChange={(e) => set('source_platform', e.target.value)}>
                <option value="">-- Pilih --</option>
                {['ig','x','threads','form','wa_bot','web'].map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label>Testimoni</Label>
            <Textarea value={form.short_description} onChange={(e) => set('short_description', e.target.value)} rows={4} />
          </div>
          <div className="mt-4">
            <Label>Source URL</Label>
            <Input value={form.source_url} onChange={(e) => set('source_url', e.target.value)} />
          </div>
        </FormCard>
      </form>
    </div>
  );
}
