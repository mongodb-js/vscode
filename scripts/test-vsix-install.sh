#!/usr/bin/env bash

set -e

echo "VSIX Installation Test - $RUNNER_OS"
echo ""

# Find the VSIX file (should be in the current directory after build)
VSIX_FILE=$(find . -maxdepth 1 -name '*.vsix' -print -quit)
if [ -z "$VSIX_FILE" ]; then
  echo "Error: No .vsix file found" >&2
  exit 1
fi

echo "Found VSIX file: $VSIX_FILE"

# Verify the file exists and is readable
if [ ! -r "$VSIX_FILE" ]; then
  echo "Error: VSIX file is not readable" >&2
  exit 1
fi

echo "Installing: $VSIX_FILE"
ls -lh "$VSIX_FILE"
echo ""

# Determine VS Code CLI command based on OS
if [ "$RUNNER_OS" = "macOS" ]; then
  VSCODE_CLI="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
  if [ ! -f "$VSCODE_CLI" ]; then
    echo "Installing VS Code on macOS..."
    if ! command -v brew &> /dev/null; then
      echo "Error: Homebrew is not installed" >&2
      exit 1
    fi
    brew install --cask visual-studio-code
    sleep 5
    if [ ! -f "$VSCODE_CLI" ]; then
      echo "Error: VS Code installation failed" >&2
      exit 1
    fi
  fi

elif [ "$RUNNER_OS" = "Windows" ]; then
  if command -v code &> /dev/null; then
    VSCODE_CLI="code"
  else
    echo "Installing VS Code on Windows..."
    if ! command -v choco &> /dev/null; then
      echo "Error: Chocolatey is not installed" >&2
      exit 1
    fi
    choco install vscode -y --no-progress

    POSSIBLE_PATHS=(
      "/c/Program Files/Microsoft VS Code/bin/code"
      "/c/Program Files (x86)/Microsoft VS Code/bin/code"
      "$LOCALAPPDATA/Programs/Microsoft VS Code/bin/code"
    )

    VSCODE_CLI=""
    for path in "${POSSIBLE_PATHS[@]}"; do
      if [ -f "$path" ] || [ -f "${path}.cmd" ]; then
        VSCODE_CLI="code"
        export PATH="$PATH:$(dirname "$path")"
        break
      fi
    done

    if [ -z "$VSCODE_CLI" ]; then
      export PATH="$PATH:/c/Program Files/Microsoft VS Code/bin"
      if command -v code &> /dev/null; then
        VSCODE_CLI="code"
      else
        echo "Error: VS Code installation failed or not found in PATH" >&2
        exit 1
      fi
    fi
    sleep 5
  fi

else
  # Linux
  if command -v code &> /dev/null; then
    VSCODE_CLI="code"
  else
    echo "Installing VS Code on Linux..."
    wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
    sudo install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
    echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list > /dev/null
    rm -f packages.microsoft.gpg
    sudo apt-get update
    sudo apt-get install -y code
    if ! command -v code &> /dev/null; then
      echo "Error: VS Code installation failed" >&2
      exit 1
    fi
    VSCODE_CLI="code"
    sleep 5
  fi
fi

echo "VS Code CLI: $VSCODE_CLI"
"$VSCODE_CLI" --version
echo ""

# Get extension ID from package.json
EXTENSION_ID=$(node -p "const pkg = require('./package.json'); pkg.publisher + '.' + pkg.name")
echo "Extension ID: $EXTENSION_ID"
echo ""

# Install the extension
echo "Installing extension..."
"$VSCODE_CLI" --install-extension "$VSIX_FILE" --force
sleep 2

# Verify installation
echo "Verifying installation..."
INSTALLED_EXTENSIONS=$("$VSCODE_CLI" --list-extensions)

if echo "$INSTALLED_EXTENSIONS" | grep -q "$EXTENSION_ID"; then
  INSTALLED_VERSION=$("$VSCODE_CLI" --list-extensions --show-versions | grep "$EXTENSION_ID")
  echo "✓ Installed: $INSTALLED_VERSION"
else
  echo "Error: Extension not found in installed extensions list" >&2
  echo "Expected: $EXTENSION_ID"
  echo "Installed extensions:"
  echo "$INSTALLED_EXTENSIONS"
  exit 1
fi
echo ""

# Uninstall the extension
echo "Uninstalling extension..."
"$VSCODE_CLI" --uninstall-extension "$EXTENSION_ID"
sleep 2

# Verify uninstallation
INSTALLED_EXTENSIONS_AFTER=$("$VSCODE_CLI" --list-extensions)
if echo "$INSTALLED_EXTENSIONS_AFTER" | grep -q "$EXTENSION_ID"; then
  echo "Warning: Extension still appears after uninstall"
else
  echo "✓ Uninstalled successfully"
fi
echo ""

echo "✓ VSIX installation test completed"
