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
Task: Add focus switching between split windows with alt and then hjkl

When we are in split windows, we want to be able to easily switch focus between the windows in the split mode with our keyboard so that we can then use vimium to navigate quickly. Don't build any vimium features- we will use the vimium extension. I just want to be able to switch focus between the tabs in the split view properly. Inspect the code from zenleap_scratch/zen-desktop folder to find the source code for zen if you need info on how things work. Make this be configurable in settings
SIDECAR_PROMPT_EOF
)"
rm -f "/Users/yashas/Documents/scratch/zenleap_scratch/ZenLeap-zenleap-workspace-focus/.sidecar-start.sh"
