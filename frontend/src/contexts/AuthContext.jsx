import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  useLoginMutation,
  useCurrentUserQuery,
  useLogoutMutation,
} from '../store/services/authApi';
import { logout as logoutAction, setUser } from '../store/slices/authSlice';

// Compatibility wrapper to keep existing imports; no longer provides context.
export const AuthProvider = ({ children }) => children;

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { user, token, isAuthenticated, status, error } = useAppSelector((s) => s.auth);
  const isLoginPage = location.pathname === '/login';

  const {
    isLoading: currentUserLoading,
    isError: currentUserError,
    error: currentUserErrorData,
    refetch: refetchCurrentUser,
  } = useCurrentUserQuery(undefined, {
    // Skip query if:
    // 1. We already have a user and are authenticated, OR
    // 2. We're on the login page (no need to check auth status there)
    skip: (isAuthenticated && !!user) || isLoginPage,
    // Disable retries completely to prevent infinite loading
    retry: false,
    // Don't refetch on window focus to prevent unnecessary requests
    refetchOnWindowFocus: false,
    // Don't refetch on reconnect to prevent loading state issues
    refetchOnReconnect: false,
    // Don't refetch on mount if we already have data
    refetchOnMountOrArgChange: false,
  });

  const [loginMutation, { isLoading: loginLoading }] = useLoginMutation();
  const [logoutMutation] = useLogoutMutation();

  const login = async (email, password) => {
    try {
      await loginMutation({ email, password }).unwrap();
      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      const message = error?.data?.message || error?.message || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await logoutMutation().unwrap();
    } catch (error) {
      // Continue with logout even if API call fails
    }
    dispatch(logoutAction());
    toast.success('Logged out successfully');
  };

  const updateUser = (userData) => {
    dispatch(setUser(userData));
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!user.permissions) return false;
    return user.permissions.includes(permission);
  };

  // Calculate loading state:
  // - Don't show loading on login page (query is skipped there)
  // - Only show loading during initial auth check or login process
  // - Once we have an error (401), stop showing loading
  const loading = isLoginPage
    ? loginLoading
    : (status === 'loading' || (currentUserLoading && !currentUserError)) || loginLoading;

  return {
    user,
    token,
    isAuthenticated,
    loading,
    error: error || (currentUserError ? currentUserErrorData : null),
    login,
    logout,
    updateUser,
    hasPermission,
    refetchCurrentUser,
  };
};
