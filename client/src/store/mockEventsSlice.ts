import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { SchemaNode } from '../types/schema'

export type StoredMockEvent = {
  id: string
  name: string
  schema: SchemaNode[]
  createdAt: string
}

export type MockEventsState = {
  events: StoredMockEvent[]
}

const initialState: MockEventsState = {
  events: [],
}

export const mockEventsSlice = createSlice({
  name: 'mockEvents',
  initialState,
  reducers: {
    addMockEvent: (
      state,
      action: PayloadAction<{ name: string; schema: SchemaNode[] }>,
    ) => {
      state.events.unshift({
        id: crypto.randomUUID(),
        name: action.payload.name,
        schema: action.payload.schema,
        createdAt: new Date().toISOString(),
      })
    },
    removeMockEvent: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter((e) => e.id !== action.payload)
    },
    updateMockEvent: (
      state,
      action: PayloadAction<{ id: string; name: string; schema: SchemaNode[] }>,
    ) => {
      const { id, name, schema } = action.payload
      const idx = state.events.findIndex((e) => e.id === id)
      if (idx >= 0) {
        state.events[idx] = { ...state.events[idx], name, schema }
      }
    },
    resetMockEvents: () => initialState,
  },
})

export const {
  addMockEvent,
  removeMockEvent,
  updateMockEvent,
  resetMockEvents,
} = mockEventsSlice.actions
