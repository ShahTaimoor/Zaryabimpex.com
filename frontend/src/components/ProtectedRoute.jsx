import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../config/rbacConfig';
import { LoadingPage } from './LoadingSpinner';

export const ProtectedRoute = ({ children, permission, permissionAny = [], role }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <LoadingPage useSpinningText={false} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && user?.role !== role && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const hasAnyPermission = permissionAny.length === 0 || permissionAny.some((permissionKey) => hasPermission(user, permissionKey));

  if ((permission && !hasPermission(user, permission)) || !hasAnyPermission) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
