import type { FastifyInstance } from 'fastify';
import { dynamicContentInputSchema } from '../types.js';
import { getSupabase } from '../lib/supabase.js';

const SINGLETON_ID = '00000000-0000-4000-8000-000000000001';

export async function dynamicContentRoutes(app: FastifyInstance) {
  app.get('/api/dynamic-content', async (_req, reply) => {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('dynamic_content')
      .select('*')
      .eq('id', SINGLETON_ID)
      .maybeSingle();

    if (error) {
      reply.code(500);
      return { error: error.message };
    }

    if (!data) {
      return {
        content: {
          id: SINGLETON_ID,
          title: 'Dynamic hero',
          field_path: '',
          default_image_url: null as string | null,
          mappings: [] as { value: string; imageUrl: string }[],
        },
      };
    }

    return {
      content: {
        id: data.id,
        title: data.title,
        field_path: data.field_path,
        default_image_url: data.default_image_url,
        mappings: Array.isArray(data.mappings) ? data.mappings : [],
      },
    };
  });

  app.put('/api/dynamic-content', async (req, reply) => {
    const parsed = dynamicContentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid body', details: parsed.error.flatten() };
    }

    const sb = getSupabase();
    const mappings = parsed.data.mappings.map((m) => ({
      value: m.value,
      imageUrl: m.imageUrl,
    }));

    const { data, error } = await sb
      .from('dynamic_content')
      .upsert(
        {
          id: SINGLETON_ID,
          title: parsed.data.title ?? 'Dynamic hero',
          field_path: parsed.data.fieldPath,
          default_image_url: parsed.data.defaultImageUrl ?? null,
          mappings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();

    if (error) {
      reply.code(500);
      return { error: error.message };
    }

    return { content: data };
  });
}
