# /kiro:spec-design

Generate technical design document for a feature specification.

## Purpose
Creates a detailed technical design based on approved requirements. This is Phase 2 of the 3-phase approval workflow.

## Prerequisites
- Requirements must be approved (`"requirements": true` in spec.json)
- Requirements document must exist

## Design Document Structure

### Architecture Overview
- High-level design approach
- Component interactions
- Data flow diagrams

### Technical Approach
- Implementation strategy
- Technology choices
- Design patterns

### API Design
- Endpoints/interfaces
- Request/response formats
- Error handling
- Versioning strategy

### Data Model
- Schema definitions
- Relationships
- Migrations approach
- Data validation

### Security Design
- Authentication flow
- Authorization model
- Data protection
- Threat mitigation

### Performance Considerations
- Optimization strategies
- Caching approach
- Load handling
- Monitoring points

### Testing Strategy
- Unit test approach
- Integration test plan
- Performance test criteria
- Security test requirements

### Deployment Plan
- Environment requirements
- Configuration needs
- Rollout strategy
- Rollback procedures

## Workflow
1. Verify requirements are approved
2. Analyze requirements document
3. Consider tech stack from steering
4. Generate comprehensive design
5. Save to `design.md`
6. Prompt for human review

## Usage
```
/kiro:spec-design [feature-name]
```

Example:
```
/kiro:spec-design user-authentication
```

## Approval Process
After generation:
1. Review `design.md`
2. Make any necessary edits
3. Update `spec.json`: set `"design": true`
4. Proceed to tasks phase

## Notes
- Based on approved requirements
- Follows project architecture patterns
- Includes implementation details
- Human review and approval required before tasks phase