import { useState, useEffect } from 'react';
import { getStats } from '../api';
import StatCard from '../components/StatCard';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-text-2 text-sm py-8 text-center">Memuat statistik...</p>;
  }

  return (
    <div>
      <h1 className="font-heading text-[22px] font-bold text-text mb-5">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Masjid" value={stats?.total_masjid} />
        <StatCard label="Total Reviews" value={stats?.total_reviews} />
        <StatCard label="Review Pending" value={stats?.pending_reviews} showBadge />
        <StatCard label="Masjid Pending" value={stats?.pending_masjid} showBadge />
        <StatCard label="Total Users" value={stats?.total_users} />
        <StatCard label="Total Admin" value={stats?.total_admins} />
      </div>
    </div>
  );
}
