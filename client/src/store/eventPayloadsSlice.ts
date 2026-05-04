import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { SchemaNode } from '../types/schema'
import { buildDefaultPayload } from '../lib/schemaDefaults'

export type EventPayloadsState = {
  byEventId: Record<string, Record<string, unknown>>
}

const initialState: EventPayloadsState = {
  byEventId: {},
}

export const eventPayloadsSlice = createSlice({
  name: 'eventPayloads',
  initialState,
  reducers: {
    setPayloadForEvent: (
      state,
      action: PayloadAction<{ eventId: string; payload: Record<string, unknown> }>,
    ) => {
      state.byEventId[action.payload.eventId] = action.payload.payload
    },
    ensureDefaultPayloadForEvent: (
      state,
      action: PayloadAction<{ eventId: string; schema: SchemaNode[] }>,
    ) => {
      const { eventId, schema } = action.payload
      if (!state.byEventId[eventId]) {
        state.byEventId[eventId] = buildDefaultPayload(schema)
      }
    },
    removePayloadForEvent: (state, action: PayloadAction<string>) => {
      delete state.byEventId[action.payload]
    },
    resetEventPayloads: () => initialState,
  },
})

export const {
  setPayloadForEvent,
  ensureDefaultPayloadForEvent,
  removePayloadForEvent,
  resetEventPayloads,
} = eventPayloadsSlice.actions
