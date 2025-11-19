import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Dashboard from './pages/Dashboard';
import InstanceDetail from './pages/InstanceDetail';
import Alerts from './pages/Alerts';
import AlertRules from './pages/AlertRules';
import { useWebSocket } from './hooks/useWebSocket';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function AppContent() {
  // Initialize WebSocket connection for real-time updates
  useWebSocket();

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/instances/:name" element={<InstanceDetail />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/alert-rules" element={<AlertRules />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
