import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar    from './components/Sidebar';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Students   from './pages/Students';
import NewSession from './pages/NewSession';
import Processing from './pages/Processing';
import Results    from './pages/Results';

const ProtectedRoute = ({ children }) => {
  const { teacher, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return teacher ? children : <Navigate to="/login" replace />;
};

const AppLayout = ({ children }) => (
  <div className="flex min-h-screen">
    <Sidebar />
    <main className="flex-1 ml-64 min-h-screen bg-mesh dot-grid overflow-y-auto">
      {children}
    </main>
  </div>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
    <Route path="/students" element={<ProtectedRoute><AppLayout><Students /></AppLayout></ProtectedRoute>} />
    <Route path="/sessions/new" element={<ProtectedRoute><AppLayout><NewSession /></AppLayout></ProtectedRoute>} />
    <Route path="/sessions/:id/processing" element={<ProtectedRoute><AppLayout><Processing /></AppLayout></ProtectedRoute>} />
    <Route path="/sessions/:id/results" element={<ProtectedRoute><AppLayout><Results /></AppLayout></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
