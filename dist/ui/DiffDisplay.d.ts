import { EnvDiff } from '../types/index.js';
import { Logger } from './Logger.js';
/**
 * Diff Display
 *
 * Displays side-by-side comparison of environment variable changes
 * with color-coded indicators:
 * - Green: Added variables
 * - Red: Removed variables
 * - Yellow: Modified variables
 * - Gray: Summary of unchanged variables
 */
export declare class DiffDisplay {
    private logger;
    private readonly maxValueLength;
    private readonly columnWidth;
    constructor(logger?: Logger);
    /**
     * Display complete diff with all sections
     *
     * @param diff - EnvDiff object to display
     */
    show(diff: EnvDiff): void;
    /**
     * Print header with source/target information
     */
    private printHeader;
    /**
     * Print added variables section
     */
    private printAdded;
    /**
     * Print modified variables section with side-by-side comparison
     */
    private printModified;
    /**
     * Print removed variables section
     */
    private printRemoved;
    /**
     * Print summary of unchanged variables
     */
    private printUnchangedSummary;
    /**
     * Print footer with summary statistics
     */
    private printFooter;
    /**
     * Display a compact summary (without full diff)
     */
    showSummary(diff: EnvDiff): void;
    /**
     * Display diff in table format
     */
    showTable(diff: EnvDiff): void;
    /**
     * Display warning if no changes found
     */
    showNoChanges(): void;
    /**
     * Truncate long values for display
     *
     * @param value - Value to truncate
     * @param maxLength - Maximum length (default: this.maxValueLength)
     * @returns Truncated value
     */
    private truncate;
    /**
     * Format quoted value for display
     *
     * @param value - Value to format
     * @param quoteType - Type of quotes
     * @returns Formatted value
     */
    private formatQuotedValue;
    /**
     * Pad string to specified width
     *
     * @param str - String to pad
     * @param width - Target width
     * @returns Padded string
     */
    private pad;
}
//# sourceMappingURL=DiffDisplay.d.ts.map