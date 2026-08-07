#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CreateCommand } from './commands/create.js';
import { CloseCommand } from './commands/close.js';
import { SyncEnvCommand } from './commands/sync-env.js';
import { ListCommand } from './commands/list.js';
import { CleanupCommand } from './commands/cleanup.js';
import {
  WorkspaceConfig,
  CloseOptions,
  SyncEnvOptions,
  ListOptions,
  CleanupOptions,
  PackageJson
} from './types/index.js';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson: PackageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
const VERSION = packageJson.version;

/**
 * WorkForge v3.0 - Advanced Git Worktree Manager
 *
 * Commands:
 * - create: Create a new worktree
 * - close: Close a worktree with intelligent environment sync
 * - sync-env: Sync environment variables between worktrees
 * - list: List all worktrees
 * - cleanup: Clean up old backups and logs
 */

async function main(): Promise<void> {
  await yargs(hideBin(process.argv))
    .scriptName('workforge')
    .usage('Usage: $0 <command> [options]')
    .version(VERSION)

    // ===== CREATE COMMAND =====
    .command(
      'create',
      'Create a new Git worktree',
      (yargs) => {
        return yargs
          .option('type', {
            alias: 't',
            type: 'string',
            description: 'Branch type (feat, fix, doc, etc.)',
            demandOption: true
          })
          .option('name', {
            alias: 'n',
            type: 'string',
            description: 'Feature/branch name (kebab-case)',
            demandOption: true
          })
          .option('base', {
            alias: 'b',
            type: 'string',
            description:
              'Base branch to fork from. Omit to auto-detect the repository primary branch from the remote. ' +
              'Always forks from the remote tip (origin/<base>) when the branch exists on the remote.'
          })
          .option('ticket', {
            alias: 'j',
            type: 'string',
            description: 'Jira ticket ID (format: BZ-12345)',
            coerce: (value: string) => {
              if (value && !/^[A-Z]+-\d+$/.test(value)) {
                throw new Error('Invalid ticket format. Use format like BZ-12345');
              }
              return value;
            }
          })
          .option('yes', {
            alias: 'y',
            type: 'boolean',
            description: 'Skip confirmations',
            default: false
          })
          .example('$0 create -t feat -n auth', 'Create feat/auth from the detected primary branch')
          .example('$0 create -t fix -n bug -b develop', 'Create from origin/develop')
          .example('$0 create -t feat -n api -b beta --yes', 'Create from beta branch')
          .example('$0 create -t feat -n api -j BZ-123', 'Create with Jira ticket')
          .example('$0 create -t feat -n auth -j BZ-456', 'Create feat/BZ-456-auth worktree')
          .example('$0 create -t fix -n "Bug Fix Name" --yes', 'Name auto-converted to kebab-case');
      },
      async (argv) => {
        const config: WorkspaceConfig = {
          type: argv.type as string,
          name: argv.name as string,
          base: argv.base as string | undefined,
          yes: argv.yes as boolean,
          ticketId: argv.ticket as string | undefined
        };

        const command = new CreateCommand(config);
        await command.run();
      }
    )

    // ===== CLOSE COMMAND =====
    .command(
      'close [path]',
      'Close a worktree with intelligent environment sync',
      (yargs) => {
        return yargs
          .positional('path', {
            type: 'string',
            description: 'Path to worktree (optional, auto-detects if not provided)'
          })
          .option('name', {
            alias: 'n',
            type: 'string',
            description: 'Worktree name to close (alternative to path)'
          })
          .option('delete-branch', {
            alias: 'd',
            type: 'boolean',
            description: 'Delete the branch after closing',
            default: false
          })
          .option('skip-sync', {
            alias: 's',
            type: 'boolean',
            description: 'Skip environment variable sync',
            default: false
          })
          .option('force', {
            alias: 'f',
            type: 'boolean',
            description: 'Force close even with uncommitted changes',
            default: false
          })
          .option('yes', {
            alias: 'y',
            type: 'boolean',
            description: 'Skip confirmations',
            default: false
          })
          .option('dry-run', {
            type: 'boolean',
            description: 'Preview changes without executing',
            default: false
          })
          .example('$0 close', 'Close current worktree')
          .example('$0 close /path/to/worktree', 'Close specific worktree')
          .example('$0 close -n feat-auth', 'Close worktree by name')
          .example('$0 close -d -y', 'Close and delete branch, skip prompts')
          .example('$0 close --skip-sync', 'Close without syncing .env');
      },
      async (argv) => {
        const options: CloseOptions = {
          path: argv.path as string | undefined,
          name: argv.name as string | undefined,
          deleteBranch: argv.deleteBranch as boolean,
          skipSync: argv.skipSync as boolean,
          force: argv.force as boolean,
          yes: argv.yes as boolean,
          dryRun: argv.dryRun as boolean
        };

        const command = new CloseCommand(options);
        await command.run();
      }
    )

    // ===== SYNC-ENV COMMAND =====
    .command(
      'sync-env',
      'Sync environment variables between worktrees',
      (yargs) => {
        return yargs
          .option('from', {
            type: 'string',
            description: 'Source worktree path or name'
          })
          .option('to', {
            type: 'string',
            description: 'Target worktree path or name'
          })
          .option('between', {
            type: 'string',
            description: 'Bidirectional sync (choose direction interactively)'
          })
          .option('yes', {
            alias: 'y',
            type: 'boolean',
            description: 'Auto-accept all changes',
            default: false
          })
          .option('dry-run', {
            type: 'boolean',
            description: 'Preview changes without executing',
            default: false
          })
          .conflicts('from', 'between')
          .conflicts('to', 'between')
          .example('$0 sync-env', 'Auto-detect: sync main to current worktree')
          .example('$0 sync-env --from main --to feat-auth', 'Sync from main to feat-auth')
          .example('$0 sync-env --from feat-auth', 'Sync feat-auth to main')
          .example('$0 sync-env --to feat-auth', 'Sync main to feat-auth')
          .example('$0 sync-env --between feat-auth', 'Bidirectional sync');
      },
      async (argv) => {
        const options: SyncEnvOptions = {
          from: argv.from as string | undefined,
          to: argv.to as string | undefined,
          between: argv.between as string | undefined,
          yes: argv.yes as boolean,
          dryRun: argv.dryRun as boolean
        };

        const command = new SyncEnvCommand(options);
        await command.run();
      }
    )

    // ===== LIST COMMAND =====
    .command(
      'list',
      'List all worktrees',
      (yargs) => {
        return yargs
          .option('all', {
            alias: 'a',
            type: 'boolean',
            description: 'List worktrees from all repositories',
            default: false
          })
          .option('json', {
            type: 'boolean',
            description: 'Output in JSON format'
          })
          .option('simple', {
            type: 'boolean',
            description: 'Simple one-line format'
          })
          .option('sort', {
            type: 'string',
            description: 'Sort by: name, path, age',
            choices: ['name', 'path', 'age'] as const
          })
          .conflicts('json', 'simple')
          .example('$0 list', 'List worktrees (table format)')
          .example('$0 list --json', 'List in JSON format')
          .example('$0 list --simple', 'Simple list')
          .example('$0 list --sort name', 'Sort by branch name');
      },
      async (argv) => {
        const options: ListOptions = {
          all: argv.all as boolean,
          json: (argv.json as boolean) || false,
          simple: (argv.simple as boolean) || false,
          sortBy: argv.sort as 'name' | 'path' | 'age' | undefined
        };

        const command = new ListCommand(options);
        await command.run();
      }
    )

    // ===== CLEANUP COMMAND =====
    .command(
      'cleanup',
      'Clean up old backups and logs',
      (yargs) => {
        return yargs
          .option('older-than', {
            type: 'number',
            description: 'Delete backups older than N days'
          })
          .option('yes', {
            alias: 'y',
            type: 'boolean',
            description: 'Skip confirmation',
            default: false
          })
          .option('dry-run', {
            type: 'boolean',
            description: 'Preview what would be deleted',
            default: false
          })
          .example('$0 cleanup', 'Clean up all backups')
          .example('$0 cleanup --older-than 30', 'Delete backups older than 30 days')
          .example('$0 cleanup --dry-run', 'Preview cleanup');
      },
      async (argv) => {
        const options: CleanupOptions = {
          olderThan: argv.olderThan as number | undefined,
          yes: argv.yes as boolean,
          dryRun: argv.dryRun as boolean
        };

        const command = new CleanupCommand(options);
        await command.run();
      }
    )

    // Global options
    .help()
    .alias('h', 'help')
    .alias('v', 'version')
    .demandCommand(1, 'You must specify a command')
    .strict()
    .recommendCommands()
    .epilogue(`
WorkForge v3.0 - Advanced Git Worktree Manager
------------------------------------------------
Features:
  • Intelligent environment variable synchronization
  • Side-by-side diff visualization
  • Interactive variable selection
  • Automatic backup management
  • Complete audit trail
  • Safety checks before worktree closure

Documentation: https://github.com/yourusername/workforge
Issues: https://github.com/yourusername/workforge/issues
    `)
    .parseAsync();
}

// Global error handler
main().catch((error) => {
  console.error(chalk.red('✗ Unexpected error:'), error);
  process.exit(1);
});
