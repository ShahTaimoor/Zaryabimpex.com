import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import saleReducer from './slices/saleSlice';
import accountingReducer from './slices/accountingSlice';

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
    }).concat(api.middleware),
  devTools: import.meta.env.DEV,
});

setupListeners(store.dispatch);

