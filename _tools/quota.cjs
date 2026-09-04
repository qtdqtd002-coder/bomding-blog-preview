#!/usr/bin/env node
/* ============================================================================
   quota.cjs — 이 PC 계정(Claude Max)의 «잔여 사용량» 스냅샷 → _trend/_quota.json   (2026-09-04 신설)

   왜 만들었나
     홈 탭 「잔여 사용량」 타일. 한도 창(5시간·7일·모델별 7일)의 사용률은 계정 API 에만 있고
     정적 사이트가 못 읽으므로 여기서 JSON 으로 굽는다.

   어떻게
     ~/.claude/.credentials.json 의 OAuth access token 으로 GET https://api.anthropic.com/api/oauth/usage
     (Claude Code 의 /usage 가 쓰는 것과 같은 엔드포인트). 토큰은 읽기만 하고 절대 출력·저장하지 않는다.
     ★토큰이 만료돼 있으면 갱신을 시도하지 않는다(리프레시 토큰을 여기서 돌리면 CLI 의 로그인이 깨질 수 있다).
       그때는 마지막 스냅샷을 그대로 두고 exit 0 — 사이트는 «n시간 전 기준»으로 보여 준다(0 위장 금지).
       토큰은 헤드리스 러너(`claude -p`)가 돌 때마다 8시간짜리로 갱신되므로 낮 시간엔 대개 살아 있다.

   출력  _trend/_quota.json (스키마 1)
     { schema, at, plan, tier,
       limits:[ { kind:"session"|"weekly_all"|"weekly_scoped", percent, severity, resets_at, model, active } ],
       extra:{ enabled, used, limit, currency } | null }
     percent = 사용률(0~100). 남음 = 100 − percent.

   실행  node _tools/quota.cjs           # 변경이 있을 때만 파일을 쓴다(드레이너 커밋 노이즈 방지)
         node _tools/quota.cjs --print   # 사람이 보는 요약도 같이
   종료  0 = 정상(갱신 또는 토큰 만료로 보류) / 1 = 자격 파일 없음·응답 오류
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_quota.json');
const CRED = path.join(os.homedir(), '.claude', '.credentials.json');
const URL = 'https://api.anthropic.com/api/oauth/usage';
const PRINT = process.argv.indexOf('--print') >= 0;

function readCred() {
  if (!fs.existsSync(CRED)) return null;
  try { return JSON.parse(fs.readFileSync(CRED, 'utf8')).claudeAiOauth || null; } catch (e) { return null; }
}
function readPrev() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; }
}
function normalize(body, cred) {
  const limits = [];
  if (Array.isArray(body.limits)) {
    body.limits.forEach((l) => {
      if (!l || typeof l !== 'object') return;
      limits.push({
        kind: String(l.kind || ''),
        percent: Math.max(0, Math.min(100, Number(l.percent) || 0)),
        severity: String(l.severity || ''),
        resets_at: l.resets_at ? String(l.resets_at) : null,
        model: (l.scope && l.scope.model && l.scope.model.display_name) ? String(l.scope.model.display_name) : null,
        active: !!l.is_active
      });
    });
  } else {
    /* 구형 응답 폴백 — five_hour / seven_day 만 */
    if (body.five_hour) limits.push({ kind: 'session', percent: Number(body.five_hour.utilization) || 0, severity: '', resets_at: body.five_hour.resets_at || null, model: null, active: false });
    if (body.seven_day) limits.push({ kind: 'weekly_all', percent: Number(body.seven_day.utilization) || 0, severity: '', resets_at: body.seven_day.resets_at || null, model: null, active: true });
  }
  const ex = body.extra_usage && typeof body.extra_usage === 'object' ? body.extra_usage : null;
  return {
    schema: 1,
    at: new Date().toISOString(),
    plan: cred.subscriptionType || null,
    tier: cred.rateLimitTier || null,
    limits,
    extra: ex ? { enabled: !!ex.is_enabled, used: Number(ex.used_credits) || 0, limit: Number(ex.monthly_limit) || 0, currency: ex.currency || 'USD' } : null
  };
}
function same(a, b) {
  if (!a || !b) return false;
  const strip = (o) => JSON.stringify(Object.assign({}, o, { at: null }));
  return strip(a) === strip(b);
}

(async () => {
  const cred = readCred();
  if (!cred || !cred.accessToken) { console.error('[quota] ~/.claude/.credentials.json 없음 — 건너뜀'); process.exit(1); }
  if (!cred.expiresAt || cred.expiresAt <= Date.now() + 60e3) {
    const prev = readPrev();
    console.log('[quota] 토큰 만료 — 갱신 안 함, 마지막 스냅샷 유지' + (prev && prev.at ? ' (' + prev.at + ')' : ' (스냅샷 없음)'));
    process.exit(0);
  }
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  let res, body;
  try {
    res = await fetch(URL, { signal: ctl.signal, headers: {
      'Authorization': 'Bearer ' + cred.accessToken, 'anthropic-beta': 'oauth-2025-04-20', 'Accept': 'application/json' } });
    body = await res.json();
  } catch (e) { clearTimeout(t); console.error('[quota] 요청 실패: ' + (e && e.message || e)); process.exit(1); }
  clearTimeout(t);
  if (!res.ok) { console.error('[quota] HTTP ' + res.status + ' ' + JSON.stringify(body).slice(0, 160)); process.exit(1); }
  const snap = normalize(body, cred);
  const prev = readPrev();
  if (same(prev, snap)) { console.log('[quota] 변화 없음 (' + prev.at + ')'); if (PRINT) console.table(snap.limits); process.exit(0); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(snap, null, 2) + '\n', 'utf8');
  console.log('[quota] 갱신 → ' + path.relative(ROOT, OUT) + ' · ' + snap.limits.map((l) => l.kind + (l.model ? '(' + l.model + ')' : '') + ' ' + l.percent + '%').join(' · '));
  if (PRINT) console.table(snap.limits);
})();
