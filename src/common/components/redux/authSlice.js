import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../constants';
import { jwtDecode } from 'jwt-decode';

const isAuthFailureStatus = (status) => status === 401 || status === 403;

// Validate token and fetch user details
export const validateToken = createAsyncThunk('auth/validateToken', async (_, { rejectWithValue }) => {
  const token = localStorage.getItem('token');
  try {
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
      profilePicture: response.data.profilePicture || null,
      token,
    };
  } catch (error) {
    console.error('authSlice: Validate token error', error.response?.data || error);
    const status = error.response?.status;
    // Only drop THIS token. A login that finished while /auth/me was in-flight
    // must not have its new token deleted.
    if (isAuthFailureStatus(status) && localStorage.getItem('token') === token) {
      localStorage.removeItem('token');
    }
    if (!error.response) {
      return rejectWithValue({ message: error.message || 'Could not verify session', keepSession: true });
    }
    return rejectWithValue({
      message: error.response?.data?.error || 'Invalid token',
      keepSession: !isAuthFailureStatus(status),
    });
  }
});

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPassword = typeof password === 'string' ? password : String(password || '');
    console.log('authSlice: Initiating login request', { email: normalizedEmail });
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: normalizedEmail,
      password: normalizedPassword,
    });
    console.log('authSlice: Login response', response.data);

    const decodedToken = jwtDecode(response.data.token);
    console.log('authSlice: Decoded token', decodedToken);

    const role = decodedToken.role || response.data.role;
    const id = decodedToken.id || response.data.id;

    if (!role || !id) {
      return rejectWithValue('Login succeeded but user role/id is missing');
    }

    localStorage.setItem('token', response.data.token);

    return {
      ...response.data,
      id,
      role,
      profilePicture: response.data.profilePicture || null,
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
    setProfilePicture: (state, action) => {
      if (state.user) {
        state.user.profilePicture = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        console.log('authSlice: Login pending');
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        console.log('authSlice: Login fulfilled', action.payload);
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.role = action.payload.role;
        state.user = {
          id: action.payload.id,
          name: action.payload.name,
          email: action.payload.email,
          role: action.payload.role,
          profilePicture: action.payload.profilePicture || null,
        };
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
        state.user = {
          id: action.payload.id,
          name: action.payload.name,
          email: action.payload.email,
          role: action.payload.role,
          profilePicture: action.payload.profilePicture || null,
        };
        state.error = null;
      })
      .addCase(validateToken.rejected, (state, action) => {
        console.log('authSlice: Validate token rejected', action.payload);
        // Login may have completed while /auth/me was still failing with the old token.
        if (state.user?.name && state.token) {
          return;
        }
        const payload = action.payload;
        const keepSession = typeof payload === 'object' && payload?.keepSession;
        if (keepSession) {
          // Network/CORS: keep the stored token, but stop the restore spinner loop.
          state.status = 'failed';
          return;
        }
        const staleToken = state.token;
        state.status = 'failed';
        state.user = null;
        state.token = null;
        state.role = null;
        // Do not show restore failures as a login-form error.
        state.error = null;
        if (!localStorage.getItem('token') || localStorage.getItem('token') === staleToken) {
          localStorage.removeItem('token');
        }
      });
  },
});

export const { logout, setProfilePicture } = authSlice.actions;
export default authSlice.reducer;