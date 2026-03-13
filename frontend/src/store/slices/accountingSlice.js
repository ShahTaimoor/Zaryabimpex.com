import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { nanoid } from '@reduxjs/toolkit';
import { accountingApi } from '../services/accountingApi';

export const postJournal = createAsyncThunk(
  'accounting/postJournal',
  async ({ entries, metadata, idempotencyKey }, { dispatch, rejectWithValue }) => {
    const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
    if (totalDebit !== totalCredit) {
      return rejectWithValue('Debits and credits must balance');
    }
    const key = idempotencyKey || nanoid();
    try {
      const res = await dispatch(
        accountingApi.endpoints.postJournal.initiate({ entries, metadata, idempotencyKey: key })
      ).unwrap();
      return { res, idempotencyKey: key };
    } catch (err) {
      return rejectWithValue(err?.data || err?.message || 'Journal post failed');
    }
  }
);

const accountingSlice = createSlice({
  name: 'accounting',
  initialState: {
    status: 'idle',
    error: null,
    lastIdempotencyKey: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(postJournal.pending, (state, action) => {
        state.status = 'loading';
        state.error = null;
        state.lastIdempotencyKey = action.meta.arg.idempotencyKey;
      })
      .addCase(postJournal.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.error = null;
        state.lastIdempotencyKey = action.payload.idempotencyKey;
      })
      .addCase(postJournal.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      });
  },
});

export default accountingSlice.reducer;

