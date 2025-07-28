#!/usr/bin/env bash
# Pre-command hook for Kiro spec-driven development

# Check if we're working on implementation tasks
CURRENT_SPEC=$(find .kiro/specs -name "spec.json" -exec grep -l '"status": "in-progress"' {} \; | head -1)

if [ -n "$CURRENT_SPEC" ]; then
    SPEC_DIR=$(dirname "$CURRENT_SPEC")
    FEATURE_NAME=$(basename "$SPEC_DIR")
    
    # Check if all phases are approved before allowing implementation
    if ! jq -e '.approvals.requirements and .approvals.design and .approvals.tasks' "$CURRENT_SPEC" > /dev/null 2>&1; then
        echo "⚠️  Warning: Feature '$FEATURE_NAME' has unapproved phases. Run /kiro:spec-status $FEATURE_NAME for details."
    fi
fi

# Check for steering drift (files modified more recently than steering docs)
if [ -d ".kiro/steering" ]; then
    NEWEST_STEERING=$(find .kiro/steering -name "*.md" -type f -exec stat -f "%m" {} \; 2>/dev/null | sort -n | tail -1)
    NEWEST_CODE=$(find . -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.rs" | grep -v node_modules | grep -v .kiro | xargs stat -f "%m" 2>/dev/null | sort -n | tail -1)
    
    if [ -n "$NEWEST_CODE" ] && [ -n "$NEWEST_STEERING" ] && [ "$NEWEST_CODE" -gt "$NEWEST_STEERING" ]; then
        echo "💡 Tip: Code has been modified since last steering update. Consider running /kiro:steering to update context."
    fi
fi