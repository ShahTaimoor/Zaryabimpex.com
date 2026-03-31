import { createSlice } from '@reduxjs/toolkit';
import { authApi } from '../services/authApi';

const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('authToken');
  } catch {
    return null;
  }
};

const initialState = {
  user: null,
  token: getStoredToken(), // Prefer token fallback for Safari/iPad cross-site cookie issues
  status: 'idle',
  error: null,
  isAuthenticated: !!getStoredToken(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, { payload }) {
      state.user = payload;
      // If we have a user, we're authenticated (token is in HTTP-only cookie)
      state.isAuthenticated = !!payload;
      if (payload && !state.token) {
        state.token = 'cookie'; // Placeholder to indicate auth via cookie
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
        if (payload?.token && typeof window !== 'undefined') {
          try {
            localStorage.setItem('authToken', payload.token);
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
        state.user = null;
        state.isAuthenticated = false;
        state.token = null;
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('authToken');
          } catch {
            // ignore storage errors
          }
        }
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;

