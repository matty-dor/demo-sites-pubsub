import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/** Mirrors a successful POST /api/personalization JSON body for UI/dev without a server. */
export type SimulatedPersonalizationResponse = {
  ok?: boolean
  status?: number
  data?: unknown
  error?: string
}

export type SimulatorState = {
  personalizationResponse: SimulatedPersonalizationResponse | null
  /** Last customer_id used on the Personalization page — Refresh Experience uses this when backend is on. */
  lastPersonalizationCustomerId: string | null
}

const initialState: SimulatorState = {
  personalizationResponse: {
    ok: true,
    status: 200,
    data: {
      segment: 'variant_a',
      message: 'Use the Personalization API page to fetch by customer_id.',
    },
  },
  lastPersonalizationCustomerId: null,
}

export const simulatorSlice = createSlice({
  name: 'simulator',
  initialState,
  reducers: {
    setSimulatedPersonalizationResponse: (
      state,
      action: PayloadAction<SimulatedPersonalizationResponse | null>,
    ) => {
      state.personalizationResponse = action.payload
    },
    setLastPersonalizationCustomerId: (state, action: PayloadAction<string | null>) => {
      state.lastPersonalizationCustomerId = action.payload
    },
    resetSimulator: () => initialState,
  },
})

export const {
  setSimulatedPersonalizationResponse,
  setLastPersonalizationCustomerId,
  resetSimulator,
} = simulatorSlice.actions
