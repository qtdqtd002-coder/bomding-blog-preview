#!/usr/bin/env bash
# 블로그 컴퍼니 백엔드 — HTTPS화 (Caddy + sslip.io 자동 TLS, 도메인/비용 없음)
# 실행: curl -fsSL https://qtdqtd002-coder.github.io/bomding-blog-preview/https.sh | bash
# 하는 일: Caddy 설치 → 443→localhost:8080 리버스 프록시(자동 Let's Encrypt)
#          → 백엔드 CORS 에 PWA 출처 보장 → HTTPS /health 확인 → VAPID 공개키 출력
# ★사전: deploy.sh 로 백엔드가 pm2 로 8080 구동 중이어야 함.
# ★GCP 방화벽에서 tcp:80,443 인그레스 허용 필요(Let's Encrypt 발급·HTTPS 수신).
set -euo pipefail

HOST_TLS="34.139.184.70.sslip.io"
BACKEND_PORT=8080
APP_DIR="$HOME/blog-company-backend"
PWA_ORIGIN="https://qtdqtd002-coder.github.io"

echo "▶ 백엔드 HTTPS화 시작 (${HOST_TLS} → localhost:${BACKEND_PORT})"

# 0) ufw 가 켜져 있으면 80/443 허용 (GCP VPC 방화벽은 콘솔/ gcloud 에서 별도 허용)
if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -qi active; then
  sudo ufw allow 80/tcp  || true
  sudo ufw allow 443/tcp || true
fi

# 1) Caddy 설치 (공식 apt 저장소)
if command -v caddy >/dev/null 2>&1; then
  echo "▶ Caddy 이미 설치됨 — 건너뜀"
else
  echo "▶ Caddy 설치 (공식 apt 저장소)"
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

# 2) Caddyfile — 443 → localhost:8080 (자동 TLS)
echo "▶ Caddyfile 작성"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
${HOST_TLS} {
    reverse_proxy localhost:${BACKEND_PORT}
}
EOF

# 3) Caddy enable + 재시작
echo "▶ Caddy enable + restart"
sudo systemctl enable caddy >/dev/null 2>&1 || true
sudo systemctl restart caddy

# 4) 백엔드 CORS_ORIGINS 에 PWA 출처 보장 (없으면 추가 후 pm2 reload)
if [ -f "$APP_DIR/.env" ]; then
  if grep -q '^CORS_ORIGINS=' "$APP_DIR/.env"; then
    CUR="$(grep -m1 '^CORS_ORIGINS=' "$APP_DIR/.env" | cut -d= -f2-)"
    if printf '%s' "$CUR" | grep -qF "$PWA_ORIGIN"; then
      echo "▶ CORS_ORIGINS 에 PWA 출처 이미 포함 — 건너뜀"
    else
      NEW="$([ -z "$CUR" ] && echo "$PWA_ORIGIN" || echo "${CUR},${PWA_ORIGIN}")"
      sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=${NEW}|" "$APP_DIR/.env"
      echo "▶ CORS_ORIGINS 에 ${PWA_ORIGIN} 추가 → pm2 reload"
      pm2 reload blog-company-backend --update-env 2>/dev/null || pm2 restart blog-company-backend 2>/dev/null || true
    fi
  else
    echo "CORS_ORIGINS=${PWA_ORIGIN}" >> "$APP_DIR/.env"
    echo "▶ CORS_ORIGINS 추가 → pm2 reload"
    pm2 reload blog-company-backend --update-env 2>/dev/null || pm2 restart blog-company-backend 2>/dev/null || true
  fi
else
  echo "⚠ $APP_DIR/.env 없음 — deploy.sh 를 먼저 실행했는지 확인하세요."
fi

# 5) HTTPS 헬스체크 (인증서 발급까지 재시도, 최대 ~60초)
echo "▶ HTTPS 헬스체크 (Let's Encrypt 발급 대기)"
HEALTH=""
for i in $(seq 1 12); do
  sleep 5
  if HEALTH="$(curl -fsS "https://${HOST_TLS}/health" 2>/dev/null)"; then break; fi
  echo "  …대기 ($i/12)"
done

# VAPID 공개키 읽기
PUB=""
[ -f "$APP_DIR/.env" ] && PUB="$(grep -m1 '^VAPID_PUBLIC_KEY=' "$APP_DIR/.env" | cut -d= -f2-)"

echo ""
echo "============================================================"
echo " 완료 보고 (이 두 줄을 그대로 복사해 전달하세요)"
echo "------------------------------------------------------------"
if [ -n "$HEALTH" ]; then
  echo " ① HEALTH: ${HEALTH}"
else
  echo " ① HEALTH: (응답 없음) — GCP 방화벽 tcp:80,443 인그레스 허용 후"
  echo "            'curl https://${HOST_TLS}/health' 재시도. 로그: sudo journalctl -u caddy -n 50"
fi
echo " ② VAPID_PUBLIC_KEY: ${PUB:-(없음 — deploy.sh VAPID 단계 확인)}"
echo "------------------------------------------------------------"
echo " 참고) PWA app/api.js BC_CONFIG:"
echo "   PUBLISH_API_BASE_URL: 'https://${HOST_TLS}'"
echo "   VAPID_PUBLIC_KEY: '${PUB}'"
echo "============================================================"
