import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  useLoginMutation,
  useRequestTwoFactorCodeMutation,
  useVerifyTwoFactorMutation,
  useCurrentUserQuery,
  useLogoutMutation,
} from '../store/services/authApi';
import { logout as logoutAction, setUser } from '../store/slices/authSlice';

// Compatibility wrapper to keep existing imports; no longer provides context.
export const AuthProvider = ({ children }) => children;

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, isAuthenticated, status, error } = useAppSelector((s) => s.auth);
  const isLoginPage = location.pathname === '/login';

  const {
    isLoading: currentUserLoading,
    isError: currentUserError,
    error: currentUserErrorData,
    refetch: refetchCurrentUser,
  } = useCurrentUserQuery(undefined, {
    // Skip when: on login page, or already authenticated with user (no need to refetch)
    skip: isLoginPage || (isAuthenticated && !!user),
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
  const [requestTwoFactorMutation, { isLoading: requestTwoFactorLoading }] = useRequestTwoFactorCodeMutation();
  const [verifyTwoFactorMutation, { isLoading: verifyTwoFactorLoading }] = useVerifyTwoFactorMutation();
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

  const requestTwoFactorCode = async ({ channel = 'email', email, phone }) => {
    try {
      const response = await requestTwoFactorMutation({ channel, email, phone }).unwrap();
      toast.info(
        channel === 'sms'
          ? 'Verification code sent to your mobile number.'
          : 'Verification code sent to your email.'
      );
      return {
        success: true,
        twoFactorRequired: true,
        tempToken: response.tempToken,
      };
    } catch (error) {
      const message = error?.data?.message || error?.message || 'Could not send verification code';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const verifyTwoFactor = async (tempToken, code) => {
    try {
      await verifyTwoFactorMutation({ tempToken, code }).unwrap();
      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      const message = error?.data?.message || error?.message || '2FA verification failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    // Clear local session first to avoid role-specific UI race conditions
    // where user state can appear "stuck" during async logout calls.
    dispatch(logoutAction());
    dispatch(authApi.util.resetApiState());
    navigate('/login', { replace: true });
    toast.success('Logged out successfully');

    try {
      await logoutMutation().unwrap();
    } catch (error) {
      // Continue with logout even if API call fails
    }
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
    ? (loginLoading || verifyTwoFactorLoading || requestTwoFactorLoading)
    : (status === 'loading' || (currentUserLoading && !currentUserError)) ||
      loginLoading ||
      verifyTwoFactorLoading ||
      requestTwoFactorLoading;

  return {
    user,
    token,
    isAuthenticated,
    loading,
    error: error || (currentUserError ? currentUserErrorData : null),
    login,
    requestTwoFactorCode,
    verifyTwoFactor,
    logout,
    updateUser,
    hasPermission,
    refetchCurrentUser,
  };
};
