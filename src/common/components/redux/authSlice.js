import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from '../../constants';
import { disconnectSocket } from '../../services/socket';

const isAuthFailureStatus = (status) => status === 401 || status === 403;

/** Decodes a JWT; returns null when it is malformed or already expired. */
const decodeLiveToken = (token) => {
  if (!token) return null;
  try {
    const decoded = jwtDecode(token);
    if (decoded?.exp && decoded.exp * 1000 <= Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
};

const removeKeysWithPrefix = (storage, prefix) => {
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
};

/** Everything a signed-in session leaves behind in the browser. */
export const clearSessionStorage = () => {
  try {
    localStorage.removeItem('token');
  } catch {
    /* ignore */
  }
  if (typeof localStorage !== 'undefined') removeKeysWithPrefix(localStorage, 'exam:');
  if (typeof sessionStorage !== 'undefined') removeKeysWithPrefix(sessionStorage, 'algo-run-history:');
  disconnectSocket();
};

const toUser = (payload) => ({
  id: payload.id,
  name: payload.name,
  email: payload.email,
  role: payload.role,
  profilePicture: payload.profilePicture || null,
  canCreateQuestion: Boolean(payload.canCreateQuestion),
  mustChangePassword: Boolean(payload.mustChangePassword),
});

// Validate token and fetch user details
export const validateToken = createAsyncThunk('auth/validateToken', async (_, { rejectWithValue }) => {
  const token = localStorage.getItem('token');
  try {
    if (!token) throw new Error('No token found');
    const decodedToken = decodeLiveToken(token);
    if (!decodedToken) {
      if (localStorage.getItem('token') === token) localStorage.removeItem('token');
      return rejectWithValue({ message: 'Session expired', keepSession: false });
    }
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // /auth/me may return the user flat or nested under `user`.
    const data = response.data?.user && typeof response.data.user === 'object'
      ? { ...response.data, ...response.data.user }
      : response.data;
    return {
      ...data,
      id: decodedToken.id || data.id,
      role: decodedToken.role || data.role,
      profilePicture: data.profilePicture || null,
      token,
    };
  } catch (error) {
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
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: normalizedEmail,
      password: normalizedPassword,
    });

    const decodedToken = decodeLiveToken(response.data.token);
    const role = decodedToken?.role || response.data.role;
    const id = decodedToken?.id || response.data.id;

    if (!response.data.token || !role || !id) {
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
    return rejectWithValue(error.response?.data?.error || 'Login failed');
  }
});

// Initialize state from the stored token; an expired or malformed token means logged out.
let initialToken = localStorage.getItem('token');
let initialUser = null;
let initialRole = null;

if (initialToken) {
  const decodedToken = decodeLiveToken(initialToken);
  if (decodedToken) {
    initialUser = { id: decodedToken.id };
    initialRole = decodedToken.role;
  } else {
    localStorage.removeItem('token');
    initialToken = null;
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: initialUser,
    token: initialToken,
    role: initialRole,
    status: 'idle',
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.role = null;
      state.status = 'idle';
      state.error = null;
      clearSessionStorage();
    },
    setProfilePicture: (state, action) => {
      if (state.user) {
        state.user.profilePicture = action.payload;
      }
    },
    /** After POST /auth/change-password: store the fresh token and lift the forced-change gate. */
    passwordChanged: (state, action) => {
      const token = action.payload?.token;
      if (token) {
        state.token = token;
        localStorage.setItem('token', token);
      }
      if (state.user) state.user.mustChangePassword = false;
    },
    setMustChangePassword: (state, action) => {
      if (state.user) state.user.mustChangePassword = Boolean(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.role = action.payload.role;
        state.user = toUser(action.payload);
        state.error = action.payload.id ? null : 'Login succeeded, but user ID is missing';
        localStorage.setItem('token', action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(validateToken.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(validateToken.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.role = action.payload.role;
        state.user = toUser(action.payload);
        state.error = null;
      })
      .addCase(validateToken.rejected, (state, action) => {
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

export const { logout, setProfilePicture, passwordChanged, setMustChangePassword } = authSlice.actions;
export default authSlice.reducer;
