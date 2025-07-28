# /kiro:steering

Create or update project steering documents to provide persistent context for Claude Code.

## Purpose
This command intelligently manages steering documents based on project state:
- For new/empty projects: Creates initial steering files
- For existing projects: Updates steering while preserving customizations
- Detects project type and suggests appropriate content

## Steering Documents Created/Updated

### product.md
- Product overview and vision
- Target users and use cases
- Core features and value proposition
- Business objectives

### tech.md
- Technology stack and dependencies
- Architecture decisions and patterns
- Development environment setup
- Build commands and scripts
- Port assignments and services

### structure.md
- Directory organization
- Code patterns and conventions
- Naming standards
- File placement guidelines

## Workflow
1. Analyze project structure and existing files
2. Detect project type (React, Node.js, Python, etc.)
3. Check for existing steering documents
4. Create new files or merge updates intelligently
5. Preserve user customizations in existing files

## Usage
```
/kiro:steering
```

## Notes
- Always preserves user edits in existing files
- Suggests content based on detected project type
- Creates all three core steering files
- Updates CLAUDE.md with active steering configuration