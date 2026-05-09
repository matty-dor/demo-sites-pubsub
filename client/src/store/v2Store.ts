import { createScopedAppStore } from './createScopedStore'

/**
 * Sandbox store for the v2 Events / Experiences routes. Lives at a separate localStorage key so
 * v1 and v2 demo data do not overlap. Reuses every reducer/slice from `./index`.
 */
const v2 = createScopedAppStore('growthloop-poc-v2')

export const v2Store = v2.store
export const v2Persistor = v2.persistor
