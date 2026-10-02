import { Navigate, Route, Routes } from 'react-router';
import { OPS_APP_ROLES, OPS_HOME_BY_ROLE, OPS_ROUTE_ACCESS } from '@feather/shared';
import { RequireRole, useAuth } from '@feather/ui';
import Layout from '@/components/Layout.jsx';
import { OutboxProvider } from '@/lib/outbox.jsx';
import ArrivalsPage from '@/pages/gate/ArrivalsPage.jsx';
import ReceivePage from '@/pages/gate/ReceivePage.jsx';
import StockCountPage from '@/pages/gate/StockCountPage.jsx';
import DispatchBoardPage from '@/pages/dispatch/DispatchBoardPage.jsx';
import NewDispatchPage from '@/pages/dispatch/NewDispatchPage.jsx';
import OrdersPage from '@/pages/dispatch/OrdersPage.jsx';
import LoadingHomePage from '@/pages/loading/LoadingHomePage.jsx';
import NewLoadingPage from '@/pages/loading/NewLoadingPage.jsx';
import HelpPage from '@/pages/HelpPage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import OutboxPage from '@/pages/OutboxPage.jsx';

function Home() {
  const { user } = useAuth();
  return <Navigate to={OPS_HOME_BY_ROLE[user.role] ?? '/login'} replace />;
}

/** Wrap a page so only the roles in OPS_ROUTE_ACCESS[group] can open it. */
const guard = (group, element) => (
  <RequireRole roles={OPS_ROUTE_ACCESS[group]} fallback="/">
    {element}
  </RequireRole>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route
        element={
          <RequireRole roles={OPS_APP_ROLES} fallback="/login">
            <OutboxProvider>
              <Layout />
            </OutboxProvider>
          </RequireRole>
        }
      >
        <Route index element={<Home />} />
        <Route path="loading" element={guard('loading', <LoadingHomePage />)} />
        <Route path="loading/new" element={guard('loading', <NewLoadingPage />)} />
        <Route path="gate" element={guard('gate', <ArrivalsPage />)} />
        <Route path="gate/receive/:id" element={guard('gate', <ReceivePage />)} />
        <Route path="gate/count" element={guard('stockCount', <StockCountPage />)} />
        <Route path="dispatch" element={guard('dispatch', <DispatchBoardPage />)} />
        <Route path="dispatch/orders" element={guard('dispatch', <OrdersPage />)} />
        <Route path="dispatch/new" element={guard('dispatch', <NewDispatchPage />)} />
        <Route path="outbox" element={<OutboxPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
