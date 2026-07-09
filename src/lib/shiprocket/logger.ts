/**
 * Lightweight, dependency-free logger for the Shiprocket integration.
 *
 * Every log line is prefixed and structured so that Shiprocket related events
 * can be easily grepped in Vercel / Hostinger logs. Sensitive values (password,
 * JWT token, auth headers) must never be passed in here.
 */

type LogLevel = 'info' | 'warn' | 'error';

/** Areas of the integration used to tag log lines for easy filtering. */
export type ShiprocketLogScope =
  | 'auth'
  | 'client'
  | 'serviceability'
  | 'order'
  | 'shipment'
  | 'pickup'
  | 'label'
  | 'invoice'
  | 'manifest'
  | 'tracking'
  | 'webhook';

/**
 * Emits a single structured log line.
 *
 * @param level - severity level
 * @param scope - which part of the integration produced the log
 * @param message - short human readable message
 * @param meta - optional structured metadata (never include secrets)
 */
function log(level: LogLevel, scope: ShiprocketLogScope, message: string, meta?: unknown): void {
  const prefix = `[shiprocket:${scope}]`;
  const payload = meta === undefined ? '' : safeStringify(meta);

  if (level === 'error') {
    console.error(prefix, message, payload);
  } else if (level === 'warn') {
    console.warn(prefix, message, payload);
  } else {
    console.log(prefix, message, payload);
  }
}

/** Safely serialize metadata, guarding against circular references. */
function safeStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return '[unserializable meta]';
  }
}

export const shiprocketLogger = {
  info: (scope: ShiprocketLogScope, message: string, meta?: unknown) => log('info', scope, message, meta),
  warn: (scope: ShiprocketLogScope, message: string, meta?: unknown) => log('warn', scope, message, meta),
  error: (scope: ShiprocketLogScope, message: string, meta?: unknown) => log('error', scope, message, meta),
};
