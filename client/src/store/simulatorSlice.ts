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
}

const initialState: SimulatorState = {
  personalizationResponse: {
    ok: true,
    status: 200,
    data: {
      segment: 'variant_a',
      message: 'Simulated personalization payload — edit on the Personalization API page.',
    },
  },
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
    resetSimulator: () => initialState,
  },
})

export const { setSimulatedPersonalizationResponse, resetSimulator } =
  simulatorSlice.actions
