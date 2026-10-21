#!/bin/bash
# One-time setup on the server for deploys from GitHub Actions. Run as root from this folder:
#   bash setup-deploy-user.sh "ssh-ed25519 AAAA... github-actions@anar.to"
# It creates a "deploy" user whose only key can run /usr/local/bin/anar-deploy (see deploy-receive.sh),
# and hands that user the site folder. Nothing else on the server changes.
set -euo pipefail
KEY=${1:?usage: bash setup-deploy-user.sh "<public key>"}
HERE=$(cd "$(dirname "$0")" && pwd)

id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
passwd -l deploy >/dev/null                      # key login only
install -m 755 -o root -g root "$HERE/deploy-receive.sh" /usr/local/bin/anar-deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
printf 'command="/usr/local/bin/anar-deploy",restrict %s\n' "$KEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
mkdir -p /var/www/anar.to/releases
chown -R deploy:deploy /var/www/anar.to          # nginx only needs to read it
echo "deploy user ready; try: ssh deploy@<server> list"
