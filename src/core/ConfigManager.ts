import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config, ConfigValue, ConfigObject, ConfigPath } from '../types/index.js';

/**
 * Default configuration for WorkForge
 */
const DEFAULT_CONFIG: Config = {
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
  private configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.workforge', 'config.json');
  }

  /**
   * Load configuration, merging user config with defaults
   */
  load(): Config {
    if (!existsSync(this.configPath)) {
      return DEFAULT_CONFIG;
    }

    try {
      const userConfig = JSON.parse(readFileSync(this.configPath, 'utf8'));
      return this.merge(DEFAULT_CONFIG, userConfig);
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${this.configPath}, using defaults`);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save configuration to disk
   */
  save(config: Config): void {
    try {
      mkdirSync(path.dirname(this.configPath), { recursive: true });
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${error}`);
    }
  }

  /**
   * Get a specific nested configuration value
   *
   * @param key - Dot-separated path (e.g., 'backup.maxBackupsPerProject')
   */
  get(key: ConfigPath): ConfigValue {
    const config = this.load();
    return this.getNestedValue(config, key);
  }

  /**
   * Set a specific nested configuration value
   *
   * @param key - Dot-separated path (e.g., 'backup.maxBackupsPerProject')
   * @param value - Value to set
   */
  set(key: ConfigPath, value: ConfigValue): void {
    const config = this.load();
    this.setNestedValue(config, key, value);
    this.save(config);
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.save(DEFAULT_CONFIG);
  }

  /**
   * Get the path to the config file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Deep merge two configuration objects
   * User values override defaults
   */
  private merge(defaults: Config, user: Partial<Config>): Config {
    const result = { ...defaults };

    for (const key in user) {
      if (Object.prototype.hasOwnProperty.call(user, key)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userValue = (user as any)[key];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const defaultValue = (defaults as any)[key];

        if (
          typeof userValue === 'object' &&
          userValue !== null &&
          !Array.isArray(userValue) &&
          typeof defaultValue === 'object' &&
          defaultValue !== null &&
          !Array.isArray(defaultValue)
        ) {
          // Recursively merge objects
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result as any)[key] = this.mergeObjects(defaultValue, userValue);
        } else {
          // Direct assignment for primitives and arrays
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result as any)[key] = userValue;
        }
      }
    }

    return result;
  }

  /**
   * Merge two objects recursively
   */
  private mergeObjects(obj1: ConfigObject, obj2: ConfigObject): ConfigObject {
    const result = { ...obj1 };

    for (const key in obj2) {
      if (Object.prototype.hasOwnProperty.call(obj2, key)) {
        const val2 = obj2[key];
        const val1 = obj1[key];

        if (
          typeof val2 === 'object' &&
          val2 !== null &&
          !Array.isArray(val2) &&
          typeof val1 === 'object' &&
          val1 !== null &&
          !Array.isArray(val1)
        ) {
          result[key] = this.mergeObjects(val1 as ConfigObject, val2 as ConfigObject);
        } else {
          result[key] = val2;
        }
      }
    }

    return result;
  }

  /**
   * Get value from nested path (e.g., 'backup.maxBackupsPerProject')
   */
  private getNestedValue(obj: ConfigObject, path: string): ConfigValue {
    const keys = path.split('.');
    let current: ConfigValue = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined as unknown as ConfigValue;
      }
      if (typeof current === 'object' && !Array.isArray(current)) {
        current = (current as ConfigObject)[key];
      }
    }

    return current;
  }

  /**
   * Set value at nested path
   */
  private setNestedValue(obj: ConfigObject, path: string, value: ConfigValue): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    let current: ConfigObject = obj;
    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      const next = current[key];
      if (typeof next === 'object' && !Array.isArray(next) && next !== null) {
        current = next as ConfigObject;
      }
    }

    current[lastKey] = value;
  }
}
