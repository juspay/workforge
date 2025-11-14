/**
 * String utility functions
 */

/**
 * Convert any string to kebab-case format
 *
 * Handles:
 * - Multiple spaces
 * - Underscores
 * - Special characters
 * - Mixed case
 * - Already kebab-case strings (idempotent)
 *
 * @param input - String to convert
 * @returns Kebab-case string
 *
 * @example
 * toKebabCase('Switch Merchants should match Mobile app')
 * // Returns: 'switch-merchants-should-match-mobile-app'
 *
 * toKebabCase('my_feature_name')
 * // Returns: 'my-feature-name'
 *
 * toKebabCase('Fix: Bug #123')
 * // Returns: 'fix-bug-123'
 */
export function toKebabCase(input: string): string {
  return input
    .trim()                              // Remove leading/trailing whitespace
    .toLowerCase()                       // Convert to lowercase
    .replace(/[\s_]+/g, '-')            // Replace spaces and underscores with hyphens
    .replace(/[^a-z0-9\-]/g, '')        // Remove all non-alphanumeric except hyphens
    .replace(/-+/g, '-')                // Collapse multiple hyphens to single
    .replace(/^-+|-+$/g, '');           // Remove leading/trailing hyphens
}
