/** When false (default), mock events + dynamic rules live in Redux (+ localStorage). When true, those features use the Fastify API + Supabase. */
export function backendStorageEnabled(): boolean {
  return import.meta.env.VITE_USE_BACKEND === 'true'
}

/**
 * When true, the app POSTs to `/api/personalization` on this origin (Fastify proxy or Vercel
 * `api/personalization.js`). Use with `VITE_USE_BACKEND=false` on Vercel so mock events stay local
 * while personalization still hits serverless.
 */
export function personalizationHttpEnabled(): boolean {
  return (
    import.meta.env.VITE_USE_BACKEND === 'true' ||
    import.meta.env.VITE_USE_VERCEL_API === 'true'
  )
}
