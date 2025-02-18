#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { simpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Helper function to clone repository
async function cloneRepo(repoUrl) {
  // Create deterministic directory name based on repo URL
  const repoHash = crypto.createHash('sha256')
    .update(repoUrl)
    .digest('hex')
    .slice(0, 12);
  const tempDir = path.join(os.tmpdir(), `github_tools_${repoHash}`);

  // Check if directory exists and is a valid git repo
  if (await fs.pathExists(tempDir)) {
    try {
      const git = simpleGit(tempDir);
      const remotes = await git.getRemotes(true);
      if (remotes.length > 0 && remotes[0].refs.fetch === repoUrl) {
        return tempDir;
      }
    } catch (error) {
      // If there's any error with existing repo, clean it up
      await fs.remove(tempDir);
    }
  }

  // Create directory and clone repository
  await fs.ensureDir(tempDir);
  try {
    await simpleGit().clone(repoUrl, tempDir);
    return tempDir;
  } catch (error) {
    // Clean up on error
    await fs.remove(tempDir);
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

// Helper function to generate directory tree
async function getDirectoryTree(dirPath, prefix = '') {
  let output = '';
  const entries = await fs.readdir(dirPath);
  entries.sort();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.startsWith('.git')) continue;

    const isLast = i === entries.length - 1;
    const currentPrefix = isLast ? '└── ' : '├── ';
    const nextPrefix = isLast ? '    ' : '│   ';
    const entryPath = path.join(dirPath, entry);
    
    output += prefix + currentPrefix + entry + '\n';
    
    const stats = await fs.stat(entryPath);
    if (stats.isDirectory()) {
      output += await getDirectoryTree(entryPath, prefix + nextPrefix);
    }
  }
  
  return output;
}

class GitRepoBrowserServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-git-repo-browser',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'git_directory_structure',
          description: 'Clone a Git repository and return its directory structure in a tree format.',
          inputSchema: {
            type: 'object',
            properties: {
              repo_url: {
                type: 'string',
                description: 'The URL of the Git repository',
              },
            },
            required: ['repo_url'],
          },
        },
        {
          name: 'git_read_important_files',
          description: 'Read the contents of specified files in a given git repository.',
          inputSchema: {
            type: 'object',
            properties: {
              repo_url: {
                type: 'string',
                description: 'The URL of the Git repository',
              },
              file_paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of file paths to read (relative to repository root)',
              },
            },
            required: ['repo_url', 'file_paths'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'git_directory_structure':
          return this.handleGitDirectoryStructure(request.params.arguments);
        case 'git_read_important_files':
          return this.handleGitReadImportantFiles(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async handleGitDirectoryStructure({ repo_url }) {
    try {
      const repoPath = await cloneRepo(repo_url);
      const tree = await getDirectoryTree(repoPath);
      return {
        content: [
          {
            type: 'text',
            text: tree,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async handleGitReadImportantFiles({ repo_url, file_paths }) {
    try {
      const repoPath = await cloneRepo(repo_url);
      const results = {};

      for (const filePath of file_paths) {
        const fullPath = path.join(repoPath, filePath);
        try {
          if (await fs.pathExists(fullPath)) {
            results[filePath] = await fs.readFile(fullPath, 'utf8');
          } else {
            results[filePath] = 'Error: File not found';
          }
        } catch (error) {
          results[filePath] = `Error reading file: ${error.message}`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Failed to process repository: ${error.message}` }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Git Repo Browser MCP server running on stdio');
  }
}

const server = new GitRepoBrowserServer();
server.run().catch(console.error);
