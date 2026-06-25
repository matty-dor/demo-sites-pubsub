import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  port: Number(process.env.PORT) || 3001,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  supabaseUrl: optional('SUPABASE_URL'),
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),

  personalizationBaseUrl: optional('PERSONALIZATION_API_BASE_URL'),
  personalizationApiKey: optional('PERSONALIZATION_API_KEY'),
  /** Path appended to base with {{customerId}} replaced (encodeURIComponent). Example: v1/users/{{customerId}}/traits */
  personalizationPathTemplate: optional('PERSONALIZATION_API_PATH_TEMPLATE'),

  growthloopApiBaseUrl: optional('GROWTHLOOP_API_BASE_URL'),
  growthloopApiToken: optional('GROWTHLOOP_API_TOKEN'),
  growthloopApiAccessKey: optional('GROWTHLOOP_API_ACCESS_KEY'),
};

export function assertSupabase(): { url: string; key: string } {
  return {
    url: required('SUPABASE_URL'),
    key: required('SUPABASE_SERVICE_ROLE_KEY'),
  };
}
