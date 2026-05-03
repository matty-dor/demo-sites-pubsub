import { combineReducers, configureStore } from '@reduxjs/toolkit'
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist'
import { persistStorage } from './persistStorage'
import { mockEventsSlice } from './mockEventsSlice'
import { eventDynamicRulesSlice } from './eventDynamicRulesSlice'
import { simulatorSlice } from './simulatorSlice'
import { brandingSlice } from './brandingSlice'

const rootReducer = combineReducers({
  mockEvents: mockEventsSlice.reducer,
  eventDynamicRules: eventDynamicRulesSlice.reducer,
  simulator: simulatorSlice.reducer,
  branding: brandingSlice.reducer,
})

const persistConfig = {
  key: 'growthloop-poc',
  storage: persistStorage,
  whitelist: ['mockEvents', 'eventDynamicRules', 'simulator', 'branding'],
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
