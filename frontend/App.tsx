import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import ClientSigning from './pages/ClientSigning';
import Login from './pages/Login';
import { User, UserRole } from './types';
import { clearSession } from './services/storage';
import { setToken, getToken, AuthAPI } from './services/api';

// Protected Route Component
const ProtectedRoute = ({ 
  children, 
  allowedRoles, 
  user 
}: { 
  children?: React.ReactNode; 
  allowedRoles: UserRole[]; 
  user: User | null 
}) => {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect based on role if trying to access unauthorized area
    const redirectTarget = user.role === UserRole.ADMIN ? '/admin' : '/agent';
    return <Navigate to={redirectTarget} replace />; 
  }

  return <>{children}</>;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token = getToken();
        if (token) {
          const resp = await AuthAPI.me();
          if (resp?.user) setCurrentUser(resp.user as User);
        }
      } catch (_) {
        setToken('');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    setToken('');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to={currentUser ? (currentUser.role === UserRole.ADMIN ? "/admin" : "/agent") : "/login"} replace />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]} user={currentUser}>
              <AdminDashboard user={currentUser!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/agent"
          element={
            <ProtectedRoute allowedRoles={[UserRole.AGENT]} user={currentUser}>
              <AgentDashboard user={currentUser!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route path="/login" element={<Login onLogin={(user) => setCurrentUser(user)} />} />

        {/* Client Signing Route - Does not strictly require prior login, manages its own auth flow */}
        <Route path="/sign/:token" element={<ClientSigning />} />

      </Routes>
    </HashRouter>
  );
}