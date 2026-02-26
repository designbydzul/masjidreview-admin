async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    credentials: 'same-origin',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth
export const authMe = () => apiFetch('/auth/me');
export const requestOTP = (wa_number) => apiFetch('/auth/otp/request', { method: 'POST', body: JSON.stringify({ wa_number }) });
export const verifyOTP = (wa_number, code) => apiFetch('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ wa_number, code }) });
export const logout = () => apiFetch('/auth/logout', { method: 'POST' });
export const googleSignIn = (credential) => apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });

// Stats
export const getStats = () => apiFetch('/api/stats');

// Masjids
export const getMasjids = (status) => apiFetch('/api/masjids' + (status ? '?status=' + status : ''));
export const createMasjid = (data) => apiFetch('/api/masjids', { method: 'POST', body: JSON.stringify(data) });
export const getMasjid = (id) => apiFetch('/api/masjids/' + id);
export const updateMasjid = (id, data) => apiFetch('/api/masjids/' + id, { method: 'PUT', body: JSON.stringify(data) });
export const deleteMasjid = (id) => apiFetch('/api/masjids/' + id, { method: 'DELETE' });
export const setMasjidStatus = (id, status) => apiFetch('/api/masjids/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
export const bulkMasjidStatus = (ids, status) => apiFetch('/api/masjids/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status }) });
export const getSimilarMasjids = (id) => apiFetch('/api/masjids/' + id + '/similar');

// Upload
export const uploadFile = (file, prefix) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('prefix', prefix);
  return apiFetch('/api/upload', { method: 'POST', body: formData });
};

export const searchPlaces = (name, city) => apiFetch('/api/places/search', { method: 'POST', body: JSON.stringify({ name, city }) });

// Reviews
export const createReview = (data) => apiFetch('/api/reviews', { method: 'POST', body: JSON.stringify(data) });
export const getReviews = (status) => apiFetch('/api/reviews' + (status ? '?status=' + status : ''));
export const getReview = (id) => apiFetch('/api/reviews/' + id);
export const updateReview = (id, data) => apiFetch('/api/reviews/' + id, { method: 'PUT', body: JSON.stringify(data) });
export const deleteReview = (id) => apiFetch('/api/reviews/' + id, { method: 'DELETE' });
export const setReviewStatus = (id, status) => apiFetch('/api/reviews/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
export const bulkReviewStatus = (ids, status) => apiFetch('/api/reviews/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status }) });

// Users
export const createUser = (data) => apiFetch('/api/users', { method: 'POST', body: JSON.stringify(data) });
export const getUsers = () => apiFetch('/api/users');
export const searchUsers = (q) => apiFetch('/api/users/search?q=' + encodeURIComponent(q));
export const getUser = (id) => apiFetch('/api/users/' + id);
export const updateUser = (id, data) => apiFetch('/api/users/' + id, { method: 'PUT', body: JSON.stringify(data) });
export const forceLogout = (id) => apiFetch('/api/users/' + id + '/force-logout', { method: 'POST' });
export const deleteUser = (id) => apiFetch('/api/users/' + id, { method: 'DELETE' });
export const changeUserRole = (id, role) => apiFetch('/api/users/' + id + '/role', { method: 'PATCH', body: JSON.stringify({ role }) });

// Admins
export const getAdmins = () => apiFetch('/api/admins');

// Facility Groups
export const getFacilityGroups = () => apiFetch('/api/facility-groups');
export const createFacilityGroup = (data) => apiFetch('/api/facility-groups', { method: 'POST', body: JSON.stringify(data) });
export const updateFacilityGroup = (grp, data) => apiFetch('/api/facility-groups/' + encodeURIComponent(grp), { method: 'PATCH', body: JSON.stringify(data) });
export const deleteFacilityGroup = (grp) => apiFetch('/api/facility-groups/' + encodeURIComponent(grp), { method: 'DELETE' });

// Facilities
export const getFacilities = () => apiFetch('/api/facilities');
export const createFacility = (data) => apiFetch('/api/facilities', { method: 'POST', body: JSON.stringify(data) });
export const updateFacility = (id, data) => apiFetch('/api/facilities/' + id, { method: 'PUT', body: JSON.stringify(data) });
export const deleteFacility = (id) => apiFetch('/api/facilities/' + id, { method: 'DELETE' });
export const toggleFacility = (id) => apiFetch('/api/facilities/' + id + '/toggle', { method: 'PATCH' });

// Facility Corrections & Notes
export const handleFacilityCorrections = (masjidId, action) =>
  apiFetch('/api/masjids/' + masjidId + '/facility-corrections', { method: 'PATCH', body: JSON.stringify({ action }) });
export const getFacilityNotes = (masjidId) =>
  apiFetch('/api/masjids/' + masjidId + '/facility-notes');

// Changelog
export const getChangelogs = (status) => apiFetch('/api/changelog' + (status ? '?status=' + status : ''));
export const createChangelog = (data) => apiFetch('/api/changelog', { method: 'POST', body: JSON.stringify(data) });
export const updateChangelog = (id, data) => apiFetch('/api/changelog/' + id, { method: 'PUT', body: JSON.stringify(data) });
export const deleteChangelog = (id) => apiFetch('/api/changelog/' + id, { method: 'DELETE' });
export const toggleChangelogStatus = (id, status) => apiFetch('/api/changelog/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });

// Feedback
export const getFeedback = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.type) qs.set('type', params.type);
  const q = qs.toString();
  return apiFetch('/api/feedback' + (q ? '?' + q : ''));
};
export const createFeedback = (data) => apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify(data) });
export const updateFeedback = (id, data) => apiFetch('/api/feedback/' + id, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteFeedback = (id) => apiFetch('/api/feedback/' + id, { method: 'DELETE' });

// Audit Log
export const getAuditLogs = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
  const q = qs.toString();
  return apiFetch('/api/audit-logs' + (q ? '?' + q : ''));
};
export const getAuditLog = (id) => apiFetch('/api/audit-logs/' + id);

// Analytics
const analyticsQs = (from, to) => '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
export const getAnalyticsOverview = (from, to) => apiFetch('/api/analytics/overview' + analyticsQs(from, to));
export const getAnalyticsCtaSummary = (from, to) => apiFetch('/api/analytics/cta-summary' + analyticsQs(from, to));
export const getAnalyticsFilterUsage = (from, to) => apiFetch('/api/analytics/filter-usage' + analyticsQs(from, to));
export const getAnalyticsConversions = (from, to) => apiFetch('/api/analytics/conversions' + analyticsQs(from, to));
export const getAnalyticsPeakHours = (from, to) => apiFetch('/api/analytics/peak-hours' + analyticsQs(from, to));
export const getAnalyticsCityTraffic = (from, to) => apiFetch('/api/analytics/city-traffic' + analyticsQs(from, to));
export const getAnalyticsTopPages = (from, to) => apiFetch('/api/analytics/top-pages' + analyticsQs(from, to));
export const getAnalyticsExportUrl = (from, to, eventType) => {
  let url = '/api/analytics/export' + analyticsQs(from, to);
  if (eventType) url += '&event_type=' + encodeURIComponent(eventType);
  return url;
};
