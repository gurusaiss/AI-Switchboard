// Centralized, validated access to required environment variables.
// Throws loudly at startup rather than silently proceeding with undefined secrets.

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }
  return v;
}

export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL || './data/dev.db';
  },
  get kekBase64() {
    return required('KEK_BASE64');
  },
  get sessionSecret() {
    return required('SESSION_SECRET');
  },
  get insecureCookies() {
    return process.env.INSECURE_COOKIES === 'true';
  },
};
