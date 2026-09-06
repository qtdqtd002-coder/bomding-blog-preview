#!/usr/bin/env node
/* ============================================================================
   quota.cjs — 이 PC 계정(Claude Max)의 «잔여 사용량» 스냅샷 → _trend/_quota.json   (2026-09-04 신설)

   왜 만들었나
     홈 탭 「잔여 사용량」 타일. 한도 창(5시간·7일·모델별 7일)의 사용률은 계정 API 에만 있고
     정적 사이트가 못 읽으므로 여기서 JSON 으로 굽는다.

   어떻게
     ~/.claude/.credentials.json 의 OAuth access token 으로 GET https://api.anthropic.com/api/oauth/usage
     (Claude Code 의 /usage 가 쓰는 것과 같은 엔드포인트). 토큰은 읽기만 하고 절대 출력·저장하지 않는다.
     ★토큰이 만료돼 있으면 «CLI 에게» 갱신을 시킨다 (2026-09-06 수정 — 그 전엔 그냥 보류라 06:00 데스크에서 한 번도
       갱신되지 못했다: 09-04 이후 실측 0회). 리프레시 토큰을 이 스크립트가 직접 돌리면 회전된 토큰을 잘못 써서
       CLI 로그인이 깨질 수 있으므로, 대신 `claude mcp list`(LLM 호출 0 · 실측 3초)를 한 번 돌려 CLI 자신이
       정규 경로로 갱신·저장하게 하고 자격 파일을 다시 읽는다. 그래도 만료면 예전처럼 보류(exit 0) —
       마지막 스냅샷을 그대로 두고 사이트는 «n시간 전 기준»으로 보여 준다(0 위장 금지). `--no-refresh` 로 끌 수 있다.

   출력  _trend/_quota.json (스키마 1)
     { schema, at, plan, tier,
       limits:[ { kind:"session"|"weekly_all"|"weekly_scoped", percent, severity, resets_at, model, active } ],
       extra:{ enabled, used, limit, currency } | null }
     percent = 사용률(0~100). 남음 = 100 − percent.

   실행  node _tools/quota.cjs              # 변경이 있을 때만 파일을 쓴다(드레이너 커밋 노이즈 방지)
         node _tools/quota.cjs --print      # 사람이 보는 요약도 같이
         node _tools/quota.cjs --no-refresh # 만료돼도 CLI 를 부르지 않는다(옛 동작)
   종료  0 = 정상(갱신 또는 토큰 만료로 보류) / 1 = 자격 파일 없음·응답 오류
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_trend', '_quota.json');
const CRED = path.join(os.homedir(), '.claude', '.credentials.json');
const URL = 'https://api.anthropic.com/api/oauth/usage';
const PRINT = process.argv.indexOf('--print') >= 0;
const NOREFRESH = process.argv.indexOf('--no-refresh') >= 0;

function readCred() {
  if (!fs.existsSync(CRED)) return null;
  try { return JSON.parse(fs.readFileSync(CRED, 'utf8')).claudeAiOauth || null; } catch (e) { return null; }
}
function readPrev() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; }
}
function alive(c) { return !!(c && c.accessToken && c.expiresAt && c.expiresAt > Date.now() + 60e3); }
/* CLI 에게 토큰 갱신을 시킨다 — `claude mcp list` 는 LLM 을 부르지 않지만 시작할 때 만료된 토큰을 정규 경로로
   재발급해 ~/.claude/.credentials.json 에 저장한다(실측 3초). 우리가 리프레시 토큰을 직접 돌리지 않는 이유이자,
   06:00 데스크에서 잔여 사용량이 갱신되게 하는 유일한 안전한 방법. 실패는 조용히 삼킨다(발행을 막지 않는다). */
function cliPath() {
  /* ★Node 24 는 보안 정책상 .cmd 를 shell 없이 spawn 하지 못한다(EINVAL) — 실행 파일이 있으면 그것을 직접 부른다 */
  const c = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    path.join(os.homedir(), '.local', 'bin', 'claude')
  ];
  for (const p of c) { try { if (fs.existsSync(p)) return p; } catch (e) { /* 무시 */ } }
  return null;
}
function refreshViaCli() {
  const opt = { timeout: 90000, stdio: 'ignore', windowsHide: true };
  try {
    const exe = cliPath();
    const r = exe ? spawnSync(exe, ['mcp', 'list'], opt)
                  : spawnSync('claude mcp list', Object.assign({ shell: true }, opt));
    return !r.error && r.status === 0;
  } catch (e) { return false; }
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
  let cred = readCred();
  if (!cred || !cred.accessToken) { console.error('[quota] ~/.claude/.credentials.json 없음 — 건너뜀'); process.exit(1); }
  if (!alive(cred)) {
    if (NOREFRESH) {
      const prev = readPrev();
      console.log('[quota] 토큰 만료 · --no-refresh — 마지막 스냅샷 유지' + (prev && prev.at ? ' (' + prev.at + ')' : ' (스냅샷 없음)'));
      process.exit(0);
    }
    console.log('[quota] 토큰 만료 — CLI(claude mcp list)로 갱신 시도');
    refreshViaCli();
    cred = readCred();
    if (!alive(cred)) {
      const prev = readPrev();
      console.log('[quota] 갱신 실패(로그인 필요?) — 마지막 스냅샷 유지' + (prev && prev.at ? ' (' + prev.at + ')' : ' (스냅샷 없음)'));
      process.exit(0);
    }
    console.log('[quota] 토큰 갱신됨 — 계속');
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
