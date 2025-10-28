import { ErrorLike } from '../types/index.js';

/**
 * Safely normalize any thrown value to an Error-like object
 *
 * JavaScript allows throwing any value (strings, numbers, objects, etc.)
 * This utility ensures we always have a consistent error structure to work with.
 *
 * @param error - Any value that was thrown
 * @returns Normalized error object with message, name, and optional stack
 */
export function toError(error: unknown): ErrorLike {
  // Already an Error instance
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
  }

  // Object with message property
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return {
      message: (error as { message: string }).message,
      name: 'Error'
    };
  }

  // Primitive or other type - stringify
  return {
    message: String(error),
    name: 'Error'
  };
}

/**
 * Extract error message safely from any thrown value
 *
 * @param error - Any value that was thrown
 * @returns Error message as string
 */
export function getErrorMessage(error: unknown): string {
  return toError(error).message;
}
