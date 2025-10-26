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
export declare class ListCommand {
    private options;
    private configManager;
    private logger;
    private worktreeResolver;
    private listDisplay;
    constructor(options: ListOptions);
    /**
     * Main execution method
     */
    run(): Promise<void>;
    /**
     * Get worktrees based on options
     */
    private getWorktrees;
    /**
     * Get worktrees for current repository
     */
    private getCurrentRepoWorktrees;
}
//# sourceMappingURL=list.d.ts.map