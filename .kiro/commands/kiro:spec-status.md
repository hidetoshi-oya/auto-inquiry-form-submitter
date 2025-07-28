# /kiro:spec-status

Check the current status and progress of a feature specification.

## Purpose
Provides a comprehensive view of:
- Specification approval status
- Task completion progress
- Current phase in the workflow
- Next required actions

## Status Information Displayed

### Specification Overview
- Feature name
- Creation date
- Last updated
- Overall status

### Approval Status
```
✅ Requirements: Approved (2024-01-15)
❌ Design: Pending approval
⏸️ Tasks: Awaiting design approval
```

### Task Progress (if applicable)
```
Implementation Progress: 45% (9/20 tasks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
████████████████████░░░░░░░░░░░░░░░░ 45%

Completed Tasks:
✅ Setup project structure
✅ Install dependencies
✅ Configure database connection
...

In Progress:
🔄 Implement user model
🔄 Create authentication middleware

Remaining:
⏳ API endpoints (5 tasks)
⏳ Frontend components (4 tasks)
⏳ Testing (3 tasks)
```

### Next Actions
Based on current status, suggests next steps:
- "Review and approve requirements"
- "Generate design document"
- "Begin implementation"
- "Complete remaining tasks"

### Compliance Warnings
- Missing required documents
- Unapproved phases
- Stale specifications (>30 days without update)

## Usage
```
/kiro:spec-status [feature-name]
```

Example:
```
/kiro:spec-status user-authentication
```

To see all specifications:
```
/kiro:spec-status --all
```

## Status Types

### initialized
- Spec created but no documents generated

### requirements-pending
- Requirements generated, awaiting approval

### design-pending
- Requirements approved, design awaiting approval

### tasks-pending
- Design approved, tasks awaiting approval

### in-progress
- All phases approved, implementation ongoing

### completed
- All tasks marked as done

### stale
- No updates for extended period

## Notes
- Parses task checkboxes for progress
- Shows blocking issues
- Suggests next actions
- Helps maintain workflow compliance