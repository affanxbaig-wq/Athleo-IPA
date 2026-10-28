// Web OAuth Client ID — used as webClientId in GoogleSignin.configure()
export const GOOGLE_WEB_CLIENT_ID = (
  (process.env.GOOGLE_WEB_CLIENT_ID || '112858469682-pcqloq3pkcfrj0bq6p7re83h2flh3l4p.apps.googleusercontent.com').trim()
);

// iOS Client ID — not needed for Android builds
export const GOOGLE_IOS_CLIENT_ID = (
  (process.env.GOOGLE_IOS_CLIENT_ID || '').trim()
);

export const isGoogleAuthConfigured = () => {
  const valid = !!GOOGLE_WEB_CLIENT_ID && !GOOGLE_WEB_CLIENT_ID.includes('YOUR_') && GOOGLE_WEB_CLIENT_ID.length > 15;
  return valid;
};
