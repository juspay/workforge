import { WorktreeResolver } from '../core/WorktreeResolver.js';
import { ConfigManager } from '../core/ConfigManager.js';
import { Logger } from '../ui/Logger.js';
import { ListDisplay } from '../ui/ListDisplay.js';
import { ListOptions } from '../types/index.js';

/**
 * List Command
 *
 * Lists all worktrees for the current repository or all repositories:
 * - Table format (default)
 * - JSON format (--json)
 * - Simple format (--simple)
 * - Sort by name, path, or age
 * - Filter to show only current repo or all repos
 */
export class ListCommand {
  private options: ListOptions;
  private configManager: ConfigManager;
  private logger: Logger;
  private worktreeResolver: WorktreeResolver;
  private listDisplay: ListDisplay;

  constructor(options: ListOptions) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.logger = new Logger(this.configManager);
    this.worktreeResolver = new WorktreeResolver();
    this.listDisplay = new ListDisplay(this.logger);
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    try {
      // Get worktrees based on --all flag
      const worktrees = await this.getWorktrees();

      // Determine format
      let format: 'table' | 'json' | 'simple' = 'table';

      if (this.options.json) {
        format = 'json';
      } else if (this.options.simple) {
        format = 'simple';
      }

      // Display worktrees
      this.listDisplay.show(worktrees, format, this.options.sortBy);

      // Show summary if not in JSON format
      if (format !== 'json' && worktrees.length > 0) {
        const mainRepoCount = worktrees.filter(w => w.isMainRepo).length;
        const worktreeCount = worktrees.length - mainRepoCount;
        this.listDisplay.showSummary(worktrees.length, mainRepoCount, worktreeCount);
      }

    } catch (error) {
      this.logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  /**
   * Get worktrees based on options
   */
  private async getWorktrees() {
    if (this.options.all) {
      // TODO: Implement listing worktrees from all repositories
      // This would require tracking all repositories in ~/.workforge/projects/
      this.logger.warning('--all flag not yet implemented. Showing current repository only.');
      return this.getCurrentRepoWorktrees();
    } else {
      return this.getCurrentRepoWorktrees();
    }
  }

  /**
   * Get worktrees for current repository
   */
  private async getCurrentRepoWorktrees() {
    // Detect current repository
    const currentWorktree = await this.worktreeResolver.resolve(undefined, undefined);
    const repoRoot = await this.worktreeResolver.getMainRepo(currentWorktree.path);

    // Get all worktrees
    const worktrees = await this.worktreeResolver.getWorktrees(repoRoot);

    return worktrees;
  }
}
