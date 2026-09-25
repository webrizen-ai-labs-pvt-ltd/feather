import { Navigate, Route, Routes } from 'react-router';
import { OWNER_APP_ROLES } from '@feather/shared';
import { RequireRole } from '@feather/ui';
import Layout from '@/components/Layout.jsx';
import AlertsPage from '@/pages/AlertsPage.jsx';
import AuditPage from '@/pages/AuditPage.jsx';
import ConsignmentDetailPage from '@/pages/ConsignmentDetailPage.jsx';
import ConsignmentsPage from '@/pages/ConsignmentsPage.jsx';
import CustomerDetailPage from '@/pages/CustomerDetailPage.jsx';
import CustomersPage from '@/pages/CustomersPage.jsx';
import DashboardPage from '@/pages/DashboardPage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import MastersPage from '@/pages/MastersPage.jsx';
import SettingsPage from '@/pages/SettingsPage.jsx';
import StockPage from '@/pages/StockPage.jsx';
import TransportersPage from '@/pages/TransportersPage.jsx';
import TripDetailPage from '@/pages/TripDetailPage.jsx';
import TripsPage from '@/pages/TripsPage.jsx';
import UsersPage from '@/pages/UsersPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireRole roles={OWNER_APP_ROLES} fallback="/login">
            <Layout />
          </RequireRole>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="consignments" element={<ConsignmentsPage />} />
        <Route path="consignments/:id" element={<ConsignmentDetailPage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="trips/:id" element={<TripDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="transporters" element={<TransportersPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="masters" element={<MastersPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
