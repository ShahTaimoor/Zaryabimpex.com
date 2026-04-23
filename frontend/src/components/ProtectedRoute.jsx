import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../config/rbacConfig';

export const ProtectedRoute = ({ children, permission }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
