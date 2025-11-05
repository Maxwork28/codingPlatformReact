import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../constants';

export const fetchClasses = createAsyncThunk('classes/fetchClasses', async (search = '', { getState, rejectWithValue }) => {
  try {
    const { auth } = getState();
    console.log('classSlice: Fetching classes with token', auth.token, 'search:', search);
    const params = search ? { search } : {};
    const response = await axios.get(`${API_BASE_URL}/admin/classes`, {
      headers: { Authorization: `Bearer ${auth.token}` },
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