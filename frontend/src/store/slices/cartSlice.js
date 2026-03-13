import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  ids: [],
  entities: {}, // {id: {id, productId, name, qty, price, tax, discount}}
  meta: {
    customerId: null,
    notes: '',
    paymentType: 'cash',
  },
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: {
      reducer(state, { payload }) {
        if (!state.ids.includes(payload.id)) {
          state.ids.push(payload.id);
        }
        state.entities[payload.id] = payload;
      },
      prepare(product, overrides = {}) {
        return {
          payload: {
            id: nanoid(),
            productId: product._id || product.id,
            name: product.name,
            price: product.price || product.pricing?.retail || 0,
            qty: 1,
            tax: product.tax || 0,
            discount: 0,
            ...overrides,
          },
        };
      },
    },
    updateItem(state, { payload: { id, changes } }) {
      if (state.entities[id]) {
        state.entities[id] = { ...state.entities[id], ...changes };
      }
    },
    removeItem(state, { payload: id }) {
      state.ids = state.ids.filter((x) => x !== id);
      delete state.entities[id];
    },
    clearCart(state) {
      state.ids = [];
      state.entities = {};
      state.meta = { customerId: null, notes: '', paymentType: 'cash' };
    },
    setMeta(state, { payload }) {
      state.meta = { ...state.meta, ...payload };
    },
  },
});

export const { addItem, updateItem, removeItem, clearCart, setMeta } = cartSlice.actions;
export default cartSlice.reducer;

