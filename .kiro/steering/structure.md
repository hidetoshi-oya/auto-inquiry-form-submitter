# Project Structure

## Root Directory Organization

```
af/                              # Project root (spec-driven development framework)
├── .claude/                     # Claude Code configuration (currently empty)
├── .kiro/                       # Kiro framework directory
│   ├── steering/                # Project context documents
│   │   ├── product.md           # Product overview and features
│   │   ├── tech.md              # Technology stack and architecture
│   │   └── structure.md         # This file - project organization
│   └── specs/                   # Feature specifications (created on demand)
│       └── [feature-name]/      # Individual feature directories
│           ├── spec.json        # Specification metadata and approval status
│           ├── requirements.md  # Business requirements document
│           ├── design.md        # Technical design document
│           └── tasks.md         # Implementation task list
└── CLAUDE.md                    # Project instructions and slash commands
```

## Subdirectory Structures

### `.kiro/steering/` - Project Knowledge Base
- **Purpose**: Persistent project context for AI interactions
- **Always Included Files**: Loaded in every Claude Code session
  - `product.md`: Business context and objectives
  - `tech.md`: Technical constraints and stack
  - `structure.md`: Organizational patterns
- **Custom Files**: Added via `/kiro:steering-custom` for specialized contexts

### `.kiro/specs/` - Feature Specifications
- **Purpose**: Structured development workflow documents
- **Organization**: One subdirectory per feature
- **Lifecycle**: Requirements → Design → Tasks → Implementation
- **Approval Tracking**: Via `spec.json` boolean flags

## Code Organization Patterns

### Markdown Document Structure
- **Headers**: Clear hierarchical organization with `#`, `##`, `###`
- **Lists**: Bulleted for features, numbered for steps
- **Code Blocks**: Triple backticks with language hints
- **Checkboxes**: `- [ ]` for task tracking in tasks.md

### JSON Metadata Structure
```json
{
  "feature": "feature-name",
  "created": "ISO-8601 timestamp",
  "requirements": false,  // Approval status
  "design": false,       // Approval status
  "tasks": false         // Approval status
}
```

## File Naming Conventions

### Steering Documents
- **Format**: `lowercase-hyphenated.md`
- **Core Files**: `product.md`, `tech.md`, `structure.md`
- **Custom Files**: `domain-specific.md` (e.g., `api-standards.md`)

### Specification Files
- **Directory**: Feature name in lowercase with hyphens
- **Fixed Names**: `spec.json`, `requirements.md`, `design.md`, `tasks.md`
- **No Versioning**: Use git for version control

## Import Organization

N/A - This framework uses slash commands rather than code imports.

## Key Architectural Principles

1. **Human-Readable First**: All specifications in markdown for easy review
2. **Explicit Approval Gates**: No phase proceeds without manual confirmation
3. **Stateless Commands**: Each slash command is independent
4. **File-Based State**: All state persisted to filesystem
5. **Git-Friendly**: Plain text files for version control
6. **Convention Over Configuration**: Fixed directory structure and filenames
7. **Progressive Enhancement**: Start simple, add custom steering as needed
8. **AI-Optimized Context**: Steering documents structured for LLM consumption