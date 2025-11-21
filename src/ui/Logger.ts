import chalk from 'chalk';
import stringWidth from 'string-width';
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
  private configManager: ConfigManager;
  private colorEnabled!: boolean;
  private verboseMode!: boolean;
  private showProgress!: boolean;

  constructor(configManager?: ConfigManager) {
    this.configManager = configManager || new ConfigManager();
    this.loadConfig();
  }

  /**
   * Load display configuration
   */
  private loadConfig(): void {
    try {
      const config = this.configManager.load();
      this.colorEnabled = config.display.colorEnabled;
      this.verboseMode = config.display.verboseOutput;
      this.showProgress = config.display.showProgressIndicators;
    } catch {
      // Fallback to defaults if config loading fails
      this.colorEnabled = true;
      this.verboseMode = false;
      this.showProgress = true;
    }
  }

  /**
   * Reload configuration (useful after config changes)
   */
  reload(): void {
    this.loadConfig();
  }

  /**
   * Apply color if enabled
   */
  private applyColor(colorFn: (text: string) => string, text: string): string {
    return this.colorEnabled ? colorFn(text) : text;
  }

  /**
   * Info message (always shown)
   */
  info(message: string): void {
    console.log(this.applyColor(chalk.blue, message));
  }

  /**
   * Success message (always shown)
   */
  success(message: string): void {
    console.log(this.applyColor(chalk.green, `✓ ${message}`));
  }

  /**
   * Warning message (always shown)
   */
  warning(message: string): void {
    console.log(this.applyColor(chalk.yellow, `⚠ ${message}`));
  }

  /**
   * Error message (always shown)
   */
  error(message: string): void {
    console.error(this.applyColor(chalk.red, `✗ ${message}`));
  }

  /**
   * Debug message (only shown in verbose mode)
   */
  debug(message: string): void {
    if (this.verboseMode) {
      console.log(this.applyColor(chalk.gray, `[DEBUG] ${message}`));
    }
  }

  /**
   * Verbose message (only shown in verbose mode)
   */
  verbose(message: string): void {
    if (this.verboseMode) {
      console.log(this.applyColor(chalk.dim, message));
    }
  }

  /**
   * Section header
   */
  header(message: string): void {
    console.log(this.applyColor(chalk.bold.blue, `\n${message}`));
  }

  /**
   * Section subheader
   */
  subheader(message: string): void {
    console.log(this.applyColor(chalk.bold, message));
  }

  /**
   * Dim text
   */
  dim(message: string): void {
    console.log(this.applyColor(chalk.dim, message));
  }

  /**
   * Bold text
   */
  bold(message: string): void {
    console.log(this.applyColor(chalk.bold, message));
  }

  /**
   * Newline
   */
  newline(): void {
    console.log();
  }

  /**
   * Horizontal line separator
   */
  separator(): void {
    console.log(this.applyColor(chalk.gray, '─'.repeat(60)));
  }

  /**
   * Progress indicator - start
   */
  startProgress(message: string): ProgressIndicator | null {
    if (!this.showProgress) {
      this.info(message);
      return null;
    }

    return new ProgressIndicator(message, this.colorEnabled);
  }

  /**
   * List item (bullet point)
   */
  listItem(message: string, indent: number = 0): void {
    const indentation = '  '.repeat(indent);
    console.log(this.applyColor(chalk.gray, `${indentation}• `) + message);
  }

  /**
   * Key-value pair display
   */
  keyValue(key: string, value: string, indent: number = 0): void {
    const indentation = '  '.repeat(indent);
    const coloredKey = this.applyColor(chalk.cyan, `${key}:`);
    console.log(`${indentation}${coloredKey} ${value}`);
  }

  /**
   * Table row (aligned columns)
   */
  tableRow(columns: string[], widths: number[]): void {
    let row = '';
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i] || '';
      const width = widths[i] || 20;

      // Calculate visual width (ignoring ANSI codes)
      const visualWidth = stringWidth(column);
      const padding = Math.max(0, width - visualWidth);

      row += column + ' '.repeat(padding) + '  ';
    }
    console.log(row.trimEnd());
  }

  /**
   * Confirmation prompt message
   */
  confirm(message: string): void {
    console.log(this.applyColor(chalk.yellow, `? ${message}`));
  }

  /**
   * Step indicator (e.g., "Step 1/5:")
   */
  step(current: number, total: number, message: string): void {
    const stepText = this.applyColor(chalk.cyan, `[${current}/${total}]`);
    console.log(`${stepText} ${message}`);
  }

  /**
   * Box message (surrounded by border)
   */
  box(message: string, style: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const lines = message.split('\n');
    const maxLength = Math.max(...lines.map(l => l.length));
    const width = Math.min(maxLength + 4, 80);

    let colorFn: (text: string) => string;
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
  diffAdded(message: string): void {
    console.log(this.applyColor(chalk.green, `+ ${message}`));
  }

  diffRemoved(message: string): void {
    console.log(this.applyColor(chalk.red, `- ${message}`));
  }

  diffModified(message: string): void {
    console.log(this.applyColor(chalk.yellow, `~ ${message}`));
  }

  diffUnchanged(message: string): void {
    console.log(this.applyColor(chalk.dim, `  ${message}`));
  }
}

/**
 * Progress Indicator
 *
 * Shows animated progress for long-running operations
 */
export class ProgressIndicator {
  private message: string;
  private colorEnabled: boolean;
  private interval: NodeJS.Timeout | null = null;
  private frame: number = 0;
  private readonly frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  constructor(message: string, colorEnabled: boolean) {
    this.message = message;
    this.colorEnabled = colorEnabled;
    this.start();
  }

  /**
   * Start the animation
   */
  private start(): void {
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
  update(message: string): void {
    this.message = message;
  }

  /**
   * Stop the animation with success
   */
  succeed(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    const checkmark = this.colorEnabled ? chalk.green('✓') : '✓';
    console.log(`${checkmark} ${finalMessage}`);
  }

  /**
   * Stop the animation with failure
   */
  fail(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    const cross = this.colorEnabled ? chalk.red('✗') : '✗';
    console.log(`${cross} ${finalMessage}`);
  }

  /**
   * Stop the animation with warning
   */
  warn(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    const warning = this.colorEnabled ? chalk.yellow('⚠') : '⚠';
    console.log(`${warning} ${finalMessage}`);
  }

  /**
   * Stop the animation with info
   */
  info(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    const info = this.colorEnabled ? chalk.blue('ℹ') : 'i';
    console.log(`${info} ${finalMessage}`);
  }

  /**
   * Stop the animation
   */
  private stop(): void {
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
let defaultLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

/**
 * Convenience exports for common operations
 */
export const log = {
  info: (message: string) => getLogger().info(message),
  success: (message: string) => getLogger().success(message),
  warning: (message: string) => getLogger().warning(message),
  error: (message: string) => getLogger().error(message),
  debug: (message: string) => getLogger().debug(message),
  verbose: (message: string) => getLogger().verbose(message),
  header: (message: string) => getLogger().header(message),
  subheader: (message: string) => getLogger().subheader(message),
  dim: (message: string) => getLogger().dim(message),
  bold: (message: string) => getLogger().bold(message),
  newline: () => getLogger().newline(),
  separator: () => getLogger().separator(),
  startProgress: (message: string) => getLogger().startProgress(message),
  listItem: (message: string, indent?: number) => getLogger().listItem(message, indent),
  keyValue: (key: string, value: string, indent?: number) =>
    getLogger().keyValue(key, value, indent),
  tableRow: (columns: string[], widths: number[]) => getLogger().tableRow(columns, widths),
  confirm: (message: string) => getLogger().confirm(message),
  step: (current: number, total: number, message: string) =>
    getLogger().step(current, total, message),
  box: (message: string, style?: 'info' | 'success' | 'warning' | 'error') =>
    getLogger().box(message, style),
  diffAdded: (message: string) => getLogger().diffAdded(message),
  diffRemoved: (message: string) => getLogger().diffRemoved(message),
  diffModified: (message: string) => getLogger().diffModified(message),
  diffUnchanged: (message: string) => getLogger().diffUnchanged(message)
};
