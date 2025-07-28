# /kiro:steering-custom

Create custom steering documents for specialized project contexts.

## Purpose
Allows creation of domain-specific steering documents beyond the core three (product, tech, structure).

## Common Custom Steering Types

### API Standards
- REST/GraphQL conventions
- Error handling patterns
- Authentication approaches
- Rate limiting policies

### Testing Approach
- Test framework choices
- Coverage requirements
- Mock/stub strategies
- Test data management

### Security Policies
- Authentication requirements
- Authorization patterns
- Data protection standards
- Vulnerability handling

### Database Conventions
- Schema design patterns
- Migration strategies
- Query optimization rules
- Data consistency approaches

### Performance Standards
- Response time targets
- Optimization techniques
- Caching strategies
- Monitoring requirements

### Deployment Workflows
- CI/CD pipeline setup
- Environment configurations
- Release procedures
- Rollback strategies

## Inclusion Modes

### Always
- Loaded in every Claude Code interaction
- Use for critical project-wide standards

### Conditional
- Loaded when working on matching file patterns
- Example: `"src/api/**/*"` for API standards

### Manual
- Loaded only when explicitly referenced
- Use syntax: `@custom-steering.md`

## Usage
```
/kiro:steering-custom [type] [inclusion-mode]
```

Examples:
```
/kiro:steering-custom api-standards conditional
/kiro:steering-custom security-policies manual
/kiro:steering-custom testing-approach conditional
```

## Notes
- Creates file in `.kiro/steering/`
- Updates CLAUDE.md configuration
- Prompts for file patterns if conditional mode selected