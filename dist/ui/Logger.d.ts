import { ConfigManager } from '../core/ConfigManager.js';
/**
 * Logger
 *
 * Centralized logging utility that respects user configuration for:
 * - Color output (config.display.colorEnabled)
 * - Verbose mode (config.display.verboseOutput)
 * - Progress indicators (config.display.showProgressIndicators)
 */
export declare class Logger {
    private configManager;
    private colorEnabled;
    private verboseMode;
    private showProgress;
    constructor(configManager?: ConfigManager);
    /**
     * Load display configuration
     */
    private loadConfig;
    /**
     * Reload configuration (useful after config changes)
     */
    reload(): void;
    /**
     * Apply color if enabled
     */
    private applyColor;
    /**
     * Info message (always shown)
     */
    info(message: string): void;
    /**
     * Success message (always shown)
     */
    success(message: string): void;
    /**
     * Warning message (always shown)
     */
    warning(message: string): void;
    /**
     * Error message (always shown)
     */
    error(message: string): void;
    /**
     * Debug message (only shown in verbose mode)
     */
    debug(message: string): void;
    /**
     * Verbose message (only shown in verbose mode)
     */
    verbose(message: string): void;
    /**
     * Section header
     */
    header(message: string): void;
    /**
     * Section subheader
     */
    subheader(message: string): void;
    /**
     * Dim text
     */
    dim(message: string): void;
    /**
     * Bold text
     */
    bold(message: string): void;
    /**
     * Newline
     */
    newline(): void;
    /**
     * Horizontal line separator
     */
    separator(): void;
    /**
     * Progress indicator - start
     */
    startProgress(message: string): ProgressIndicator | null;
    /**
     * List item (bullet point)
     */
    listItem(message: string, indent?: number): void;
    /**
     * Key-value pair display
     */
    keyValue(key: string, value: string, indent?: number): void;
    /**
     * Table row (aligned columns)
     */
    tableRow(columns: string[], widths: number[]): void;
    /**
     * Confirmation prompt message
     */
    confirm(message: string): void;
    /**
     * Step indicator (e.g., "Step 1/5:")
     */
    step(current: number, total: number, message: string): void;
    /**
     * Box message (surrounded by border)
     */
    box(message: string, style?: 'info' | 'success' | 'warning' | 'error'): void;
    /**
     * Diff line (for showing changes)
     */
    diffAdded(message: string): void;
    diffRemoved(message: string): void;
    diffModified(message: string): void;
    diffUnchanged(message: string): void;
}
/**
 * Progress Indicator
 *
 * Shows animated progress for long-running operations
 */
export declare class ProgressIndicator {
    private message;
    private colorEnabled;
    private interval;
    private frame;
    private readonly frames;
    constructor(message: string, colorEnabled: boolean);
    /**
     * Start the animation
     */
    private start;
    /**
     * Update the message
     */
    update(message: string): void;
    /**
     * Stop the animation with success
     */
    succeed(message?: string): void;
    /**
     * Stop the animation with failure
     */
    fail(message?: string): void;
    /**
     * Stop the animation with warning
     */
    warn(message?: string): void;
    /**
     * Stop the animation with info
     */
    info(message?: string): void;
    /**
     * Stop the animation
     */
    private stop;
}
export declare function getLogger(): Logger;
/**
 * Convenience exports for common operations
 */
export declare const log: {
    info: (message: string) => void;
    success: (message: string) => void;
    warning: (message: string) => void;
    error: (message: string) => void;
    debug: (message: string) => void;
    verbose: (message: string) => void;
    header: (message: string) => void;
    subheader: (message: string) => void;
    dim: (message: string) => void;
    bold: (message: string) => void;
    newline: () => void;
    separator: () => void;
    startProgress: (message: string) => ProgressIndicator | null;
    listItem: (message: string, indent?: number) => void;
    keyValue: (key: string, value: string, indent?: number) => void;
    tableRow: (columns: string[], widths: number[]) => void;
    confirm: (message: string) => void;
    step: (current: number, total: number, message: string) => void;
    box: (message: string, style?: "info" | "success" | "warning" | "error") => void;
    diffAdded: (message: string) => void;
    diffRemoved: (message: string) => void;
    diffModified: (message: string) => void;
    diffUnchanged: (message: string) => void;
};
//# sourceMappingURL=Logger.d.ts.map