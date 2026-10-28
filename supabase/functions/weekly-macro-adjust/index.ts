import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {z} from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const schema = z.object({
  user_id: z.string().uuid().optional(),
});

Deno.serve(async req => {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ok: false, code: 'INVALID_BODY', errors: parsed.error.issues}), {status: 400, headers: {'Content-Type': 'application/json'}});
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const {data: users} = await supabase.from('profiles').select('id');
    const rows = users ?? [];

    return new Response(JSON.stringify({ok: true, processed: rows.length}), {status: 200, headers: {'Content-Type': 'application/json'}});
  } catch (error) {
    return new Response(JSON.stringify({ok: false, code: 'INTERNAL_ERROR', message: String(error)}), {status: 500, headers: {'Content-Type': 'application/json'}});
  }
});
