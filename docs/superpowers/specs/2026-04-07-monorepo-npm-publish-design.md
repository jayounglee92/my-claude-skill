# Monorepo + npm Publish + Changeset 릴리즈 설계

## 목적

my-claude-skill 레포를 모노레포로 전환하여 각 스킬을 독립 npm 패키지로 배포하고, changeset 기반 자동 릴리즈를 구성한다.

## 현재 상태

- 레포: `jayounglee92/my-claude-skill` (public)
- 스킬 3개: `work-tracker`, `fe-sdd-tdd`, `keycloak-auth-generator`
- 설치: `install.sh` (curl + degit) 또는 `cli/` (미배포 npm CLI)
- CI/CD: 없음 (.github 디렉토리 없음)

## 설계

### 디렉토리 구조

```
my-claude-skill/
├── packages/
│   ├── work-tracker/
│   │   ├── package.json          # @jayounglee92/work-tracker
│   │   ├── bin/install.js        # npx 실행 시 설치 스크립트
│   │   ├── SKILL.md
│   │   ├── README.md
│   │   ├── templates/
│   │   ├── references/
│   │   └── scripts/
│   ├── fe-sdd-tdd/
│   │   ├── package.json          # @jayounglee92/fe-sdd-tdd
│   │   ├── bin/install.js
│   │   ├── SKILL.md
│   │   ├── README.md
│   │   └── references/
│   └── keycloak-auth-generator/
│       ├── package.json          # @jayounglee92/keycloak-auth-generator
│       ├── bin/install.js
│       ├── SKILL.md
│       ├── README.md
│       └── references/
├── .github/
│   └── workflows/
│       └── release.yml           # changeset 기반 자동 릴리즈
├── .changeset/
│   └── config.json               # changeset 설정
├── package.json                  # 루트 (npm workspaces)
├── install.sh                    # 기존 curl 설치 유지
└── README.md
```

### 패키지 네이밍

| 폴더 | npm 패키지명 | 설치 명령 |
|------|-------------|----------|
| `packages/work-tracker` | `@jayounglee92/work-tracker` | `npx @jayounglee92/work-tracker` |
| `packages/fe-sdd-tdd` | `@jayounglee92/fe-sdd-tdd` | `npx @jayounglee92/fe-sdd-tdd` |
| `packages/keycloak-auth-generator` | `@jayounglee92/keycloak-auth-generator` | `npx @jayounglee92/keycloak-auth-generator` |

### 각 패키지 package.json 구조

```json
{
  "name": "@jayounglee92/work-tracker",
  "version": "1.0.0",
  "description": "출퇴근 자동 기록 + 월간 업무 보고서 생성 Claude Code 스킬",
  "bin": {
    "work-tracker": "./bin/install.js"
  },
  "files": [
    "bin/",
    "SKILL.md",
    "README.md",
    "templates/",
    "references/",
    "scripts/"
  ],
  "engines": {
    "node": ">=18"
  },
  "keywords": ["claude", "claude-code", "skill", "work-tracker"],
  "author": "jayounglee92",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/jayounglee92/my-claude-skill.git",
    "directory": "packages/work-tracker"
  }
}
```

### bin/install.js 동작

파일 상단에 `#!/usr/bin/env node` shebang 필수.

`npx @jayounglee92/work-tracker` 실행 시:

1. npm 캐시에서 패키지를 가져옴 (degit 불필요)
2. `~/.claude/skills/{name}/`이 이미 존재하면 덮어쓰기 (업그레이드 시나리오)
3. 패키지 내 스킬 파일들을 `~/.claude/skills/{name}/`에 복사
4. work-tracker의 경우 `~/.claude/commands/`에 clockin.md, clockout.md, recap.md 생성
5. 완료 메시지 출력 (설치 경로 + 버전 표시)

install.js는 Node.js 내장 모듈(`fs`, `path`, `os`)만 사용하여 외부 의존성 없이 동작한다.

**각 패키지별 files 필드:** 패키지마다 실제 존재하는 파일/폴더만 files에 포함한다. work-tracker는 `templates/`, `references/`, `scripts/`를, fe-sdd-tdd와 keycloak-auth-generator는 `references/`만 포함.

### 루트 package.json

```json
{
  "name": "my-claude-skill",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "changeset": "changeset",
    "version": "changeset version",
    "publish": "changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "@changesets/changelog-github": "^0.5.0"
  }
}
```

### Changeset 설정 (.changeset/config.json)

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "jayounglee92/my-claude-skill" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- `access: "public"` — scoped 패키지를 public으로 배포
- `changelog-github` — GitHub PR 링크가 CHANGELOG에 자동 포함

### GitHub Actions 릴리즈 워크플로우 (.github/workflows/release.yml)

트리거: main 브랜치 push

동작:
1. changeset이 있는 경우 → "Version Packages" PR 자동 생성 (버전 bump + CHANGELOG 업데이트)
2. "Version Packages" PR이 merge되면 → npm publish + GitHub Release 생성

NPM_TOKEN은 GitHub repository secrets에 등록 필요.

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"
      - run: npm install
      - name: Smoke test install scripts
        run: |
          for pkg in packages/*/bin/install.js; do
            node "$pkg" --dry-run
          done
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: npm run publish
          title: "chore: version packages"
          commit: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 기여자 릴리즈 플로우

```
1. 기여자가 코드 수정
2. npx changeset 실행 → 변경된 패키지 선택 + bump 타입(patch/minor/major) 지정
3. .changeset/ 에 changeset 파일 생성됨
4. PR 올림 (코드 + changeset 파일 포함)
5. 메인테이너(jayounglee92)가 리뷰 후 merge
6. GitHub Actions가 "Version Packages" PR 자동 생성
7. 메인테이너가 "Version Packages" PR merge
8. npm publish + GitHub Release 자동 실행
```

### 기존 install.sh 유지

npm 없이 설치하고 싶은 사용자를 위해 `install.sh`는 그대로 유지한다. `packages/` 경로 변경에 맞춰 degit 경로만 수정:

```bash
npx degit jayounglee92/my-claude-skill/packages/$SKILL ~/.claude/skills/$SKILL --force
```

### 삭제 대상

- `cli/` 폴더 전체 — 각 패키지의 bin/install.js가 대체

### README.md 업데이트

설치 방법 섹션을 npm 방식 우선으로 변경:

```markdown
## 설치

### npm (권장)
npx @jayounglee92/work-tracker

### curl
curl -fsSL https://raw.githubusercontent.com/jayounglee92/my-claude-skill/main/install.sh | bash -s work-tracker
```

### 사전 준비 (1회)

1. npm에 `@jayounglee92` org/scope가 사용 가능한지 확인
2. npmjs.com에서 Access Token 생성 (Automation 타입)
3. GitHub repo Settings > Secrets > `NPM_TOKEN`에 등록
