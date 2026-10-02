import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { OWNER_APP_ROLES } from '@feather/shared';
import { AuthProvider, RouteProvider, ThemeProvider, ToastProvider } from '@feather/ui';
import App from '@/App.jsx';
import '@/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (count, err) => err?.status >= 500 && count < 2, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider storageKey="feather.owner.theme" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <AuthProvider storageKey="feather.owner.session" allowedRoles={OWNER_APP_ROLES}>
          <ToastProvider>
            <BrowserRouter>
              <RouteProvider>
                <App />
              </RouteProvider>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
