import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../constants';
import { login, logout, validateToken } from './authSlice';

const resetList = (state) => {
  state.classes = [];
  state.status = 'idle';
  state.error = null;
};

export const fetchClasses = createAsyncThunk('classes/fetchClasses', async (search = '', { getState, rejectWithValue }) => {
  try {
    const { auth } = getState();
    const token = auth.token || localStorage.getItem('token');
    if (!token) {
      return rejectWithValue('Please authenticate');
    }
    console.log('classSlice: Fetching classes', { search: search || '' });
    const params = search ? { search } : {};
    const response = await axios.get(`${API_BASE_URL}/admin/classes`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    console.log('classSlice: Fetch classes response', response.data);
    return response.data.classes;
  } catch (error) {
    console.error('classSlice: Fetch classes error', error.response?.data || error);
    return rejectWithValue(error.response?.data?.error || 'Failed to fetch classes');
  }
});

const classSlice = createSlice({
  name: 'classes',
  initialState: {
    classes: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchClasses.pending, (state) => {
        console.log('classSlice: Fetch classes pending');
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchClasses.fulfilled, (state, action) => {
        console.log('classSlice: Fetch classes fulfilled', action.payload);
        state.status = 'succeeded';
        state.classes = action.payload;
        state.error = null;
      })
      .addCase(fetchClasses.rejected, (state, action) => {
        console.log('classSlice: Fetch classes rejected', action.payload);
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(login.fulfilled, resetList)
      .addCase(logout, resetList)
      .addCase(validateToken.rejected, resetList);
  },
});

export default classSlice.reducer;