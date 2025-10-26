import { ProjectMetadata } from '../types/index.js';
/**
 * Project Identifier
 *
 * Generates unique project IDs based on Git remote URL and manages project metadata
 */
export declare class ProjectIdentifier {
    /**
     * Generate unique project ID from git remote URL
     * Uses SHA-256 hash of origin URL (first 8 characters)
     *
     * @param repoRoot - Absolute path to repository root
     * @returns Project ID (8-character hex string)
     */
    static generateId(repoRoot: string): string;
    /**
     * Get git remote origin URL
     *
     * @param repoRoot - Absolute path to repository root
     * @returns Remote origin URL
     */
    private static getRemoteUrl;
    /**
     * Get project directory in ~/.workforge/projects/<project-id>
     *
     * @param repoRoot - Absolute path to repository root
     * @returns Absolute path to project directory
     */
    static getProjectDir(repoRoot: string): string;
    /**
     * Get backup directory for project
     *
     * @param repoRoot - Absolute path to repository root
     * @returns Absolute path to backup directory
     */
    static getBackupDir(repoRoot: string): string;
    /**
     * Create or update project metadata
     * Creates .meta.json file in project directory
     *
     * @param repoRoot - Absolute path to repository root
     */
    static updateMetadata(repoRoot: string): void;
    /**
     * Get project metadata
     *
     * @param repoRoot - Absolute path to repository root
     * @returns Project metadata or null if not found
     */
    static getMetadata(repoRoot: string): ProjectMetadata | null;
    /**
     * Get all project directories
     *
     * @returns Array of project directory paths
     */
    static getAllProjectDirs(): string[];
    /**
     * Get all projects metadata
     *
     * @returns Array of project metadata
     */
    static getAllProjects(): ProjectMetadata[];
}
//# sourceMappingURL=ProjectIdentifier.d.ts.map