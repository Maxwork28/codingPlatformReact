import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../constants';
import { jwtDecode } from 'jwt-decode';

// Validate token and fetch user details
export const validateToken = createAsyncThunk('auth/validateToken', async (_, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('authSlice: Validate token response', response.data);
    const decodedToken = jwtDecode(token);
    return {
      ...response.data,
      id: decodedToken.id || response.data.id,
      role: decodedToken.role || response.data.role,
      token,
    };
  } catch (error) {
    console.error('authSlice: Validate token error', error.response?.data || error);
    localStorage.removeItem('token');
    return rejectWithValue(error.response?.data?.error || 'Invalid token');
  }
});

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    console.log('authSlice: Initiating login request', { email });
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
    console.log('authSlice: Login response', response.data);

    const decodedToken = jwtDecode(response.data.token);
    console.log('authSlice: Decoded token', decodedToken);

    return {
      ...response.data,
      id: decodedToken.id || response.data.id,
      role: decodedToken.role || response.data.role,
    };
  } catch (error) {
    console.error('authSlice: Login error', error.response?.data || error);
    return rejectWithValue(error.response?.data?.error || 'Login failed');
  }
});

// Initialize state with token and decoded user info
const token = localStorage.getItem('token');
let initialUser = null;
let initialRole = null;

if (token) {
  try {
    const decodedToken = jwtDecode(token);
    initialUser = { id: decodedToken.id };
    initialRole = decodedToken.role;
    console.log('authSlice: Initialized with token', { id: decodedToken.id, role: initialRole });
  } catch (error) {
    console.error('authSlice: Failed to decode token', error);
    localStorage.removeItem('token');
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: initialUser,
    token: token,
    role: initialRole,
    status: 'idle',
    error: null,
  },
  reducers: {
    logout: (state) => {
      console.log('authSlice: Logging out');
      state.user = null;
      state.token = null;
      state.role = null;
      state.status = 'idle';
      state.error = null;
      localStorage.removeItem('token');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        console.log('authSlice: Login pending');
        state.status = 'loading';
      })
      .addCase(login.fulfilled, (state, action) => {
        console.log('authSlice: Login fulfilled', action.payload);
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.role = action.payload.role;
        state.user = { id: action.payload.id };
        state.error = null;
        if (!action.payload.id) {
          state.error = 'Login succeeded, but user ID is missing';
          console.warn('authSlice: User ID is missing in payload', action.payload);
        }
        localStorage.setItem('token', action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        console.log('authSlice: Login rejected', action.payload);
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(validateToken.pending, (state) => {
        console.log('authSlice: Validate token pending');
        state.status = 'loading';
      })
      .addCase(validateToken.fulfilled, (state, action) => {
        console.log('authSlice: Validate token fulfilled', action.payload);
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.role = action.payload.role;
        state.user = { id: action.payload.id };
        state.error = null;
      })
      .addCase(validateToken.rejected, (state, action) => {
        console.log('authSlice: Validate token rejected', action.payload);
        state.status = 'failed';
        state.user = null;
        state.token = null;
        state.role = null;
        state.error = action.payload;
        localStorage.removeItem('token');
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;