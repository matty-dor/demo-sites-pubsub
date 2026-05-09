import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type StaticContentType = 'text' | 'imageUrl'

export type StaticBlockContent = {
  contentType: StaticContentType
  content: string
}

export type StaticContent = {
  /**
   * Per-row block content, indexed by `PageStructureRow.id`. Each value is an array of block
   * contents — length 1 for `full` rows, length 2 for `half-half` rows.
   */
  byRowId: Record<string, StaticBlockContent[]>
}

export type StaticContentState = {
  byEventId: Record<string, StaticContent>
}

const initialState: StaticContentState = {
  byEventId: {},
}

export const staticContentSlice = createSlice({
  name: 'staticContent',
  initialState,
  reducers: {
    setStaticContentForEvent: (
      state,
      action: PayloadAction<{ eventId: string; content: StaticContent }>,
    ) => {
      state.byEventId[action.payload.eventId] = action.payload.content
    },
    removeStaticContentForEvent: (state, action: PayloadAction<string>) => {
      delete state.byEventId[action.payload]
    },
    resetStaticContent: () => initialState,
  },
})

export const {
  setStaticContentForEvent,
  removeStaticContentForEvent,
  resetStaticContent,
} = staticContentSlice.actions
