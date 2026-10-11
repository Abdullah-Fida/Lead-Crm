#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu server for BatSols: Docker + firewall.
# deploy.sh runs this automatically the first time; it is safe to run again.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "→ Installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"
sudo systemctl enable --now docker

# Oracle's Ubuntu images reject everything except SSH in iptables. Allow web
# traffic (HTTP, HTTPS, HTTP/3) ahead of the final REJECT rule and keep it after reboots.
open_port() {
  local proto=$1 port=$2
  sudo iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null && return
  local reject
  reject=$(sudo iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')
  if [ -n "$reject" ]; then
    sudo iptables -I INPUT "$reject" -p "$proto" --dport "$port" -j ACCEPT
  else
    sudo iptables -A INPUT -p "$proto" --dport "$port" -j ACCEPT
  fi
}
open_port tcp 80
open_port tcp 443
open_port udp 443
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save >/dev/null
fi

echo "✓ Server ready"
