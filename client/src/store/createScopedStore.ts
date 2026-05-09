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
import { experienceRefreshSlice } from './experienceRefreshSlice'
import { eventPayloadsSlice } from './eventPayloadsSlice'
import { pageStructureSlice } from './pageStructureSlice'
import { staticContentSlice } from './staticContentSlice'
import { eventDynamicTargetsSlice } from './eventDynamicTargetsSlice'

const rootReducer = combineReducers({
  mockEvents: mockEventsSlice.reducer,
  eventDynamicRules: eventDynamicRulesSlice.reducer,
  simulator: simulatorSlice.reducer,
  branding: brandingSlice.reducer,
  experienceRefresh: experienceRefreshSlice.reducer,
  eventPayloads: eventPayloadsSlice.reducer,
  pageStructure: pageStructureSlice.reducer,
  staticContent: staticContentSlice.reducer,
  eventDynamicTargets: eventDynamicTargetsSlice.reducer,
})

/**
 * Builds an isolated Redux store + persistor under a unique localStorage key. Used to give the
 * `v2` event/experience routes a sandboxed copy of state so they don't read or overwrite the
 * primary (`v1`) demo data.
 */
export function createScopedAppStore(persistKey: string) {
  const persistConfig = {
    key: persistKey,
    storage: persistStorage,
    whitelist: [
      'mockEvents',
      'eventDynamicRules',
      'simulator',
      'branding',
      'eventPayloads',
      'pageStructure',
      'staticContent',
      'eventDynamicTargets',
    ],
  }

  const persistedReducer = persistReducer(persistConfig, rootReducer)

  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  })

  const persistor = persistStore(store)

  return { store, persistor }
}

export type ScopedAppStore = ReturnType<typeof createScopedAppStore>['store']
