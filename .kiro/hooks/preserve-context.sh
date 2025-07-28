#!/usr/bin/env bash
# Context preservation hook for memory compaction

# This hook helps preserve important context during Claude Code's memory compaction

echo "=== KIRO CONTEXT PRESERVATION ==="

# List active specifications
echo "📋 Active Specifications:"
for spec_file in $(find .kiro/specs -name "spec.json" 2>/dev/null); do
    if [ -f "$spec_file" ]; then
        FEATURE=$(jq -r '.feature' "$spec_file" 2>/dev/null)
        STATUS=$(jq -r '.status' "$spec_file" 2>/dev/null)
        echo "  - $FEATURE: $STATUS"
    fi
done

# Show steering files status
echo -e "\n📁 Steering Documents:"
if [ -d ".kiro/steering" ]; then
    for file in .kiro/steering/*.md; do
        if [ -f "$file" ]; then
            echo "  - $(basename "$file"): $(stat -f "%Sm" -t "%Y-%m-%d" "$file" 2>/dev/null || date -r "$file" "+%Y-%m-%d" 2>/dev/null)"
        fi
    done
fi

# Current working context
if [ -n "$KIRO_CURRENT_SPEC" ]; then
    echo -e "\n🎯 Current Focus: $KIRO_CURRENT_SPEC"
fi

echo "=== END CONTEXT ==="