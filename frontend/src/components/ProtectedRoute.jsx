import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../config/rbacConfig';

export const ProtectedRoute = ({ children, permission, permissionAny = [] }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasAnyPermission = permissionAny.length === 0 || permissionAny.some((permissionKey) => hasPermission(user, permissionKey));

  if ((permission && !hasPermission(user, permission)) || !hasAnyPermission) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
