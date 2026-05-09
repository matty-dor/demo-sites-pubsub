import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/** Layout choice for a single row in an event's page structure (Events v2 only). */
export type PageStructureRowLayout = 'full' | 'half-half'

export type PageStructureRow = {
  id: string
  layout: PageStructureRowLayout
}

export type PageStructure = {
  rows: PageStructureRow[]
}

export type PageStructureState = {
  byEventId: Record<string, PageStructure>
}

const initialState: PageStructureState = {
  byEventId: {},
}

export const pageStructureSlice = createSlice({
  name: 'pageStructure',
  initialState,
  reducers: {
    setPageStructureForEvent: (
      state,
      action: PayloadAction<{ eventId: string; structure: PageStructure }>,
    ) => {
      state.byEventId[action.payload.eventId] = action.payload.structure
    },
    removePageStructureForEvent: (state, action: PayloadAction<string>) => {
      delete state.byEventId[action.payload]
    },
    resetPageStructure: () => initialState,
  },
})

export const {
  setPageStructureForEvent,
  removePageStructureForEvent,
  resetPageStructure,
} = pageStructureSlice.actions
