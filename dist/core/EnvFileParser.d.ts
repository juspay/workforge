import { EnvVariable } from '../types/index.js';
/**
 * Environment File Parser
 *
 * Parses .env files into structured format, handling all edge cases:
 * - Comments (# and //)
 * - Empty lines
 * - Quoted values (single and double quotes)
 * - Multi-line values
 * - Inline comments
 * - Escape sequences
 */
export declare class EnvFileParser {
    /**
     * Parse .env file into map of variables
     *
     * @param filePath - Path to .env file
     * @returns Map of key to EnvVariable
     */
    parse(filePath: string): Map<string, EnvVariable>;
    /**
     * Convert variable map back to .env format
     *
     * @param vars - Map of key to EnvVariable
     * @returns Formatted .env file content
     */
    stringify(vars: Map<string, EnvVariable>): string;
    /**
     * Parse a single line (or multiline buffer) into EnvVariable
     *
     * @param line - Line to parse
     * @param lineNumber - Line number in file
     * @param knownKey - Optional key if already parsed (for multiline)
     * @returns EnvVariable or null if invalid
     */
    private parseLine;
    /**
     * Parse value part of KEY=VALUE
     *
     * @param valuePart - String after the = sign
     * @returns Parsed value information
     */
    private parseValue;
    /**
     * Unescape value based on quote type
     *
     * @param value - Escaped value
     * @param quoteType - Type of quotes used
     * @returns Unescaped value
     */
    private unescapeValue;
    /**
     * Find index of inline comment (# or //)
     *
     * @param line - Line to search
     * @returns Index of comment start, or -1 if none
     */
    private findInlineComment;
    /**
     * Extract inline comment from string
     *
     * @param str - String potentially containing comment
     * @returns Comment or undefined
     */
    private extractInlineComment;
    /**
     * Check if line is a comment
     *
     * @param line - Line to check
     * @returns True if comment line
     */
    private isComment;
    /**
     * Check if line starts a multiline value
     *
     * @param line - Line to check
     * @returns Key if multiline starts, null otherwise
     */
    private startsMultiline;
    /**
     * Check if multiline value is complete
     *
     * @param buffer - Accumulated multiline buffer
     * @returns True if complete
     */
    private isMultilineComplete;
    /**
     * Validate environment variable key
     *
     * @param key - Key to validate
     * @returns True if valid
     */
    private isValidKey;
}
//# sourceMappingURL=EnvFileParser.d.ts.map