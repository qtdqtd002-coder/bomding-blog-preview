#!/usr/bin/env bash
# 블로그 컴퍼니 — GCP VM 기본 세팅 (Ubuntu 22.04)
# 실행: curl -fsSL https://qtdqtd002-coder.github.io/bomding-blog-preview/setup.sh | bash
# 설치: Node.js 20(NodeSource) · git · pm2(전역). 비밀값 없음.
set -euo pipefail

echo "▶ 블로그 컴퍼니 VM 기본 세팅 시작 (Ubuntu 22.04)"

echo "▶ 패키지 인덱스 갱신 + 기본 도구(ca-certificates·curl·gnupg·git)"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git

echo "▶ Node.js 20 설치 (NodeSource)"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "▶ pm2 전역 설치"
sudo npm install -g pm2

echo ""
echo "▶ 설치 완료 — 버전 확인"
echo "node : $(node -v)"
echo "npm  : $(npm -v)"
echo "git  : $(git --version)"
echo "pm2  : $(pm2 -v 2>/dev/null || echo 'n/a')"
echo ""
echo "✅ 기본 세팅 끝."
