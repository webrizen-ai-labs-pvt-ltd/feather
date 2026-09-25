import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { OPS_APP_ROLES } from '@feather/shared';
import { AuthProvider, ToastProvider } from '@feather/ui';
import App from '@/App.jsx';
import '@/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      // Keep showing the last list when the signal drops.
      networkMode: 'offlineFirst',
      retry: (count, err) => !err?.isNetwork && err?.status >= 500 && count < 2,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider storageKey="feather.ops.session" allowedRoles={OPS_APP_ROLES}>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
