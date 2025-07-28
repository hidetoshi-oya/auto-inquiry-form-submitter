# /kiro:spec-tasks

Generate implementation tasks for a feature specification.

## Purpose
Creates a detailed task breakdown based on approved design. This is Phase 3 of the 3-phase approval workflow.

## Prerequisites
- Design must be approved (`"design": true` in spec.json)
- Design document must exist

## Tasks Document Structure

### Task Categories
- Setup & Configuration
- Core Implementation
- API Development
- Database Changes
- Frontend Components
- Testing Implementation
- Documentation
- Deployment Tasks

### Task Format
```markdown
- [ ] Task description
  - Subtask details
  - Acceptance criteria
  - Dependencies
  - Estimated effort
```

### Task Properties
- Clear, actionable descriptions
- Logical ordering and dependencies
- Testable completion criteria
- Effort estimates (optional)

### Implementation Phases
1. **Foundation Tasks**
   - Project setup
   - Dependencies installation
   - Configuration

2. **Core Development**
   - Main feature implementation
   - API endpoints
   - Data models

3. **Integration Tasks**
   - Service connections
   - Third-party integrations
   - Internal system connections

4. **Quality Assurance**
   - Unit tests
   - Integration tests
   - Performance tests

5. **Finalization**
   - Documentation
   - Deployment setup
   - Monitoring configuration

## Workflow
1. Verify design is approved
2. Analyze design document
3. Break down into implementable tasks
4. Order by dependencies
5. Save to `tasks.md`
6. Prompt for human review

## Usage
```
/kiro:spec-tasks [feature-name]
```

Example:
```
/kiro:spec-tasks user-authentication
```

## Approval Process
After generation:
1. Review `tasks.md`
2. Make any necessary edits
3. Update `spec.json`: set `"tasks": true`
4. Begin implementation

## Task Tracking
During implementation:
- Check off completed tasks in `tasks.md`
- Use `/kiro:spec-status` to monitor progress
- Update task notes as needed

## Notes
- Based on approved design
- Includes all implementation aspects
- Ordered by logical dependencies
- Human review and approval required before implementation