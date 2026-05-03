import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * After a successful Trigger, UI can offer Refresh Experience until cleared.
 * Not persisted — session-only.
 */
export type ExperienceRefreshState = {
  awaitingRefreshByEventId: Record<string, boolean>
}

const initialState: ExperienceRefreshState = {
  awaitingRefreshByEventId: {},
}

export const experienceRefreshSlice = createSlice({
  name: 'experienceRefresh',
  initialState,
  reducers: {
    markExperienceAwaitingRefresh: (state, action: PayloadAction<string>) => {
      state.awaitingRefreshByEventId[action.payload] = true
    },
    clearExperienceAwaitingRefresh: (state, action: PayloadAction<string>) => {
      delete state.awaitingRefreshByEventId[action.payload]
    },
    resetExperienceRefresh: () => initialState,
  },
})

export const {
  markExperienceAwaitingRefresh,
  clearExperienceAwaitingRefresh,
  resetExperienceRefresh,
} = experienceRefreshSlice.actions
