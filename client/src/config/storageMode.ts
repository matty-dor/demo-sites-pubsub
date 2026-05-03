/** When false (default), mock events + dynamic rules + simulated personalization live in Redux (+ localStorage). When true, those features use the Fastify API instead. */
export function backendStorageEnabled(): boolean {
  return import.meta.env.VITE_USE_BACKEND === 'true'
}
