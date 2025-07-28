# /kiro:spec-requirements

Generate requirements document for a feature specification.

## Purpose
Creates a comprehensive requirements document based on feature description and project context. This is Phase 1 of the 3-phase approval workflow.

## Prerequisites
- Feature must be initialized with `/kiro:spec-init`
- Steering documents should exist (recommended)

## Requirements Document Structure

### Executive Summary
- Feature overview
- Business value
- Success metrics

### User Stories
- Primary user flows
- Edge cases
- Accessibility requirements

### Functional Requirements
- Core features
- Input/output specifications
- Business rules
- Validation requirements

### Non-Functional Requirements
- Performance targets
- Security requirements
- Scalability needs
- Compatibility requirements

### Dependencies
- External services
- Internal systems
- Third-party libraries

### Constraints
- Technical limitations
- Business constraints
- Regulatory requirements

### Out of Scope
- Explicitly excluded features
- Future considerations

## Workflow
1. Check spec exists and is not already approved
2. Analyze project context from steering
3. Generate comprehensive requirements
4. Save to `requirements.md`
5. Prompt for human review

## Usage
```
/kiro:spec-requirements [feature-name]
```

Example:
```
/kiro:spec-requirements user-authentication
```

## Approval Process
After generation:
1. Review `requirements.md`
2. Make any necessary edits
3. Update `spec.json`: set `"requirements": true`
4. Proceed to design phase

## Notes
- Uses steering documents for context
- Generates based on industry best practices
- Includes testable acceptance criteria
- Human review and approval required before design phase