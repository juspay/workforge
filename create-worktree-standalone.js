#!/usr/bin/env node

/**
 * Git Worktree Creator - Standalone Version
 * A self-contained script for creating organized Git worktrees
 * 
 * Usage: ./create-worktree-standalone.js --type feat --name my-feature
 */

import { execFileSync, spawnSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

// Simple argument parser (no external dependencies)
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { base: 'main', yes: false };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--type':
      case '-t':
        config.type = nextArg;
        i++;
        break;
      case '--name':
      case '-n':
        config.name = nextArg;
        i++;
        break;
      case '--base':
      case '-b':
        config.base = nextArg;
        i++;
        break;
      case '--yes':
      case '-y':
        config.yes = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  if (!config.type || !config.name) {
    console.error('❌ Error: --type and --name are required');
    showHelp();
    process.exit(1);
  }
  
  return config;
}

function showHelp() {
  console.log(`
Git Worktree Creator - Standalone Version

Usage: ./create-worktree-standalone.js --type <type> --name <name> [options]

Options:
  -t, --type <type>    Branch type (feat, fix, doc, etc.)               [required]
  -n, --name <name>    Feature/branch name (kebab-case)                [required]
  -b, --base <branch>  Base branch to checkout from                    [default: main]
  -y, --yes           Skip confirmations (non-interactive)             [default: false]
  -h, --help          Show this help message

Examples:
  ./create-worktree-standalone.js -t feat -n user-authentication
  ./create-worktree-standalone.js -t fix -n memory-leak -b develop
  ./create-worktree-standalone.js -t doc -n api-guide -y
`);
}

// Simple logging with colors (no chalk dependency)
function log(level, message) {
  const colors = {
    info: '\x1b[34m',    // Blue
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };
  
  const prefix = {
    info: 'ℹ',
    success: '✓',
    warn: '⚠',
    error: '✗'
  }[level];
  
  console.log(`${colors[level]}${prefix}${colors.reset} ${message}`);
}

// Simple confirmation prompt (no inquirer dependency)
function confirm(message) {
  return new Promise((resolve) => {
    const readline = createRequire(import.meta.url)('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

class WorktreeCreator {
  constructor(config) {
    this.config = config;
    this.paths = null;
  }

  async run() {
    try {
      log('info', '🚀 Starting Git worktree creation...');
      
      this.validateInputs();
      this.discoverRepository();
      this.calculatePaths();
      await this.runPreflightChecks();
      
      if (!this.config.yes) {
        const proceed = await confirm('Proceed with worktree creation?');
        if (!proceed) {
          log('info', 'Operation cancelled by user');
          process.exit(0);
        }
      }
      
      await this.createWorktree();
      this.copyEnvironmentFiles();
      
      this.logSuccess();
      process.exit(0);
    } catch (error) {
      this.handleError(error);
      process.exit(1);
    }
  }

  validateInputs() {
    log('info', 'Validating inputs...');
    
    // Validate type - must be letters only, convert to lowercase
    if (!/^[a-zA-Z]+$/.test(this.config.type)) {
      throw new Error(`Invalid type "${this.config.type}". Must contain only letters.`);
    }
    
    // Normalize type to lowercase
    this.config.type = this.config.type.toLowerCase();
    
    // Validate name - must be kebab-case
    if (!/^[a-z0-9\-]+$/.test(this.config.name)) {
      throw new Error(`Invalid name "${this.config.name}". Must be kebab-case (lowercase letters, numbers, and hyphens only).`);
    }
    
    log('success', '✅ Input validation passed');
  }

  discoverRepository() {
    log('info', 'Discovering Git repository root...');
    
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const gitPath = path.join(currentDir, '.git');
      
      if (existsSync(gitPath)) {
        // Check if it's a worktree or main repo
        const isWorktree = existsSync(gitPath) && !existsSync(path.join(gitPath, 'objects'));
        
        if (isWorktree) {
          // Read .git file to find main repo
          const gitFile = readFileSync(gitPath, 'utf8').trim();
          const match = gitFile.match(/^gitdir: (.+)$/);
          if (match) {
            const gitDir = path.resolve(currentDir, match[1]);
            const mainRepoPath = path.dirname(path.dirname(gitDir));
            if (existsSync(mainRepoPath)) {
              this.paths = { repoRoot: mainRepoPath };
              log('success', `✅ Found main repository at: ${mainRepoPath}`);
              return;
            }
          }
        } else {
          // This is the main repository
          this.paths = { repoRoot: currentDir };
          log('success', `✅ Found repository root at: ${currentDir}`);
          return;
        }
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    throw new Error('Not inside a Git repository. Please run this command from within a Git repository.');
  }

  calculatePaths() {
    if (!this.paths?.repoRoot) {
      throw new Error('Repository root not found');
    }

    const worktreeParent = path.join(this.paths.repoRoot, '..', this.config.type);
    const worktreePath = path.join(worktreeParent, this.config.name);
    const branchName = `${this.config.type}/${this.config.name}`;

    this.paths = {
      repoRoot: this.paths.repoRoot,
      worktreeParent,
      worktreePath,
      branchName
    };

    log('info', `Calculated paths:
  Repository Root: ${this.paths.repoRoot}
  Worktree Parent: ${this.paths.worktreeParent}
  Worktree Path: ${this.paths.worktreePath}
  Branch Name: ${this.paths.branchName}`);
  }

  async runPreflightChecks() {
    log('info', 'Running pre-flight checks...');
    
    // Check Git binary
    try {
      execFileSync('git', ['--version'], { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Git binary not found in PATH');
    }
    
    if (!this.paths) {
      throw new Error('Paths not calculated');
    }
    
    // Check if branch already exists
    try {
      const result = spawnSync('git', ['branch', '--list', this.paths.branchName], {
        cwd: this.paths.repoRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      if (result.stdout && result.stdout.trim()) {
        throw new Error(`Branch "${this.paths.branchName}" already exists locally`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
    }
    
    // Check if worktree path already exists
    if (existsSync(this.paths.worktreePath)) {
      throw new Error(`Worktree path already exists: ${this.paths.worktreePath}`);
    }
    
    log('success', '✅ Pre-flight checks passed');
  }

  async createWorktree() {
    if (!this.paths) {
      throw new Error('Paths not calculated');
    }

    log('info', 'Creating Git worktree...');
    
    // Ensure parent directory exists
    mkdirSync(this.paths.worktreeParent, { recursive: true });
    
    // Fetch latest changes
    try {
      execFileSync('git', ['fetch', '--prune'], {
        cwd: this.paths.repoRoot,
        stdio: 'pipe'
      });
    } catch (error) {
      log('warn', 'Warning: Failed to fetch latest changes');
    }
    
    // Create worktree with new branch
    try {
      execFileSync('git', [
        'worktree',
        'add',
        '-B',
        this.paths.branchName,
        this.paths.worktreePath,
        this.config.base
      ], {
        cwd: this.paths.repoRoot,
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error(`Failed to create worktree: ${error}`);
    }
    
    log('success', '✅ Worktree created successfully');
  }

  copyEnvironmentFiles() {
    if (!this.paths) {
      throw new Error('Paths not calculated');
    }

    log('info', 'Copying environment files...');
    
    const envFiles = ['.env', '.env.example', '.env.local', '.env.development'];
    let copiedCount = 0;
    
    for (const filename of envFiles) {
      const sourcePath = path.join(this.paths.repoRoot, filename);
      const targetPath = path.join(this.paths.worktreePath, filename);
      
      if (existsSync(sourcePath)) {
        if (!existsSync(targetPath)) {
          try {
            copyFileSync(sourcePath, targetPath);
            log('success', `✅ Copied ${filename}`);
            copiedCount++;
          } catch (error) {
            log('warn', `⚠️  Failed to copy ${filename}: ${error}`);
          }
        } else {
          log('info', `ℹ️  ${filename} already exists in worktree, skipping`);
        }
      }
    }
    
    if (copiedCount === 0) {
      log('info', 'No environment files found to copy');
    }
  }

  logSuccess() {
    if (!this.paths) return;
    
    log('success', `
🎉 Worktree created successfully!

📁 Worktree Path: ${this.paths.worktreePath}
🌿 Branch Name: ${this.paths.branchName}
🎯 Base Branch: ${this.config.base}

Next steps:
  cd ${this.paths.worktreePath}
  # Start working on your feature/fix!
`);
  }

  handleError(error) {
    const message = error instanceof Error ? error.message : String(error);
    log('error', `Failed to create worktree: ${message}`);
  }
}

// Main execution
const config = parseArgs();
const creator = new WorktreeCreator(config);
creator.run().catch((error) => {
  console.error('✗ Unexpected error:', error);
  process.exit(1);
});