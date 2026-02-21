import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { getUsers } from '../api';
import { useToast } from '../contexts/ToastContext';
import DataTable from '../components/DataTable';
import { Button } from '../components/ui/button';
import { formatWA, formatDate } from '../utils/format';

export default function UserListPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: 'name', label: 'Nama', render: (row) => <span className="font-medium">{row.name || '-'}</span> },
    { key: 'wa_number', label: 'WhatsApp', render: (row) => <span className="text-text-2">{formatWA(row.wa_number)}</span> },
    { key: 'city', label: 'Kota', render: (row) => row.city || '-' },
    { key: 'age_range', label: 'Usia', render: (row) => row.age_range || '-' },
    { key: 'review_count', label: 'Reviews', render: (row) => <span className="font-heading font-medium">{row.review_count || 0}</span> },
    { key: 'created_at', label: 'Bergabung', render: (row) => <span className="text-text-3 text-xs">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => navigate(`/users/${row.id}`)}>
          Detail
        </Button>
      ),
    },
  ];

  if (loading) return <p className="text-text-2 text-sm py-8 text-center">Memuat data user...</p>;

  return (
    <div>
      <h1 className="font-heading text-[22px] font-bold text-text mb-5">Kelola Users</h1>
      <DataTable columns={columns} data={users} emptyIcon={Users} emptyText="Tidak ada user" />
    </div>
  );
}
