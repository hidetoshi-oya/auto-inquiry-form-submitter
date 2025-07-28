# /kiro:spec-init

Initialize a new specification structure for a feature.

## Purpose
Creates the basic directory structure and configuration for a new feature specification, following the 3-phase approval workflow.

## Structure Created
```
.kiro/specs/[feature-name]/
├── spec.json           # Specification metadata and approval tracking
├── requirements.md     # Business requirements (Phase 1)
├── design.md          # Technical design (Phase 2)
└── tasks.md           # Implementation tasks (Phase 3)
```

## spec.json Format
```json
{
  "feature": "[feature-name]",
  "created": "[timestamp]",
  "updated": "[timestamp]",
  "status": "initialized",
  "approvals": {
    "requirements": false,
    "design": false,
    "tasks": false
  },
  "implementation": {
    "started": null,
    "completed": null
  }
}
```

## Workflow Integration
After initialization:
1. Run `/kiro:spec-requirements [feature-name]` to generate requirements
2. Review and approve requirements
3. Run `/kiro:spec-design [feature-name]` to generate design
4. Review and approve design
5. Run `/kiro:spec-tasks [feature-name]` to generate tasks
6. Review and approve tasks
7. Begin implementation

## Usage
```
/kiro:spec-init [feature-name]
```

Example:
```
/kiro:spec-init user-authentication
/kiro:spec-init payment-processing
/kiro:spec-init data-export
```

## Notes
- Feature names should use kebab-case
- Creates empty markdown files for manual editing
- Sets all approvals to false initially
- Updates active specifications list in CLAUDE.md