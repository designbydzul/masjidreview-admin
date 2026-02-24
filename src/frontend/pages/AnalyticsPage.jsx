import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { SkeletonAnalytics } from '../components/Skeleton';
import { useToast } from '../contexts/ToastContext';
import {
  getAnalyticsOverview,
  getAnalyticsCtaSummary,
  getAnalyticsFilterUsage,
  getAnalyticsConversions,
  getAnalyticsPeakHours,
  getAnalyticsCityTraffic,
  getAnalyticsTopPages,
  getAnalyticsExportUrl,
} from '../api';

const GREEN = '#1B7A4A';
const GREEN_LIGHT = 'rgba(27,122,74,0.15)';
const FUNNEL_COLORS = ['#1B7A4A', '#2D8A5E', '#4CAF50', '#81C784'];

function toLocalDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function toISOStart(dateStr) {
  return dateStr + 'T00:00:00.000Z';
}

function toISOEnd(dateStr) {
  return dateStr + 'T23:59:59.999Z';
}

const CTA_LABELS = {
  cta_click_tulis_review: 'Tulis Review',
  cta_click_tambah_masjid: 'Tambah Masjid',
  ig_link_click: 'Link IG',
  maps_link_click: 'Link Maps',
};

const FUNNEL_STEPS = [
  { key: 'page_view', label: 'Page Views' },
  { key: 'login_start', label: 'Login Dimulai' },
  { key: 'login_success', label: 'Login Berhasil' },
  { key: 'review_submitted', label: 'Review Dikirim' },
];

const EVENT_TYPES_FOR_EXPORT = [
  { value: '', label: 'Semua Event' },
  { value: 'page_view', label: 'Page View' },
  { value: 'cta_click_tulis_review', label: 'CTA Tulis Review' },
  { value: 'cta_click_tambah_masjid', label: 'CTA Tambah Masjid' },
  { value: 'ig_link_click', label: 'IG Link Click' },
  { value: 'maps_link_click', label: 'Maps Link Click' },
  { value: 'filter_city', label: 'Filter Kota' },
  { value: 'filter_preference', label: 'Filter Preferensi' },
  { value: 'login_start', label: 'Login Start' },
  { value: 'login_success', label: 'Login Success' },
  { value: 'review_submitted', label: 'Review Submitted' },
  { value: 'masjid_submitted', label: 'Masjid Submitted' },
];

function formatNum(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('id-ID');
}

function ChartCard({ title, children, className }) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { showToast } = useToast();
  const today = toLocalDate(new Date());
  const [preset, setPreset] = useState('30d');
  const [fromDate, setFromDate] = useState(toLocalDate(new Date(Date.now() - 30 * 86400000)));
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [exportType, setExportType] = useState('');

  const [overview, setOverview] = useState(null);
  const [ctaSummary, setCtaSummary] = useState([]);
  const [filterUsage, setFilterUsage] = useState({ cities: [], preferences: [] });
  const [conversions, setConversions] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [cityTraffic, setCityTraffic] = useState([]);
  const [topPages, setTopPages] = useState([]);

  const applyPreset = useCallback((key) => {
    setPreset(key);
    const now = new Date();
    if (key === 'today') {
      setFromDate(toLocalDate(now));
      setToDate(toLocalDate(now));
    } else if (key === '7d') {
      setFromDate(toLocalDate(new Date(Date.now() - 7 * 86400000)));
      setToDate(toLocalDate(now));
    } else if (key === '30d') {
      setFromDate(toLocalDate(new Date(Date.now() - 30 * 86400000)));
      setToDate(toLocalDate(now));
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const from = toISOStart(fromDate);
    const to = toISOEnd(toDate);
    try {
      const [ov, cta, fu, conv, ph, ct, tp] = await Promise.all([
        getAnalyticsOverview(from, to),
        getAnalyticsCtaSummary(from, to),
        getAnalyticsFilterUsage(from, to),
        getAnalyticsConversions(from, to),
        getAnalyticsPeakHours(from, to),
        getAnalyticsCityTraffic(from, to),
        getAnalyticsTopPages(from, to),
      ]);
      setOverview(ov);
      setCtaSummary(cta);
      setFilterUsage(fu);
      setConversions(conv);
      setPeakHours(ph);
      setCityTraffic(ct);
      setTopPages(tp);
    } catch (err) {
      showToast(err.message || 'Gagal memuat data analitik', 'error');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Transform CTA data
  const ctaData = useMemo(() => {
    const map = {};
    ctaSummary.forEach((r) => { map[r.event_type] = r.count; });
    return Object.entries(CTA_LABELS).map(([key, label]) => ({
      name: label,
      count: map[key] || 0,
    }));
  }, [ctaSummary]);

  // Transform funnel data
  const funnelData = useMemo(() => {
    const map = {};
    conversions.forEach((r) => { map[r.event_type] = r.count; });
    const first = map[FUNNEL_STEPS[0].key] || 0;
    return FUNNEL_STEPS.map((step, i) => {
      const count = map[step.key] || 0;
      const pct = first > 0 ? ((count / first) * 100).toFixed(1) : '0.0';
      return { name: step.label, count, pct: Number(pct) };
    });
  }, [conversions]);

  // Peak hours: fill all 24 hours
  const peakData = useMemo(() => {
    const map = {};
    peakHours.forEach((r) => { map[r.hour] = r.count; });
    return Array.from({ length: 24 }, (_, i) => ({
      hour: String(i).padStart(2, '0') + ':00',
      count: map[i] || 0,
    }));
  }, [peakHours]);

  const handleExport = () => {
    const from = toISOStart(fromDate);
    const to = toISOEnd(toDate);
    const url = getAnalyticsExportUrl(from, to, exportType || undefined);
    window.open(url, '_blank');
  };

  if (loading) return <SkeletonAnalytics />;

  return (
    <div>
      <h1 className="font-heading text-[22px] font-bold text-text mb-5">Analitik</h1>

      {/* Date Range Picker */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {[
          { key: 'today', label: 'Hari Ini' },
          { key: '7d', label: '7 Hari' },
          { key: '30d', label: '30 Hari' },
        ].map((p) => (
          <Button
            key={p.key}
            variant={preset === p.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => applyPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => { setFromDate(e.target.value); setPreset('custom'); }}
            className="h-8 px-2 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
          />
          <span className="text-text-2 text-sm">—</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={today}
            onChange={(e) => { setToDate(e.target.value); setPreset('custom'); }}
            className="h-8 px-2 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
          />
        </div>
      </div>

      {/* Row 1: Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Page Views', value: overview?.total_page_views },
          { label: 'Pengunjung Unik', value: overview?.unique_visitors },
          { label: 'Review Dikirim', value: overview?.total_reviews },
          { label: 'Masjid Dikirim', value: overview?.total_masjids },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="text-text-2 text-xs font-semibold uppercase tracking-wider mb-2">{s.label}</div>
              <span className="font-heading text-[28px] font-bold text-text">{formatNum(s.value)}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: CTA Clicks */}
      <ChartCard title="Klik CTA" className="mb-6">
        {ctaData.every((d) => d.count === 0) ? (
          <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ctaData} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 13 }} />
              <Tooltip formatter={(v) => formatNum(v)} />
              <Bar dataKey="count" fill={GREEN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 3: Filter Usage — 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Kota Populer">
          {filterUsage.cities.length === 0 ? (
            <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, filterUsage.cities.length * 32)}>
              <BarChart data={filterUsage.cities} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatNum(v)} />
                <Bar dataKey="count" fill={GREEN} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Preferensi Populer">
          {filterUsage.preferences.length === 0 ? (
            <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, filterUsage.preferences.length * 32)}>
              <BarChart data={filterUsage.preferences} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatNum(v)} />
                <Bar dataKey="count" fill={GREEN} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 4: Conversion Funnel */}
      <ChartCard title="Conversion Funnel" className="mb-6">
        {funnelData.every((d) => d.count === 0) ? (
          <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
        ) : (
          <div className="space-y-3">
            {funnelData.map((step, i) => {
              const maxCount = funnelData[0].count || 1;
              const widthPct = Math.max((step.count / maxCount) * 100, 4);
              return (
                <div key={step.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-text">{step.name}</span>
                    <span className="text-text-2">{formatNum(step.count)} ({step.pct}%)</span>
                  </div>
                  <div className="w-full bg-bg rounded-sm h-7">
                    <div
                      className="h-7 rounded-sm transition-all duration-500"
                      style={{ width: widthPct + '%', backgroundColor: FUNNEL_COLORS[i] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>

      {/* Row 5: Peak Hours */}
      <ChartCard title="Jam Aktivitas Puncak" className="mb-6">
        {peakData.every((d) => d.count === 0) ? (
          <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={peakData} margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
              <YAxis />
              <Tooltip formatter={(v) => formatNum(v)} />
              <Bar dataKey="count" fill={GREEN}>
                {peakData.map((entry, i) => (
                  <Cell key={i} fill={entry.count === Math.max(...peakData.map((d) => d.count)) ? GREEN : GREEN_LIGHT} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 6: Two columns — Top Pages + City Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Halaman Populer">
          {topPages.length === 0 ? (
            <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Halaman</TableHead>
                    <TableHead className="text-right w-24">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPages.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">{row.page}</TableCell>
                      <TableCell className="text-right">{formatNum(row.count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ChartCard>
        <ChartCard title="Traffic per Kota">
          {cityTraffic.length === 0 ? (
            <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kota</TableHead>
                    <TableHead className="text-right w-24">Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityTraffic.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.city || '-'}</TableCell>
                      <TableCell className="text-right">{formatNum(row.count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Bottom: CSV Export */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-text-2 uppercase tracking-wider mb-4">Ekspor Data</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              className="h-9 px-3 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
            >
              {EVENT_TYPES_FOR_EXPORT.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Ekspor CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
