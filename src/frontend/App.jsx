import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MasjidListPage from './pages/MasjidListPage';
import MasjidFormPage from './pages/MasjidFormPage';
import ReviewListPage from './pages/ReviewListPage';
import ReviewFormPage from './pages/ReviewFormPage';
import UserListPage from './pages/UserListPage';
import UserDetailPage from './pages/UserDetailPage';
import AdminListPage from './pages/AdminListPage';
import SettingsPage from './pages/SettingsPage';
import ChangelogPage from './pages/ChangelogPage';
import FeedbackPage from './pages/FeedbackPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="masjids" element={<MasjidListPage />} />
                <Route path="masjids/new" element={<MasjidFormPage />} />
                <Route path="masjids/:id/edit" element={<MasjidFormPage />} />
                <Route path="reviews" element={<ReviewListPage />} />
                <Route path="reviews/:id/edit" element={<ReviewFormPage />} />
                <Route path="users" element={<UserListPage />} />
                <Route path="users/:id" element={<UserDetailPage />} />
                <Route path="admins" element={<AdminListPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="fasilitas" element={<SettingsPage />} />
                <Route path="feedback" element={<FeedbackPage />} />
                <Route path="changelog" element={<ChangelogPage />} />
              </Route>
            </Routes>
            <Toaster position="bottom-right" richColors />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
