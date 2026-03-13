import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from '@/components/ui/sonner';
import { Provider } from 'react-redux';
import './index.css';
import './components/print/printStyles.css';
import App from './App';
import { store } from './store/store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: import.meta.env.DEV ? 0 : 5 * 60 * 1000, // No cache in dev, 5 minutes in production
      cacheTime: import.meta.env.DEV ? 0 : 5 * 60 * 1000, // No cache in dev
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <App />
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              classNames: {
                success: 'border-green-500/50',
                error: 'border-red-500/50',
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
