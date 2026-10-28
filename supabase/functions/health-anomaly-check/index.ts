import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {z} from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const schema = z.object({
  user_id: z.string().uuid(),
  type: z.enum(['steps','heart_rate','hrv','sleep','calories_burned','body_temp']),
  value: z.number(),
  source: z.string().optional(),
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

    const isAnomaly =
      (parsed.data.type === 'steps' && parsed.data.value > 50000) ||
      (parsed.data.type === 'heart_rate' && (parsed.data.value < 30 || parsed.data.value > 220)) ||
      (parsed.data.type === 'sleep' && parsed.data.value > 24 * 60);

    return new Response(JSON.stringify({ok: true, accepted: !isAnomaly, flagged: isAnomaly}), {status: 200, headers: {'Content-Type': 'application/json'}});
  } catch (error) {
    return new Response(JSON.stringify({ok: false, code: 'INTERNAL_ERROR', message: String(error)}), {status: 500, headers: {'Content-Type': 'application/json'}});
  }
});
