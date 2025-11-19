/**
 * Structured Logging Module
 *
 * Provides a centralized logger with log levels and timestamps
 * for better debugging and monitoring.
 */

import pino from "pino";

// Configure pino logger based on environment
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

export default logger;
