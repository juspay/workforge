import { Config } from '../types/index.js';
/**
 * Configuration Manager
 *
 * Handles loading, saving, and accessing configuration from ~/.workforge/config.json
 */
export declare class ConfigManager {
    private configPath;
    constructor();
    /**
     * Load configuration, merging user config with defaults
     */
    load(): Config;
    /**
     * Save configuration to disk
     */
    save(config: Config): void;
    /**
     * Get a specific nested configuration value
     *
     * @param key - Dot-separated path (e.g., 'backup.maxBackupsPerProject')
     */
    get(key: string): any;
    /**
     * Set a specific nested configuration value
     *
     * @param key - Dot-separated path (e.g., 'backup.maxBackupsPerProject')
     * @param value - Value to set
     */
    set(key: string, value: any): void;
    /**
     * Reset configuration to defaults
     */
    reset(): void;
    /**
     * Get the path to the config file
     */
    getConfigPath(): string;
    /**
     * Deep merge two configuration objects
     * User values override defaults
     */
    private merge;
    /**
     * Merge two objects recursively
     */
    private mergeObjects;
    /**
     * Get value from nested path (e.g., 'backup.maxBackupsPerProject')
     */
    private getNestedValue;
    /**
     * Set value at nested path
     */
    private setNestedValue;
}
//# sourceMappingURL=ConfigManager.d.ts.map