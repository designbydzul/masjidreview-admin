import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SkeletonAnalytics } from '../components/Skeleton';
import { useToast } from '../contexts/ToastContext';
import {
  getAnalyticsOverview,
  getAnalyticsCtaSummary,
  getAnalyticsFilterUsage,
  getAnalyticsConversions,
  getAnalyticsPeakHours,
  getAnalyticsTopPages,
  getAnalyticsExportUrl,
} from '../api';

const GREEN = '#1B7A4A';
const GREEN_LIGHT = 'rgba(27,122,74,0.15)';
const BLUE = '#60a5fa';
const PURPLE = '#a78bfa';
const FUNNEL_COLORS = ['#1B7A4A', '#2D8A5E', '#4CAF50', '#81C784'];

function toLocalDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function toISOStart(dateStr) { return dateStr + 'T00:00:00.000Z'; }
function toISOEnd(dateStr) { return dateStr + 'T23:59:59.999Z'; }

const CTA_LABELS = {
  cta_click_tambah_masjid: 'Tambah Masjid',
  cta_click_tulis_review: 'Tulis Review',
  join_page: 'Join Page',
  maps_link_click: 'Link Maps',
};

const FUNNEL_STEPS = [
  { key: 'page_view', label: 'Page Views' },
  { key: 'join_page', label: 'Join Page' },
  { key: 'login_success', label: 'Login Berhasil' },
  { key: 'review_submitted', label: 'Review Dikirim' },
];

const EVENT_TYPES_FOR_EXPORT = [
  { value: '', label: 'Semua Event' },
  { value: 'page_view', label: 'Page View' },
  { value: 'cta_click_tulis_review', label: 'CTA Tulis Review' },
  { value: 'cta_click_tambah_masjid', label: 'CTA Tambah Masjid' },
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

const PAGE_LABELS = {
  '/': 'Home (/)',
  '/join': 'Join',
  '/profile': 'Profile',
  '/tambah': 'Tambah',
  '/tambah/form': 'Tambah Form',
  '/tambah/review': 'Tambah Review',
};

function friendlyPage(page, masjidName) {
  if (PAGE_LABELS[page]) return PAGE_LABELS[page];
  if (page?.startsWith('/masjids/') && masjidName) return masjidName;
  return page || '-';
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

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-sm px-3 py-1.5 shadow-lg text-xs">
      <span className="font-semibold text-text">{formatNum(payload[0].value)}</span>
    </div>
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
      const [ov, cta, fu, conv, ph, tp] = await Promise.all([
        getAnalyticsOverview(from, to),
        getAnalyticsCtaSummary(from, to),
        getAnalyticsFilterUsage(from, to),
        getAnalyticsConversions(from, to),
        getAnalyticsPeakHours(from, to),
        getAnalyticsTopPages(from, to),
      ]);
      setOverview(ov);
      setCtaSummary(cta);
      setFilterUsage(fu);
      setConversions(conv);
      setPeakHours(ph);
      setTopPages(tp);
    } catch (err) {
      showToast(err.message || 'Gagal memuat data analitik', 'error');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // CTA data
  const ctaData = useMemo(() => {
    const map = {};
    ctaSummary.forEach((r) => { map[r.event_type] = r.count; });
    return Object.entries(CTA_LABELS).map(([key, label]) => ({
      name: label,
      count: map[key] || 0,
    }));
  }, [ctaSummary]);

  // Funnel data
  const funnelData = useMemo(() => {
    const map = {};
    conversions.forEach((r) => { map[r.event_type] = r.count; });
    const first = map[FUNNEL_STEPS[0].key] || 0;
    return FUNNEL_STEPS.map((step) => {
      const count = map[step.key] || 0;
      const pct = first > 0 ? ((count / first) * 100).toFixed(1) : '0.0';
      return { name: step.label, count, pct: Number(pct) };
    });
  }, [conversions]);

  // Peak hours
  const peakData = useMemo(() => {
    const map = {};
    peakHours.forEach((r) => { map[r.hour] = r.count; });
    return Array.from({ length: 24 }, (_, i) => ({
      hour: String(i).padStart(2, '0'),
      count: map[i] || 0,
    }));
  }, [peakHours]);

  const maxPeak = useMemo(() => Math.max(...peakData.map((d) => d.count), 1), [peakData]);

  const handleExport = () => {
    const from = toISOStart(fromDate);
    const to = toISOEnd(toDate);
    const url = getAnalyticsExportUrl(from, to, exportType || undefined);
    window.open(url, '_blank');
  };

  if (loading) return <SkeletonAnalytics />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-heading text-[22px] font-bold text-text">Analitik</h1>
      </div>

      {/* Top bar: filters + export */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => { setFromDate(e.target.value); setPreset('custom'); }}
              className="h-8 px-2 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
            />
            <span className="text-text-3 text-sm">—</span>
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
        <div className="flex items-center gap-2">
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            className="h-8 px-2 text-sm border border-border rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-green"
          >
            {EVENT_TYPES_FOR_EXPORT.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
          <Button size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {/* Row 1: 6 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'PAGE VIEWS', value: overview?.total_page_views },
          { label: 'PENGUNJUNG UNIK', value: overview?.unique_visitors },
          { label: 'REVIEW (WEB)', value: overview?.reviews_web },
          { label: 'REVIEW (BOT)', value: overview?.reviews_bot },
          { label: 'MASJID DIKIRIM', value: overview?.masjid_submitted },
          { label: 'USER BARU', value: overview?.user_baru },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-text-3 text-[11px] font-semibold uppercase tracking-wider mb-1.5">{s.label}</div>
              <span className="font-heading text-[26px] font-bold text-text leading-none">{formatNum(s.value)}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Conversion Funnel (left) + Klik CTA (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Conversion Funnel">
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

        <ChartCard title="Klik CTA">
          {ctaData.every((d) => d.count === 0) ? (
            <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ctaData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="count" fill={GREEN} radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {ctaData.map((_, i) => (
                    <Cell key={i} fill={GREEN} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Peak Hours (full width) */}
      <ChartCard title="Jam Aktivitas Puncak" className="mb-6">
        {peakData.every((d) => d.count === 0) ? (
          <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={peakData} margin={{ left: -10, right: 0, top: 0, bottom: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={24}>
                {peakData.map((entry, i) => (
                  <Cell key={i} fill={entry.count === maxPeak ? GREEN : GREEN_LIGHT} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 4: Three columns — Kota Dicari + Preferensi Dicari + Halaman Populer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Kota Dicari (Filter) */}
        <ChartCard title="Kota Dicari (Filter)">
          {filterUsage.cities.length === 0 ? (
            <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, filterUsage.cities.length * 32)}>
              <BarChart data={filterUsage.cities} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Preferensi Dicari (Filter) */}
        <ChartCard title="Preferensi Dicari (Filter)">
          {filterUsage.preferences.length === 0 ? (
            <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, filterUsage.preferences.length * 32)}>
              <BarChart data={filterUsage.preferences} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="count" fill={PURPLE} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Halaman Populer */}
        <ChartCard title="Halaman Populer">
          {topPages.length === 0 ? (
            <p className="text-text-3 text-sm py-8 text-center">Belum ada data</p>
          ) : (
            <div className="space-y-1.5">
              {topPages.slice(0, 10).map((row, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm text-text truncate mr-2">{friendlyPage(row.page, row.masjid_name)}</span>
                  <span className="text-sm font-heading font-semibold text-text-2 shrink-0">{formatNum(row.count)}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
