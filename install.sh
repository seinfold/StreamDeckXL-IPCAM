#!/usr/bin/env bash
set -euo pipefail

PREFIX="${PREFIX:-$HOME/.local}"
BIN="$PREFIX/bin"
CFG="${XDG_CONFIG_HOME:-$HOME/.config}/streamdeck-camera"
UNITS="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

here="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$BIN" "$CFG" "$UNITS"

install -m 755 "$here/streamdeck-camera"                 "$BIN/streamdeck-camera"
install -m 644 "$here/systemd/streamdeck-camera.service" "$UNITS/streamdeck-camera.service"
install -m 644 "$here/systemd/streamdeck-ui.service"     "$UNITS/streamdeck-ui.service"

if [[ ! -f "$CFG/config.ini" ]]; then
    install -m 600 "$here/config.example.ini" "$CFG/config.ini"
    echo "Created $CFG/config.ini — edit it with your camera details."
fi

systemctl --user daemon-reload

cat <<EOF

Installed:
  $BIN/streamdeck-camera
  $UNITS/streamdeck-camera.service
  $UNITS/streamdeck-ui.service

Next:
  1. Edit $CFG/config.ini
  2. systemctl --user start streamdeck-camera.service

Make sure $BIN is on your \$PATH.
EOF
