import chalk from 'chalk';
import { ConfigManager } from '../core/ConfigManager.js';
/**
 * Logger
 *
 * Centralized logging utility that respects user configuration for:
 * - Color output (config.display.colorEnabled)
 * - Verbose mode (config.display.verboseOutput)
 * - Progress indicators (config.display.showProgressIndicators)
 */
export class Logger {
    configManager;
    colorEnabled;
    verboseMode;
    showProgress;
    constructor(configManager) {
        this.configManager = configManager || new ConfigManager();
        this.loadConfig();
    }
    /**
     * Load display configuration
     */
    loadConfig() {
        try {
            const config = this.configManager.load();
            this.colorEnabled = config.display.colorEnabled;
            this.verboseMode = config.display.verboseOutput;
            this.showProgress = config.display.showProgressIndicators;
        }
        catch {
            // Fallback to defaults if config loading fails
            this.colorEnabled = true;
            this.verboseMode = false;
            this.showProgress = true;
        }
    }
    /**
     * Reload configuration (useful after config changes)
     */
    reload() {
        this.loadConfig();
    }
    /**
     * Apply color if enabled
     */
    applyColor(colorFn, text) {
        return this.colorEnabled ? colorFn(text) : text;
    }
    /**
     * Info message (always shown)
     */
    info(message) {
        console.log(this.applyColor(chalk.blue, message));
    }
    /**
     * Success message (always shown)
     */
    success(message) {
        console.log(this.applyColor(chalk.green, `✓ ${message}`));
    }
    /**
     * Warning message (always shown)
     */
    warning(message) {
        console.log(this.applyColor(chalk.yellow, `⚠ ${message}`));
    }
    /**
     * Error message (always shown)
     */
    error(message) {
        console.error(this.applyColor(chalk.red, `✗ ${message}`));
    }
    /**
     * Debug message (only shown in verbose mode)
     */
    debug(message) {
        if (this.verboseMode) {
            console.log(this.applyColor(chalk.gray, `[DEBUG] ${message}`));
        }
    }
    /**
     * Verbose message (only shown in verbose mode)
     */
    verbose(message) {
        if (this.verboseMode) {
            console.log(this.applyColor(chalk.dim, message));
        }
    }
    /**
     * Section header
     */
    header(message) {
        console.log(this.applyColor(chalk.bold.blue, `\n${message}`));
    }
    /**
     * Section subheader
     */
    subheader(message) {
        console.log(this.applyColor(chalk.bold, message));
    }
    /**
     * Dim text
     */
    dim(message) {
        console.log(this.applyColor(chalk.dim, message));
    }
    /**
     * Bold text
     */
    bold(message) {
        console.log(this.applyColor(chalk.bold, message));
    }
    /**
     * Newline
     */
    newline() {
        console.log();
    }
    /**
     * Horizontal line separator
     */
    separator() {
        console.log(this.applyColor(chalk.gray, '─'.repeat(60)));
    }
    /**
     * Progress indicator - start
     */
    startProgress(message) {
        if (!this.showProgress) {
            this.info(message);
            return null;
        }
        return new ProgressIndicator(message, this.colorEnabled);
    }
    /**
     * List item (bullet point)
     */
    listItem(message, indent = 0) {
        const indentation = '  '.repeat(indent);
        console.log(this.applyColor(chalk.gray, `${indentation}• `) + message);
    }
    /**
     * Key-value pair display
     */
    keyValue(key, value, indent = 0) {
        const indentation = '  '.repeat(indent);
        const coloredKey = this.applyColor(chalk.cyan, `${key}:`);
        console.log(`${indentation}${coloredKey} ${value}`);
    }
    /**
     * Table row (aligned columns)
     */
    tableRow(columns, widths) {
        let row = '';
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i] || '';
            const width = widths[i] || 20;
            row += column.padEnd(width, ' ') + '  ';
        }
        console.log(row.trimEnd());
    }
    /**
     * Confirmation prompt message
     */
    confirm(message) {
        console.log(this.applyColor(chalk.yellow, `? ${message}`));
    }
    /**
     * Step indicator (e.g., "Step 1/5:")
     */
    step(current, total, message) {
        const stepText = this.applyColor(chalk.cyan, `[${current}/${total}]`);
        console.log(`${stepText} ${message}`);
    }
    /**
     * Box message (surrounded by border)
     */
    box(message, style = 'info') {
        const lines = message.split('\n');
        const maxLength = Math.max(...lines.map(l => l.length));
        const width = Math.min(maxLength + 4, 80);
        let colorFn;
        switch (style) {
            case 'success':
                colorFn = chalk.green;
                break;
            case 'warning':
                colorFn = chalk.yellow;
                break;
            case 'error':
                colorFn = chalk.red;
                break;
            default:
                colorFn = chalk.blue;
        }
        const border = this.applyColor(colorFn, '─'.repeat(width));
        console.log(this.applyColor(colorFn, `┌${border}┐`));
        for (const line of lines) {
            const paddedLine = line.padEnd(width - 2, ' ');
            console.log(this.applyColor(colorFn, '│ ') + paddedLine + this.applyColor(colorFn, ' │'));
        }
        console.log(this.applyColor(colorFn, `└${border}┘`));
    }
    /**
     * Diff line (for showing changes)
     */
    diffAdded(message) {
        console.log(this.applyColor(chalk.green, `+ ${message}`));
    }
    diffRemoved(message) {
        console.log(this.applyColor(chalk.red, `- ${message}`));
    }
    diffModified(message) {
        console.log(this.applyColor(chalk.yellow, `~ ${message}`));
    }
    diffUnchanged(message) {
        console.log(this.applyColor(chalk.dim, `  ${message}`));
    }
}
/**
 * Progress Indicator
 *
 * Shows animated progress for long-running operations
 */
export class ProgressIndicator {
    message;
    colorEnabled;
    interval = null;
    frame = 0;
    frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    constructor(message, colorEnabled) {
        this.message = message;
        this.colorEnabled = colorEnabled;
        this.start();
    }
    /**
     * Start the animation
     */
    start() {
        // Hide cursor
        process.stdout.write('\x1B[?25l');
        this.interval = setInterval(() => {
            const spinner = this.frames[this.frame];
            const text = this.colorEnabled ? chalk.cyan(spinner) : spinner;
            process.stdout.write(`\r${text} ${this.message}`);
            this.frame = (this.frame + 1) % this.frames.length;
        }, 80);
    }
    /**
     * Update the message
     */
    update(message) {
        this.message = message;
    }
    /**
     * Stop the animation with success
     */
    succeed(message) {
        this.stop();
        const finalMessage = message || this.message;
        const checkmark = this.colorEnabled ? chalk.green('✓') : '✓';
        console.log(`${checkmark} ${finalMessage}`);
    }
    /**
     * Stop the animation with failure
     */
    fail(message) {
        this.stop();
        const finalMessage = message || this.message;
        const cross = this.colorEnabled ? chalk.red('✗') : '✗';
        console.log(`${cross} ${finalMessage}`);
    }
    /**
     * Stop the animation with warning
     */
    warn(message) {
        this.stop();
        const finalMessage = message || this.message;
        const warning = this.colorEnabled ? chalk.yellow('⚠') : '⚠';
        console.log(`${warning} ${finalMessage}`);
    }
    /**
     * Stop the animation with info
     */
    info(message) {
        this.stop();
        const finalMessage = message || this.message;
        const info = this.colorEnabled ? chalk.blue('ℹ') : 'i';
        console.log(`${info} ${finalMessage}`);
    }
    /**
     * Stop the animation
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        // Clear the line
        process.stdout.write('\r\x1B[K');
        // Show cursor
        process.stdout.write('\x1B[?25h');
    }
}
/**
 * Singleton logger instance for convenience
 */
let defaultLogger = null;
export function getLogger() {
    if (!defaultLogger) {
        defaultLogger = new Logger();
    }
    return defaultLogger;
}
/**
 * Convenience exports for common operations
 */
export const log = {
    info: (message) => getLogger().info(message),
    success: (message) => getLogger().success(message),
    warning: (message) => getLogger().warning(message),
    error: (message) => getLogger().error(message),
    debug: (message) => getLogger().debug(message),
    verbose: (message) => getLogger().verbose(message),
    header: (message) => getLogger().header(message),
    subheader: (message) => getLogger().subheader(message),
    dim: (message) => getLogger().dim(message),
    bold: (message) => getLogger().bold(message),
    newline: () => getLogger().newline(),
    separator: () => getLogger().separator(),
    startProgress: (message) => getLogger().startProgress(message),
    listItem: (message, indent) => getLogger().listItem(message, indent),
    keyValue: (key, value, indent) => getLogger().keyValue(key, value, indent),
    tableRow: (columns, widths) => getLogger().tableRow(columns, widths),
    confirm: (message) => getLogger().confirm(message),
    step: (current, total, message) => getLogger().step(current, total, message),
    box: (message, style) => getLogger().box(message, style),
    diffAdded: (message) => getLogger().diffAdded(message),
    diffRemoved: (message) => getLogger().diffRemoved(message),
    diffModified: (message) => getLogger().diffModified(message),
    diffUnchanged: (message) => getLogger().diffUnchanged(message)
};
//# sourceMappingURL=Logger.js.map