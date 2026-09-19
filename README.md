# gventus_web

광주 청년 문화 연결 플랫폼 **VENTUS**의 웹사이트 저장소. 메인 사이트와 여러 캠페인용 랜딩 페이지, 그리고 폼 제출을 텔레그램으로 전달하는 API 서버로 구성되어 있습니다.

## 개요

- **대상 서비스**: `gventus.store`
- **성격**: 빌드 도구/프레임워크 없이 순수 HTML/CSS/JS로 작성된 정적 사이트 + 폼 제출을 처리하는 소형 Flask API
- **목적**: 메인 소개 페이지(`index.html`)와, 각종 캠페인/이벤트별 참여 폼(설문, 씨앗 책방, 힐링 유형 테스트, 사부작 신청) 운영

## 기술 아키텍처

### 프론트엔드
- 빌드 스텝 없음(번들러·패키지 매니저 없음). 저장소 루트의 HTML 파일을 그대로 배포합니다.
- `assets/styles/`: 공통 및 페이지별 CSS. `common.css`는 공통 UI, `seedsbook.css`는 씨앗책방 전용 스타일입니다.
- `assets/scripts/core/`: 공통 UI 스크립트, `assets/scripts/pages/`: 페이지별 스크립트입니다. 사용하지 않는 기존 스크립트는 `assets/scripts/legacy/`에 보관합니다.
- `assets/images/`: `site`, `healing`, `sabujak`, `seedsbook` 기능 단위로 정리한 정적 이미지입니다.

### 백엔드 (`api/server.py`)
- Flask 단일 파일 앱. 폼별로 라우트 하나씩 존재: `/contact`, `/survey`, `/sabujak-book`, `/seedsbook`.
- 각 라우트는 JSON body를 받아 텔레그램 메시지로 포맷 후 `urllib`(외부 HTTP 라이브러리 없이)로 Telegram Bot API에 전송.
- `/seedsbook`은 body의 `type` 값(`survey` / `checklist`)에 따라 메시지 포맷을 분기.
- `/sabujak-book`만 별도 텔레그램 채팅방(`TELEGRAM_SABUJAK_CHAT`)으로 전송, 나머지는 기본 채팅방(`TELEGRAM_CHAT_ID`).
- 요청 body의 필드명이 한글(`이름`, `나이`, `연락처` 등)로 되어 있는데, 이는 프론트엔드 폼이 해당 키로 직접 보내기 때문 — 폼과 서버 양쪽을 함께 맞춰야 합니다.
- 환경변수: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`(필수), `TELEGRAM_SABUJAK_CHAT`(선택), `API_PORT`(기본 3000). 운영 환경에서는 `/home/ubuntu/report/.env`에서 로드.

### 라우팅 (`nginx/gventus`)
Nginx가 특정 클린 URL을 정적 파일로 매핑합니다 (SPA 라우터가 아니라 파일별 매핑):

| URL | 매핑 파일 |
|---|---|
| `/` | `index.html` (그 외 미매칭 경로는 SPA 폴백으로도 연결) |
| `/survey` | `survey.html` |
| `/form/hskcM5sSYK` | `sabujak-book.html` (외부 배포용 난독화 경로) |
| `/seedsbook` | `seedsbook.html` |
| `/seedsbook-new` | `seedsbook-new.html` |
| `/healing-type` | `healing-type.html` |
| `/hub` | `hub.html` |
| `/api/*` | Flask API (`127.0.0.1:8000`)로 프록시 |

새 캠페인 페이지를 추가할 때는 HTML 파일 생성과 `nginx/gventus`의 `location` 블록 추가를 함께 해야 합니다.

### 폼 제출 흐름
프론트엔드 폼은 동일 출처의 `/api/<name>` 엔드포인트로 POST하며, 일부 페이지(`assets/scripts/pages/survey.js`, `assets/scripts/pages/seedsbook.js`)는 이와 별개로 구글 앱스 스크립트 URL(`APPS_SCRIPT_URL`, 코드에 하드코딩)로도 병렬 전송을 시도합니다. 이 앱스 스크립트 전송은 스프레드시트 백업 로그용이며 실패해도 무시됩니다(텔레그램 전송과는 독립적).

### 배포 (`.github/workflows/deploy.yml`)
`main` 브랜치에 push하면 즉시 프로덕션(EC2)에 배포됩니다. 별도 스테이징 환경 없음.
1. 저장소 루트를 정적 파일로 EC2의 `/home/ubuntu/report/dist/`에 rsync (`.git`, `.idea`, `api/`, `nginx/`, `choi3/`, 로그 파일 등 제외)
2. `api/`를 `/home/ubuntu/report/api/`에 rsync, venv에 의존성 설치 후 PM2로 `gventus-api`(gunicorn, 8000 포트) 재시작
3. `nginx/gventus`를 `/etc/nginx/sites-available/gventus`에 반영 후 nginx reload

## 페이지별 상세 설명

| 파일 | URL | 설명 |
|---|---|---|
| `index.html` | `/` | 메인 소개 페이지. VENTUS 소개, 팀, 진행 프로젝트, FAQ, 참여/문의 폼(`/api/contact`)을 포함하는 원페이지 랜딩. |
| `hub.html` | `/hub` | 진행 중인 참여 페이지(설문, 씨앗 책방, 힐링 유형 테스트) 링크를 모아놓은 허브 페이지. |
| `survey.html` | `/survey` | "벤투스 × 문화티켓" 설문조사 폼. 제출 시 `/api/survey` + 구글 앱스 스크립트로 전송(`assets/scripts/pages/survey.js`). |
| `sabujak-book.html` | `/form/hskcM5sSYK` | "사부작" 모임 참여 신청 폼(이름, 출생연도, 연락처, 참여 이유 등). 제출 시 `/api/sabujak-book`로 전송, 전용 텔레그램 채팅방으로 알림. 로직은 페이지 내부 인라인 스크립트. |
| `seedsbook.html` | `/seedsbook` | 기존 캐릭터 그리드·설문·체크리스트 (`assets/scripts/pages/seedsbook-old.js`). |
| `seedsbook-new.html` | `/seedsbook-new` | 신규 Slider / Deck / Roulette 비교 화면. 기존 설문 연결 (`assets/scripts/pages/seedsbook.js`). |
| `healing-type.html` | `/healing-type` | 9개의 YES/NO 질문으로 힐링 유형을 진단하는 인터랙티브 테스트(결과는 캔버스로 시각화). 폼 제출/API 연동 없음, 클라이언트 로직만으로 완결. |
| `timer.html` | (직접 접근) | `timermo.com`으로 즉시 리다이렉트하는 자리표시 페이지. 실질적인 콘텐츠 없음. |
| `choi3/` | `choi3.gventus.store` | 이 저장소와 별개로 관리·배포되는 하위 프로젝트(별도 git 저장소, 별도 CI/CD, 별도 EC2 서브도메인). `.gitignore`로 제외되어 있으며 본 저장소의 배포 파이프라인과 무관. |

## 로컬 실행

프론트엔드는 정적 파일이라 별도 서버 없이 HTML을 열거나(`python3 -m http.server` 등으로 루트 서빙) 확인 가능합니다. `/assets/...` 경로를 사용하므로 저장소 루트를 기준으로 서빙해야 합니다.

API 서버:
```bash
pip install -r api/requirements.txt
export TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
python3 api/server.py   # API_PORT 환경변수로 포트 변경 가능 (기본 3000)
```

이 저장소에는 별도의 테스트/린트 설정이 없습니다.
