import chalk from 'chalk';
import { EnvDiff, EnvVariable, EnvModification } from '../types/index.js';
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
export class DiffDisplay {
  private logger: Logger;
  private readonly maxValueLength = 40;
  private readonly _columnWidth = 50;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Display complete diff with all sections
   *
   * @param diff - EnvDiff object to display
   */
  show(diff: EnvDiff): void {
    this.printHeader(diff);

    // Show changes
    if (diff.added.length > 0) {
      this.printAdded(diff.added);
    }

    if (diff.modified.length > 0) {
      this.printModified(diff.modified);
    }

    if (diff.removed.length > 0) {
      this.printRemoved(diff.removed);
    }

    // Show unchanged summary
    if (diff.unchanged.length > 0) {
      this.printUnchangedSummary(diff.unchanged);
    }

    this.printFooter(diff);
  }

  /**
   * Print header with source/target information
   */
  private printHeader(diff: EnvDiff): void {
    this.logger.newline();
    this.logger.header('🔄 Environment Variable Diff');
    this.logger.newline();

    if (diff.targets) {
      this.logger.keyValue('Source', diff.targets.sourceLabel);
      this.logger.keyValue('Target', diff.targets.targetLabel);
    }

    this.logger.separator();
  }

  /**
   * Print added variables section
   */
  private printAdded(added: EnvVariable[]): void {
    this.logger.newline();
    this.logger.subheader(chalk.green(`✚ Added Variables (${added.length})`));
    this.logger.dim('These variables will be added to the target:');
    this.logger.newline();

    for (const variable of added) {
      const value = this.truncate(variable.value);
      const displayValue = variable.hasQuotes
        ? this.formatQuotedValue(value, variable.quoteType!)
        : value;

      this.logger.diffAdded(`${chalk.bold(variable.key)} = ${displayValue}`);

      if (variable.comment) {
        this.logger.dim(`    ${variable.comment}`);
      }
    }
  }

  /**
   * Print modified variables section with side-by-side comparison
   */
  private printModified(modified: EnvModification[]): void {
    this.logger.newline();
    this.logger.subheader(chalk.yellow(`⟳ Modified Variables (${modified.length})`));
    this.logger.dim('These variables have different values:');
    this.logger.newline();

    for (const mod of modified) {
      // Variable name
      this.logger.diffModified(chalk.bold(mod.key));

      // Old value (source)
      const oldValue = this.truncate(mod.oldValue);
      const oldDisplayValue = mod.oldHasQuotes
        ? this.formatQuotedValue(oldValue, mod.oldQuoteType!)
        : oldValue;

      console.log(chalk.red(`    - ${oldDisplayValue}`));

      if (mod.oldComment) {
        console.log(chalk.dim(`      ${mod.oldComment}`));
      }

      // New value (target)
      const newValue = this.truncate(mod.newValue);
      const newDisplayValue = mod.newHasQuotes
        ? this.formatQuotedValue(newValue, mod.newQuoteType!)
        : newValue;

      console.log(chalk.green(`    + ${newDisplayValue}`));

      if (mod.newComment) {
        console.log(chalk.dim(`      ${mod.newComment}`));
      }

      this.logger.newline();
    }
  }

  /**
   * Print removed variables section
   */
  private printRemoved(removed: EnvVariable[]): void {
    this.logger.newline();
    this.logger.subheader(chalk.red(`✖ Removed Variables (${removed.length})`));
    this.logger.dim('These variables will be removed from the target:');
    this.logger.newline();

    for (const variable of removed) {
      const value = this.truncate(variable.value);
      const displayValue = variable.hasQuotes
        ? this.formatQuotedValue(value, variable.quoteType!)
        : value;

      this.logger.diffRemoved(`${chalk.bold(variable.key)} = ${displayValue}`);

      if (variable.comment) {
        this.logger.dim(`    ${variable.comment}`);
      }
    }
  }

  /**
   * Print summary of unchanged variables
   */
  private printUnchangedSummary(unchanged: EnvVariable[]): void {
    this.logger.newline();
    this.logger.dim(`━ Unchanged: ${unchanged.length} variable${unchanged.length === 1 ? '' : 's'}`);

    // Show first few unchanged variables if verbose
    const maxShow = 5;
    if (unchanged.length <= maxShow) {
      for (const variable of unchanged) {
        this.logger.dim(`  ${variable.key}`);
      }
    } else {
      for (let i = 0; i < maxShow; i++) {
        this.logger.dim(`  ${unchanged[i].key}`);
      }
      this.logger.dim(`  ... and ${unchanged.length - maxShow} more`);
    }
  }

  /**
   * Print footer with summary statistics
   */
  private printFooter(diff: EnvDiff): void {
    this.logger.separator();

    const addedCount = diff.added.length;
    const modifiedCount = diff.modified.length;
    const removedCount = diff.removed.length;
    const unchangedCount = diff.unchanged.length;
    const totalChanges = addedCount + modifiedCount + removedCount;

    this.logger.newline();
    this.logger.subheader('Summary:');

    if (totalChanges === 0) {
      this.logger.info(chalk.green('✓ No changes detected'));
    } else {
      if (addedCount > 0) {
        this.logger.listItem(
          chalk.green(`${addedCount} variable${addedCount === 1 ? '' : 's'} to be added`)
        );
      }

      if (modifiedCount > 0) {
        this.logger.listItem(
          chalk.yellow(`${modifiedCount} variable${modifiedCount === 1 ? '' : 's'} to be modified`)
        );
      }

      if (removedCount > 0) {
        this.logger.listItem(
          chalk.red(`${removedCount} variable${removedCount === 1 ? '' : 's'} to be removed`)
        );
      }

      this.logger.listItem(
        chalk.dim(`${unchangedCount} variable${unchangedCount === 1 ? '' : 's'} unchanged`)
      );

      this.logger.newline();
      this.logger.bold(
        chalk.cyan(`Total changes: ${totalChanges}`)
      );
    }

    this.logger.newline();
  }

  /**
   * Display a compact summary (without full diff)
   */
  showSummary(diff: EnvDiff): void {
    const addedCount = diff.added.length;
    const modifiedCount = diff.modified.length;
    const removedCount = diff.removed.length;
    const totalChanges = addedCount + modifiedCount + removedCount;

    this.logger.newline();
    this.logger.subheader('Environment Variable Changes:');

    if (totalChanges === 0) {
      this.logger.info(chalk.green('✓ No changes detected'));
    } else {
      const parts: string[] = [];

      if (addedCount > 0) {
        parts.push(chalk.green(`+${addedCount}`));
      }

      if (modifiedCount > 0) {
        parts.push(chalk.yellow(`~${modifiedCount}`));
      }

      if (removedCount > 0) {
        parts.push(chalk.red(`-${removedCount}`));
      }

      this.logger.info(`Changes: ${parts.join(' ')} (${totalChanges} total)`);
    }

    this.logger.newline();
  }

  /**
   * Display diff in table format
   */
  showTable(diff: EnvDiff): void {
    this.logger.newline();
    this.logger.header('Environment Variable Diff');
    this.logger.newline();

    // Header row
    const headers = ['Status', 'Variable', 'Old Value', 'New Value'];
    const widths = [10, 25, 35, 35];

    this.logger.tableRow(
      headers.map(h => chalk.bold(h)),
      widths
    );
    this.logger.separator();

    // Added variables
    for (const variable of diff.added) {
      const value = this.truncate(variable.value, 30);
      this.logger.tableRow(
        [
          chalk.green('+ ADD'),
          chalk.bold(variable.key),
          chalk.dim('(none)'),
          chalk.green(value)
        ],
        widths
      );
    }

    // Modified variables
    for (const mod of diff.modified) {
      const oldValue = this.truncate(mod.oldValue, 30);
      const newValue = this.truncate(mod.newValue, 30);

      this.logger.tableRow(
        [
          chalk.yellow('~ MOD'),
          chalk.bold(mod.key),
          chalk.red(oldValue),
          chalk.green(newValue)
        ],
        widths
      );
    }

    // Removed variables
    for (const variable of diff.removed) {
      const value = this.truncate(variable.value, 30);
      this.logger.tableRow(
        [
          chalk.red('- DEL'),
          chalk.bold(variable.key),
          chalk.red(value),
          chalk.dim('(removed)')
        ],
        widths
      );
    }

    this.logger.separator();
    this.logger.newline();
  }

  /**
   * Display warning if no changes found
   */
  showNoChanges(): void {
    this.logger.box(
      'No environment variable changes detected.\nSource and target .env files are identical.',
      'info'
    );
  }

  /**
   * Truncate long values for display
   *
   * @param value - Value to truncate
   * @param maxLength - Maximum length (default: this.maxValueLength)
   * @returns Truncated value
   */
  private truncate(value: string, maxLength?: number): string {
    const limit = maxLength || this.maxValueLength;

    if (value.length <= limit) {
      return value;
    }

    return value.substring(0, limit - 3) + '...';
  }

  /**
   * Format quoted value for display
   *
   * @param value - Value to format
   * @param quoteType - Type of quotes
   * @returns Formatted value
   */
  private formatQuotedValue(value: string, quoteType: 'single' | 'double'): string {
    const quote = quoteType === 'single' ? "'" : '"';
    return `${quote}${value}${quote}`;
  }

  /**
   * Pad string to specified width
   *
   * @param str - String to pad
   * @param width - Target width
   * @returns Padded string
   */
  private _pad(str: string, width: number): string {
    return str.padEnd(width, ' ');
  }
}
