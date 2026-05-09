import { createScopedAppStore } from './createScopedStore'

const v1 = createScopedAppStore('growthloop-poc')

export const store = v1.store
export const persistor = v1.persistor

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
