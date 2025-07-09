/**
 * Common logger utility with JSON format
 * Provides consistent logging structure across the application
 */

export interface LogContext {
  tenantId?: string | null;
  appId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  tenantId: string | null;
  appId: string | null;
  userId: string | null;
  "x3-header": string | null;
  [key: string]: any;
}

export class Logger {
  private static formatLog(message: string, context: LogContext = {}, additionalData: any = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      message,
      tenantId: context.tenantId || 'system',
      appId: context.appId || 'system',
      userId: context.userId || 'system',
      ...additionalData
    };
  }


  static error(message: string, context: LogContext = {}, additionalData: any = {}): void {
    const logEntry = this.formatLog(message, context, additionalData);
    console.error(JSON.stringify(logEntry));
  }

  static warn(message: string, context: LogContext = {}, additionalData: any = {}): void {
    const logEntry = this.formatLog(message, context, additionalData);
    console.warn(JSON.stringify(logEntry));
  }

  static info(message: string, context: LogContext = {}, additionalData: any = {}): void {
    const logEntry = this.formatLog(message, context, additionalData);
    console.info(JSON.stringify(logEntry));
  }

  static debug(message: string, context: LogContext = {}, additionalData: any = {}): void {
    const logEntry = this.formatLog(message, context, additionalData);
    console.debug(JSON.stringify(logEntry));
  }
}

// Convenience functions for common logging patterns
export const logger = Logger;