import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import classReducer from './classSlice';
import questionReducer from './questionSlice';

export default configureStore({
  reducer: {
    auth: authReducer,
    classes: classReducer,
    questions: questionReducer,
  },
});