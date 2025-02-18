# MCP Git Repo Browser (Node.js)

A Node.js implementation of a Git repository browser using the Model Context Protocol (MCP).

## Configuration

Add this to your MCP settings configuration file:

```json
{
    "mcpServers": {
        "mcp-git-repo-browser": {
            "command": "node",
            "args": ["/path/to/mcp-git-repo-browser/src/index.js"]
        }
    }
}
```

## Features

The server provides two main tools:

1. `git_directory_structure`: Returns a tree-like representation of a repository's directory structure
   - Input: Repository URL
   - Output: ASCII tree representation of the repository structure

2. `git_read_important_files`: Reads and returns the contents of specified files in a repository
   - Input: Repository URL and list of file paths
   - Output: Dictionary mapping file paths to their contents

## Implementation Details

- Uses Node.js native modules (crypto, path, os) for core functionality
- Leverages fs-extra for enhanced file operations
- Uses simple-git for Git repository operations
- Implements clean error handling and resource cleanup
- Creates deterministic temporary directories based on repository URL hashes
- Reuses cloned repositories when possible for efficiency

## Requirements

- Node.js 14.x or higher
- Git installed on the system

## Installation

```bash
git clone <repository-url>
cd mcp-git-repo-browser
npm install
```

## Usage

Start the server:

```bash
node src/index.js
```

The server runs on stdio, making it compatible with MCP clients.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
