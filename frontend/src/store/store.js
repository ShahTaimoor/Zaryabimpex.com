import { configureStore, isRejectedWithValue } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import saleReducer from './slices/saleSlice';
import accountingReducer from './slices/accountingSlice';
import { toast } from 'sonner';

let networkToastId = null;
let isNetworkDown = false;
let recoveryInterval = null;

const MAINTENANCE_MSG = 'Server is currently under maintenance. Please try again shortly.';

function startRecoveryPolling(dispatch) {
  if (recoveryInterval) return;
  recoveryInterval = setInterval(async () => {
    try {
      const resp = await fetch(
        (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/').replace(/\/$/, '') + '/health',
        { method: 'GET', cache: 'no-store' }
      );
      if (resp.ok) {
        clearInterval(recoveryInterval);
        recoveryInterval = null;
        isNetworkDown = false;
        if (networkToastId) {
          toast.dismiss(networkToastId);
          networkToastId = null;
        }
        toast.success('Server is back online!', { duration: 3000 });
        dispatch(api.util.invalidateTags(api.util.selectInvalidatedBy(undefined, [])));
        dispatch(api.util.resetApiState());
      }
    } catch {
      // still down
    }
  }, 5000);
}

const networkErrorMiddleware = (storeApi) => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const payload = action.payload;
    const isNetworkError = !payload?.status && typeof payload?.data === 'string' &&
      payload.data.includes('maintenance');

    if (isNetworkError) {
      if (!isNetworkDown) {
        isNetworkDown = true;
        networkToastId = toast.error(MAINTENANCE_MSG, {
          duration: Infinity,
          id: 'network-maintenance',
        });
        startRecoveryPolling(storeApi.dispatch);
      }
      return next(action);
    }
  }

  return next(action);
};

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    cart: cartReducer,
    sale: saleReducer,
    accounting: accountingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(api.middleware, networkErrorMiddleware),
  devTools: import.meta.env.DEV,
});

setupListeners(store.dispatch);

