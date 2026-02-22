import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats } from '../api';
import StatCard from '../components/StatCard';
import { SkeletonDashboard } from '../components/Skeleton';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  return (
    <div>
      <h1 className="font-heading text-[22px] font-bold text-text mb-5">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Masjid" value={stats?.total_masjid} onClick={() => navigate('/masjids?status=approved')} />
        <StatCard label="Total Reviews" value={stats?.total_reviews} onClick={() => navigate('/reviews?status=approved')} />
        <StatCard label="Review Pending" value={stats?.pending_reviews} showBadge onClick={() => navigate('/reviews?status=pending')} />
        <StatCard label="Masjid Pending" value={stats?.pending_masjid} showBadge onClick={() => navigate('/masjids?status=pending')} />
        <StatCard label="Total Users" value={stats?.total_users} onClick={() => navigate('/users')} />
        <StatCard label="Total Admin" value={stats?.total_admins} onClick={() => navigate('/admins')} />
      </div>
    </div>
  );
}
