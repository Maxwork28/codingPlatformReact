import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import classReducer from './classSlice';

export default configureStore({
  reducer: {
    auth: authReducer,
    classes: classReducer,
  },
});
