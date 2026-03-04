import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Eye, Search } from 'lucide-react';
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
  masjid_bulk_delete: 'Bulk Hapus Masjid',
  user_promote: 'Promosi User',
  user_demote: 'Demosi User',
  user_force_logout: 'Paksa Logout',
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
  feedback_group_create: 'Buat Grup Feedback',
  feedback_group_delete: 'Hapus Grup Feedback',
  feedback_group_assign: 'Assign Grup Feedback',
  facility_create: 'Buat Fasilitas',
  facility_edit: 'Edit Fasilitas',
  facility_delete: 'Hapus Fasilitas',
  facility_group_create: 'Buat Grup Fasilitas',
  facility_group_edit: 'Edit Grup Fasilitas',
  facility_group_delete: 'Hapus Grup Fasilitas',
  facility_corrections_accept: 'Terima Koreksi',
  facility_corrections_reject: 'Tolak Koreksi',
  changelog_create: 'Buat Changelog',
  changelog_edit: 'Edit Changelog',
  changelog_delete: 'Hapus Changelog',
  changelog_publish: 'Publish Changelog',
  changelog_unpublish: 'Unpublish Changelog',
  backlog_create: 'Buat Backlog',
  backlog_edit: 'Edit Backlog',
  backlog_delete: 'Hapus Backlog',
  backlog_status_change: 'Ubah Status Backlog',
};

const RESOURCE_LABELS = {
  review: 'Review',
  masjid: 'Masjid',
  user: 'User',
  facility_suggestion: 'Saran Fasilitas',
  facility: 'Fasilitas',
  facility_group: 'Grup Fasilitas',
  feedback: 'Feedback',
  feedback_group: 'Grup Feedback',
  changelog: 'Changelog',
  backlog: 'Backlog',
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
    { value: 'masjid_bulk_delete', label: 'Bulk Hapus' },
  ]},
  { group: 'User', items: [
    { value: 'user_create', label: 'Buat' },
    { value: 'user_edit', label: 'Edit' },
    { value: 'user_promote', label: 'Promosi' },
    { value: 'user_demote', label: 'Demosi' },
    { value: 'user_force_logout', label: 'Paksa Logout' },
    { value: 'user_delete', label: 'Hapus' },
  ]},
  { group: 'Fasilitas', items: [
    { value: 'facility_create', label: 'Buat' },
    { value: 'facility_edit', label: 'Edit' },
    { value: 'facility_delete', label: 'Hapus' },
    { value: 'suggestion_approve', label: 'Setujui Saran' },
    { value: 'suggestion_reject', label: 'Tolak Saran' },
    { value: 'suggestion_bulk_approve', label: 'Bulk Setujui Saran' },
    { value: 'suggestion_bulk_reject', label: 'Bulk Tolak Saran' },
  ]},
  { group: 'Feedback', items: [
    { value: 'feedback_create', label: 'Buat' },
    { value: 'feedback_edit', label: 'Edit' },
    { value: 'feedback_status_change', label: 'Ubah Status' },
    { value: 'feedback_delete', label: 'Hapus' },
  ]},
  { group: 'Changelog', items: [
    { value: 'changelog_create', label: 'Buat' },
    { value: 'changelog_edit', label: 'Edit' },
    { value: 'changelog_publish', label: 'Publish' },
    { value: 'changelog_delete', label: 'Hapus' },
  ]},
  { group: 'Backlog', items: [
    { value: 'backlog_create', label: 'Buat' },
    { value: 'backlog_edit', label: 'Edit' },
    { value: 'backlog_status_change', label: 'Ubah Status' },
    { value: 'backlog_delete', label: 'Hapus' },
  ]},
];

function getActionColor(action) {
  if (!action) return 'bg-gray-100 text-gray-600 border-gray-200';
  if (action.includes('approve') || action.includes('create') || action === 'changelog_publish')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (action.includes('delete') || action.includes('reject'))
    return 'bg-rose-50 text-rose-700 border-rose-200';
  if (action.includes('edit') || action.includes('status_change') || action === 'changelog_unpublish')
    return 'bg-blue-50 text-blue-700 border-blue-200';
  if (action.includes('promote') || action.includes('demote') || action === 'user_force_logout')
    return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function ActionBadge({ action }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap', getActionColor(action))}>
      {ACTION_LABELS[action] || action}
    </span>
  );
}

function getResourceColor(type) {
  if (!type) return 'bg-gray-100 text-gray-600 border-gray-200';
  if (type === 'masjid') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (type === 'review') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (type === 'user') return 'bg-gray-100 text-gray-600 border-gray-200';
  if (type === 'facility' || type === 'facility_group' || type === 'facility_suggestion') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (type === 'feedback' || type === 'feedback_group') return 'bg-pink-50 text-pink-700 border-pink-200';
  if (type === 'changelog') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (type === 'backlog') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function ResourceBadge({ type }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap', getResourceColor(type))}>
      {RESOURCE_LABELS[type] || type}
    </span>
  );
}

function toLocalDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Derive a short before → after summary from before_data and after_data
function getChangeSummary(row) {
  let before = row.before_data;
  let after = row.after_data;

  // Parse JSON strings if needed
  if (typeof before === 'string') { try { before = JSON.parse(before); } catch { before = null; } }
  if (typeof after === 'string') { try { after = JSON.parse(after); } catch { after = null; } }

  if (!before && !after) return null;

  // For create actions, show key created value
  if (!before && after) {
    if (after.status) return { label: 'status', value: after.status };
    if (after.role) return { label: 'role', value: after.role };
    if (after.name) return { label: 'dibuat', value: after.name };
    return null;
  }

  // For delete actions
  if (before && !after) {
    if (before.status) return { label: before.status, value: 'dihapus' };
    if (before.name) return { label: before.name, value: 'dihapus' };
    return { label: '', value: 'dihapus' };
  }

  // For updates, find the most relevant changed field
  // Priority: status > role > name > first changed field
  const priority = ['status', 'role', 'name', 'is_active', 'priority', 'category'];
  for (const key of priority) {
    if (before[key] !== undefined && after[key] !== undefined && String(before[key]) !== String(after[key])) {
      return { label: key, before: String(before[key]), after: String(after[key]) };
    }
  }

  // Fallback: first differing key
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of allKeys) {
    if (key === 'ids' || key === 'count') continue;
    const bv = before?.[key];
    const av = after?.[key];
    if (bv !== undefined && av !== undefined && JSON.stringify(bv) !== JSON.stringify(av)) {
      return { label: key, before: String(bv), after: String(av) };
    }
  }

  // Bulk actions
  if (before?.count && after?.status) {
    return { label: before.count + ' item', value: after.status };
  }

  return null;
}

function ChangeSummary({ row }) {
  const summary = getChangeSummary(row);
  if (!summary) return <span className="text-text-3 text-xs">—</span>;

  // Simple value display (create/delete)
  if (summary.value && !summary.before) {
    return (
      <span className="text-xs">
        {summary.label && <span className="text-text-3">{summary.label}: </span>}
        <span className="font-medium text-text-1">{summary.value}</span>
      </span>
    );
  }

  // Before → After display
  if (summary.before && summary.after) {
    return (
      <span className="text-xs">
        {summary.label && <span className="text-text-3">{summary.label}: </span>}
        <span className="text-rose-600 line-through">{summary.before}</span>
        <span className="text-text-3 mx-1">→</span>
        <span className="text-emerald-700 font-medium">{summary.after}</span>
      </span>
    );
  }

  return <span className="text-text-3 text-xs">—</span>;
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
    search: '',
    from: thirtyDaysAgo,
    to: today,
  });
  const [datePreset, setDatePreset] = useState('30d');
  const [searchInput, setSearchInput] = useState('');

  const [selectedLogId, setSelectedLogId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const perPage = 50;

  // Fetch admins for dropdown
  useEffect(() => {
    getAdmins().then((data) => setAdmins(Array.isArray(data) ? data : data.admins || [])).catch(() => {});
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }));
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

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
        <div className="flex items-center gap-1.5 text-sm">
          <ResourceBadge type={row.resource_type} />
          {row.resource_name && <span className="font-medium truncate max-w-[140px]" title={row.resource_name}>{row.resource_name}</span>}
        </div>
      ),
    },
    {
      key: 'change',
      label: 'Perubahan',
      render: (row) => <ChangeSummary row={row} />,
    },
    {
      key: 'detail',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => openDetail(row.id)} className="text-text-3 hover:text-green">
            <Eye className="h-3.5 w-3.5 mr-1" />
            Lihat
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-heading font-bold text-text-1">Audit Log</h1>
        <p className="text-sm text-text-3 mt-1">Riwayat semua aksi admin dalam sistem</p>
      </div>

      {/* Filter bar — single row */}
      <div className="flex items-center gap-2">
        {/* Time dropdown */}
        <Select
          value={datePreset}
          onChange={(e) => {
            const v = e.target.value;
            setDatePreset(v);
            if (v !== 'custom') handleDatePreset(v);
          }}
          className="h-8 text-xs w-40 shrink-0"
        >
          <option value="today">Hari Ini</option>
          <option value="7d">7 Hari</option>
          <option value="30d">30 Hari</option>
          <option value="custom">Custom</option>
        </Select>

        <Select value={filters.action} onChange={(e) => handleFilterChange('action', e.target.value)} className="h-8 text-xs w-40 shrink-0">
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

        <Select value={filters.resource_type} onChange={(e) => handleFilterChange('resource_type', e.target.value)} className="h-8 text-xs w-40 shrink-0">
          <option value="">Semua Resource</option>
          {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        <Select value={filters.admin_id} onChange={(e) => handleFilterChange('admin_id', e.target.value)} className="h-8 text-xs w-40 shrink-0">
          <option value="">Semua Admin</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>

        {/* Search — fills remaining space */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari audit log..."
            className="h-8 pl-8 pr-3 w-full rounded-md border border-border bg-white text-xs focus:outline-none focus:ring-2 focus:ring-green placeholder:text-text-3"
          />
        </div>
      </div>

      {/* Custom date inputs */}
      {datePreset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.from}
            onChange={(e) => { setFilters((prev) => ({ ...prev, from: e.target.value })); setPage(1); }}
            className="h-8 rounded-md border border-border bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-green"
          />
          <span className="text-text-3 text-xs">s/d</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => { setFilters((prev) => ({ ...prev, to: e.target.value })); setPage(1); }}
            className="h-8 rounded-md border border-border bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-green"
          />
        </div>
      )}

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
