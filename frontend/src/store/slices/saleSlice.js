import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { nanoid } from '@reduxjs/toolkit';
import { salesApi } from '../services/salesApi';
import { clearCart } from './cartSlice';

export const submitSale = createAsyncThunk(
  'sale/submitSale',
  async ({ payload, idempotencyKey }, { dispatch, rejectWithValue }) => {
    const key = idempotencyKey || nanoid();
    try {
      const result = await dispatch(
        salesApi.endpoints.createSale.initiate({ payload, idempotencyKey: key })
      ).unwrap();
      dispatch(clearCart());
      return { result, idempotencyKey: key };
    } catch (err) {
      return rejectWithValue(err?.data || err?.message || 'Sale submission failed');
    }
  }
);

const saleSlice = createSlice({
  name: 'sale',
  initialState: {
    status: 'idle',
    error: null,
    lastIdempotencyKey: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(submitSale.pending, (state, action) => {
        state.status = 'loading';
        state.error = null;
        state.lastIdempotencyKey = action.meta.arg.idempotencyKey;
      })
      .addCase(submitSale.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.error = null;
        state.lastIdempotencyKey = action.payload.idempotencyKey;
      })
      .addCase(submitSale.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      });
  },
});

export default saleSlice.reducer;

