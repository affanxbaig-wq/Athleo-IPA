import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {z} from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const schema = z.object({
  user_id: z.string().uuid(),
  event_type: z.string().min(1),
  related_entity_id: z.string().uuid().nullable().optional(),
  xp_awarded: z.number().int().min(0),
});

Deno.serve(async req => {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ok: false, code: 'INVALID_BODY', errors: parsed.error.issues}), {status: 400, headers: {'Content-Type': 'application/json'}});
    }

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ok: false, code: 'UNAUTHORIZED'}), {status: 401, headers: {'Content-Type': 'application/json'}});
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {persistSession: false, autoRefreshToken: false},
    });

    const {data: {user}} = await supabase.auth.getUser(jwt);
    if (!user) {
      return new Response(JSON.stringify({ok: false, code: 'UNAUTHORIZED'}), {status: 401, headers: {'Content-Type': 'application/json'}});
    }

    const {error} = await supabase.from('xp_events').insert({
      user_id: parsed.data.user_id,
      event_type: parsed.data.event_type,
      related_entity_id: parsed.data.related_entity_id ?? null,
      xp_awarded: parsed.data.xp_awarded,
    });

    if (error) {
      return new Response(JSON.stringify({ok: false, code: 'DB_ERROR', message: error.message}), {status: 500, headers: {'Content-Type': 'application/json'}});
    }

    return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'Content-Type': 'application/json'}});
  } catch (error) {
    return new Response(JSON.stringify({ok: false, code: 'INTERNAL_ERROR', message: String(error)}), {status: 500, headers: {'Content-Type': 'application/json'}});
  }
});
