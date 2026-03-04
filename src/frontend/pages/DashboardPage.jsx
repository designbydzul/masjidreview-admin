import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Star, Clock, Users, MessageSquare, ArrowRight, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getDashboard } from '../api';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';

const CARD_CONFIG = [
  { key: 'masjid', label: 'Masjid', icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', link: '/masjids?status=approved' },
  { key: 'reviews', label: 'Reviews', icon: Star, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', link: '/reviews?status=approved' },
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', link: '/reviews?status=pending' },
  { key: 'users', label: 'Users', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', link: '/users' },
  { key: 'feedback', label: 'Feedback', icon: MessageSquare, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', link: '/feedback' },
];

function StatCardNew({ config, value, subtitle, onClick }) {
  const Icon = config.icon;
  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md hover:border-green" onClick={onClick}>
      <CardContent className="p-4">
        <div className={cn('inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2', config.bg)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <div className="font-heading text-[26px] font-bold text-text leading-none">{value ?? '–'}</div>
        <div className="text-xs text-text-3 mt-1">{config.label}</div>
        {subtitle && <div className={cn('text-[11px] font-medium mt-0.5', config.color)}>{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

function ActionRow({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between w-full px-3 py-2 text-sm text-text-2 rounded-sm hover:bg-gray-50 transition-colors group"
    >
      <span className="truncate">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-text-3 shrink-0 group-hover:text-green transition-colors" />
    </button>
  );
}

function truncateMsg(msg, max = 40) {
  if (!msg) return '-';
  return msg.length > max ? msg.slice(0, max) + '...' : msg;
}

function formatChartDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate().toString();
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-sm px-3 py-1.5 shadow-lg text-xs">
      <span className="text-text-2">{label}: </span>
      <span className="font-semibold text-text">{payload[0].value} views</span>
    </div>
  );
}

// Skeleton
function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-border rounded-sm p-4">
            <div className="h-8 w-8 rounded-lg bg-bg-2 mb-2" />
            <div className="h-7 w-12 bg-bg-2 rounded mb-1" />
            <div className="h-3 w-16 bg-bg-2 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-border rounded-sm p-4">
            <div className="h-5 w-24 bg-bg-2 rounded mb-3" />
            {Array.from({ length: 3 }).map((_, j) => <div key={j} className="h-8 w-full bg-bg-2 rounded mb-2" />)}
          </div>
        ))}
      </div>
      <div className="border border-border rounded-sm p-5">
        <div className="h-5 w-40 bg-bg-2 rounded mb-4" />
        <div className="h-40 w-full bg-bg-2 rounded" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const { cards, pendingMasjids, pendingMasjidTotal, pendingReviews, pendingReviewTotal, feedbackBaru, feedbackBaruTotal, traffic } = data;

  const pendingTotal = (cards.pending_reviews || 0) + (cards.pending_masjid || 0);

  const today = new Date().toISOString().split('T')[0];
  const chartData = (traffic.daily || []).map((d) => ({
    date: formatChartDate(d.date),
    fullDate: d.date,
    count: d.count,
    isToday: d.date === today,
  }));

  return (
    <div>
      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCardNew
          config={CARD_CONFIG[0]}
          value={cards.total_masjid}
          subtitle={cards.masjid_this_week > 0 ? `+${cards.masjid_this_week} minggu ini` : null}
          onClick={() => navigate(CARD_CONFIG[0].link)}
        />
        <StatCardNew
          config={CARD_CONFIG[1]}
          value={cards.total_reviews}
          onClick={() => navigate(CARD_CONFIG[1].link)}
        />
        <StatCardNew
          config={CARD_CONFIG[2]}
          value={pendingTotal}
          subtitle={pendingTotal > 0 ? 'butuh aksi' : null}
          onClick={() => navigate(CARD_CONFIG[2].link)}
        />
        <StatCardNew
          config={CARD_CONFIG[3]}
          value={cards.total_users}
          onClick={() => navigate(CARD_CONFIG[3].link)}
        />
        <StatCardNew
          config={CARD_CONFIG[4]}
          value={cards.total_feedback}
          subtitle={cards.feedback_baru > 0 ? `${cards.feedback_baru} todo` : null}
          onClick={() => navigate(CARD_CONFIG[4].link)}
        />
      </div>

      {/* Row 2: Perlu Ditindak */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Masjid Pending */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-heading text-sm font-semibold text-text mb-2">Masjid ({pendingMasjidTotal})</h3>
            {pendingMasjids.length === 0 ? (
              <p className="text-text-3 text-sm py-2">Tidak ada lagi</p>
            ) : (
              <div className="space-y-0.5">
                {pendingMasjids.map((m) => (
                  <ActionRow key={m.id} label={m.name} onClick={() => navigate(`/masjids/${m.id}/edit`)} />
                ))}
              </div>
            )}
            {pendingMasjidTotal > 5 && (
              <button type="button" onClick={() => navigate('/masjids?status=pending')} className="text-xs text-green font-medium mt-2 hover:underline">
                + {pendingMasjidTotal - 5} lainnya
              </button>
            )}
          </CardContent>
        </Card>

        {/* Review Pending */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-heading text-sm font-semibold text-text mb-2">Review ({pendingReviewTotal})</h3>
            {pendingReviews.length === 0 ? (
              <p className="text-text-3 text-sm py-2">Tidak ada lagi</p>
            ) : (
              <div className="space-y-0.5">
                {pendingReviews.map((r) => (
                  <ActionRow key={r.id} label={`Review oleh ${r.reviewer_name || 'Anonim'}`} onClick={() => navigate('/reviews?status=pending')} />
                ))}
              </div>
            )}
            {pendingReviewTotal > 5 && (
              <button type="button" onClick={() => navigate('/reviews?status=pending')} className="text-xs text-green font-medium mt-2 hover:underline">
                + {pendingReviewTotal - 5} lainnya
              </button>
            )}
          </CardContent>
        </Card>

        {/* Bug & Feedback */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-heading text-sm font-semibold text-text mb-2">Bug & Feedback ({feedbackBaruTotal})</h3>
            {feedbackBaru.length === 0 ? (
              <p className="text-text-3 text-sm py-2">Tidak ada lagi</p>
            ) : (
              <div className="space-y-0.5">
                {feedbackBaru.map((f) => (
                  <ActionRow key={f.id} label={truncateMsg(f.message)} onClick={() => navigate('/feedback')} />
                ))}
              </div>
            )}
            {feedbackBaruTotal > 5 && (
              <button type="button" onClick={() => navigate('/feedback')} className="text-xs text-green font-medium mt-2 hover:underline">
                + {feedbackBaruTotal - 5} lainnya
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Ringkasan Trafik */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-sm font-semibold text-text flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-text-3" />
              Ringkasan Trafik
            </h3>
          </div>

          {/* Stats row */}
          <div className="flex gap-8 mb-4">
            <div>
              <div className="text-xs text-text-3">Hari ini</div>
              <div className="font-heading text-lg font-bold text-text">{traffic.today} <span className="text-xs font-normal text-text-3">views</span></div>
            </div>
            <div>
              <div className="text-xs text-text-3">Kemarin</div>
              <div className="font-heading text-lg font-bold text-text">{traffic.yesterday} <span className="text-xs font-normal text-text-3">views</span></div>
            </div>
            <div>
              <div className="text-xs text-text-3">Total (7 hari)</div>
              <div className="font-heading text-lg font-bold text-text">{traffic.total7d} <span className="text-xs font-normal text-text-3">views</span></div>
            </div>
          </div>

          {/* Chart */}
          <div className="text-xs text-text-3 mb-2">Page Views (7 hari terakhir)</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#888' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#aaa' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.isToday ? '#16a34a' : '#60a5fa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-text-3">* hari ini (masih berjalan)</span>
            <button type="button" onClick={() => navigate('/analytics')} className="text-xs text-green font-medium hover:underline flex items-center gap-1">
              Buka Analitik <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
