import { createSlice } from '@reduxjs/toolkit';
import { authApi } from '../services/authApi';

const initialState = {
  user: null,
  token: null, // Token is stored in HTTP-only cookie, not in localStorage
  status: 'idle',
  error: null,
  isAuthenticated: false,
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
      // Token is in HTTP-only cookie, backend handles logout/clearing
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
        // Token is stored in HTTP-only cookie by backend, not in localStorage
        state.token = payload.token || 'cookie'; // Placeholder to indicate auth success
        state.isAuthenticated = true;
        state.status = 'succeeded';
        state.error = null;
        // Backend should set HTTP-only cookie with token
      })
      .addMatcher(authApi.endpoints.login.matchRejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error?.message || 'Login failed';
        state.isAuthenticated = false;
      })
      .addMatcher(authApi.endpoints.currentUser.matchFulfilled, (state, { payload }) => {
        state.user = payload.user || payload;
        state.token = 'cookie'; // Placeholder to indicate auth via HTTP-only cookie
        state.isAuthenticated = true;
        state.status = 'succeeded';
        state.error = null;
      })
      .addMatcher(authApi.endpoints.currentUser.matchRejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;

