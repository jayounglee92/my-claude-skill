# My Claude Skills

Claude Code에서 사용할 수 있는 스킬 모음집입니다. 각 스킬은 독립적인 npm 패키지로 배포됩니다.

## 스킬 목록

| 스킬 | 설명 | 설치 |
| --- | --- | --- |
| [work-tracker](#work-tracker) | 출퇴근 자동 기록 + 월간 업무 보고서 생성 | `npx @jayounglee92/work-tracker` |
| [fe-sdd-tdd](#fe-sdd-tdd) | Spec → 테스트 → 구현 순서를 강제하는 프론트엔드 TDD 워크플로우 | `npx @jayounglee92/fe-sdd-tdd` |
| [keycloak-auth-generator](#keycloak-auth-generator) | 프레임워크별 Keycloak SSO 인증 코드 자동 생성 | `npx @jayounglee92/keycloak-auth-generator` |

---

## 설치

### npm (권장)

```bash
npx @jayounglee92/work-tracker
npx @jayounglee92/fe-sdd-tdd
npx @jayounglee92/keycloak-auth-generator
```

스킬 파일이 `~/.claude/skills/`에 설치됩니다. work-tracker는 `/clockin`, `/clockout`, `/recap` 슬래시 커맨드도 자동 등록됩니다.

> Claude Code를 재시작하면 적용됩니다.

### curl (npm 없이)

```bash
curl -fsSL https://raw.githubusercontent.com/jayounglee92/my-claude-skill/main/install.sh | bash -s work-tracker
curl -fsSL https://raw.githubusercontent.com/jayounglee92/my-claude-skill/main/install.sh | bash -s fe-sdd-tdd
curl -fsSL https://raw.githubusercontent.com/jayounglee92/my-claude-skill/main/install.sh | bash -s keycloak-auth-generator
```

### Claude.ai

1. 각 스킬 폴더를 ZIP으로 압축
2. **Settings > Features > Skills**에서 업로드

---

## work-tracker

### 출퇴근 자동 기록 + 월간 업무 보고서 생성기

매일 출퇴근 시점에 Claude Code 세션, Git 커밋, Auto Memory를 자동 수집해 일간 요약을 만들고, 월간 보고서를 생성합니다. 터미널을 여러 번 열고 닫아도 하루의 컨텍스트가 자동으로 유지됩니다.

| 커맨드 | 설명 |
| --- | --- |
| `/clockin` | 출근 기록. Git HEAD 스냅샷 저장 |
| `/clockout` | 퇴근 기록. 오늘 전체 세션 수집 → 일간 요약 자동 생성 |
| `/recap` | 월간 보고서 생성. 날짜 범위 지정 가능 |

**주요 기능**

- **자동 컨텍스트 수집** — Claude Code 세션 JSONL + Git diff + Auto Memory를 자동 파싱
- **일간 요약 생성** — 퇴근 시 당일 전체 작업 내용을 자동 요약
- **월간 보고서** — 목표/핵심결과/잘한점/보완계획 4열 테이블 형식으로 생성
- **다양한 내보내기** — 로컬 .md, Notion, Obsidian, Confluence 지원
- **보안 필터링** — API 키, .env, 인증서 등 민감 정보 자동 마스킹

**사용 예시**

```text
"출근 찍어줘"
"퇴근할게, 오늘 코드리뷰 2건 했어"
"저번 달 업무 정리해줘"
/recap 2025-02
/recap q1
```

---

## fe-sdd-tdd

### Frontend Spec-Driven Development + Test-Driven Development

프론트엔드 기능을 구현할 때 **Spec 작성 → 테스트 작성 → 구현** 순서를 강제하는 워크플로우 스킬입니다.

```text
Spec이 있나? → 없으면 만든다 → 테스트 먼저 작성 → 최소 구현 → 리팩터링 → 완료 체크
```

**주요 기능**

- **Spec 자동 생성** — 기능 유형별 맞춤 질문 + 코드베이스 분석으로 Spec 초안 생성
- **Testing Trophy 기반 TDD** — Unit → Integration (MSW) → E2E (Playwright)
- **구현 중 의사결정** — TODO/FIXME 스캔, 미구현 항목 탐지
- **완료 체크리스트** — 반응형(필수), 접근성, i18n, Storybook 등

**사용 예시**

```text
"댓글 위젯 만들어줘"
"회원가입 기능 구현"
"TDD로 개발하자"
```

---

## keycloak-auth-generator

### Keycloak SSO 인증 코드 자동 생성기

7개 프레임워크에 대해 Keycloak SSO 인증에 필요한 모든 코드를 자동 생성합니다.

| 프레임워크 | 인증 방식 | UI 디자인 시스템 |
| --- | --- | --- |
| Next.js | Auth.js v5 + Keycloak Provider | shadcn/ui, MUI, Ant Design |
| Vue 3 | @josempgon/vue-keycloak | Vuetify, PrimeVue, Element Plus |
| Nuxt 3 | sidebase/nuxt-auth | Nuxt UI, Vuetify |
| FastAPI | PyJWT (JWT) | Swagger UI |
| Django | mozilla-django-oidc | crispy-forms+Bootstrap |
| Flask | Authlib | Bootstrap 5 |
| Thymeleaf | Spring Security OAuth2 | Bootstrap 5 |

**생성되는 코드**: 로그인/로그아웃 페이지, 토큰 자동 재발급, 인증 미들웨어, RBAC, 타입 정의, Docker 기반 로컬 Keycloak(선택)

**사용 예시**

```text
"Next.js에 Keycloak 연동해줘"
"FastAPI 인증 코드 만들어줘"
"SSO 붙여줘"
```

---

## 프로젝트 구조

```
my-claude-skill/
├── packages/
│   ├── work-tracker/          # @jayounglee92/work-tracker
│   ├── fe-sdd-tdd/            # @jayounglee92/fe-sdd-tdd
│   └── keycloak-auth-generator/ # @jayounglee92/keycloak-auth-generator
├── .github/workflows/         # 자동 릴리즈 CI
├── .changeset/                # changeset 설정
├── install.sh                 # curl 설치 스크립트
└── package.json               # npm workspaces 루트
```

---

## 기여하기

### 개발 환경 설정

```bash
git clone https://github.com/jayounglee92/my-claude-skill.git
cd my-claude-skill
npm install
```

### 변경사항 반영 플로우

1. 코드 수정 후, changeset 생성:

```bash
npx changeset
```

변경한 패키지를 선택하고 bump 타입(patch/minor/major)을 지정합니다.

2. PR을 올립니다 (코드 + `.changeset/` 파일 포함).

3. 메인테이너가 merge하면 GitHub Actions가 자동으로 "Version Packages" PR을 생성합니다.

4. "Version Packages" PR이 merge되면 npm publish + GitHub Release가 자동으로 실행됩니다.

### 새 스킬 추가하기

1. `packages/` 아래에 새 폴더 생성
2. `SKILL.md`, `package.json`, `bin/install.js` 작성
3. 위의 기여 플로우를 따라 PR 제출

---

## 라이선스

MIT
