import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * Persists Experiences v2 per-event `<details open>` so expand/collapse survives navigation.
 * `expandedByEventId[eventId] === true` means the card body (live region) is shown; missing or false = collapsed (default).
 */
export type ExperienceV2CardExpandState = {
  expandedByEventId: Record<string, boolean>
}

const initialState: ExperienceV2CardExpandState = {
  expandedByEventId: {},
}

export const experienceV2CardExpandSlice = createSlice({
  name: 'experienceV2CardExpand',
  initialState,
  reducers: {
    setExperienceV2CardExpanded: (
      state,
      action: PayloadAction<{ eventId: string; expanded: boolean }>,
    ) => {
      const { eventId, expanded } = action.payload
      if (expanded) {
        state.expandedByEventId[eventId] = true
      } else {
        delete state.expandedByEventId[eventId]
      }
    },
    removeExperienceV2CardExpand: (state, action: PayloadAction<string>) => {
      delete state.expandedByEventId[action.payload]
    },
    resetExperienceV2CardExpand: () => initialState,
  },
})

export const {
  setExperienceV2CardExpanded,
  removeExperienceV2CardExpand,
  resetExperienceV2CardExpand,
} = experienceV2CardExpandSlice.actions
