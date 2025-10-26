import { readFileSync } from 'fs';
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
export class EnvFileParser {
  /**
   * Parse .env file into map of variables
   *
   * @param filePath - Path to .env file
   * @returns Map of key to EnvVariable
   */
  parse(filePath: string): Map<string, EnvVariable> {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const variables = new Map<string, EnvVariable>();

    let multilineBuffer: string | null = null;
    let multilineStart = 0;
    let multilineKey = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle multiline continuation
      if (multilineBuffer !== null) {
        multilineBuffer += '\n' + line;

        if (this.isMultilineComplete(multilineBuffer)) {
          const variable = this.parseLine(multilineBuffer, multilineStart, multilineKey);
          if (variable) {
            variables.set(variable.key, variable);
          }
          multilineBuffer = null;
          multilineKey = '';
        }
        continue;
      }

      // Skip comments and empty lines
      if (this.isComment(line) || line.trim() === '') {
        continue;
      }

      // Check if line starts multiline value
      const multilineInfo = this.startsMultiline(line);
      if (multilineInfo) {
        multilineBuffer = line;
        multilineStart = i + 1;
        multilineKey = multilineInfo.key;
        continue;
      }

      // Parse single line
      const variable = this.parseLine(line, i + 1);
      if (variable) {
        variables.set(variable.key, variable);
      }
    }

    // Handle unclosed multiline (treat as error, but include what we have)
    if (multilineBuffer !== null) {
      console.warn(`Warning: Unclosed multiline value for ${multilineKey} at line ${multilineStart}`);
      const variable = this.parseLine(multilineBuffer, multilineStart, multilineKey);
      if (variable) {
        variables.set(variable.key, variable);
      }
    }

    return variables;
  }

  /**
   * Convert variable map back to .env format
   *
   * @param vars - Map of key to EnvVariable
   * @returns Formatted .env file content
   */
  stringify(vars: Map<string, EnvVariable>): string {
    const lines: string[] = [];

    // Sort by line number to maintain order
    const sorted = Array.from(vars.values()).sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0));

    for (const variable of sorted) {
      const { key, value, hasQuotes, quoteType, comment } = variable;

      let line = `${key}=`;

      if (hasQuotes && quoteType) {
        const quote = quoteType === 'single' ? "'" : '"';
        line += `${quote}${value}${quote}`;
      } else {
        line += value;
      }

      if (comment) {
        line += ` ${comment}`;
      }

      lines.push(line);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Parse a single line (or multiline buffer) into EnvVariable
   *
   * @param line - Line to parse
   * @param lineNumber - Line number in file
   * @param knownKey - Optional key if already parsed (for multiline)
   * @returns EnvVariable or null if invalid
   */
  private parseLine(line: string, lineNumber: number, knownKey?: string): EnvVariable | null {
    // Remove leading/trailing whitespace
    const trimmed = line.trim();

    // Skip if empty after trimming
    if (trimmed === '') {
      return null;
    }

    // Find first = sign
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      console.warn(`Warning: Invalid line ${lineNumber}: ${trimmed.substring(0, 50)}`);
      return null;
    }

    // Extract key
    const key = knownKey || trimmed.substring(0, equalIndex).trim();

    // Validate key (must be alphanumeric + underscore)
    if (!this.isValidKey(key)) {
      console.warn(`Warning: Invalid key "${key}" at line ${lineNumber}`);
      return null;
    }

    // Extract value part (everything after =)
    const valuePart = trimmed.substring(equalIndex + 1);

    // Parse value and detect quotes
    const valueInfo = this.parseValue(valuePart);

    return {
      key,
      value: valueInfo.value,
      lineNumber,
      comment: valueInfo.comment,
      hasQuotes: valueInfo.hasQuotes,
      quoteType: valueInfo.quoteType
    };
  }

  /**
   * Parse value part of KEY=VALUE
   *
   * @param valuePart - String after the = sign
   * @returns Parsed value information
   */
  private parseValue(valuePart: string): {
    value: string;
    hasQuotes: boolean;
    quoteType?: 'single' | 'double';
    comment?: string;
  } {
    const trimmed = valuePart.trim();

    // Check for quotes
    if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
      const quoteChar = trimmed[0];
      const quoteType = quoteChar === '"' ? 'double' : 'single';

      // Find closing quote
      let endIndex = 1;
      let escaped = false;

      while (endIndex < trimmed.length) {
        const char = trimmed[endIndex];

        if (escaped) {
          escaped = false;
          endIndex++;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          endIndex++;
          continue;
        }

        if (char === quoteChar) {
          // Found closing quote
          const value = trimmed.substring(1, endIndex);

          // Check for inline comment after quote
          const afterQuote = trimmed.substring(endIndex + 1).trim();
          const comment = this.extractInlineComment(afterQuote);

          return {
            value: this.unescapeValue(value, quoteType),
            hasQuotes: true,
            quoteType,
            comment
          };
        }

        endIndex++;
      }

      // No closing quote found (might be multiline)
      return {
        value: trimmed.substring(1),
        hasQuotes: true,
        quoteType
      };
    }

    // Unquoted value
    // Check for inline comment
    const commentIndex = this.findInlineComment(trimmed);

    if (commentIndex !== -1) {
      const value = trimmed.substring(0, commentIndex).trim();
      const comment = trimmed.substring(commentIndex);

      return {
        value,
        hasQuotes: false,
        comment
      };
    }

    return {
      value: trimmed,
      hasQuotes: false
    };
  }

  /**
   * Unescape value based on quote type
   *
   * @param value - Escaped value
   * @param quoteType - Type of quotes used
   * @returns Unescaped value
   */
  private unescapeValue(value: string, quoteType: 'single' | 'double'): string {
    if (quoteType === 'single') {
      // Single quotes: only escape single quote itself
      return value.replace(/\\'/g, "'");
    }

    // Double quotes: unescape common sequences
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Find index of inline comment (# or //)
   *
   * @param line - Line to search
   * @returns Index of comment start, or -1 if none
   */
  private findInlineComment(line: string): number {
    // Look for # or //
    const hashIndex = line.indexOf('#');
    const slashIndex = line.indexOf('//');

    if (hashIndex === -1 && slashIndex === -1) {
      return -1;
    }

    if (hashIndex === -1) return slashIndex;
    if (slashIndex === -1) return hashIndex;

    return Math.min(hashIndex, slashIndex);
  }

  /**
   * Extract inline comment from string
   *
   * @param str - String potentially containing comment
   * @returns Comment or undefined
   */
  private extractInlineComment(str: string): string | undefined {
    if (str.startsWith('#') || str.startsWith('//')) {
      return str;
    }
    return undefined;
  }

  /**
   * Check if line is a comment
   *
   * @param line - Line to check
   * @returns True if comment line
   */
  private isComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('#') || trimmed.startsWith('//');
  }

  /**
   * Check if line starts a multiline value
   *
   * @param line - Line to check
   * @returns Key if multiline starts, null otherwise
   */
  private startsMultiline(line: string): { key: string } | null {
    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) return null;

    const key = line.substring(0, equalIndex).trim();
    const valuePart = line.substring(equalIndex + 1).trim();

    // Check if value starts with quote but doesn't end with it
    if (valuePart.startsWith('"')) {
      // Count unescaped quotes
      let quoteCount = 0;
      let escaped = false;

      for (let i = 0; i < valuePart.length; i++) {
        const char = valuePart[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"') {
          quoteCount++;
        }
      }

      // Odd number of quotes = multiline
      if (quoteCount % 2 === 1) {
        return { key };
      }
    }

    if (valuePart.startsWith("'")) {
      // Same for single quotes
      let quoteCount = 0;
      let escaped = false;

      for (let i = 0; i < valuePart.length; i++) {
        const char = valuePart[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === "'") {
          quoteCount++;
        }
      }

      if (quoteCount % 2 === 1) {
        return { key };
      }
    }

    return null;
  }

  /**
   * Check if multiline value is complete
   *
   * @param buffer - Accumulated multiline buffer
   * @returns True if complete
   */
  private isMultilineComplete(buffer: string): boolean {
    // Find the quote type from first line
    const equalIndex = buffer.indexOf('=');
    if (equalIndex === -1) return false;

    const valuePart = buffer.substring(equalIndex + 1).trim();
    const quoteChar = valuePart[0];

    if (quoteChar !== '"' && quoteChar !== "'") {
      return false;
    }

    // Count unescaped quotes
    let quoteCount = 0;
    let escaped = false;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === quoteChar) {
        quoteCount++;
      }
    }

    // Even number of quotes = complete
    return quoteCount % 2 === 0 && quoteCount > 0;
  }

  /**
   * Validate environment variable key
   *
   * @param key - Key to validate
   * @returns True if valid
   */
  private isValidKey(key: string): boolean {
    // Must be alphanumeric + underscore, cannot start with number
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
  }
}
