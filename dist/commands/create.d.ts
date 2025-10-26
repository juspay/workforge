import { WorkspaceConfig } from '../types/index.js';
/**
 * Create Command
 *
 * Handles workspace (worktree) creation with automatic environment setup,
 * dependency installation, and project metadata tracking.
 */
export declare class CreateCommand {
    private config;
    private paths;
    private configManager;
    private worktreeResolver;
    constructor(config: WorkspaceConfig);
    run(): Promise<void>;
    private validateInputs;
    private discoverRepository;
    private detectDefaultBranch;
    private detectRepositoryType;
    private showExistingWorktrees;
    private getRelativeTime;
    private getWorktreeStatus;
    private promptForTicketId;
    private calculatePaths;
    private runPreflightChecks;
    private confirmCreation;
    private createWorkspace;
    private copyEnvironmentFiles;
    private detectPackageManager;
    private installDependencies;
    private updateProjectMetadata;
    private logSuccess;
    private log;
    private handleError;
}
//# sourceMappingURL=create.d.ts.map