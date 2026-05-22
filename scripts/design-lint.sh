#!/usr/bin/env bash
# Lightweight design-system guardrails (AI slop patterns).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_SRC="$ROOT/apps/web/src"
WORKSPACE_ROUTES="$WEB_SRC/app/(workspace)"

fail=0

report() {
  echo "design-lint: $1"
  fail=1
}

# Arbitrary font sizes in workspace UI (exclude em-relative code blocks)
matches="$(rg 'text-\[0\.' "$WORKSPACE_ROUTES" "$WEB_SRC/components/dashboard" "$WEB_SRC/components/app-sidebar.tsx" -g '*.tsx' 2>/dev/null | rg -v '0\.875em' || true)"
if [ -n "$matches" ]; then
  report "arbitrary text-[0.*] sizes in workspace UI (use text-ui-* / text-title-*)"
  echo "$matches" | head -20
fi

# Decorative glass on headers
if rg -q 'backdrop-blur' "$WEB_SRC/app" "$WEB_SRC/components/auth-shell-layout.tsx" -g '*.tsx' 2>/dev/null; then
  report "backdrop-blur in app shells (prefer bg-paper/95 + border-rule)"
  rg 'backdrop-blur' "$WEB_SRC/app" "$WEB_SRC/components/auth-shell-layout.tsx" -g '*.tsx' --no-heading 2>/dev/null || true
fi

# Inline red button styles in workspace
if rg -q 'bg-mark text-paper' "$WORKSPACE_ROUTES" -g '*.tsx' 2>/dev/null; then
  report "inline bg-mark button styles in workspace (use variant=\"mark\")"
  rg 'bg-mark text-paper' "$WORKSPACE_ROUTES" -g '*.tsx' --no-heading 2>/dev/null | head -15 || true
fi

# shadcn Card in workspace routes
if rg -q '@/components/ui/card' "$WORKSPACE_ROUTES" -g '*.tsx' 2>/dev/null; then
  report "Card import in workspace routes (use Surface + rows)"
fi

# Gradient text anti-pattern
if rg -q 'bg-clip-text' "$WEB_SRC" -g '*.tsx' 2>/dev/null; then
  report "possible gradient text (bg-clip-text)"
fi

if [ "$fail" -eq 0 ]; then
  echo "design-lint: OK"
fi

exit "$fail"
