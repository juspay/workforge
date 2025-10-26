import inquirer from 'inquirer';
import chalk from 'chalk';
import { Logger } from './Logger.js';
/**
 * Sync Prompt
 *
 * Interactive prompt for selecting which environment variables to sync.
 * Allows line-by-line selection of:
 * - Added variables
 * - Modified variables
 * - Removed variables
 */
export class SyncPrompt {
    logger;
    constructor(logger) {
        this.logger = logger || new Logger();
    }
    /**
     * Prompt user to select which variables to sync
     *
     * @param diff - EnvDiff object with all changes
     * @param autoYes - If true, automatically accept all changes
     * @returns SyncDecision with user selections
     */
    async prompt(diff, autoYes = false) {
        // If auto-yes, accept all changes
        if (autoYes) {
            return this.autoAcceptAll(diff);
        }
        // If no changes, return empty decision
        if (diff.added.length === 0 && diff.modified.length === 0 && diff.removed.length === 0) {
            this.logger.info('No changes to sync.');
            return {
                addedKeys: new Set(),
                modifiedKeys: new Set(),
                removedKeys: new Set(),
                syncAll: false
            };
        }
        this.logger.newline();
        this.logger.header('📝 Select Variables to Sync');
        this.logger.dim('Choose which environment variable changes to apply:');
        this.logger.newline();
        const decision = {
            addedKeys: new Set(),
            modifiedKeys: new Set(),
            removedKeys: new Set(),
            syncAll: false
        };
        // Prompt for sync all or selective
        const { syncMode } = await inquirer.prompt([
            {
                type: 'list',
                name: 'syncMode',
                message: 'How would you like to sync?',
                choices: [
                    {
                        name: 'Sync all changes',
                        value: 'all'
                    },
                    {
                        name: 'Select variables individually',
                        value: 'selective'
                    },
                    {
                        name: 'Cancel sync',
                        value: 'cancel'
                    }
                ]
            }
        ]);
        if (syncMode === 'cancel') {
            this.logger.warning('Sync cancelled by user.');
            return decision;
        }
        if (syncMode === 'all') {
            return this.autoAcceptAll(diff);
        }
        // Selective mode - prompt for each category
        if (diff.added.length > 0) {
            const addedKeys = await this.promptAdded(diff);
            addedKeys.forEach(key => decision.addedKeys.add(key));
        }
        if (diff.modified.length > 0) {
            const modifiedKeys = await this.promptModified(diff);
            modifiedKeys.forEach(key => decision.modifiedKeys.add(key));
        }
        if (diff.removed.length > 0) {
            const removedKeys = await this.promptRemoved(diff);
            removedKeys.forEach(key => decision.removedKeys.add(key));
        }
        return decision;
    }
    /**
     * Prompt for added variables
     */
    async promptAdded(diff) {
        this.logger.newline();
        this.logger.subheader(chalk.green('Added Variables'));
        this.logger.newline();
        const choices = diff.added.map(variable => ({
            name: this.formatVariableChoice(variable.key, variable.value, 'added'),
            value: variable.key,
            checked: true // Default to checked
        }));
        const { selectedKeys } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedKeys',
                message: 'Select variables to add:',
                choices,
                pageSize: 15
            }
        ]);
        return selectedKeys;
    }
    /**
     * Prompt for modified variables
     */
    async promptModified(diff) {
        this.logger.newline();
        this.logger.subheader(chalk.yellow('Modified Variables'));
        this.logger.newline();
        const choices = diff.modified.map(mod => ({
            name: this.formatModifiedChoice(mod.key, mod.oldValue, mod.newValue),
            value: mod.key,
            checked: true // Default to checked
        }));
        const { selectedKeys } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedKeys',
                message: 'Select variables to update:',
                choices,
                pageSize: 15
            }
        ]);
        return selectedKeys;
    }
    /**
     * Prompt for removed variables
     */
    async promptRemoved(diff) {
        this.logger.newline();
        this.logger.subheader(chalk.red('Removed Variables'));
        this.logger.newline();
        const choices = diff.removed.map(variable => ({
            name: this.formatVariableChoice(variable.key, variable.value, 'removed'),
            value: variable.key,
            checked: false // Default to unchecked for removals
        }));
        const { selectedKeys } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedKeys',
                message: 'Select variables to remove:',
                choices,
                pageSize: 15
            }
        ]);
        return selectedKeys;
    }
    /**
     * Auto-accept all changes
     */
    autoAcceptAll(diff) {
        this.logger.info('Auto-accepting all changes...');
        return {
            addedKeys: new Set(diff.added.map(v => v.key)),
            modifiedKeys: new Set(diff.modified.map(m => m.key)),
            removedKeys: new Set(diff.removed.map(v => v.key)),
            syncAll: true
        };
    }
    /**
     * Format variable choice for display
     */
    formatVariableChoice(key, value, type) {
        const truncatedValue = this.truncate(value, 50);
        const coloredKey = chalk.bold(key);
        if (type === 'added') {
            return `${coloredKey} = ${chalk.green(truncatedValue)}`;
        }
        else {
            return `${coloredKey} = ${chalk.red(truncatedValue)}`;
        }
    }
    /**
     * Format modified variable choice for display
     */
    formatModifiedChoice(key, oldValue, newValue) {
        const truncatedOld = this.truncate(oldValue, 25);
        const truncatedNew = this.truncate(newValue, 25);
        const coloredKey = chalk.bold(key);
        return `${coloredKey}: ${chalk.red(truncatedOld)} → ${chalk.green(truncatedNew)}`;
    }
    /**
     * Confirm sync operation before proceeding
     */
    async confirmSync(decision) {
        const totalChanges = decision.addedKeys.size + decision.modifiedKeys.size + decision.removedKeys.size;
        if (totalChanges === 0) {
            this.logger.warning('No variables selected for sync.');
            return false;
        }
        this.logger.newline();
        this.logger.subheader('Sync Summary:');
        this.logger.listItem(chalk.green(`${decision.addedKeys.size} variable(s) to add`));
        this.logger.listItem(chalk.yellow(`${decision.modifiedKeys.size} variable(s) to modify`));
        this.logger.listItem(chalk.red(`${decision.removedKeys.size} variable(s) to remove`));
        this.logger.newline();
        const { confirmed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmed',
                message: 'Proceed with sync?',
                default: true
            }
        ]);
        return confirmed;
    }
    /**
     * Ask if user wants to create backup before sync
     */
    async askForBackup() {
        const { createBackup } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'createBackup',
                message: 'Create backup before syncing?',
                default: true
            }
        ]);
        return createBackup;
    }
    /**
     * Prompt for sync direction in bidirectional sync
     */
    async promptDirection(sourceLabel, targetLabel) {
        this.logger.newline();
        this.logger.subheader('Bidirectional Sync');
        this.logger.dim('Choose sync direction:');
        this.logger.newline();
        const { direction } = await inquirer.prompt([
            {
                type: 'list',
                name: 'direction',
                message: 'Which direction to sync?',
                choices: [
                    {
                        name: `${sourceLabel} → ${targetLabel}`,
                        value: 'source-to-target'
                    },
                    {
                        name: `${targetLabel} → ${sourceLabel}`,
                        value: 'target-to-source'
                    },
                    {
                        name: 'Cancel',
                        value: 'cancel'
                    }
                ]
            }
        ]);
        return direction;
    }
    /**
     * Truncate long values for display
     */
    truncate(value, maxLength) {
        if (value.length <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength - 3) + '...';
    }
    /**
     * Display sync decision summary
     */
    showDecisionSummary(decision) {
        this.logger.newline();
        this.logger.header('Sync Decision Summary');
        this.logger.newline();
        if (decision.syncAll) {
            this.logger.info(chalk.green('✓ Syncing all changes'));
        }
        else {
            const totalSelected = decision.addedKeys.size + decision.modifiedKeys.size + decision.removedKeys.size;
            if (totalSelected === 0) {
                this.logger.warning('No changes selected');
            }
            else {
                this.logger.info(`Selected ${totalSelected} change(s):`);
                if (decision.addedKeys.size > 0) {
                    this.logger.listItem(chalk.green(`${decision.addedKeys.size} to add: `) +
                        chalk.dim(Array.from(decision.addedKeys).join(', ')));
                }
                if (decision.modifiedKeys.size > 0) {
                    this.logger.listItem(chalk.yellow(`${decision.modifiedKeys.size} to modify: `) +
                        chalk.dim(Array.from(decision.modifiedKeys).join(', ')));
                }
                if (decision.removedKeys.size > 0) {
                    this.logger.listItem(chalk.red(`${decision.removedKeys.size} to remove: `) +
                        chalk.dim(Array.from(decision.removedKeys).join(', ')));
                }
            }
        }
        this.logger.newline();
    }
}
//# sourceMappingURL=SyncPrompt.js.map