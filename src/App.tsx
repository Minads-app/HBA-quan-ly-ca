import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import UserManagement from './pages/UserManagement';
import StaffRegistration from './pages/StaffRegistration';
import StaffDashboard from './pages/StaffDashboard';
import Settings from './pages/Settings';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Root Redirect Component
const RootRedirect = () => {
  const { profile, loading } = useAuth();
  
  if (loading) return null;
  
  if (profile?.role === 'manager' || profile?.role === 'admin') {
    return <Navigate to="/manager" replace />;
  }
  return <Navigate to="/staff" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route 
        path="/manager/*" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <ManagerDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/manager/users" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <UserManagement />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/manager/settings" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <Settings />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/manager/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['manager', 'admin']}>
            <StaffDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/staff/*" 
        element={
          <ProtectedRoute allowedRoles={['cashier', 'ticket_checker']}>
            <StaffRegistration />
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <RootRedirect />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
