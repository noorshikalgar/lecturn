#!/usr/bin/env bash
# Deletes .nfo, .url, and .torrent files under a courses library root.
# Defaults to a dry run — pass --delete to actually remove anything.
#
# Usage:
#   ./clean-junk-files.sh /mnt/courses            # dry run, lists matches + count
#   ./clean-junk-files.sh /mnt/courses --delete    # actually deletes them

set -euo pipefail

ROOT="${1:-}"
MODE="${2:-}"

if [[ -z "$ROOT" ]]; then
  echo "Usage: $0 <courses-root-path> [--delete]" >&2
  exit 1
fi

if [[ ! -d "$ROOT" ]]; then
  echo "Error: '$ROOT' is not a directory" >&2
  exit 1
fi

echo "Scanning: $ROOT"
echo "Matching: *.nfo, *.url, *.torrent"
echo

MATCHES=$(find "$ROOT" -type f \( -iname '*.nfo' -o -iname '*.url' -o -iname '*.torrent' \))
COUNT=$(echo "$MATCHES" | grep -c . || true)

if [[ "$COUNT" -eq 0 ]]; then
  echo "No matching files found."
  exit 0
fi

echo "$MATCHES"
echo
echo "Found $COUNT file(s)."

if [[ "$MODE" != "--delete" ]]; then
  echo
  echo "Dry run only — nothing deleted. Re-run with --delete to remove these files:"
  echo "  $0 \"$ROOT\" --delete"
  exit 0
fi

echo
read -r -p "About to permanently delete $COUNT file(s) under $ROOT. Type 'yes' to confirm: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted — nothing deleted."
  exit 1
fi

echo "$MATCHES" | while IFS= read -r f; do
  [[ -n "$f" ]] && rm -f -- "$f"
done

echo "Deleted $COUNT file(s)."
