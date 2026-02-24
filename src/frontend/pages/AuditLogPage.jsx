import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Eye, Calendar, Filter } from 'lucide-react';
import { getAuditLogs, getAuditLog, getAdmins } from '../api';
import { formatRelativeTime, formatDate } from '../utils/format';
import { cn } from '../lib/utils';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

const ACTION_LABELS = {
  review_approve: 'Setujui Review',
  review_reject: 'Tolak Review',
  review_edit: 'Edit Review',
  review_delete: 'Hapus Review',
  review_create: 'Buat Review',
  review_bulk_approve: 'Bulk Setujui Review',
  review_bulk_reject: 'Bulk Tolak Review',
  masjid_create: 'Buat Masjid',
  masjid_edit: 'Edit Masjid',
  masjid_delete: 'Hapus Masjid',
  masjid_approve: 'Setujui Masjid',
  masjid_reject: 'Tolak Masjid',
  masjid_bulk_approve: 'Bulk Setujui Masjid',
  masjid_bulk_reject: 'Bulk Tolak Masjid',
  user_promote: 'Promosi User',
  user_demote: 'Demosi User',
  user_force_logout: 'Paksa Logout User',
  user_delete: 'Hapus User',
  user_edit: 'Edit User',
  user_create: 'Buat User',
  suggestion_approve: 'Setujui Saran Fasilitas',
  suggestion_reject: 'Tolak Saran Fasilitas',
  suggestion_bulk_approve: 'Bulk Setujui Saran',
  suggestion_bulk_reject: 'Bulk Tolak Saran',
  feedback_status_change: 'Ubah Status Feedback',
  feedback_edit: 'Edit Feedback',
  feedback_create: 'Buat Feedback',
  feedback_delete: 'Hapus Feedback',
};

const RESOURCE_LABELS = {
  review: 'Review',
  masjid: 'Masjid',
  user: 'User',
  facility_suggestion: 'Saran Fasilitas',
  feedback: 'Feedback',
};

const ACTION_OPTIONS = [
  { value: '', label: 'Semua Aksi' },
  { group: 'Review', items: [
    { value: 'review_create', label: 'Buat' },
    { value: 'review_approve', label: 'Setujui' },
    { value: 'review_reject', label: 'Tolak' },
    { value: 'review_edit', label: 'Edit' },
    { value: 'review_delete', label: 'Hapus' },
    { value: 'review_bulk_approve', label: 'Bulk Setujui' },
    { value: 'review_bulk_reject', label: 'Bulk Tolak' },
  ]},
  { group: 'Masjid', items: [
    { value: 'masjid_create', label: 'Buat' },
    { value: 'masjid_approve', label: 'Setujui' },
    { value: 'masjid_reject', label: 'Tolak' },
    { value: 'masjid_edit', label: 'Edit' },
    { value: 'masjid_delete', label: 'Hapus' },
    { value: 'masjid_bulk_approve', label: 'Bulk Setujui' },
    { value: 'masjid_bulk_reject', label: 'Bulk Tolak' },
  ]},
  { group: 'User', items: [
    { value: 'user_create', label: 'Buat' },
    { value: 'user_edit', label: 'Edit' },
    { value: 'user_promote', label: 'Promosi' },
    { value: 'user_demote', label: 'Demosi' },
    { value: 'user_force_logout', label: 'Paksa Logout' },
    { value: 'user_delete', label: 'Hapus' },
  ]},
  { group: 'Saran Fasilitas', items: [
    { value: 'suggestion_approve', label: 'Setujui' },
    { value: 'suggestion_reject', label: 'Tolak' },
    { value: 'suggestion_bulk_approve', label: 'Bulk Setujui' },
    { value: 'suggestion_bulk_reject', label: 'Bulk Tolak' },
  ]},
  { group: 'Feedback', items: [
    { value: 'feedback_create', label: 'Buat' },
    { value: 'feedback_edit', label: 'Edit' },
    { value: 'feedback_status_change', label: 'Ubah Status' },
    { value: 'feedback_delete', label: 'Hapus' },
  ]},
];

function getActionColor(action) {
  if (!action) return 'bg-gray-100 text-gray-600 border-gray-200';
  if (action.includes('approve') || action.includes('create') || action.includes('promote'))
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (action.includes('delete') || action.includes('reject') || action.includes('demote'))
    return 'bg-rose-50 text-rose-700 border-rose-200';
  if (action.includes('edit') || action.includes('status_change'))
    return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function ActionBadge({ action }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border', getActionColor(action))}>
      {ACTION_LABELS[action] || action}
    </span>
  );
}

function toLocalDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function JsonBlock({ data, label, comparisonData }) {
  if (!data) return <div className="text-text-3 text-sm italic">Tidak ada data</div>;

  const entries = Object.entries(data);
  return (
    <div className="rounded-md border border-border bg-bg/50 overflow-hidden">
      <div className="px-3 py-1.5 bg-bg border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-3">{label}</span>
      </div>
      <div className="p-3 space-y-1">
        {entries.map(([key, value]) => {
          const isChanged = comparisonData && comparisonData[key] !== undefined && JSON.stringify(comparisonData[key]) !== JSON.stringify(value);
          return (
            <div key={key} className={cn('flex gap-2 text-sm font-mono px-1.5 py-0.5 rounded', isChanged && 'bg-amber-50')}>
              <span className="text-blue-600 shrink-0">{key}:</span>
              <span className="text-text-1 break-all">
                {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? 'null')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditDetailDialog({ open, onOpenChange, logId }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !logId) { setLog(null); return; }
    setLoading(true);
    getAuditLog(logId).then(setLog).catch(() => setLog(null)).finally(() => setLoading(false));
  }, [open, logId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Audit Log</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-4 bg-bg rounded animate-pulse" />)}
          </div>
        ) : log ? (
          <div className="space-y-4">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-3 text-xs uppercase tracking-wider">Admin</span>
                <p className="font-medium mt-0.5">{log.admin_name}</p>
              </div>
              <div>
                <span className="text-text-3 text-xs uppercase tracking-wider">Waktu</span>
                <p className="font-medium mt-0.5">{formatDate(log.created_at)}</p>
                <p className="text-text-3 text-xs">{new Date(log.created_at).toLocaleTimeString('id-ID')}</p>
              </div>
              <div>
                <span className="text-text-3 text-xs uppercase tracking-wider">Aksi</span>
                <div className="mt-1"><ActionBadge action={log.action} /></div>
              </div>
              <div>
                <span className="text-text-3 text-xs uppercase tracking-wider">Resource</span>
                <p className="font-medium mt-0.5">{RESOURCE_LABELS[log.resource_type] || log.resource_type}</p>
                {log.resource_name && <p className="text-text-3 text-xs">{log.resource_name}</p>}
                {log.resource_id && <p className="text-text-3 text-xs font-mono">{log.resource_id.slice(0, 12)}...</p>}
              </div>
            </div>

            {/* Before / After */}
            <div className="space-y-3">
              <JsonBlock data={log.before_data} label="Sebelum" comparisonData={log.after_data} />
              <JsonBlock data={log.after_data} label="Sesudah" comparisonData={log.before_data} />
            </div>
          </div>
        ) : (
          <p className="text-text-3 text-sm py-4 text-center">Log tidak ditemukan</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [admins, setAdmins] = useState([]);

  const today = toLocalDate(new Date());
  const thirtyDaysAgo = toLocalDate(new Date(Date.now() - 30 * 86400000));
  const sevenDaysAgo = toLocalDate(new Date(Date.now() - 7 * 86400000));

  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    admin_id: '',
    from: thirtyDaysAgo,
    to: today,
  });
  const [datePreset, setDatePreset] = useState('30d');

  const [selectedLogId, setSelectedLogId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const perPage = 50;

  // Fetch admins for dropdown
  useEffect(() => {
    getAdmins().then((data) => setAdmins(Array.isArray(data) ? data : data.admins || [])).catch(() => {});
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ ...filters, page: String(page), per_page: String(perPage) });
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'today') {
      setFilters((prev) => ({ ...prev, from: today, to: today }));
    } else if (preset === '7d') {
      setFilters((prev) => ({ ...prev, from: sevenDaysAgo, to: today }));
    } else if (preset === '30d') {
      setFilters((prev) => ({ ...prev, from: thirtyDaysAgo, to: today }));
    }
    setPage(1);
  };

  const openDetail = (id) => {
    setSelectedLogId(id);
    setDetailOpen(true);
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Waktu',
      render: (row) => (
        <span className="text-sm text-text-2 whitespace-nowrap" title={formatDate(row.created_at)}>
          {formatRelativeTime(row.created_at)}
        </span>
      ),
    },
    {
      key: 'admin_name',
      label: 'Admin',
      render: (row) => <span className="text-sm font-medium">{row.admin_name}</span>,
    },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => <ActionBadge action={row.action} />,
    },
    {
      key: 'resource',
      label: 'Resource',
      render: (row) => (
        <div className="text-sm">
          <span className="text-text-3">{RESOURCE_LABELS[row.resource_type] || row.resource_type}</span>
          {row.resource_name && <span className="ml-1.5 font-medium">{row.resource_name}</span>}
        </div>
      ),
    },
    {
      key: 'detail',
      label: '',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => openDetail(row.id)} className="text-text-3 hover:text-green">
          <Eye className="h-3.5 w-3.5 mr-1" />
          Lihat
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-heading font-bold text-text-1">Audit Log</h1>
        <p className="text-sm text-text-3 mt-1">Riwayat semua aksi admin dalam sistem</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-text-3" />
          <span className="text-sm font-semibold text-text-2">Filter</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action filter */}
          <Select value={filters.action} onChange={(e) => handleFilterChange('action', e.target.value)}>
            {ACTION_OPTIONS.map((opt) =>
              opt.group ? (
                <optgroup key={opt.group} label={opt.group}>
                  {opt.items.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </optgroup>
              ) : (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              )
            )}
          </Select>

          {/* Resource type filter */}
          <Select value={filters.resource_type} onChange={(e) => handleFilterChange('resource_type', e.target.value)}>
            <option value="">Semua Resource</option>
            {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>

          {/* Admin filter */}
          <Select value={filters.admin_id} onChange={(e) => handleFilterChange('admin_id', e.target.value)}>
            <option value="">Semua Admin</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>

          {/* Date range presets */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-text-3 shrink-0" />
            {[
              { key: 'today', label: 'Hari Ini' },
              { key: '7d', label: '7 Hari' },
              { key: '30d', label: '30 Hari' },
              { key: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  if (p.key !== 'custom') handleDatePreset(p.key);
                  else setDatePreset('custom');
                }}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded transition-colors',
                  datePreset === p.key
                    ? 'bg-green text-white'
                    : 'bg-bg text-text-3 hover:text-text-2 hover:bg-border-2'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date inputs */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => { setFilters((prev) => ({ ...prev, from: e.target.value })); setPage(1); }}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green"
            />
            <span className="text-text-3 text-sm">s/d</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => { setFilters((prev) => ({ ...prev, to: e.target.value })); setPage(1); }}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-border">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-bg rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={logs}
              emptyIcon={ClipboardList}
              emptyText="Belum ada audit log"
            />
            <div className="px-4 pb-4">
              <Pagination
                currentPage={page}
                totalItems={total}
                pageSize={perPage}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <AuditDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        logId={selectedLogId}
      />
    </div>
  );
}
