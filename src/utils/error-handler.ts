import { showSnackbar } from '@openmrs/esm-framework';

export enum LogLevel {
  WARN = 'warn',
  ERROR = 'error',
}

export interface ErrorContext {
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface UserFeedbackOptions {
  title: string;
  subtitle?: string;
  kind: 'error' | 'warning' | 'info' | 'success';
  timeoutInMs?: number;
}

class ErrorHandler {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Logs messages to console only in development mode
   * Only logs errors and warnings - no info/debug to avoid unexpected console usage
   */
  private log(level: LogLevel, message: string, data?: any, context?: ErrorContext) {
    if (!this.isDevelopment) return;

    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context.component}${context.action ? `::${context.action}` : ''}]` : '';
    const logMessage = `${timestamp}${contextStr} ${message}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, data);
        break;
    }
  }

  /**
   * Handles errors with optional user feedback
   */
  handleError(error: Error | string, context?: ErrorContext, userFeedback?: UserFeedbackOptions) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorData = error instanceof Error ? { stack: error.stack, ...context?.metadata } : context?.metadata;

    this.log(LogLevel.ERROR, errorMessage, errorData, context);

    if (userFeedback) {
      showSnackbar({
        title: userFeedback.title,
        subtitle: userFeedback.subtitle || errorMessage,
        kind: userFeedback.kind,
        timeoutInMs: userFeedback.timeoutInMs,
      });
    }
  }

  /**
   * Handles warnings with optional user feedback
   */
  handleWarning(message: string, data?: any, context?: ErrorContext, userFeedback?: UserFeedbackOptions) {
    this.log(LogLevel.WARN, message, data, context);

    if (userFeedback) {
      showSnackbar({
        title: userFeedback.title,
        subtitle: userFeedback.subtitle || message,
        kind: userFeedback.kind,
        timeoutInMs: userFeedback.timeoutInMs,
      });
    }
  }

  /**
   * Handles info messages with user feedback only (no console logging)
   */
  handleInfo(message: string, data?: any, context?: ErrorContext, userFeedback?: UserFeedbackOptions) {
    // Only show user feedback for info messages, no console logging
    if (userFeedback) {
      showSnackbar({
        title: userFeedback.title,
        subtitle: userFeedback.subtitle || message,
        kind: userFeedback.kind,
        timeoutInMs: userFeedback.timeoutInMs,
      });
    }
  }

  /**
   * Wraps async functions with error handling
   */
  async wrapAsync<T>(
    asyncFn: () => Promise<T>,
    context?: ErrorContext,
    userFeedback?: UserFeedbackOptions,
  ): Promise<T | null> {
    try {
      return await asyncFn();
    } catch (error) {
      this.handleError(error as Error, context, userFeedback);
      return null;
    }
  }

  /**
   * Creates a reusable error handler for specific components
   */
  createComponentHandler(component: string) {
    return {
      error: (
        error: Error | string,
        action?: string,
        userFeedback?: UserFeedbackOptions,
        metadata?: Record<string, any>,
      ) => this.handleError(error, { component, action, metadata }, userFeedback),

      warning: (message: string, action?: string, userFeedback?: UserFeedbackOptions, data?: any) =>
        this.handleWarning(message, data, { component, action }, userFeedback),

      info: (message: string, action?: string, userFeedback?: UserFeedbackOptions, data?: any) =>
        this.handleInfo(message, data, { component, action }, userFeedback),

      wrapAsync: async <T>(
        asyncFn: () => Promise<T>,
        action?: string,
        userFeedback?: UserFeedbackOptions,
      ): Promise<T | null> => this.wrapAsync(asyncFn, { component, action }, userFeedback),
    };
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export common error feedback messages
export const commonErrorMessages = {
  fetchError: {
    title: 'Failed to Load Data',
    subtitle: 'Unable to retrieve the requested information. Please try again.',
    kind: 'error' as const,
  },
  saveError: {
    title: 'Save Failed',
    subtitle: 'Unable to save your changes. Please try again.',
    kind: 'error' as const,
  },
  networkError: {
    title: 'Network Error',
    subtitle: 'Please check your internet connection and try again.',
    kind: 'error' as const,
  },
  validationError: {
    title: 'Validation Error',
    subtitle: 'Please check your input and try again.',
    kind: 'error' as const,
  },
  unexpectedError: {
    title: 'Unexpected Error',
    subtitle: 'Something went wrong. Please try again or contact support.',
    kind: 'error' as const,
  },
} as const;
