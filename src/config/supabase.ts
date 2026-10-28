export const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://fddvabezdjzmbbgftevy.supabase.co').trim();
export const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZHZhYmV6ZGp6bWJiZ2Z0ZXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTcyNjksImV4cCI6MjEwNzU3MzI2OX0.0hKR8kgzvroNcp7n1Z0XC3E-xtv08wOX9KDmwEHdPqM').trim();

export const isSupabaseConfigured = () => {
  const url = SUPABASE_URL.trim();
  const anonKey = SUPABASE_ANON_KEY.trim();

  return (
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    anonKey.length > 20 &&
    !url.includes('your-project') &&
    !anonKey.includes('your-')
  );
};

export const getSupabaseConfigError = () =>
  'Supabase credentials are not configured yet. Add your real project URL and anon key in src/config/supabase.ts or your environment variables to enable signup, login, and password reset.';

export const getSupabaseErrorMessage = (error: any) => {
  if (!error) {
    return 'Authentication failed. Please try again.';
  }

  if (typeof error === 'string') {
    return error;
  }

  const message = error?.message ?? error?.error_description ?? 'Authentication failed. Please try again.';

  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (message.toLowerCase().includes('user already registered') || message.toLowerCase().includes('already registered')) {
    return 'An account with this email already exists.';
  }

  if (message.toLowerCase().includes('email not confirmed')) {
    return 'Check your inbox and confirm your email before logging in.';
  }

  if (message.toLowerCase().includes('reset')) {
    return 'We could not send a password reset email. Please try again.';
  }

  if (message.toLowerCase().includes('missing')) {
    return 'Supabase is not configured for this build yet. Add the real project URL and anon key.';
  }

  return message;
};
