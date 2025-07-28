# Technology Stack

## Architecture

Kiro Spec-Driven Development is implemented as a command-line extension system for Claude Code, utilizing hooks and slash commands to provide structured development workflows.

### System Components
- **Slash Commands**: Primary interface for user interactions
- **Hook System**: Automated event-driven actions
- **Markdown Storage**: Human-readable specification and steering files
- **JSON Metadata**: Machine-readable state tracking

## Frontend

N/A - This is a command-line tool extension with no traditional frontend.

## Backend

### Core Technologies
- **Platform**: Claude Code CLI
- **Language**: JavaScript/TypeScript (for hooks)
- **Storage**: Local filesystem (markdown and JSON files)
- **Version Control**: Git-compatible file structure

### Integration Points
- **Claude Code Hooks**: Event-driven automation
- **TodoWrite Tool**: Native task management integration
- **File System Tools**: Read, Write, Edit, MultiEdit
- **Bash Integration**: Command execution capabilities

## Development Environment

### Required Tools
- Claude Code CLI (latest version)
- Text editor for markdown editing
- Git (optional but recommended)

### Setup Steps
1. Initialize project with CLAUDE.md configuration
2. Run `/kiro:steering` to create steering documents
3. Use `/kiro:spec-init` to start first specification

## Common Commands

### Steering Commands
```bash
/kiro:steering                    # Create or update core steering documents
/kiro:steering-custom             # Add custom steering for specialized contexts
```

### Specification Commands
```bash
/kiro:spec-init [feature]         # Initialize new specification
/kiro:spec-requirements [feature] # Generate requirements document
/kiro:spec-design [feature]       # Generate technical design
/kiro:spec-tasks [feature]        # Generate implementation tasks
/kiro:spec-status [feature]       # Check specification progress
```

### Development Commands
```bash
# No specific build or test commands - this is a methodology framework
# Implementation projects will have their own commands documented in specs
```

## Environment Variables

No environment variables required for core functionality. Implementation projects may define their own.

## Port Configuration

N/A - No network services or ports used by the framework itself.