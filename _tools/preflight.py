#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
집필 프리플라이트 — 결정론으로 잡히는 결함을 QA 라운드 전에 없앤다  (2026-09-12 신설 · 2026-09-23 8종 경고+sensitive 확장 · LLM 0)

왜 있나 (실측)
  QA 차원당 라운드가 편당 2.1~2.4 인데, R1 FAIL 사유의 다수가 **사람 판단이 필요 없는 것**들이다:
  분량 미달, `<img>` 치수 누락(CLS), 태그 메타↔본문 불일치, 제목 «N종» 과 실제 커버 수 불일치,
  날짜↔요일 오표기(09-07 실측 «수»→«목» 6곳 · 09-12 «8/13»↔실제 8/12).
  집필 프리플라이트 4종은 2026-07-11부터 «프롬프트 문장»으로만 존재했고, 문장은 집행되지 않았다.
  R2 한 바퀴 = 수정 5분 + 재QA 4분 + 4~5스폰(약 $2.5). 코드가 먼저 막으면 그만큼이 사라진다.

★2026-09-23 확장 (전수조사 C#5 · B#2·#10 · C#8 · D#9)
  결정론인데 LLM 에 남아 같은 결함이 재발하던 8종을 **경고**로 코드화했다(exit 0 유지 · `--strict` 로 1):
    W1 FAQ 답↔본문 4어절 연속 일치율(문항별 · ≥50% 경고)          — 봄딩 FAQ 재진술 13회 재발(B#2)
    W2 헤지 종결어미 밀도(2,000자당 5 초과)                         — 에디토리얼 7회차 수기 계수(B#10)
    W3 «참고한 곳» 도메인 화이트리스트(공식·위키·주요 매체 + 용어집 소스맵) · 개수 1~3
    W4 `.post`↔`#copy` 산문 토큰 동일성(양본 있을 때)               — 양본 불일치 hits 7
    W5 〔사진 자리 N〕 연속성 · 광고 고지 1회                          — 광고 고지 2중 삽입
    W6 동일 명사 옆 숫자 불일치(표 vs 본문)
    W7 1인칭 경험 문장 ≥1(09-13 진단 정규식 계열 — 경고만, 정본 규칙 추가 아님)
    W8 문단 길이(영도만: 3문장/≈80자 상한)
  그리고 refute(반증) 투입 판정을 코드 플래그로 낸다 — `<글폴더>/_qa/sensitive.json` 을 **항상** 쓴다
  (publish SKILL §2 «반증 투입 기준 ①②③» 을 코드화. ④ D±7 은 코드가 못 본다 — json 에 명시).
  ★봄딩 «FAQ 5개 미만 경고»는 삭제했다 — 개수 압력이 재진술을 불렀다(B#2).
  ★2026-09-24: 분량·h2·표행 계수에서 네이버 위젯 서랍(안내문 h2 «이렇게 쓰세요»·p.np-lbl·qbox·#copy)을 뺀다 —
    봄딩 글은 inject-npaste 주입 «후» 측정되므로(outbox-submit 호출 계약: `preflight.py <html> --writer <작성자>` · 인자 순서 무관).

★2026-09-25 차단 규칙 B5 — «공략·쿠폰·티어 글의 1차 출처 링크 0 = 발행 차단» (전수조사 후속 · 사용자 결정 09-25 항목 12)
  purpose 가 B5_PURPOSE_KEYS(공략·쿠폰·티어·추천·티어표·순위) 계열인데 본문(.post · #copy 제외)의 **외부 1차 출처 링크가 0개**면 ⛔ exit 1.
    1차 출처 링크 = `<a href="http…">` 중 ⑴ W3 화이트리스트(REF_WHITELIST ∪ 용어집 소스맵 도메인) 안이고
                    ⑵ url-verify.py 의 등급(TIER_RULES 를 그대로 import)이 board·fanwiki 가 아니고(= official·press 만 인정)
                    ⑶ 개인·SNS·제휴·단축(B5_SNS_PERSONAL — blog.naver·tistory·유튜브·X·인스타·쿠팡·pf.kakao…)이 아닌 것.
    링크 텍스트만 있고 href 가 없는 «참고한 곳» 줄은 0 으로 센다(앵커가 없으면 독자가 못 간다).
  purpose 입력 = ⑴ `--purpose "<발주 [목적]>"`(파이프라인이 발주 양식의 [목적]을 넘긴다)
               ⑵ 없으면 `<글폴더>/_qa/` 의 order-form*.md · order*.md · order-and-research.md · research-brief.md 에서
                  `[목적]`(같은 줄 값 또는 바로 다음 줄들 «1. 게임 공략» 형)·`purpose:` 줄을 찾아 추론(B5_ORDER_GLOBS 순)
               ⑶ 그래도 없으면 직전 실행이 남긴 `_qa/preflight.json` 의 b5.purpose 를 이어받는다(2026-09-26 — 아웃박스 게이트는
                  --purpose 없이 돌며 이 파일을 덮어쓴다 · purposeSource «_qa/preflight.json←arg»)
               ⑷ 못 찾으면 규칙 미적용 — 경고 «purpose 미상 — B5 미판정» 1줄(exit 영향 없음).
  ★«제품 비교·추천»(봄딩 육아·취미 쿠팡 파트너스 레인)은 게임 1차 출처 개념이 없어 B5_PURPOSE_SKIP 으로 뺀다(«추천» 이 걸려도 미적용).
  `preflight.json` 최상위 `b5:{purpose, purposeSource, applied, primaryLinks, primaryHosts, excluded, blocked}` 기록.
  B5 검사 자체가 예외로 죽으면 경고만(fail-open — 드레이너 «도구 고장으로 무인 발행을 세우지 않는다» 처방과 동일).

사용
  python preflight.py "<글 HTML 절대경로>" [--writer 봄딩|영도] [--min 2000] [--json] [--strict]
                      [--purpose "<발주 목적>"] [--out-dir <폴더>]
    exit 0 = 통과(경고는 있을 수 있음) · exit 1 = 결함(고쳐서 다시 돌릴 것) · --strict 면 경고도 1
    차단(exit 1) = ①분량 ②img 치수 ③날짜↔요일 ⑥금지요소 + ★B5 1차 출처 링크 0(purpose 가 공략·쿠폰·티어 계열일 때)
                   + ★B6 시각 앵커 < 2(봄딩·영도 공략형 · A형 img·.imgslot + B형 .ss 합계 · 09-26) — 그 밖 purpose 는 0 일 때 W9 경고만
    항상 쓴다: `<글폴더>/_qa/preflight.json` · `<글폴더>/_qa/sensitive.json`
      (--out-dir 를 주면 그 폴더에 쓴다 — 표본 dry-run 이 실제 글 폴더를 건드리지 않게)
  집필·수정 서브가 **결과를 반환하기 전에** 스스로 돌린다. 드레이너 게이트에도 붙일 수 있다.

측정 정의 = game-blog-publish §2 «분량 측정 정의 — 정본 확정(2026-08-02)» 를 코드로 옮긴 것:
  포함 = 산문(p·li) + 소제목(h2·h3) + **표(td·th)**    ← 표는 독자가 읽는 본문이다
  제외 = 네이버 붙여넣기 위젯(#copy) · h1 · 캡션(.cap) · 출처줄(.src) · 각주(.tnote) · 태그줄(.tags)
          · 자리표시자 · HTML 주석
  단위 = **한글(가-힣) 글자수**
★Windows: stdout UTF-8 고정.
"""
import io, os, re, sys, json, glob, argparse, datetime

sys.stdout.reconfigure(encoding='utf-8')

WD = ['월', '화', '수', '목', '금', '토', '일']
BAND = {'봄딩': 2000, '영도': 2000, '겜더쿠': 2000, '연봄': 2500, '하루살이': 2000}
GLOSSARY_DIR = r'C:\Users\qtdqt\Desktop\Claude\_glossary'

# ── W2 헤지 종결어미 — 에디토리얼 by-writer/봄딩.md 수기 계수 기준(더라고요류 + 것같아요류 + 추천드려요류)를 그대로 코드화.
#    (ai-tell-lint 의 HEDGE 는 «수 있습니다/보입니다/편입니다» 까지 넓은 광의 목록 — 그쪽은 어미 비율 표로 따로 본다)
HEDGE_FAMILIES = [
    ('더라고요', r'더라[고구]요'),
    ('것 같아요류', r'(?:것|거)\s*같(?:아요|네요|습니다|아서요|은데요|고요|더라고요|아요\.|네요\.)'),
    ('추천드려요류', r'추천\s*드(?:려요|립니다|릴게요)|권해\s*드(?:려요|립니다)'),
]
HEDGE_PER = 2000     # 2,000자당
HEDGE_MAX = 5        # 초과 시 경고 (by-writer/봄딩.md 09-16 참고기준)

# ── W3 «참고한 곳» 화이트리스트 — 공식(게임사·스토어·플랫폼) · 위키 · 주요 매체. 게임별 공식 도메인은 용어집 소스맵(`## 소스맵`)에서 동적으로 더한다.
REF_WHITELIST = [
    # 스토어·플랫폼
    'store.steampowered.com', 'steampowered.com', 'steamcommunity.com', 'play.google.com', 'apps.apple.com',
    'onestore.co.kr', 'playstation.com', 'nintendo.com', 'nintendo.co.kr', 'xbox.com', 'epicgames.com',
    'galaxystore.samsung.com', 'store.epicgames.com',
    # 게임사(공식)
    'nexon.com', 'nexon.co.kr', 'netmarble.com', 'ncsoft.com', 'plaync.com', 'kakaogames.com', 'kakaogamescorp.com',
    'game.kakao.com', 'com2us.com', 'gamevil.com', 'withhive.com', 'pearlabyss.com', 'krafton.com', 'pubg.com',
    'smilegate.com', 'stove.com', 'onstove.com', 'riotgames.com', 'leagueoflegends.com', 'teamfighttactics.leagueoflegends.com',
    'blizzard.com', 'battle.net', 'square-enix.com', 'square-enix-games.com', 'finalfantasyxiv.com', 'capcom.com',
    'capcom.co.jp', 'monsterhunter.com', 'konami.com', 'sega.com', 'sega.co.kr', 'bandainamcoent.com', 'bandainamcoent.co.kr',
    'bandainamcoent.co.jp', 'pokemon.com', 'pokemon.co.kr', 'pokemongolive.com', 'nianticlabs.com', 'niantic.com',
    'hoyoverse.com', 'mihoyo.com', 'genshin.hoyoverse.com', 'hsr.hoyoverse.com', 'zenless.hoyoverse.com',
    'perfectworld.com', 'nte.perfectworld.com', 'aniimo.com', 'wiki.aniimo.com', 'pocketpair.jp', 'palworld.jp',
    'level5.co.jp', 'nihon-falcom.com', 'devsisters.com', 'cookierun.com', 'neowiz.com', 'pmang.com', 'wemade.com',
    'gravity.co.kr', 'webzen.com', 'ngelgames.com', 'nexongames.co.kr', 'projectmoon.kr', 'limbuscompany.kr',
    'shiftup.co.kr', 'nikke-kr.com', 'nikke-en.com', 'yostar.co.kr', 'yostarkr.com', 'yostar.co.jp', 'hypergryph.com',
    'kuro-game.com', 'kurogames.com', 'mojang.com', 'minecraft.net', 'ea.com', 'ubisoft.com', 'rockstargames.com',
    'cdprojektred.com', 'fromsoftware.jp', 'larian.com', 'valve.software', 'overwatch.nexon.com', 'maplestory.nexon.com',
    'mabinogi.nexon.com', 'lineage.plaync.com', 'lineagem.plaync.com', 'lineage2m.plaync.com', 'blizzcon.com',
    'sony.co.kr', 'sony.com', 'logitechg.com', 'logitech.com', 'razer.com', 'corsair.com', 'steelseries.com', 'hyperx.com',
    'nvidia.com', 'amd.com', 'intel.com', 'samsung.com', 'lg.com', 'apple.com', 'google.com', 'microsoft.com',
    'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'discord.com', 'discord.gg', 'cafe.naver.com', 'game.naver.com',
    'blog.naver.com', 'post.naver.com', 'naver.com', 'kakao.com', 'coupang.com',
    # 위키
    'namu.wiki', 'wikipedia.org', 'fandom.com', 'wiki.gg', 'gamepedia.com', 'bulbapedia.bulbagarden.net', 'serebii.net',
    'pokemondb.net', 'paldb.cc', 'palworld.wiki.gg', 'mapledb.kr', 'lolchess.gg', 'op.gg', 'game8.co', 'game8.jp', 'gamewith.jp',
    'gamewith.net', 'maplestory.wiki', 'maplestorywiki.net',
    # 주요 매체
    'inven.co.kr', 'ruliweb.com', 'thisisgame.com', 'gamemeca.com', 'gametoc.co.kr', 'gamefocus.co.kr', 'khgames.co.kr',
    'gameple.co.kr', 'gamevu.co.kr', 'gamechosun.co.kr', 'zdnet.co.kr', 'etnews.com', 'mk.co.kr', 'hankyung.com',
    'yna.co.kr', 'news.naver.com', 'gematsu.com', 'ign.com', 'kr.ign.com', 'polygon.com', 'pcgamer.com', 'eurogamer.net',
    'gamesradar.com', 'kotaku.com', 'rpgfan.com', 'famitsu.com', '4gamer.net', 'gamesindustry.biz', 'dexerto.com',
    'steamdb.info', 'steamcharts.com', 'metacritic.com', 'opencritic.com', 'twitch.tv', 'chzzk.naver.com', 'afreecatv.com', 'sooplive.co.kr',
    # 공공
    'go.kr', 'or.kr', 'kdca.go.kr', 'mfds.go.kr', 'kca.go.kr',
]
REF_MIN, REF_MAX = 1, 3

# ── B5 1차 출처 링크 게이트(2026-09-25 · 차단) — purpose 매칭 키워드는 «부분 일치»(«게임 공략»·«쿠폰·이벤트»·«티어·추천» 이 걸린다).
B5_PURPOSE_KEYS = ('공략', '쿠폰', '티어', '추천', '티어표', '순위')
B5_PURPOSE_SKIP = ('제품 비교', '제품비교')     # 봄딩 육아·취미 «제품 비교·추천»(쿠팡 파트너스 수익형) — 게임 1차 출처 개념이 없다
B5_ORDER_GLOBS = ('order-form*.md', 'order*.md', 'order-and-research.md', 'research-brief.md')   # <글폴더>/_qa/ 에서 이 순서로
B5_MIN_LINKS = 1
# ── B6 시각 앵커 게이트(2026-09-26 · 사용자 결정 «공략형 글은 사진 자리 최소 N곳») — 봄딩·영도만
#   앵커 = A형 이미지(`<img>` — 위젯·디자인 자산 제외) + A형 저장 자리(`.imgslot`) + B형 촬영 자리(`.ss`). «공략형» 판정은 B5 와 같다(b5_applies).
#   공략형 < B6_MIN_GUIDE → ⛔ · 기타 purpose(소식·출시 등)·purpose 미상은 0 일 때만 경고(W9).
#   왜: 09-24~26 헤드리스 글 11편 중 7편이 이미지 0장이었고 4편은 사진 자리도 0 — 파이프라인이 집필 프롬프트에
#   «이미지 파일이 없으면 자리를 만들지 마라»를 즉석으로 넣었다(image-sourcing §9-2 «봄딩·영도는 못 구하면 B형» 과 정반대).
#   09-01 이후 공략형 94편 앵커 중앙값 ≈4 · ≥2 가 87% — 2 는 «얇은 글»만 막는 바닥선이다.
B6_WRITERS = ('봄딩', '영도')
B6_MIN_GUIDE = 2
# 개인·SNS·제휴·단축·자기 사이트 — 화이트리스트의 넓은 항목(naver.com·kakao.com·youtube.com·coupang.com)에 걸려도 1차 출처가 아니다.
B5_SNS_PERSONAL = (
    'blog.naver.com', 'm.blog.naver.com', 'post.naver.com', 'cafe.naver.com', 'tistory.com', 'brunch.co.kr',
    'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'instagram.com', 'facebook.com', 'threads.net', 'tiktok.com',
    'discord.com', 'discord.gg', 'twitch.tv', 'chzzk.naver.com', 'afreecatv.com', 'sooplive.co.kr',
    'coupang.com', 'link.coupang.com', 'pf.kakao.com', 'open.kakao.com', 'onelink.me', 'naver.me', 'bit.ly',
    'qtdqtd002-coder.github.io',
)
# url-verify.py(정본 — shared/blog-writing/tools)의 tier_of 를 import 해 쓴다. 못 찾을 때만 아래 사본 규칙(2026-09-23 판)을 쓴다.
URL_VERIFY = os.path.join(os.path.expanduser('~'), '.claude', 'shared', 'blog-writing', 'tools', 'url-verify.py')
_B5_TIER_FALLBACK = [
    ('board', re.compile(
        r'(inven\.co\.kr/board/|dcinside\.com|arca\.live|cafe\.naver\.com|cafe\.daum\.net'
        r'|bbs\.ruliweb\.com|ruliweb\.com/.*/board/|fmkorea\.com|clien\.net|ppomppu\.co\.kr'
        r'|theqoo\.net|dogdrip\.net|mlbpark\.donga\.com|instiz\.net|reddit\.com'
        r'|steamcommunity\.com/app/\d+/discussions|forums?\.|/forum/|/bbs/)', re.I)),
    ('fanwiki', re.compile(
        r'(namu\.wiki|\.fandom\.com|\.wiki\.gg|wikipedia\.org|bulbagarden\.net|librewiki\.net'
        r'|\.miraheze\.org|wiki\.biligame\.com|wikidot\.com)', re.I)),
]
_B5_TIER_FN = {'fn': None, 'src': ''}

# ── W6 표↔본문 숫자 대조에 쓰는 단위(같은 단위끼리만 비교한다 — 단위가 다르면 다른 양이다)
#    날짜·시각 단위(일·월·시간·분·초)는 뺀다 — 일정은 한 글에 여러 날짜가 섞여 «같은 명사 옆 다른 날짜» 가 정상이라 오탐이 됐다(09-23 실측 제우스 5건).
NUM_UNIT = r'(\d[\d,]*(?:\.\d+)?)\s*(%|원|개|종|회|레벨|명|장|억|만|천|kg|g|mm|cm|GB|MB|층|단계|성|랭크|위|배|마리|칸|판|턴|스택|포인트|pt|골드|다이아|코인|Lv|lv)'
NUM_NEAR = 30   # 본문에서 명사와 숫자가 이 거리(자) 안에 있을 때만 같은 대상으로 본다
TABLE_NOUN_STOP = {'구분', '항목', '내용', '비고', '순위', '이름', '명칭', '종류', '조건', '설명', '값', '수치', '기간', '날짜', '일정', '보상', '단계', '순서', '등급', '티어', '분류', '종합', '합계', '총합', '계'}

# ── W7 1인칭 경험(09-13 진단 정규식 «직접 확인/써봤/해보니» 광의 계열) — 경고만
FIRST_PERSON = re.compile(
    r'(?:직접|제가|저도|저는|저희|주인장|내가|저희가)[^.!?<\n]{0,40}?'
    r'(?:해\s?보|써\s?보|돌려\s?보|들어가\s?보|확인해\s?보|플레이해|넣어\s?보|찍어\s?보|눌러\s?보|열어\s?보|해\s?봤|겪|키워\s?보|잡아\s?보|돌아\s?보|달려\s?보|굴려\s?보|뽑아\s?보|사\s?보|받아\s?보|따라\s?해|해\s?본)'
    r'|(?:해봤|써봤|해보니|해 보니|돌려봤|들어가 봤|들어가봤|확인해 봤|확인해봤|플레이해 봤|플레이했|해봤는데|해봤더니|겪어 봤|겪어봤|써 봤|해 봤|달려봤|달려 봤|키워봤|키워 봤)')

# ── sensitive(반증 투입) — publish SKILL §2 ①②③ 코드화
SENS_SIGNAL_WORDS = ['최초', '유일', '없다', '아직 없', '순위', '동접', '점유율', '확률', '%', '시행일', '출시일']
# «~는 없다/유일/최초» 가 한 문장이라도 있으면 ②(SKILL: 판정 여지 없음). 단 독자 상태(«계정이 없으신 분»)·조건절(«없으면/없어도»)·
# 내부 마커(🔍) 는 사실의 부재 단정이 아니라 뺀다 — 09-23 실측 오탐 3건.
ABSENCE_RE = re.compile(
    r'유일(?:한|하게|무이)|최초(?:로|의|다|입니다|예요)|처음으로\s*(?:공개|출시|도입|등장|선보)|'
    r'아직\s*(?:없(?:다|습니다|어요|네요|는|고)|안\s*나오|안\s*열|안\s*풀|공개되지|나오지|확인되지|밝혀지지|정해지지|공지되지|발표되지)|'
    r'(?:스토어|페이지|공지|안내|정보|지원|한국어|한글|출시|일정|가격|공식|기능|모드|데모|쿠폰|이벤트|버전|플랫폼|콘솔|캐릭터|아이템|보상|언급|계획|소식|발표|조합|확인된\s*바|근거|자료)[^.!?\n]{0,25}?'
    r'(?:없(?:다|습니다|어요|네요|더라고요|는\s*상태|음|었(?:다|습니다|어요))|아니다|아닙니다|아니에요)(?=[\s.!?,)]|$)')
ABSENCE_SKIP = re.compile(r'없으신|없는\s*분|없다면|없으면|없어도|없이|🔍|✔|▶')
RESULT_WORDS = re.compile(r'결과|순위|랭킹|매출|시세|점유율|동접|우승|승률|1위|톱\s?\d|TOP\s?\d|메타크리틱|평점', re.I)
RESULT_PURPOSE = re.compile(r'결과|순위|시세|매출|평가|랭킹', re.I)
NUM_CELL = re.compile(r'\d')


# ────────────────────────────────────────────────────────────── 공통 파싱
def strip_excluded(html):
    """분량 계수에서 빼야 하는 영역을 지운다."""
    t = re.sub(r'<!--.*?-->', ' ', html, flags=re.S)                      # 주석
    t = re.sub(r'<script\b.*?</script>', ' ', t, flags=re.S | re.I)
    t = re.sub(r'<style\b.*?</style>', ' ', t, flags=re.S | re.I)
    # ★네이버 위젯 서랍(#npBtn 부터 끝까지 — 안내문 h2 «이렇게 쓰세요»·p.np-lbl·qbox·#copy)은 본문이 아니다(2026-09-24).
    #   봄딩 글은 inject-npaste --file 주입 «후» 측정되므로 서랍 안내문이 한글 ~36자·h2 1개를 부풀렸다(09-24 실측 애니모 초반 육성 티어 h2 8→7).
    cut = len(t)
    for pat in WIDGET_MARKS:
        m = re.search(pat, t)
        if m and m.start() < cut:
            cut = m.start()
    t = t[:cut]
    # 네이버 붙여넣기 위젯 — id="copy" 블록 통째로(중복 계수 방지 · 서랍 밖에 옛 방식으로 박힌 글 대비)
    t = re.sub(r'<div[^>]*id\s*=\s*["\']copy["\'].*?</div>\s*(?=<)', ' ', t, flags=re.S | re.I)
    t = re.sub(r'<h1\b.*?</h1>', ' ', t, flags=re.S | re.I)
    for cls in ('cap', 'src', 'tnote', 'tags', 'pvbar', 'imgslot', 'shoot'):
        t = re.sub(r'<(\w+)[^>]*class\s*=\s*["\'][^"\']*\b%s\b[^"\']*["\'].*?</\1>' % cls,
                   ' ', t, flags=re.S | re.I)
    return t


def body_korean_chars(html):
    t = strip_excluded(html)
    chunks = re.findall(r'<(?:p|li|h2|h3|td|th)\b[^>]*>(.*?)</(?:p|li|h2|h3|td|th)>', t, flags=re.S | re.I)
    text = ' '.join(chunks)
    text = re.sub(r'<[^>]+>', ' ', text)
    return sum(1 for c in text if '가' <= c <= '힣'), text


def kchars(s):
    return sum(1 for c in s if '가' <= c <= '힣')


def untag(s):
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = s.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    return s


def clean(html):
    t = re.sub(r'<!--.*?-->', ' ', html, flags=re.S)
    t = re.sub(r'<script\b.*?</script>', ' ', t, flags=re.S | re.I)
    t = re.sub(r'<style\b.*?</style>', ' ', t, flags=re.S | re.I)
    return t


WIDGET_MARKS = (r'id\s*=\s*["\']npBtn["\']', r'id\s*=\s*["\']copy["\']', r'네이버 붙여넣기 위젯')


def split_post_copy(html, with_widget=False):
    """(.post 쪽 HTML, #copy 쪽 HTML[, 위젯 전체]). #copy 가 없으면 두 번째는 ''."""
    t = clean(html)
    cut = len(t)
    for pat in WIDGET_MARKS:
        m = re.search(pat, t)
        if m and m.start() < cut:
            cut = m.start()
    post, widget = t[:cut], t[cut:]
    m = re.search(r'<div[^>]*id\s*=\s*["\']copy["\']', t)
    if not m:
        return (post, '', widget) if with_widget else (post, '')
    seg = t[m.start():]
    end = re.search(r'<script\b|</body>', seg, re.I)
    copy = seg[:end.start()] if end else seg
    return (post, copy, widget) if with_widget else (post, copy)


def balanced_divs(seg, cls):
    """class 에 cls 가 든 <div> 의 안쪽 HTML — 중첩 div 를 세어 짝 맞는 </div> 까지(비탐욕 정규식은 안쪽 첫 </div> 에서 끊긴다)."""
    out = []
    for m in re.finditer(r'<div\b[^>]*class\s*=\s*["\'][^"\']*\b%s\b[^"\']*["\'][^>]*>' % cls, seg, re.I):
        depth, i = 1, m.end()
        for tok in re.finditer(r'<div\b|</div\s*>', seg[m.end():], re.I):
            depth += 1 if tok.group(0).lower().startswith('<div') else -1
            if depth == 0:
                i = m.end() + tok.start()
                break
        out.append(seg[m.end():i])
    return out


# ★div 는 넣지 않는다 — 비탐욕 매치가 `<div id="copy">…첫 </div>` 를 한 덩어리로 삼켜 안쪽 <p> 가 전부 사라진다(09-23 실측).
BLOCK_RE = re.compile(r'<(p|li|h2|h3|td|th)\b([^>]*)>(.*?)</\1>', re.S | re.I)
SKIP_CLASS = ('cap', 'src', 'tnote', 'tags', 'tags-line', 'pvbar', 'imgslot', 'shoot', 'ph', 'phsub', 'notice',
              'notice-line', 'guidenote', 'np-lbl', 'np-guide', 'np-head', 'qbox', 'sidenote', 'btns', 'meta', 'topbar', 'cat')


def blocks(seg, tags=('p', 'li'), skip=SKIP_CLASS):
    """(tag, class, text) — 산문 블록만. 캡션·출처·태그·자리표시는 뺀다."""
    out = []
    for m in BLOCK_RE.finditer(seg):
        tag = m.group(1).lower()
        if tag not in tags:
            continue
        attrs = m.group(2)
        cm = re.search(r'class\s*=\s*["\']([^"\']*)["\']', attrs)
        cls = (cm.group(1) if cm else '').split()
        if any(c in skip for c in cls):
            continue
        inner = m.group(3)
        if tag == 'p' and re.search(r'<img\b', inner, re.I):
            inner = re.sub(r'<img\b[^>]*>', ' ', inner, flags=re.I)
        # 🔍 .chk 마커(미리보기 전용)는 산문이 아니다 — #copy 엔 없는 게 정상
        inner = re.sub(r'<span\b[^>]*class\s*=\s*["\'][^"\']*\bchk\b[^"\']*["\'][^>]*>.*?</span>', ' ', inner, flags=re.S | re.I)
        text = untag(inner)
        # 내부링크 묶음(✔ 같이 보기 · ▶ 같이 보면 좋은 글) · 참고한 곳 · 자리표시(📷) 는 산문이 아니다
        if tag == 'p' and re.match(r'\s*(?:✔|▶|📷|참고한\s*곳)', text):
            continue
        out.append((tag, ' '.join(cls), text))
    return out


def sentences(text):
    text = re.sub(r'\s+', ' ', text).strip()
    parts = re.split(r'(?<=[.!?。])\s+|(?<=[다요죠]\.)\s*|\n', text)
    return [p.strip() for p in parts if p and p.strip()]


def norm(s):
    s = re.sub(r'https?://\S+|[\w.-]+\.(?:com|net|kr|gg|io|jp|org)(?:/\S*)?', ' ', s)   # URL·도메인은 양본 표기가 달라서 뺀다
    return re.sub(r'[\s\W_]+', '', s, flags=re.UNICODE)


def div_texts(seg, classes=('summary', 'notice', 'guidenote')):
    """영도 .summary(마무리 박스)·고지 div 는 <p> 가 아니라서 blocks() 에 안 잡힌다 — #copy 쪽은 <p> 로 오므로 여기서 보탠다."""
    out = []
    for cls in classes:
        for inner in balanced_divs(seg, cls):
            inner = re.sub(r'<div\b[^>]*class\s*=\s*["\']h["\'][^>]*>.*?</div>', ' ', inner, flags=re.S | re.I)
            out.append(untag(inner))
    return out


def faq_section(post):
    """FAQ 절 HTML (없으면 '') 과 FAQ 를 뺀 본문 HTML."""
    m = re.search(r'<h[23]\b[^>]*>[^<]*?(?:자주\s*묻는\s*질문|FAQ)[^<]*</h[23]>', post, re.I)
    if not m:
        return '', post
    rest = post[m.end():]
    n = re.search(r'<h[23]\b', rest, re.I)
    sec = rest[:n.start()] if n else rest
    # 절 뒤에 «✔ 같이 보기·참고한 곳» 문단이 붙어 있으면 그건 FAQ 가 아니다
    k = re.search(r'<p\b[^>]*>\s*<b>\s*(?:✔|참고한 곳|▶)', sec)
    if k:
        sec = sec[:k.start()]
    return sec, post[:m.start()] + (rest[n.start():] if n else '')


def faq_items(sec):
    items = []
    for tag, cls, _ in []:
        pass
    for m in re.finditer(r'<p\b[^>]*>(.*?)</p>', sec, re.S | re.I):
        inner = m.group(1)
        q = re.search(r'<(?:b|strong|span)\b[^>]*>(.*?)</(?:b|strong|span)>', inner, re.S | re.I)
        if not q:
            continue
        qt = untag(q.group(1)).strip()
        if '?' not in qt and not qt.startswith('Q'):
            continue
        ans = untag(inner[q.end():]).strip()
        items.append((qt, ans))
    return items


def four_gram_overlap(answer, body_text):
    toks = [t for t in re.sub(r'[,.!?·…()\[\]「」『』"\'“”‘’]', ' ', answer).split() if t]
    if len(toks) < 4:
        return None, 0
    body = ' ' + re.sub(r'\s+', ' ', re.sub(r'[,.!?·…()\[\]「」『』"\'“”‘’]', ' ', body_text)) + ' '
    wins = [' '.join(toks[i:i + 4]) for i in range(len(toks) - 3)]
    hit = sum(1 for w in wins if (' ' + w + ' ') in body)
    return hit / float(len(wins)), len(wins)


def char_gram_overlap(answer, body_text, n=6):
    """조사만 바꾼 «근접 재진술» 보조 신호 — 공백·기호를 뗀 글자 6-gram 포함률.
    09-23 캘리브레이션: 에디토리얼이 근접 재진술로 지목한 문항 0.32~0.37 · 깨끗한 문항 0.00~0.24 → 임계 0.30."""
    a, b = norm(answer), norm(body_text)
    if len(a) < n:
        return None
    wins = [a[i:i + n] for i in range(len(a) - n + 1)]
    return sum(1 for w in wins if w in b) / float(len(wins))


CHAR6_NEAR = 0.30


def host_of(url):
    m = re.match(r'https?://([^/:?#]+)', url.strip(), re.I)
    return m.group(1).lower() if m else ''


def glossary_hosts():
    """용어집 소스맵(`## 소스맵` 표)과 근거 URL 열에서 도메인을 모은다 — 게임 공식 도메인의 동적 화이트리스트."""
    hosts = set()
    try:
        for p in glob.glob(os.path.join(GLOSSARY_DIR, '*.md')):
            t = io.open(p, encoding='utf-8', errors='replace').read()
            for u in re.findall(r'https?://[^\s|)>\]`"\']+', t):
                h = host_of(u)
                if h:
                    hosts.add(h)
    except Exception:
        pass
    return hosts


def whitelisted(host, dyn):
    if not host:
        return False
    h = host[4:] if host.startswith('www.') else host
    for w in REF_WHITELIST:
        if h == w or h.endswith('.' + w):
            return True
    for w in dyn:
        w2 = w[4:] if w.startswith('www.') else w
        if h == w2 or h.endswith('.' + w2):
            return True
    return False


# ────────────────────────────────────────────────────────────── B5 1차 출처 링크(차단)
def b5_tier_of(url):
    """url-verify.py 의 tier_of(url, official=()) — board / fanwiki / press. 정본을 import 하고, 실패하면 사본 규칙."""
    if _B5_TIER_FN['fn'] is None:
        fn = None
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location('_url_verify_for_preflight', URL_VERIFY)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            fn = getattr(mod, 'tier_of', None)
            _B5_TIER_FN['src'] = 'url-verify.py'
        except Exception:
            fn = None
        if fn is None:
            def fn(u, official=()):
                h = host_of(u)
                m = re.match(r'https?://[^/]+(/[^?#]*)?', u.strip(), re.I)
                hp = h + ((m.group(1) or '') if m else '')
                for name, rx in _B5_TIER_FALLBACK:
                    if rx.search(hp):
                        return name
                return 'press'
            _B5_TIER_FN['src'] = 'fallback'
        _B5_TIER_FN['fn'] = fn
    try:
        return _B5_TIER_FN['fn'](url, ())
    except Exception:
        return 'press'


def is_sns_personal(host):
    h = (host or '').lower()
    h = h[4:] if h.startswith('www.') else h
    return any(h == s or h.endswith('.' + s) for s in B5_SNS_PERSONAL)


def purpose_from_text(text):
    """발주 양식 텍스트에서 [목적] 값. 같은 줄(`[목적] 게임 — 정보형 가이드(공략·티어)…`)이면 그 줄,
    비어 있으면 바로 다음 줄들(`1. 게임 공략` 형 · 빈 줄이나 다음 `[머리]`/`#` 에서 멈춘다). 없으면 `purpose:` 줄."""
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        m = re.search(r'\[\s*목적\s*\]\s*(.*)$', ln)
        if not m:
            continue
        rest = re.sub(r'^[\s:：\-—*_]+', '', m.group(1)).strip().strip('*').strip()
        if rest and not rest.startswith('['):
            return rest[:120]
        buf = []
        for nx in lines[i + 1:i + 7]:
            s = nx.strip()
            if not s or re.match(r'^\[|^#{1,6}\s|^---', s):
                break
            buf.append(re.sub(r'^(?:\d+[.)]|[-*•·])\s*', '', s))
        if buf:
            return ' / '.join(buf)[:120]
    for ln in lines:
        m = re.match(r'^\s*(?:[-*]\s*)?(?:\*\*)?purpose(?:\*\*)?\s*[:=：]\s*(.+?)\s*$', ln, re.I)
        if m:
            return m.group(1).strip('`"\' ')[:120]
    return ''


PREV_PF = '_qa/preflight.json'


def resolve_purpose(arg, html_path):
    """(purpose, source) — source = 'arg' | '_qa/<파일>' | '_qa/preflight.json←<직전 출처>' | ''(미상)."""
    if arg and arg.strip():
        return arg.strip(), 'arg'
    qa = os.path.join(os.path.dirname(os.path.abspath(html_path)), '_qa')
    if not os.path.isdir(qa):
        return '', ''
    seen = set()
    for pat in B5_ORDER_GLOBS:
        for f in sorted(glob.glob(os.path.join(qa, pat))):
            if f in seen:
                continue
            seen.add(f)
            try:
                text = io.open(f, encoding='utf-8', errors='replace').read()
            except Exception:
                continue
            pv = purpose_from_text(text)
            if pv:
                return pv, '_qa/' + os.path.basename(f)
    # ⑶ 직전 실행 기록(2026-09-26) — 아웃박스 게이트(outbox-submit)는 --purpose 없이 돌며 이 파일을 덮어쓴다.
    #    파이프라인 자가 실행(--purpose 필수 · 09-25)이 남긴 b5.purpose 를 덮어쓰기 «전에» 읽어 이어받는다.
    #    09-26 실측: PvP·팰월드 — 파이프라인이 «게임 공략» 으로 돌린 뒤 아웃박스 실행이 purpose 없이 덮어써 B5·B6 가 미판정이었다.
    try:
        prev = json.load(io.open(os.path.join(qa, 'preflight.json'), encoding='utf-8'))
        b = prev.get('b5') or {}
        pv = (b.get('purpose') or '').strip()
        if pv:
            src = b.get('purposeSource') or '?'
            return pv, (src if src.startswith(PREV_PF) else '%s←%s' % (PREV_PF, src))
    except Exception:
        pass
    return '', ''


def b5_applies(purpose):
    """None = purpose 미상(미판정) · False = 대상 아님 · True = 공략·쿠폰·티어 계열."""
    if not purpose:
        return None
    if any(k in purpose for k in B5_PURPOSE_SKIP):
        return False
    return any(k in purpose for k in B5_PURPOSE_KEYS)


def check_primary_links(post, res, purpose, purpose_src):
    """(issues, warns). 본문(.post · #copy 제외)의 <a href="http…"> 를 1차 출처(official·press ∩ 화이트리스트 − SNS/개인)로 걸러 센다."""
    urls = re.findall(r'<a\b[^>]*href\s*=\s*["\']([^"\']+)["\']', post, re.I)
    dyn = glossary_hosts()
    primary, excluded = [], []
    for u in urls:
        u = u.strip()
        if not re.match(r'https?://', u, re.I):
            continue                                   # 내부 앵커·상대경로는 출처가 아니다(세지 않는다)
        h = host_of(u)
        if is_sns_personal(h):
            excluded.append({'host': h, 'why': 'sns/personal'})
            continue
        tier = b5_tier_of(u)
        if tier in ('board', 'fanwiki'):
            excluded.append({'host': h, 'why': tier})
            continue
        if not whitelisted(h, dyn):
            excluded.append({'host': h, 'why': 'not-whitelisted'})
            continue
        primary.append({'host': h, 'tier': 'official' if whitelisted(h, dyn) and not whitelisted(h, ()) else tier})
    applies = b5_applies(purpose)
    res['b5'] = {
        'purpose': purpose, 'purposeSource': purpose_src, 'applied': bool(applies),
        'anchors': len(urls), 'primaryLinks': len(primary),
        'primaryHosts': sorted(set(x['host'] for x in primary)),
        'excluded': [dict(t) for t in {tuple(sorted(e.items())) for e in excluded}][:20],
        'tierSource': _B5_TIER_FN['src'], 'blocked': False,
        'rule': 'B5(2026-09-25) purpose∈%s(−%s) 이면 1차 출처 링크 ≥%d' % ('·'.join(B5_PURPOSE_KEYS), '·'.join(B5_PURPOSE_SKIP), B5_MIN_LINKS),
    }
    if applies is None:
        return [], ['purpose 미상 — B5 미판정(--purpose 또는 _qa/order-form*.md·order-and-research.md·research-brief.md 의 [목적] · 직전 _qa/preflight.json)']
    if applies and len(primary) < B5_MIN_LINKS:
        res['b5']['blocked'] = True
        ex = ', '.join(sorted(set('%s(%s)' % (e['host'], e['why']) for e in excluded))) or '없음'
        return ['B5 1차 출처 링크 0 — 공략·쿠폰·티어 글은 공식·매체 출처 링크 ≥1 필수(참고한 곳 R5 또는 본문) · 출처를 넣거나 purpose 를 낮춰라 · 공식 도메인이 화이트리스트 밖이면 용어집 소스맵(_glossary/<게임>.md «소스맵»)에 1행 등재'
                ' [purpose «%s» ← %s · a href %d개 · 제외 %s]' % (purpose, purpose_src, len(urls), ex)], []
    return [], []


def count_visual_anchors(post):
    """(A형 img, A형 .imgslot, B형 .ss) — `post` = 위젯 서랍·#copy 를 뺀 미리보기 본문(split_post_copy)."""
    imgs = [t for t in re.findall(r'<img\b[^>]*>', post or '', flags=re.I)
            if not re.search(r'data:|_design/|\bicon|logo|avatar|profile', t, re.I)]
    slots = len(re.findall(r'class\s*=\s*["\'](?:[^"\']*\s)?imgslot(?:\s[^"\']*)?["\']', post or '', flags=re.I))
    ss = len(re.findall(r'<div\b[^>]*class\s*=\s*["\'](?:[^"\']*\s)?ss(?:\s[^"\']*)?["\']', post or '', flags=re.I))
    return len(imgs), slots, ss


def check_visual_anchors(post, res, writer, purpose, purpose_src):
    """B6(2026-09-26) — 봄딩·영도 공략형은 시각 앵커 ≥ B6_MIN_GUIDE(⛔), 그 밖은 0 이면 W9 경고. 반환 (issues, warns)."""
    if writer not in B6_WRITERS:
        return [], []
    ni, nslot, nss = count_visual_anchors(post)
    total = ni + nslot + nss
    guide = b5_applies(purpose)
    res['b6'] = {'writer': writer, 'purpose': purpose, 'purposeSource': purpose_src, 'guide': guide,
                 'img': ni, 'imgslot': nslot, 'ss': nss, 'anchors': total, 'min': B6_MIN_GUIDE if guide else 1,
                 'blocked': False, 'rule': 'B6(2026-09-26) 봄딩·영도 공략형 시각 앵커 ≥%d(⛔) · 그 밖 0 이면 경고' % B6_MIN_GUIDE}
    if guide and total < B6_MIN_GUIDE:
        res['b6']['blocked'] = True
        return ['B6 시각 앵커 %d < %d — 공략형(%s) 글은 A형 이미지(`img/` self-host · .imgslot)와 B형 촬영 자리(`.ss`+`.shoot` — 무엇을·어디서·어떻게 찍을지)를'
                ' 합쳐 %d곳 이상. 이미지를 못 구하면 B형으로 둔다(자리 자체를 없애지 않는다 · image-sourcing §9-2) [img %d · imgslot %d · .ss %d]'
                % (total, B6_MIN_GUIDE, purpose, B6_MIN_GUIDE, ni, nslot, nss)], []
    if total == 0:
        return [], ['W9 시각 앵커 0 — 이미지도 사진 자리도 없다(purpose «%s»). 공식·스토어 이미지(A형) 또는 B형 촬영 자리(.ss)를 1곳 이상 권장 — 독자검수 시각편집 🔴 단골'
                    % (purpose or '미상')]
    return [], []


# ────────────────────────────────────────────────────────────── 8종 경고
def check_faq(post, res):
    sec, body_html = faq_section(post)
    if not sec:
        res['faq'] = {'items': 0, 'note': 'FAQ 절 없음'}
        return []
    items = faq_items(sec)
    body_text = ' '.join(t for _, _, t in blocks(body_html, tags=('p', 'li', 'td', 'th', 'h2', 'h3')))
    rows, warns, near = [], [], []
    for q, a in items:
        ratio, nwin = four_gram_overlap(a, body_text)
        c6 = char_gram_overlap(a, body_text)
        rows.append({'q': q[:60], 'overlap': None if ratio is None else round(ratio, 2), 'windows': nwin,
                     'char6': None if c6 is None else round(c6, 2)})
        if ratio is not None and ratio >= 0.5:
            warns.append('«%s» 4어절 연속 일치율 %d%%(%d/%d창)' % (q[:28], int(ratio * 100), int(round(ratio * nwin)), nwin))
        elif c6 is not None and c6 >= CHAR6_NEAR:
            near.append('«%s» 글자 6-gram 포함률 %d%%(근접 재진술)' % (q[:28], int(c6 * 100)))
    res['faq'] = {'items': len(items), 'rows': rows}
    out = []
    if warns:
        out.append('W1 FAQ 본문 재진술 %d/%d문항 — %s → 새 질문이 없으면 문항을 지운다(ai-briefing R4 «재진술 금지가 개수보다 위»)'
                   % (len(warns), len(items), ' · '.join(warns)))
    if near:
        out.append('W1 FAQ 근접 재진술 의심 %d/%d문항 — %s → 표·직전 문단을 조사만 바꿔 되풀이했는지 확인'
                   % (len(near), len(items), ' · '.join(near)))
    return out


def check_hedge(post, res, body_chars=0):
    text = ' '.join(t for _, _, t in blocks(post))
    # 분모 = 분량 정의(p·li·h2·h3·td·th 한글자수) — 에디토리얼 수기 계수(«8회/약 3,215자») 와 같은 기준
    n = body_chars or kchars(text)
    fam = {}
    total = 0
    for name, pat in HEDGE_FAMILIES:
        c = len(re.findall(pat, text))
        fam[name] = c
        total += c
    per = (total / float(n) * HEDGE_PER) if n else 0.0
    res['hedge'] = {'chars': n, 'total': total, 'per2000': round(per, 1), 'families': fam}
    if n and per > HEDGE_MAX:
        return ['W2 헤지 종결어미 %d회/%d자 = 2,000자당 %.1f(기준 %d) — %s' % (
            total, n, per, HEDGE_MAX, ' · '.join('%s %d' % kv for kv in fam.items()))]
    return []


def check_refs(post, res, writer):
    m = re.search(r'<p\b[^>]*>\s*(?:<b>|<strong>)?\s*참고한\s*곳', post)
    has_faq = bool(re.search(r'자주\s*묻는\s*질문|FAQ', post, re.I))
    if not m:
        res['refs'] = {'count': 0, 'hosts': [], 'present': False}
        if writer == '봄딩' and has_faq:
            return ['W3 «참고한 곳» 줄 없음 — 정보형(FAQ 있음)이면 R5 공식 출처 1~3개(#copy 에도 포함)']
        return []
    seg = post[m.start():]
    e = re.search(r'</p>', seg, re.I)
    seg = seg[:e.end()] if e else seg
    urls = re.findall(r'href\s*=\s*["\']([^"\']+)["\']', seg, re.I)
    dyn = glossary_hosts()
    hosts = [host_of(u) for u in urls]
    bad = [h for h in hosts if not whitelisted(h, dyn)]
    res['refs'] = {'count': len(urls), 'hosts': hosts, 'present': True, 'not_whitelisted': bad}
    w = []
    if not (REF_MIN <= len(urls) <= REF_MAX):
        w.append('링크 %d개(권장 %d~%d)' % (len(urls), REF_MIN, REF_MAX))
    if bad:
        w.append('화이트리스트 밖 도메인 %s — 공식이면 용어집 소스맵에 등재, 커뮤니티·개인 블로그면 교체' % ', '.join(sorted(set(bad))))
    return ['W3 «참고한 곳» ' + ' · '.join(w)] if w else []


def check_copy_sync(post, copy, res):
    if not copy:
        res['copy_sync'] = {'present': False}
        return []
    ps = [t for _, _, t in blocks(post)] + div_texts(post)
    # #copy 쪽 고지는 <p class="notice-line"> 로 온다 — 미리보기 .notice div 와 짝을 맞추려 여기서만 살린다
    cs = [t for _, _, t in blocks(copy, skip=tuple(c for c in SKIP_CLASS if c != 'notice-line'))]
    skip = re.compile(r'^\s*(?:👉|📷|└|〔)')   # #copy 전용 안내 줄(사전예약 링크 자리·사진 자리·캡션 추천)
    p_s = {norm(s): s for t in ps for s in sentences(t) if kchars(s) >= 8 and not skip.match(s)}
    c_s = {norm(s): s for t in cs for s in sentences(t) if kchars(s) >= 8 and not skip.match(s)}
    # ★포함 판정의 참조 텍스트는 «상대 판 전체 가시 텍스트»(표 셀·인포그래픽 .ig-row·캡션·소제목 포함)다 — 09-24 표본 실측:
    #   미리보기 표(.tbl)·인포그래픽 행이 #copy 에선 <p> 줄로 풀려 «#copy 에만 있는 문장» 으로 오탐(도깨비 «엽전 상점 — …» 6건).
    #   문장 집합(p_s·c_s)은 종전대로 p·li 산문만 — «한쪽만 고친 산문» 만 잡는다.
    p_all = norm(untag(post))
    c_all = norm(untag(copy))

    def hard_missing(src, other_all):
        out = []
        for k, s in src.items():
            if k in other_all:
                continue
            grams = [k[i:i + 4] for i in range(0, max(1, len(k) - 3))]
            cont = sum(1 for g in grams if g in other_all) / float(len(grams))
            if cont < 0.8:
                out.append(s[:50])
        return out

    only_post = hard_missing({k: v for k, v in p_s.items() if k not in c_s}, c_all)
    only_copy = hard_missing({k: v for k, v in c_s.items() if k not in p_s}, p_all)
    res['copy_sync'] = {'present': True, 'post_sents': len(p_s), 'copy_sents': len(c_s),
                        'only_in_post': only_post[:10], 'only_in_copy': only_copy[:10]}
    if only_post or only_copy:
        ex = (only_post[:1] + only_copy[:1])
        return ['W4 .post↔#copy 산문 불일치 — 미리보기에만 %d문장 · #copy 에만 %d문장 (예: %s) → 한쪽만 고친 흔적, 양본 동시 수정'
                % (len(only_post), len(only_copy), ' / '.join('«%s»' % x for x in ex))]
    return []


def check_photo_and_notice(post, copy, res, widget=''):
    w = []
    nums = [int(x) for x in re.findall(r'〔\s*사진\s*자리\s*(\d+)\s*〕', copy)] if copy else []
    seq_ok = nums == list(range(1, len(nums) + 1))
    # qbox «사진 N곳» 은 A형 〔사진 자리〕 + B형 촬영 안내(📷 파란 줄) 를 합친 수다 — .ph 줄 전체와 비교한다
    ph_lines = len(re.findall(r'<p\b[^>]*class\s*=\s*["\'][^"\']*\bph\b', copy)) if copy else 0
    qbox = re.search(r'사진\s*(\d+)\s*곳', widget or copy) if copy else None   # qbox 는 #copy 밖(드로어 안내)에 있다
    qn = int(qbox.group(1)) if qbox else None
    res['photo'] = {'slots': nums, 'sequential': seq_ok, 'qbox': qn, 'ph_lines': ph_lines}
    if nums and not seq_ok:
        w.append('〔사진 자리 N〕 번호가 1..%d 연속이 아니다: %s' % (len(nums), nums))
    if qn is not None and (nums or ph_lines) and qn != max(len(nums), ph_lines):
        w.append('qbox «사진 %d곳» ≠ 사진 줄 %d개(〔자리〕 %d)' % (qn, max(len(nums), ph_lines), len(nums)))
    # 고지 «문장» 만 센다(«원고료를 지원받아» · «확률형 아이템을 포함») — 본문이 확률형 아이템을 화제로 언급하는 건 고지가 아니다
    n_post = len(re.findall(r'원고료를?\s*(?:지원|제공)', untag(post)))
    n_copy = len(re.findall(r'원고료를?\s*(?:지원|제공)', untag(copy))) if copy else 0
    g_post = len(re.findall(r'확률형\s*아이템을\s*포함하고\s*있', untag(post)))            # 고지 정형문만(FAQ «포함돼 있어요» 는 답변)
    g_copy = len(re.findall(r'확률형\s*아이템을\s*포함하고\s*있', untag(copy))) if copy else 0
    res['notice'] = {'post': n_post, 'copy': n_copy, 'gacha_post': g_post, 'gacha_copy': g_copy}
    if n_post > 1 or n_copy > 1:
        w.append('광고 고지(원고료) 미리보기 %d회·#copy %d회 — 각 1회' % (n_post, n_copy))
    if g_post > 1 or g_copy > 1:
        w.append('확률형 아이템 고지 미리보기 %d회·#copy %d회 — 각 1회' % (g_post, g_copy))
    if copy and n_post == 1 and n_copy == 0:
        w.append('광고 고지가 #copy 에 없다(미리보기엔 있음)')
    return ['W5 ' + ' · '.join(w)] if w else []


def check_table_numbers(post, res):
    sents = [s for _, _, t in blocks(post) for s in sentences(t)]
    found = []
    for tbl in re.findall(r'<table\b.*?</table>', post, re.S | re.I):
        for tr in re.findall(r'<tr\b.*?</tr>', tbl, re.S | re.I):
            cells = [untag(c).strip() for c in re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>', tr, re.S | re.I)]
            if len(cells) < 2:
                continue
            noun = re.sub(r'\s+', ' ', cells[0]).strip()
            # 명사에 숫자가 들어 있으면(«1차»·«9월 23일 업데이트») 그 자체가 날짜·서수라 대조 대상이 아니다
            if len(noun) < 2 or noun in TABLE_NOUN_STOP or re.search(r'\d', noun):
                continue
            tnums = {}
            for c in cells[1:]:
                for num, unit in re.findall(NUM_UNIT, c):
                    tnums.setdefault(unit, set()).add(num.replace(',', ''))
            if not tnums:
                continue
            for s in sents:
                k = s.find(noun)
                if k < 0:
                    continue
                near = s[max(0, k - NUM_NEAR):k + len(noun) + NUM_NEAR]
                for num, unit in re.findall(NUM_UNIT, near):
                    if unit in tnums and num.replace(',', '') not in tnums[unit]:
                        found.append('«%s» 표 %s%s ↔ 본문 %s%s' % (noun[:16], '/'.join(sorted(tnums[unit]))[:24], unit, num, unit))
                        break
    found = list(dict.fromkeys(found))
    res['table_numbers'] = found[:20]
    if found:
        return ['W6 표↔본문 같은 명사 옆 숫자 불일치 %d건 — %s' % (len(found), ' · '.join(found[:4]))]
    return []


def check_first_person(post, res):
    text = ' '.join(t for _, _, t in blocks(post))
    hits = FIRST_PERSON.findall(text)
    res['first_person'] = {'count': len(hits)}
    if not hits:
        return ['W7 1인칭 경험 문장 0 — «직접 해보니/써봤는데» 계열이 한 문장도 없다(09-13 진단 정규식 · 경고만 — 없는 경험을 지어내지 말 것)']
    return []


def check_para_len(post, res, writer):
    if writer != '영도':
        return []
    paras = [t for tag, _, t in blocks(post) if tag == 'p']
    stats = []
    for t in paras:
        ns = len(sentences(t))
        nk = kchars(t)
        if nk < 10:
            continue
        stats.append((ns, nk))
    if not stats:
        return []
    over_s = sum(1 for ns, nk in stats if ns > 3)
    over_c = sum(1 for ns, nk in stats if nk > 80)
    med = sorted(nk for _, nk in stats)[len(stats) // 2]
    res['para'] = {'paras': len(stats), 'over_3sent': over_s, 'over_80chars': over_c, 'median_chars': med}
    # 라이브 영도 문단 중앙 62.7자(09-13) · 우리 초안 103자. 상한 3문장/≈80자를 «문단 절반 이상이 넘으면» 경고한다.
    if over_s * 2 >= len(stats) or over_c * 2 >= len(stats):
        return ['W8 문단 길이 — %d문단 중 3문장 초과 %d · 80자 초과 %d(중앙 %d자) → 영도 라이브 문단 중앙 62.7자, 사진·소제목으로 호흡을 끊는다'
                % (len(stats), over_s, over_c, med)]
    return []


# ────────────────────────────────────────────────────────────── sensitive(반증 투입 플래그)
def sensitive_flag(post, purpose, title):
    text = ' '.join(t for _, _, t in blocks(post, tags=('p', 'li', 'td', 'th', 'h2', 'h3')))
    reasons = []
    signals = {w: len(re.findall(re.escape(w), text)) for w in SENS_SIGNAL_WORDS}
    # ② 부재 단정 — «유일/최초/없다» 가 한 문장이라도 있으면(SKILL: 판정 여지 없음). 문장 단위로 주어 단서와 함께 본다.
    ab = []
    for s in sentences(text):
        if ABSENCE_SKIP.search(s):
            continue
        m = ABSENCE_RE.search(s)
        if m:
            ab.append((s, m.group(0)))
    if ab:
        reasons.append('② 부재 단정 %d문장(예: «%s» ← «%s»)' % (len(ab), ab[0][0][:40], ab[0][1][:20]))
    # ① 결과형 — 발주 purpose 또는 제목·본문에 결과어 + 숫자
    head = (purpose or '') + ' ' + (title or '')
    if RESULT_PURPOSE.search(purpose or '') or (RESULT_WORDS.search(head) and re.search(r'\d', text)):
        reasons.append('① 결과형(purpose/제목: %s)' % re.sub(r'\s+', ' ', head.strip())[:40])
    # ③ 수치표 밀집 — 숫자 셀 6개 이상인 표가 하나라도
    dense = 0
    for tbl in re.findall(r'<table\b.*?</table>', post, re.S | re.I):
        cells = [untag(c) for c in re.findall(r'<td\b[^>]*>(.*?)</td>', tbl, re.S | re.I)]
        if sum(1 for c in cells if NUM_CELL.search(c)) >= 6:
            dense += 1
    if dense:
        reasons.append('③ 수치 밀집 표 %d개(숫자 셀 6+)' % dense)
    return {
        'sensitive': bool(reasons), 'reasons': reasons, 'signals': signals,
        'rule': 'game-blog-publish §2 반증 투입 기준 ①②③ 코드화(2026-09-23) — ④ D±7 결합 조건은 코드가 못 본다(파이프라인이 알면 덧씌움)',
        'checkedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
    }


# ────────────────────────────────────────────────────────────── main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('path')
    ap.add_argument('--writer', default='')
    ap.add_argument('--min', type=int, default=0)
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--strict', action='store_true', help='8종 경고도 exit 1')
    ap.add_argument('--purpose', default='', help='발주 [목적] — sensitive ① 결과형 판정 + B5 1차 출처 게이트에 쓴다(없으면 _qa/order-form*.md 등에서 추론)')
    ap.add_argument('--out-dir', default='', help='preflight.json·sensitive.json 저장 폴더(기본 <글폴더>/_qa)')
    a = ap.parse_args()

    p = os.path.abspath(a.path)
    if not os.path.isfile(p):
        print('⛔ 파일 없음: %s' % p)
        sys.exit(1)
    html = io.open(p, encoding='utf-8', errors='replace').read()

    writer = a.writer or next((w for w in BAND if w in p), '')
    floor = a.min or BAND.get(writer, 2000)
    issues, warns = [], []
    detail = {}

    # ① 분량 — «작성자 자가보고를 신뢰하지 마라»(정본)를 코드로 강제
    n, _txt = body_korean_chars(html)
    if n < floor:
        issues.append('분량 %d자 < 하한 %d자(%s) — fluff 말고 **검증된 소재**로 채운다(기획팀 환류 경로)'
                      % (n, floor, writer or '기본'))

    # ② 이미지 치수(CLS) — 모든 <img> 에 width/height
    imgs = re.findall(r'<img\b[^>]*>', html, flags=re.I)
    nodim = [t for t in imgs
             if not (re.search(r'\bwidth\s*=', t, re.I) and re.search(r'\bheight\s*=', t, re.I))]
    if nodim:
        issues.append('img 치수 누락 %d/%d — width·height 속성 필수(CLS). 예: %s'
                      % (len(nodim), len(imgs), nodim[0][:90]))

    # ③ 날짜↔요일 — 실측 사고 2건(요일 6곳 오표기 · 날짜 하루 밀림)
    bad = []
    for m in re.finditer(r'(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?\s*\(\s*([월화수목금토일])\s*\)', html):
        y, mo, d, w = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4)
        try:
            real = WD[datetime.date(y, mo, d).weekday()]
        except ValueError:
            bad.append('%s-%s-%s(존재하지 않는 날짜)' % (y, mo, d))
            continue
        if real != w:
            bad.append('%d.%02d.%02d(%s) → 실제 %s' % (y, mo, d, w, real))
    if bad:
        issues.append('날짜↔요일 불일치 %d건: %s' % (len(bad), ' · '.join(bad[:5])))

    # ④ 제목 약속 수 ↔ 본문 커버리지
    head = ' '.join(re.findall(r'<title\b[^>]*>(.*?)</title>', html, flags=re.S | re.I)
                    + re.findall(r'<h1\b[^>]*>(.*?)</h1>', html, flags=re.S | re.I))
    head = re.sub(r'<[^>]+>', ' ', head)
    title = re.sub(r'\s+', ' ', head).strip()
    # ★h2·표행·li 는 위젯 서랍(안내문 h2 «이렇게 쓰세요»·#copy 사본 표)을 뺀 본문에서만 센다(2026-09-24 — 종전엔 #copy 표가 두 번 세어졌다)
    body_html = strip_excluded(html)
    h2n = len(re.findall(r'<h2\b', body_html, flags=re.I))
    promise = re.search(r'(\d+)\s*(종|선|가지|개)\b', head)
    if promise:
        k = int(promise.group(1))
        # 표 행·리스트 항목도 커버 수단이라 h2 만으로 단정하지 않는다 — 모자랄 때만 경고.
        rows = len(re.findall(r'<tr\b', body_html, flags=re.I))
        lis = len(re.findall(r'<li\b', body_html, flags=re.I))
        if k > max(h2n, rows - 1, lis):
            warns.append('제목이 «%d%s»을 약속했는데 h2 %d·표행 %d·li %d — 커버 수를 세어 제목 숫자를 맞출 것'
                         % (k, promise.group(2), h2n, max(0, rows - 1), lis))

    # ⑤ 태그 줄 존재(네이버·티스토리 SEO) — 없으면 QA structure 가 반드시 잡는다
    if not re.search(r'class\s*=\s*["\'][^"\']*\btags\b', html, re.I) and '#' not in html[-3000:]:
        warns.append('태그 줄을 못 찾았다 — output-format 의 `.tags` 규격 확인')

    # ⑥ 초안·QA 잔재(발행본 금지요소) — style-lint 가 push 를 막지만 여기서 먼저 알린다
    for pat, why in ((r'class\s*=\s*["\'][^"\']*\bdisclaimer\b', '면책 박스(.disclaimer)'),
                     (r'게임 내 확인 필요', 'AI 템플릿 잔재 문구'),
                     (r'img-placeholder', '비표준 플레이스홀더')):
        if re.search(pat, html, re.I):
            issues.append('발행본 금지요소: %s — style-lint 가 push 를 차단한다' % why)

    # ⑦ (삭제 2026-09-23) 봄딩 «FAQ Q 5개 미만 경고» — 개수 압력이 본문 재진술 13회 재발의 원인(B#2). W1 이 재진술 자체를 본다.

    post, copy, widget = split_post_copy(html, with_widget=True)

    # ── B5 1차 출처 링크(차단 · 2026-09-25) — purpose 가 공략·쿠폰·티어 계열인데 official·press 링크 0 이면 exit 1.
    #    purpose = --purpose 우선, 없으면 <글폴더>/_qa/order-form*.md 등에서 추론, 그것도 없으면 미판정(경고 1줄).
    purpose, purpose_src = resolve_purpose(a.purpose, p)
    try:
        b5_issues, b5_warns = check_primary_links(post, detail, purpose, purpose_src)
    except Exception as e:   # 게이트 코드가 죽어도 발행을 세우지 않는다(fail-open · 경고로 남긴다)
        b5_issues, b5_warns = [], ['B5 검사 내부 오류 — %s' % e]
        detail.setdefault('b5', {'purpose': purpose, 'purposeSource': purpose_src, 'applied': False, 'blocked': False, 'error': str(e)})
    issues += b5_issues
    warns += b5_warns

    # ── B6 시각 앵커(차단 · 2026-09-26) — 봄딩·영도 공략형 앵커 < 2 면 exit 1 · 그 밖 0 이면 W9 경고. 게이트 코드가 죽어도 발행은 세우지 않는다.
    try:
        b6_issues, b6_warns = check_visual_anchors(post, detail, writer, purpose, purpose_src)
    except Exception as e:
        b6_issues, b6_warns = [], ['B6 검사 내부 오류 — %s' % e]
    issues += b6_issues
    warns += b6_warns

    # ── 8종 경고(W1~W8) — 경고만. --strict 면 exit 1.
    try:
        warns += check_faq(post, detail)
        warns += check_hedge(post, detail, n)
        warns += check_refs(post, detail, writer)
        warns += check_copy_sync(post, copy, detail)
        warns += check_photo_and_notice(post, copy, detail, widget)
        warns += check_table_numbers(post, detail)
        warns += check_first_person(post, detail)
        warns += check_para_len(post, detail, writer)
    except Exception as e:   # 경고 검사가 죽어도 기존 4항목 판정은 살린다
        warns.append('W? 경고 검사 내부 오류 — %s' % e)

    # sensitive ①(결과형)은 파이프라인과 같은 입력으로 — --purpose 또는 그것을 이어받은 값(←arg)만 쓴다.
    #   추론값(research-brief 등)을 넣으면 파이프라인이 false 로 정한 글이 드레이너 qa-files-check 에서 refute 필수로 뒤집힐 수 있다.
    sens = sensitive_flag(post, a.purpose or (purpose if purpose_src.endswith('←arg') else ''), title)

    ok = not issues
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    out = {'ok': ok, 'chars': n, 'floor': floor, 'writer': writer,
           'imgs': len(imgs), 'img_nodim': len(nodim), 'h2': h2n,
           'issues': issues, 'warns': warns, 'checks': detail, 'sensitive': sens['sensitive'],
           'b5': detail.get('b5', {}),      # 계약(2026-09-25): b5:{purpose, purposeSource, applied, primaryLinks, primaryHosts, excluded, blocked}
           'b6': detail.get('b6', {}),      # 계약(2026-09-26): b6:{writer, purpose, guide, img, imgslot, ss, anchors, min, blocked} — 봄딩·영도만
           'checkedAt': now, 'file': p}

    # ── 항상 쓴다: <글폴더>/_qa/preflight.json · sensitive.json (다른 패키지가 읽는 계약 — 파일명 고정)
    out_dir = os.path.abspath(a.out_dir) if a.out_dir else os.path.join(os.path.dirname(p), '_qa')
    write_err = ''
    try:
        os.makedirs(out_dir, exist_ok=True)
        io.open(os.path.join(out_dir, 'preflight.json'), 'w', encoding='utf-8', newline='\n').write(
            json.dumps(out, ensure_ascii=False, indent=1))
        io.open(os.path.join(out_dir, 'sensitive.json'), 'w', encoding='utf-8', newline='\n').write(
            json.dumps(sens, ensure_ascii=False, indent=1))
    except Exception as e:
        write_err = str(e)

    if a.json:
        out['out_dir'] = out_dir
        out['write_error'] = write_err
        out['sensitive_detail'] = sens
        print(json.dumps(out, ensure_ascii=False))
    else:
        print('=== 집필 프리플라이트: %s ===' % os.path.basename(p))
        print('  작성자 %s · 본문 한글 %d자(하한 %d) · img %d장(치수누락 %d) · h2 %d개'
              % (writer or '?', n, floor, len(imgs), len(nodim), h2n))
        for s in issues:
            print('  ⛔ %s' % s)
        for s in warns:
            print('  ⚠ %s' % s)
        # 8종 검사 결과 표(경고 없어도 값은 보인다 — 검수자는 이 값을 인용하고 재측정하지 않는다)
        f = detail.get('faq', {}); h = detail.get('hedge', {}); r = detail.get('refs', {})
        c = detail.get('copy_sync', {}); ph = detail.get('photo', {}); nt = detail.get('notice', {})
        tn = detail.get('table_numbers', []); fp = detail.get('first_person', {}); pa = detail.get('para', {})
        print('  ── 8종 검사 ──')
        print('  W1 FAQ      문항 %s · 일치율 %s' % (f.get('items', 0), [x.get('overlap') for x in f.get('rows', [])]))
        print('  W2 헤지     %s회 · 2,000자당 %s (%s)' % (h.get('total'), h.get('per2000'), h.get('families')))
        print('  W3 참고한곳  %s개 · %s' % (r.get('count'), r.get('hosts')))
        print('  W4 양본     %s' % ('없음(#copy 없음)' if not c.get('present') else '미리보기만 %d · #copy만 %d' % (len(c.get('only_in_post', [])), len(c.get('only_in_copy', [])))))
        print('  W5 사진자리  %s(연속 %s · qbox %s) · 고지 원고료 %s/%s' % (ph.get('slots'), ph.get('sequential'), ph.get('qbox'), nt.get('post'), nt.get('copy')))
        print('  W6 표↔본문  불일치 %d' % len(tn))
        print('  W7 1인칭    %s문장' % fp.get('count'))
        if pa:
            print('  W8 문단     %d문단 · 3문장초과 %d · 80자초과 %d · 중앙 %d자' % (pa.get('paras', 0), pa.get('over_3sent', 0), pa.get('over_80chars', 0), pa.get('median_chars', 0)))
        b5 = detail.get('b5', {})
        print('  B5 출처     purpose «%s»(%s) · 적용 %s · 1차 링크 %s %s · 제외 %s'
              % (b5.get('purpose') or '미상', b5.get('purposeSource') or '-', b5.get('applied'), b5.get('primaryLinks'),
                 b5.get('primaryHosts'), ['%s(%s)' % (e.get('host'), e.get('why')) for e in b5.get('excluded', [])][:6]))
        b6 = detail.get('b6', {})
        if b6:
            print('  B6 시각앵커  %s곳(img %s · imgslot %s · B형 .ss %s) · 공략형 %s · 최소 %s%s'
                  % (b6.get('anchors'), b6.get('img'), b6.get('imgslot'), b6.get('ss'), b6.get('guide'), b6.get('min'),
                     ' · ⛔' if b6.get('blocked') else ''))
        print('  sensitive = %s %s' % (sens['sensitive'], sens['reasons'] or '(반증 투입 사유 없음)'))
        print('  → %s' % os.path.join(out_dir, 'preflight.json') + (' ⚠ 저장 실패: %s' % write_err if write_err else ''))
        if ok and not warns:
            print('  ✅ 통과 — 결정론 게이트에서 걸릴 것이 없다')
        elif ok:
            print('  ✅ 차단 사유 없음(경고 %d) — 경고는 고치는 쪽이 R2 를 아낀다' % len(warns))
    if issues:
        sys.exit(1)
    sys.exit(1 if (a.strict and warns) else 0)


if __name__ == '__main__':
    main()
