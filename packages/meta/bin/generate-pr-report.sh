#!/bin/bash

# Generate PR Report Script
# Usage: ./generate-pr-report.sh [from-date] [to-date] [output-file]

FROM_DATE=${1:-"2025-09-19"}
TO_DATE=${2:-"2025-09-26"}
OUTPUT_FILE=${3:-"pr-report-${FROM_DATE}-to-${TO_DATE}.md"}

echo "📊 Generating PR Report..."
echo "📅 Date range: $FROM_DATE to $TO_DATE"
echo "📄 Output file: $OUTPUT_FILE"

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN environment variable is not set"
    echo "Please set your GitHub token:"
    echo "export GITHUB_TOKEN=your_github_token_here"
    exit 1
fi

# Run the TypeScript script
npx tsx packages/meta/bin/pr-report.ts \
    --from="$FROM_DATE" \
    --to="$TO_DATE" \
    --outfile="$OUTPUT_FILE" \
    --token="$GITHUB_TOKEN"

if [ $? -eq 0 ]; then
    echo "✅ Report generated successfully!"
    echo "📄 Report saved to: $OUTPUT_FILE"
    
    # Display summary
    echo ""
    echo "📈 Quick Summary:"
    grep -E "^  [A-Za-z]+: [0-9]+ PRs$" "$OUTPUT_FILE" || echo "No summary found in output"
else
    echo "❌ Failed to generate report"
    exit 1
fi