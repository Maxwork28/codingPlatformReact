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
    const params = search ? { search } : {};
    const response = await axios.get(`${API_BASE_URL}/admin/classes`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return response.data.classes;
  } catch (error) {
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
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchClasses.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.classes = action.payload;
        state.error = null;
      })
      .addCase(fetchClasses.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(login.fulfilled, resetList)
      .addCase(logout, resetList)
      .addCase(validateToken.rejected, resetList);
  },
});

export default classSlice.reducer;