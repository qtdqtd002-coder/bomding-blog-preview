#!/usr/bin/env bash
# 블로그 컴퍼니 백엔드 — VM 한 줄 배포 (Ubuntu, Node20·git·pm2 설치 가정)
# 실행: curl -fsSL https://qtdqtd002-coder.github.io/bomding-blog-preview/deploy.sh | bash
# 하는 일: clone → npm install(운영) → .env 준비 → VAPID 발급/기록 → pm2 상시구동 → /health 확인
#          (+ 1GB 메모리 대비 swap 2GB 추가). 비밀값은 VM의 .env 에만 생성되고 깃에 올리지 않음.
set -euo pipefail

REPO_URL="https://github.com/qtdqtd002-coder/blog-company-backend.git"
APP_DIR="$HOME/blog-company-backend"
PORT=8080

echo "▶ 블로그 컴퍼니 백엔드 배포 시작"

# 0) swap 2GB (1GB 메모리 대비) — 활성 swap 없을 때만
if sudo swapon --show 2>/dev/null | grep -q '/swapfile'; then
  echo "▶ swap 이미 활성 — 건너뜀"
else
  echo "▶ swap 2GB 추가"
  sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# 1) clone(처음) 또는 pull(재실행)
if [ -d "$APP_DIR/.git" ]; then
  echo "▶ 기존 저장소 갱신 (git pull)"
  git -C "$APP_DIR" pull --ff-only
else
  echo "▶ 저장소 clone"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# 2) 운영 의존성 설치
echo "▶ npm install --omit=dev"
npm install --omit=dev

# 3) .env 준비 (없으면 예시 복사)
if [ ! -f .env ]; then
  echo "▶ .env 생성 (.env.example 복사)"
  cp .env.example .env
fi

# 4) VAPID 키: .env 에 비어 있으면 발급해 기록 (서버에만 저장, 깃 커밋 안 함)
if grep -q '^VAPID_PUBLIC_KEY=.\+' .env; then
  echo "▶ VAPID 키 이미 설정됨 — 건너뜀"
else
  echo "▶ VAPID 키 발급 → .env 기록"
  VAPID_OUT="$(npm run --silent gen:vapid)"
  PUB="$(printf '%s\n' "$VAPID_OUT" | grep -m1 '^VAPID_PUBLIC_KEY=' | cut -d= -f2-)"
  PRIV="$(printf '%s\n' "$VAPID_OUT" | grep -m1 '^VAPID_PRIVATE_KEY=' | cut -d= -f2-)"
  if [ -z "$PUB" ] || [ -z "$PRIV" ]; then echo "✗ VAPID 발급 실패"; exit 1; fi
  if grep -q '^VAPID_PUBLIC_KEY=' .env; then
    sed -i "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${PUB}|" .env
  else echo "VAPID_PUBLIC_KEY=${PUB}" >> .env; fi
  if grep -q '^VAPID_PRIVATE_KEY=' .env; then
    sed -i "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=${PRIV}|" .env
  else echo "VAPID_PRIVATE_KEY=${PRIV}" >> .env; fi
  echo "  · 공개키(PWA app/api.js 의 VAPID_PUBLIC_KEY 에 동일 입력):"
  echo "    ${PUB}"
fi

# 4b) ADMIN_TOKEN: 상태갱신/푸시 트리거 보호용. 비어 있으면 자동 발급(서버에만 저장).
if grep -q '^ADMIN_TOKEN=.\+' .env; then
  echo "▶ ADMIN_TOKEN 이미 설정됨 — 건너뜀"
else
  echo "▶ ADMIN_TOKEN 발급 → .env 기록"
  ADMIN_TOK="$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  if [ -z "$ADMIN_TOK" ]; then echo "✗ ADMIN_TOKEN 발급 실패"; exit 1; fi
  if grep -q '^ADMIN_TOKEN=' .env; then
    sed -i "s|^ADMIN_TOKEN=.*|ADMIN_TOKEN=${ADMIN_TOK}|" .env
  else echo "ADMIN_TOKEN=${ADMIN_TOK}" >> .env; fi
  echo "  · ADMIN_TOKEN(작성 러너 설정에 입력, 외부 노출 금지):"
  echo "    ${ADMIN_TOK}"
fi

# 5) 로그 디렉터리 + pm2 상시 구동
mkdir -p logs
echo "▶ pm2 기동"
pm2 startOrReload ecosystem.config.js
pm2 save

# 6) 헬스체크
echo "▶ 헬스체크"
sleep 2
echo "--- curl http://localhost:${PORT}/health ---"
curl -fsS "http://localhost:${PORT}/health" || echo "(health 응답 실패 — 'pm2 logs blog-company-backend' 확인)"
echo ""
echo "✅ 배포 완료.  상태: pm2 status   로그: pm2 logs blog-company-backend"
echo "   다음1: PWA app/api.js BC_CONFIG 에 PUBLISH_API_BASE_URL(이 서버 주소)·VAPID_PUBLIC_KEY 입력."
echo "   다음2: 위 ADMIN_TOKEN 을 작성 러너(PC) 설정파일 .runner.config.json 에 입력."
