#!/bin/bash
# Setup PATH for tools installed via nvm, homebrew, etc.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" 2>/dev/null
# Fallback: source shell profile if nvm not found
if ! command -v node &>/dev/null; then
  [ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null
  [ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc" 2>/dev/null
fi

claude --dangerously-skip-permissions "$(cat <<'SIDECAR_PROMPT_EOF'
Task: Add option to turn off vim mode in search and command bar

In the settings window, add an option to turn off vim mode in the search bar and command bars so that we only have to press escape once to leave each bar and there is no weirdness with insert and normal mode for non-vim users.
SIDECAR_PROMPT_EOF
)"
rm -f "/Users/yashas/Documents/scratch/zenleap_scratch/ZenLeap-vim-mode/.sidecar-start.sh"
