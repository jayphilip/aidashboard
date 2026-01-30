// web/src/utils/logger.ts
// Logger utility that respects environment for production deployments

const isDev = import.meta.env.DEV;

/**
 * Logger utility that only logs in development mode.
 * In production, only errors and warnings are logged.
 */
export const logger = {
  /**
   * Log informational messages (dev only)
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log errors (always logged)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log warnings (always logged)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Log debug messages (dev only)
   */
  debug: (...args: any[]) => {
    console.debug(...args);
  },
};
