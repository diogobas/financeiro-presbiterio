#!/usr/bin/env bash
set -euo pipefail

# Helper to set JAVA_HOME to a local Java 21 installation (macOS)
# Usage: source ./scripts/use-java21.sh

if command -v /usr/libexec/java_home >/dev/null 2>&1; then
  if /usr/libexec/java_home -v21 >/dev/null 2>&1; then
    export JAVA_HOME=$(/usr/libexec/java_home -v21)
    echo "JAVA_HOME set to $JAVA_HOME"
    java -version
    mvn -v
  else
    cat <<'MSG'
Java 21 (Temurin 21) not found on this machine.
Install it with Homebrew:

  brew install --cask temurin21

Then run:

  source ./scripts/use-java21.sh

MSG
    exit 1
  fi
else
  echo "This helper assumes macOS with /usr/libexec/java_home available."
  exit 1
fi
