import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/** When `hide`, the row is omitted from Static Content; Dynamic Content may still target its cells. */
export type PageStructureRowDefaultDisplay = 'show' | 'hide'

export type PageStructureRow = {
  id: string
  layout: PageStructureRowLayout
  defaultDisplay: PageStructureRowDefaultDisplay
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

/** Rows eligible for the Static Content editor and static fallback in experiences. */
export function isPageStructureRowVisibleForStaticContent(
  row: PageStructureRow,
): boolean {
  return row.defaultDisplay !== 'hide'
}

export function normalizePageStructureRow(row: PageStructureRow): PageStructureRow {
  return {
    ...row,
    defaultDisplay: row.defaultDisplay === 'hide' ? 'hide' : 'show',
  }
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
