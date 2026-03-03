#!/bin/bash
# =============================================================
# Deploy script: Install & configure fail2ban untuk SCADA server
# Jalankan sebagai root: sudo bash deploy-fail2ban.sh
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "  SCADA Server — Fail2ban Setup"
echo "========================================"

# 1. Install fail2ban jika belum ada
if ! command -v fail2ban-client &>/dev/null; then
    echo "[*] Installing fail2ban..."
    apt-get update -qq
    apt-get install -y fail2ban
else
    echo "[✓] fail2ban already installed: $(fail2ban-client --version)"
fi

# 2. Copy jail config
echo "[*] Deploying jail.local..."
cp "$SCRIPT_DIR/fail2ban-jail.local" /etc/fail2ban/jail.local
echo "[✓] /etc/fail2ban/jail.local updated"

# 3. Copy SCADA filter
echo "[*] Deploying scada-auth filter..."
cp "$SCRIPT_DIR/fail2ban-filter-scada.conf" /etc/fail2ban/filter.d/scada-auth.conf
echo "[✓] /etc/fail2ban/filter.d/scada-auth.conf updated"

# 4. Enable & restart fail2ban
echo "[*] Enabling & restarting fail2ban..."
systemctl enable fail2ban
systemctl restart fail2ban

# 5. Tunggu sebentar lalu tampilkan status
sleep 2
echo ""
echo "========================================"
echo "  ✅ Fail2ban Status"
echo "========================================"
fail2ban-client status
echo ""
echo "  SSH jail:"
fail2ban-client status sshd || echo "  [!] sshd jail not found (cek /var/log/auth.log)"
echo ""
echo "========================================"
echo "  Setup selesai!"
echo "  Monitor bans dengan: fail2ban-client status sshd"
echo "  Lihat log: tail -f /var/log/fail2ban.log"
echo "========================================"
