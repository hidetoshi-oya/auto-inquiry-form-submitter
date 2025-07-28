#!/usr/bin/env bash
# Post-command hook for Kiro spec-driven development

# Function to count completed tasks in a markdown file
count_tasks() {
    local file=$1
    local total=$(grep -c "^- \[ \]" "$file" 2>/dev/null || echo 0)
    local completed=$(grep -c "^- \[x\]" "$file" 2>/dev/null || echo 0)
    echo "$completed/$total"
}

# Update task progress for active specifications
for spec_file in $(find .kiro/specs -name "spec.json" -exec grep -l '"status": "in-progress"' {} \;); do
    SPEC_DIR=$(dirname "$spec_file")
    TASKS_FILE="$SPEC_DIR/tasks.md"
    
    if [ -f "$TASKS_FILE" ]; then
        PROGRESS=$(count_tasks "$TASKS_FILE")
        FEATURE_NAME=$(basename "$SPEC_DIR")
        
        # Update spec.json with current timestamp
        if command -v jq >/dev/null 2>&1; then
            jq --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.updated = $time' "$spec_file" > "$spec_file.tmp" && mv "$spec_file.tmp" "$spec_file"
        fi
        
        echo "📊 Task Progress for '$FEATURE_NAME': $PROGRESS tasks completed"
    fi
done

# Check for completed specifications
for spec_file in $(find .kiro/specs -name "spec.json"); do
    SPEC_DIR=$(dirname "$spec_file")
    TASKS_FILE="$SPEC_DIR/tasks.md"
    
    if [ -f "$TASKS_FILE" ]; then
        TOTAL=$(grep -c "^- \[ \]" "$TASKS_FILE" 2>/dev/null || echo 0)
        COMPLETED=$(grep -c "^- \[x\]" "$TASKS_FILE" 2>/dev/null || echo 0)
        
        if [ "$TOTAL" -eq 0 ] && [ "$COMPLETED" -gt 0 ]; then
            # All tasks completed
            FEATURE_NAME=$(basename "$SPEC_DIR")
            echo "🎉 Congratulations! All tasks for '$FEATURE_NAME' are completed!"
            
            # Update status to completed
            if command -v jq >/dev/null 2>&1; then
                jq '.status = "completed"' "$spec_file" > "$spec_file.tmp" && mv "$spec_file.tmp" "$spec_file"
            fi
        fi
    fi
done