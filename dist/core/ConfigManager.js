import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
/**
 * Default configuration for WorkForge
 */
const DEFAULT_CONFIG = {
    version: '3.0.0',
    preferences: {
        defaultBaseBranch: 'main',
        autoDeleteBranch: false,
        skipConfirmations: false,
        packageManager: 'auto',
        showExistingWorktrees: true
    },
    backup: {
        enabled: true,
        maxBackupsPerProject: 10,
        autoCleanup: true
    },
    sync: {
        createBackupBeforeSync: true,
        defaultSyncDirection: 'ask'
    },
    audit: {
        enabled: true,
        includeVariableValues: true,
        retentionDays: 90
    },
    display: {
        colorEnabled: true,
        verboseOutput: false,
        showProgressIndicators: true
    }
};
/**
 * Configuration Manager
 *
 * Handles loading, saving, and accessing configuration from ~/.workforge/config.json
 */
export class ConfigManager {
    configPath;
    constructor() {
        this.configPath = path.join(os.homedir(), '.workforge', 'config.json');
    }
    /**
     * Load configuration, merging user config with defaults
     */
    load() {
        if (!existsSync(this.configPath)) {
            return DEFAULT_CONFIG;
        }
        try {
            const userConfig = JSON.parse(readFileSync(this.configPath, 'utf8'));
            return this.merge(DEFAULT_CONFIG, userConfig);
        }
        catch (error) {
            console.warn(`Warning: Failed to load config from ${this.configPath}, using defaults`);
            return DEFAULT_CONFIG;
        }
    }
    /**
     * Save configuration to disk
     */
    save(config) {
        try {
            mkdirSync(path.dirname(this.configPath), { recursive: true });
            writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
        }
        catch (error) {
            throw new Error(`Failed to save config to ${this.configPath}: ${error}`);
        }
    }
    /**
     * Get a specific nested configuration value
     *
     * @param key - Dot-separated path (e.g., 'backup.maxBackupsPerProject')
     */
    get(key) {
        const config = this.load();
        return this.getNestedValue(config, key);
    }
    /**
     * Set a specific nested configuration value
     *
     * @param key - Dot-separated path (e.g., 'backup.maxBackupsPerProject')
     * @param value - Value to set
     */
    set(key, value) {
        const config = this.load();
        this.setNestedValue(config, key, value);
        this.save(config);
    }
    /**
     * Reset configuration to defaults
     */
    reset() {
        this.save(DEFAULT_CONFIG);
    }
    /**
     * Get the path to the config file
     */
    getConfigPath() {
        return this.configPath;
    }
    /**
     * Deep merge two configuration objects
     * User values override defaults
     */
    merge(defaults, user) {
        const result = { ...defaults };
        for (const key in user) {
            if (user.hasOwnProperty(key)) {
                const userValue = user[key];
                const defaultValue = defaults[key];
                if (typeof userValue === 'object' &&
                    userValue !== null &&
                    !Array.isArray(userValue) &&
                    typeof defaultValue === 'object' &&
                    defaultValue !== null &&
                    !Array.isArray(defaultValue)) {
                    // Recursively merge objects
                    result[key] = this.mergeObjects(defaultValue, userValue);
                }
                else {
                    // Direct assignment for primitives and arrays
                    result[key] = userValue;
                }
            }
        }
        return result;
    }
    /**
     * Merge two objects recursively
     */
    mergeObjects(obj1, obj2) {
        const result = { ...obj1 };
        for (const key in obj2) {
            if (obj2.hasOwnProperty(key)) {
                const val2 = obj2[key];
                const val1 = obj1[key];
                if (typeof val2 === 'object' &&
                    val2 !== null &&
                    !Array.isArray(val2) &&
                    typeof val1 === 'object' &&
                    val1 !== null &&
                    !Array.isArray(val1)) {
                    result[key] = this.mergeObjects(val1, val2);
                }
                else {
                    result[key] = val2;
                }
            }
        }
        return result;
    }
    /**
     * Get value from nested path (e.g., 'backup.maxBackupsPerProject')
     */
    getNestedValue(obj, path) {
        const keys = path.split('.');
        let current = obj;
        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }
        return current;
    }
    /**
     * Set value at nested path
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;
        for (const key of keys) {
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }
        current[lastKey] = value;
    }
}
//# sourceMappingURL=ConfigManager.js.map