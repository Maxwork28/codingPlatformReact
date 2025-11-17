import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getQuestion, submitAnswer, runCode, runCodeWithCustomInput } from '../../services/api';

export const fetchQuestion = createAsyncThunk('questions/fetchQuestion', async (questionId, { rejectWithValue }) => {
  try {
    console.log('questionSlice: Fetching question', { questionId });
    const response = await getQuestion(questionId);
    console.log('questionSlice: Fetch question response', response.data);
    return response.data.question;
  } catch (error) {
    console.error('questionSlice: Fetch question error', error.response?.data || error);
    return rejectWithValue(error.response?.data?.error || 'Failed to fetch question');
  }
});

export const submitQuestionAnswer = createAsyncThunk('questions/submitAnswer', async ({ questionId, answer, classId, language, examContext }, { rejectWithValue }) => {
  try {
    console.log('questionSlice: Submitting answer', { questionId, answer, classId, language, examContext });
    const response = await submitAnswer(questionId, answer, classId, language, false, examContext);
    console.log('questionSlice: Submit answer response', response.data);
    return response.data;
  } catch (error) {
    console.error('questionSlice: Submit answer error', error.response?.data || error);
    return rejectWithValue(error.response?.data?.error || 'Failed to submit answer');
  }
});

export const runQuestionCode = createAsyncThunk('questions/runQuestionCode', async ({ questionId, answer, classId, language, examContext }, { rejectWithValue }) => {
  try {
    console.log('questionSlice: Running code', { questionId, answer, classId, language, examContext });
    const response = await runCode(questionId, answer, classId, language, examContext);
    console.log('questionSlice: Run code response', response.data);
    return response.data;
  } catch (error) {
    console.error('questionSlice: Run code error', error.response?.data || error);
    return rejectWithValue(error.response?.data?.error || 'Failed to run code');
  }
});

export const runQuestionCodeWithCustomInput = createAsyncThunk(
  'questions/runQuestionCodeWithCustomInput',
  async ({ questionId, answer, classId, language, customInput, expectedOutput, examContext }, { rejectWithValue }) => {
    try {
      console.log('questionSlice: Running code with custom input', { questionId, answer, classId, language, customInput, expectedOutput, examContext });
      const response = await runCodeWithCustomInput(questionId, answer, classId, language, customInput, expectedOutput, examContext);
      console.log('questionSlice: Run code with custom input response', response.data);
      return response.data;
    } catch (error) {
      console.error('questionSlice: Run code with custom input error', error.response?.data || error);
      return rejectWithValue(error.response?.data?.error || 'Failed to run code with custom input');
    }
  }
);

const questionSlice = createSlice({
  name: 'questions',
  initialState: {
    question: null,
    submission: null,
    runResults: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    resetSubmission: (state) => {
      console.log('questionSlice: Resetting submission');
      state.submission = null;
      state.runResults = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuestion.pending, (state) => {
        console.log('questionSlice: Fetch question pending');
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchQuestion.fulfilled, (state, action) => {
        console.log('questionSlice: Fetch question fulfilled', action.payload);
        state.status = 'succeeded';
        state.question = action.payload;
      })
      .addCase(fetchQuestion.rejected, (state, action) => {
        console.log('questionSlice: Fetch question rejected', action.payload);
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(submitQuestionAnswer.pending, (state) => {
        console.log('questionSlice: Submit answer pending');
        state.status = 'loading';
        state.error = null;
      })
      .addCase(submitQuestionAnswer.fulfilled, (state, action) => {
        console.log('questionSlice: Submit answer fulfilled', action.payload);
        state.status = 'succeeded';
        state.submission = action.payload.submission;
        state.runResults = null; // Clear run results on submission
      })
      .addCase(submitQuestionAnswer.rejected, (state, action) => {
        console.log('questionSlice: Submit answer rejected', action.payload);
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(runQuestionCode.pending, (state) => {
        console.log('questionSlice: Run code pending');
        state.status = 'loading';
        state.error = null;
      })
      .addCase(runQuestionCode.fulfilled, (state, action) => {
        console.log('questionSlice: Run code fulfilled', action.payload);
        state.status = 'succeeded';
        state.runResults = action.payload.testResults;
        state.submission = action.payload.submission;
      })
      .addCase(runQuestionCode.rejected, (state, action) => {
        console.log('questionSlice: Run code rejected', action.payload);
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(runQuestionCodeWithCustomInput.pending, (state) => {
        console.log('questionSlice: Run code with custom input pending');
        state.status = 'loading';
        state.error = null;
      })
      .addCase(runQuestionCodeWithCustomInput.fulfilled, (state, action) => {
        console.log('questionSlice: Run code with custom input fulfilled', action.payload);
        state.status = 'succeeded';
        state.runResults = action.payload.testResults;
        state.submission = action.payload.submission;
      })
      .addCase(runQuestionCodeWithCustomInput.rejected, (state, action) => {
        console.log('questionSlice: Run code with custom input rejected', action.payload);
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { resetSubmission } = questionSlice.actions;
export default questionSlice.reducer;