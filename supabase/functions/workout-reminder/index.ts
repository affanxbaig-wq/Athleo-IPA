import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

interface WorkoutReminderPayload {
  user_id?: string;
  action?: 'evaluate_all' | 'send_user_reminder' | 'preview';
}

Deno.serve(async req => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ok: false, error: 'SUPABASE_ENV_MISSING'}), {
        status: 500,
        headers: {'Content-Type': 'application/json'},
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {persistSession: false, autoRefreshToken: false},
    });

    let body: WorkoutReminderPayload = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    let targetUserId = body.user_id;
    if (!targetUserId && token) {
      const {data: {user}} = await supabase.auth.getUser(token);
      if (user) {
        targetUserId = user.id;
      }
    }

    // Single User Reminder Preview / Generation
    if (targetUserId) {
      const {data: scheduleData} = await supabase
        .from('user_workout_schedules')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

      const {data: profileData, error: profErr} = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (profErr || !profileData) {
        return new Response(JSON.stringify({ok: false, error: 'USER_PROFILE_NOT_FOUND'}), {
          status: 404,
          headers: {'Content-Type': 'application/json'},
        });
      }

      // Re-generate the reminder using SQL RPC
      const {data: reminderResult, error: remErr} = await supabase.rpc('generate_workout_goal_reminder', {
        p_user_id: targetUserId,
      });

      if (remErr) {
        return new Response(JSON.stringify({ok: false, error: remErr.message}), {
          status: 500,
          headers: {'Content-Type': 'application/json'},
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          action: 'user_reminder_ready',
          data: {
            user_id: targetUserId,
            timezone: scheduleData?.timezone ?? profileData.timezone ?? 'UTC',
            country: scheduleData?.country ?? profileData.country,
            region: scheduleData?.region ?? profileData.region,
            workout_time: scheduleData?.workout_time ?? '07:00 AM',
            workout_days: scheduleData?.workout_days ?? ['Monday', 'Wednesday', 'Friday'],
            selected_exercises: scheduleData?.selected_exercises ?? [],
            reminder: reminderResult,
          },
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      );
    }

    // Cron evaluation of pending workout reminders
    const {data: pendingReminders, error: queryErr} = await supabase
      .from('workout_reminders')
      .select('*, profiles(id, email, display_name)')
      .eq('status', 'scheduled')
      .limit(50);

    if (queryErr) {
      return new Response(JSON.stringify({ok: false, error: queryErr.message}), {
        status: 500,
        headers: {'Content-Type': 'application/json'},
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        evaluated_count: pendingReminders?.length ?? 0,
        reminders: pendingReminders ?? [],
      }),
      {status: 200, headers: {'Content-Type': 'application/json'}},
    );
  } catch (error) {
    return new Response(JSON.stringify({ok: false, error: String(error)}), {
      status: 500,
      headers: {'Content-Type': 'application/json'},
    });
  }
});
