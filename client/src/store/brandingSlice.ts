import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type BrandingState = {
  /** Empty means show “Company Name” placeholder until the user saves a value. */
  companyName: string
}

const initialState: BrandingState = {
  companyName: '',
}

export const brandingSlice = createSlice({
  name: 'branding',
  initialState,
  reducers: {
    setCompanyName: (state, action: PayloadAction<string>) => {
      state.companyName = action.payload
    },
    resetBranding: () => initialState,
  },
})

export const { setCompanyName, resetBranding } = brandingSlice.actions
