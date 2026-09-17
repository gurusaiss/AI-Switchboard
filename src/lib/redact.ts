// Redacts anything that looks like an API key / secret token before it can reach
// server logs. Used by the logger wrapper and should be applied to any object that
// might get console.logged (errors, request bodies, etc).

const KEY_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{10,}/g, // OpenAI-style
  /sk-ant-[A-Za-z0-9_-]{10,}/g, // Anthropic-style
  /AIza[A-Za-z0-9_-]{20,}/g, // Google API key style
  /or-[A-Za-z0-9_-]{10,}/g, // OpenRouter-style
  /Bearer\s+[A-Za-z0-9._-]{10,}/gi,
  /"?apiKey"?\s*[:=]\s*"[^"]{6,}"/gi,
  /"?api_key"?\s*[:=]\s*"[^"]{6,}"/gi,
];

export function redactString(input: string): string {
  let out = input;
  for (const pattern of KEY_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

/** Deep-redacts strings anywhere inside an object/array before logging. */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return redactString(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactDeep(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/api[_-]?key|secret|token|password/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactDeep(v);
      }
    }
    return out as unknown as T;
  }
  return value;
}

/** Safe logger: always redacts before writing to the console. Use instead of console.* */
export const safeLog = {
  info: (...args: unknown[]) => console.log(...args.map((a) => redactDeep(a))),
  warn: (...args: unknown[]) => console.warn(...args.map((a) => redactDeep(a))),
  error: (...args: unknown[]) => console.error(...args.map((a) => redactDeep(a))),
};
