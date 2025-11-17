import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../constants';

export const fetchClasses = createAsyncThunk('classes/fetchClasses', async (search = '', { getState, rejectWithValue }) => {
  try {
    const { auth } = getState();
    // Use token from Redux state, fallback to localStorage if not available
    const token = auth.token || localStorage.getItem('token');
    if (!token) {
      console.error('classSlice: No token available');
      return rejectWithValue('Please authenticate');
    }
    console.log('classSlice: Fetching classes with token', token ? 'Present' : 'Not present', 'search:', search);
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
      })
      .addCase(fetchClasses.fulfilled, (state, action) => {
        console.log('classSlice: Fetch classes fulfilled', action.payload);
        state.status = 'succeeded';
        state.classes = action.payload;
      })
      .addCase(fetchClasses.rejected, (state, action) => {
        console.log('classSlice: Fetch classes rejected', action.payload);
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export default classSlice.reducer;