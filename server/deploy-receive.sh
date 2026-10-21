#!/bin/bash
# Receives releases of anar.to over SSH. Installed as /usr/local/bin/anar-deploy and forced for the deploy key
# in /home/deploy/.ssh/authorized_keys, so that key can do nothing else:
#   command="/usr/local/bin/anar-deploy",restrict ssh-ed25519 AAAA... github-actions@anar.to
#
# Commands (sent as the SSH command):
#   deploy <label>   read a .tar.gz of dist/ on stdin, unpack it as a new release, check it, make it live
#   rollback         make the release before the live one live again
#   list             show the releases, the live one marked with *
set -euo pipefail
umask 022

SITE=/var/www/anar.to
KEEP=5
read -r cmd label _ <<< "${SSH_ORIGINAL_COMMAND:-list}"

live() { readlink -f "$SITE/current" || true; }
releases() { find "$SITE/releases" -mindepth 1 -maxdepth 1 -type d | sort; }   # ids start with a UTC timestamp
switch() { ln -sfn "$1" "$SITE/current.next" && mv -T "$SITE/current.next" "$SITE/current"; }

case "$cmd" in
  deploy)
    label=${label//[^a-zA-Z0-9]/}
    id="$(date -u +%Y%m%d%H%M%S)${label:+-$label}"
    dir="$SITE/releases/$id"
    mkdir "$dir"
    if ! tar -xzf - -C "$dir" --no-same-owner --no-same-permissions; then
      rm -rf "$dir"; echo "unpacking failed" >&2; exit 1
    fi
    for f in index.html 404.html impressum.html datenschutz.html; do
      [ -s "$dir/$f" ] || { rm -rf "$dir"; echo "release is missing $f" >&2; exit 1; }
    done
    chmod -R u=rwX,go=rX "$dir"
    switch "$dir"
    mapfile -t all < <(releases)
    for ((i = 0; i < ${#all[@]} - KEEP; i++)); do
      [ "${all[i]}" = "$(live)" ] || rm -rf "${all[i]}"
    done
    echo "live: $id"
    ;;
  rollback)
    cur=$(live); prev=""
    while read -r r; do [ "$r" = "$cur" ] && break; prev=$r; done < <(releases)
    [ -n "$prev" ] || { echo "no earlier release to go back to" >&2; exit 1; }
    switch "$prev"
    echo "live: $(basename "$prev")"
    ;;
  list)
    cur=$(live)
    while read -r r; do
      if [ "$r" = "$cur" ]; then echo "* $(basename "$r")"; else echo "  $(basename "$r")"; fi
    done < <(releases)
    ;;
  *)
    echo "unknown command: $cmd (use deploy, rollback or list)" >&2; exit 2
    ;;
esac
