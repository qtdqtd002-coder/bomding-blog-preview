// test-query-miner.cjs — query-miner.cjs 낱말 경계 판정 회귀 게이트 (2026-09-13)
//   node _tools/test-query-miner.cjs
//   ★도구의 mentionsGame 을 고치면 반드시 돌린다(test-classify-picks 와 같은 결 — 고정 사례로 결과를 못 박는다).
//   왜 이 게이트가 있나: 두 번 연속 틀렸다.
//     ⑴ 단순 포함 판정 → «애니모» 가 «애니모션텍»(다른 회사)을 후보로 끌어왔다.
//     ⑵ 공백을 지우고 경계를 봄 → «애니모 출시일» 까지 탈락해 후보가 통째로 비었다.
//   둘 다 «돌려 보기 전엔 멀쩡해 보였다». 그래서 사례를 파일에 박아 둔다.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, 'query-miner.cjs'), 'utf8');
const m = src.match(/function gameRe[\s\S]*?function mentionsGame[^\n]*\n/);
if (!m) { console.log('FAIL: 함수를 못 찾음'); process.exit(1); }
eval(m[0]);

const cases = [
  ['애니모', '애니모 출시일', true],
  ['애니모', '애니모 사전예약', true],
  ['애니모', '애니모', true],
  ['애니모', '애니모 하는법', true],
  ['애니모', '애니모션텍', false],
  ['애니모', '애니모어', false],
  ['롤토체스', '롤토체스 티어 분포', true],
  ['롤토체스', '롤토체스지지', false],
  ['롤토체스', '롤토체스gg', true],
  ['림버스 컴퍼니', '림버스컴퍼니 공략', true],
  ['림버스 컴퍼니', '림버스 컴퍼니 10장', true],
  ['쿠키런 크럼블', '쿠키런 크럼블 쿠폰', true],
  ['포켓몬 GO', '포켓몬go 레이드', true],
  ['팰월드', '팰월드 교배', true],
  ['팰월드', '팰월드온라인', false],
  ['팰월드', '다른게임 공략', false],
];
let bad = 0;
for (const [g, q, want] of cases) {
  const got = mentionsGame(q, g);
  if (got !== want) { bad++; console.log('FAIL', g, '|', q, '· want', want, 'got', got); }
  else console.log('ok  ', g, '|', q, '=', got);
}
console.log(bad ? 'FAIL ' + bad : 'ALL PASS');
process.exit(bad ? 1 : 0);
