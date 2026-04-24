import { createSlice } from '@reduxjs/toolkit';
import { authApi } from '../services/authApi';

const getStoredAuth = () => {
  if (typeof window === 'undefined') return { token: null, user: null };
  try {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('authUser');
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

const { token: storedToken, user: storedUser } = getStoredAuth();

const initialState = {
  user: storedUser,
  token: storedToken,
  status: 'idle',
  error: null,
  isAuthenticated: !!storedToken,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, { payload }) {
      state.user = payload;
      state.isAuthenticated = !!payload;
      if (payload && !state.token) {
        state.token = 'cookie';
      }
      // Persist user
      if (typeof window !== 'undefined' && payload) {
        try {
          localStorage.setItem('authUser', JSON.stringify(payload));
        } catch (e) {
          console.error('Failed to store auth user', e);
        }
      }
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      state.error = null;
      // Keep state and storage in sync
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
        } catch {
          // ignore storage errors
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(authApi.endpoints.login.matchPending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
        state.user = payload.user || payload;
        state.token = payload.token || state.token || 'cookie';
        state.isAuthenticated = true;
        state.status = 'succeeded';
        state.error = null;
        // Store token fallback for browsers that block cross-site cookies (e.g. Safari/iPad)
        if (typeof window !== 'undefined') {
          try {
            if (payload?.token) {
              localStorage.setItem('authToken', payload.token);
            }
            if (state.user) {
              localStorage.setItem('authUser', JSON.stringify(state.user));
            }
          } catch {
            // ignore storage errors
          }
        }
      })
      .addMatcher(authApi.endpoints.login.matchRejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error?.message || 'Login failed';
        state.isAuthenticated = false;
      })
      .addMatcher(authApi.endpoints.currentUser.matchFulfilled, (state, { payload }) => {
        state.user = payload.user || payload;
        state.token = state.token || 'cookie';
        state.isAuthenticated = true;
        state.status = 'succeeded';
        state.error = null;
      })
      .addMatcher(authApi.endpoints.currentUser.matchRejected, (state) => {
        // If offline, we don't want to clear the session just because the request failed
        if (navigator.onLine) {
          state.user = null;
          state.isAuthenticated = false;
          state.token = null;
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('authToken');
              localStorage.removeItem('authUser');
            } catch {
              // ignore storage errors
            }
          }
        }
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;

