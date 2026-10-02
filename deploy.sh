#!/bin/sh
# Idempotent deploy for mdfocus: copies repo files over their deployed
# counterparts only when they differ, restarts mdfocus-api only if its
# source actually changed. Never deletes anything.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

WEB_SRC_DIR="$SCRIPT_DIR/web"
WEB_DST_DIR="/var/www/html/mdfocus"
API_SRC="$SCRIPT_DIR/api/app.py"
API_DST="/opt/mdfocus-api/app.py"

changed=0

deploy_file() {
    src="$1"
    dst="$2"
    if [ -f "$dst" ] && cmp -s "$src" "$dst"; then
        return 0
    fi
    if [ -f "$dst" ]; then
        cp "$src" "$dst"
    else
        install -m 644 "$src" "$dst"
    fi
    echo "deployed: $dst"
    changed=1
    return 1
}

web_changed=0
for f in index.html app.js og.png; do
    if ! deploy_file "$WEB_SRC_DIR/$f" "$WEB_DST_DIR/$f"; then
        web_changed=1
    fi
done

api_changed=0
if ! deploy_file "$API_SRC" "$API_DST"; then
    api_changed=1
fi

if [ "$changed" -eq 0 ]; then
    echo "no changes"
    exit 0
fi

if [ "$api_changed" -eq 1 ]; then
    systemctl restart mdfocus-api
    sleep 2
    systemctl is-active mdfocus-api
    echo "NRestarts: $(systemctl show mdfocus-api -p NRestarts --value)"
fi

exit 0
