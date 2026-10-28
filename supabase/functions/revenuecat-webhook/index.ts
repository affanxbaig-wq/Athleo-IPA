import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {z} from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const schema = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string().optional(),
    product_id: z.string().optional(),
  }),
});

Deno.serve(async req => {
  try {
    const secret = req.headers.get('x-revenuecat-signature');
    if (!secret) {
      return new Response(JSON.stringify({ok: false, code: 'UNAUTHORIZED'}), {status: 401, headers: {'Content-Type': 'application/json'}});
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ok: false, code: 'INVALID_BODY', errors: parsed.error.issues}), {status: 400, headers: {'Content-Type': 'application/json'}});
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const {error} = await supabase.from('subscriptions').upsert({
      user_id: parsed.data.event.app_user_id ?? '',
      entitlement: parsed.data.event.product_id ?? 'premium',
      status: 'active',
      updated_at: new Date().toISOString(),
    }, {onConflict: 'user_id'});

    if (error) {
      return new Response(JSON.stringify({ok: false, code: 'DB_ERROR', message: error.message}), {status: 500, headers: {'Content-Type': 'application/json'}});
    }

    return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'Content-Type': 'application/json'}});
  } catch (error) {
    return new Response(JSON.stringify({ok: false, code: 'INTERNAL_ERROR', message: String(error)}), {status: 500, headers: {'Content-Type': 'application/json'}});
  }
});
