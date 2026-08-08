/**
 * String utility functions
 */

/**
 * Render a value safely on a single terminal line.
 *
 * Environment values may legitimately contain newlines, carriage returns and
 * tabs. Printed raw they break the diff layout and, worse, corrupt inquirer's
 * checkbox list — so the user can end up approving something other than what
 * they appear to be looking at. Control characters are escaped visibly rather
 * than stripped, so nothing silently disappears from the preview.
 *
 * @param value - Raw value
 * @returns Single-line representation
 *
 * @example
 * toSingleLine('line1\nline2')
 * // Returns: 'line1\\nline2'
 */
export function toSingleLine(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    // Remaining C0 controls (and DEL) have no printable form.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '?');
}

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
