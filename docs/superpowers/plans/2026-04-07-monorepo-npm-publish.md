# Monorepo + npm Publish 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** my-claude-skill 레포를 npm workspaces 모노레포로 전환하고, changeset 기반 자동 릴리즈를 구성한다.

**Architecture:** 기존 루트 레벨 스킬 폴더들을 `packages/`로 이동하고, 각 패키지에 `bin/install.js`를 추가해 `npx`로 설치 가능하게 한다. changeset + GitHub Actions로 merge 시 자동 npm publish.

**Tech Stack:** npm workspaces, @changesets/cli, GitHub Actions, Node.js (fs/path/os 내장 모듈만)

**Spec:** `docs/superpowers/specs/2026-04-07-monorepo-npm-publish-design.md`

---

## File Structure

### 생성할 파일

```
package.json                                    # 루트 workspaces 설정
.changeset/config.json                          # changeset 설정
.github/workflows/release.yml                   # 릴리즈 CI
packages/work-tracker/package.json              # @jayounglee92/work-tracker
packages/work-tracker/bin/install.js            # npx 설치 스크립트
packages/fe-sdd-tdd/package.json                # @jayounglee92/fe-sdd-tdd
packages/fe-sdd-tdd/bin/install.js              # npx 설치 스크립트
packages/keycloak-auth-generator/package.json   # @jayounglee92/keycloak-auth-generator
packages/keycloak-auth-generator/bin/install.js # npx 설치 스크립트
```

### 이동할 파일

```
work-tracker/*           → packages/work-tracker/
fe-sdd-tdd/*             → packages/fe-sdd-tdd/
keycloak-auth-generator/* → packages/keycloak-auth-generator/
```

### 수정할 파일

```
install.sh               # degit 경로를 packages/ 하위로 변경
README.md                # npm 설치 방법 우선, 구조 업데이트
```

### 삭제할 파일

```
cli/                     # 각 패키지 bin/install.js가 대체
```

---

### Task 1: 스킬 폴더를 packages/로 이동

**Files:**
- Move: `work-tracker/` → `packages/work-tracker/`
- Move: `fe-sdd-tdd/` → `packages/fe-sdd-tdd/`
- Move: `keycloak-auth-generator/` → `packages/keycloak-auth-generator/`
- Delete: `cli/`

- [ ] **Step 1: packages 디렉토리 생성 및 스킬 이동**

```bash
mkdir -p packages
mv work-tracker packages/
mv fe-sdd-tdd packages/
mv keycloak-auth-generator packages/
```

- [ ] **Step 2: cli 폴더 삭제**

```bash
rm -rf cli
```

- [ ] **Step 3: 이동 확인**

```bash
ls packages/
```

Expected: `fe-sdd-tdd  keycloak-auth-generator  work-tracker`

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "refactor: move skill folders into packages/"
```

---

### Task 2: 공통 bin/install.js 작성 (work-tracker)

**Files:**
- Create: `packages/work-tracker/bin/install.js`

- [ ] **Step 1: bin 디렉토리 생성**

```bash
mkdir -p packages/work-tracker/bin
```

- [ ] **Step 2: install.js 작성**

`packages/work-tracker/bin/install.js`:

```javascript
#!/usr/bin/env node

const { cpSync, mkdirSync, writeFileSync, existsSync } = require("fs");
const { join, resolve } = require("path");
const { homedir } = require("os");

const SKILL_NAME = "work-tracker";
const home = homedir();
const skillDest = join(home, ".claude", "skills", SKILL_NAME);
const packageRoot = resolve(__dirname, "..");

// --dry-run 지원 (CI smoke test용)
if (process.argv.includes("--dry-run")) {
  console.log(`[dry-run] Would install ${SKILL_NAME} to ${skillDest}`);
  process.exit(0);
}

// 스킬 파일 복사 (기존 폴더 덮어쓰기)
mkdirSync(skillDest, { recursive: true });

const filesToCopy = ["SKILL.md", "README.md", "LICENSE", ".gitignore"];
const dirsToCopy = ["templates", "references", "scripts"];

filesToCopy.forEach((file) => {
  const src = join(packageRoot, file);
  if (existsSync(src)) {
    cpSync(src, join(skillDest, file));
  }
});

dirsToCopy.forEach((dir) => {
  const src = join(packageRoot, dir);
  if (existsSync(src)) {
    cpSync(src, join(skillDest, dir), { recursive: true });
  }
});

// slash commands 등록
const commandsDir = join(home, ".claude", "commands");
mkdirSync(commandsDir, { recursive: true });

const commands = [
  { name: "clockin", content: "출근 기록. 오늘의 Git HEAD를 스냅샷하고 세션 마커를 설정해줘." },
  { name: "clockout", content: "퇴근 기록. 오늘 하루 세션 컨텍스트를 수집하고 일간 요약을 생성해줘." },
  { name: "recap", content: "월간 보고서를 생성해줘." },
];

commands.forEach(({ name, content }) => {
  writeFileSync(join(commandsDir, `${name}.md`), content);
});

const pkg = require(join(packageRoot, "package.json"));
console.log(`\n✅ ${SKILL_NAME} v${pkg.version} 설치 완료`);
console.log(`   📂 ${skillDest}`);
console.log(`   📝 /clockin, /clockout, /recap 커맨드 등록됨`);
console.log(`\n   Claude Code를 재시작하면 자동완성 목록에 나타납니다.\n`);
```

- [ ] **Step 3: 실행 권한 부여**

```bash
chmod +x packages/work-tracker/bin/install.js
```

- [ ] **Step 4: dry-run 테스트**

```bash
node packages/work-tracker/bin/install.js --dry-run
```

Expected: `[dry-run] Would install work-tracker to /Users/.../.claude/skills/work-tracker`

- [ ] **Step 5: 커밋**

```bash
git add packages/work-tracker/bin/install.js
git commit -m "feat(work-tracker): add bin/install.js for npx installation"
```

---

### Task 3: bin/install.js 작성 (fe-sdd-tdd, keycloak-auth-generator)

**Files:**
- Create: `packages/fe-sdd-tdd/bin/install.js`
- Create: `packages/keycloak-auth-generator/bin/install.js`

- [ ] **Step 1: fe-sdd-tdd install.js 작성**

`packages/fe-sdd-tdd/bin/install.js`:

```javascript
#!/usr/bin/env node

const { cpSync, mkdirSync, existsSync } = require("fs");
const { join, resolve } = require("path");
const { homedir } = require("os");

const SKILL_NAME = "fe-sdd-tdd";
const home = homedir();
const skillDest = join(home, ".claude", "skills", SKILL_NAME);
const packageRoot = resolve(__dirname, "..");

if (process.argv.includes("--dry-run")) {
  console.log(`[dry-run] Would install ${SKILL_NAME} to ${skillDest}`);
  process.exit(0);
}

mkdirSync(skillDest, { recursive: true });

const filesToCopy = ["SKILL.md", "README.md", "LICENSE"];
const dirsToCopy = ["references"];

filesToCopy.forEach((file) => {
  const src = join(packageRoot, file);
  if (existsSync(src)) {
    cpSync(src, join(skillDest, file));
  }
});

dirsToCopy.forEach((dir) => {
  const src = join(packageRoot, dir);
  if (existsSync(src)) {
    cpSync(src, join(skillDest, dir), { recursive: true });
  }
});

const pkg = require(join(packageRoot, "package.json"));
console.log(`\n✅ ${SKILL_NAME} v${pkg.version} 설치 완료`);
console.log(`   📂 ${skillDest}\n`);
```

- [ ] **Step 2: keycloak-auth-generator install.js 작성**

`packages/keycloak-auth-generator/bin/install.js`: 위와 동일한 구조, `SKILL_NAME = "keycloak-auth-generator"`로 변경.

- [ ] **Step 3: 실행 권한 부여**

```bash
chmod +x packages/fe-sdd-tdd/bin/install.js
chmod +x packages/keycloak-auth-generator/bin/install.js
```

- [ ] **Step 4: dry-run 테스트**

```bash
node packages/fe-sdd-tdd/bin/install.js --dry-run
node packages/keycloak-auth-generator/bin/install.js --dry-run
```

Expected: 각각 `[dry-run] Would install ...` 출력

- [ ] **Step 5: 커밋**

```bash
git add packages/fe-sdd-tdd/bin/ packages/keycloak-auth-generator/bin/
git commit -m "feat(fe-sdd-tdd, keycloak): add bin/install.js for npx installation"
```

---

### Task 4: 각 패키지 package.json 작성

**Files:**
- Create: `packages/work-tracker/package.json`
- Create: `packages/fe-sdd-tdd/package.json`
- Create: `packages/keycloak-auth-generator/package.json`

- [ ] **Step 1: work-tracker package.json**

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
    "LICENSE",
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

- [ ] **Step 2: fe-sdd-tdd package.json**

```json
{
  "name": "@jayounglee92/fe-sdd-tdd",
  "version": "1.0.0",
  "description": "Spec 작성 → 테스트 → 구현 순서를 강제하는 프론트엔드 TDD 워크플로우 Claude Code 스킬",
  "bin": {
    "fe-sdd-tdd": "./bin/install.js"
  },
  "files": [
    "bin/",
    "SKILL.md",
    "README.md",
    "LICENSE",
    "references/"
  ],
  "engines": {
    "node": ">=18"
  },
  "keywords": ["claude", "claude-code", "skill", "tdd", "frontend"],
  "author": "jayounglee92",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/jayounglee92/my-claude-skill.git",
    "directory": "packages/fe-sdd-tdd"
  }
}
```

- [ ] **Step 3: keycloak-auth-generator package.json**

```json
{
  "name": "@jayounglee92/keycloak-auth-generator",
  "version": "1.0.0",
  "description": "프레임워크별 Keycloak SSO 인증 코드 자동 생성 Claude Code 스킬",
  "bin": {
    "keycloak-auth-generator": "./bin/install.js"
  },
  "files": [
    "bin/",
    "SKILL.md",
    "README.md",
    "references/"
  ],
  "engines": {
    "node": ">=18"
  },
  "keywords": ["claude", "claude-code", "skill", "keycloak", "sso", "auth"],
  "author": "jayounglee92",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/jayounglee92/my-claude-skill.git",
    "directory": "packages/keycloak-auth-generator"
  }
}
```

- [ ] **Step 4: 커밋**

```bash
git add packages/*/package.json
git commit -m "feat: add package.json for each skill package"
```

---

### Task 5: 루트 package.json + changeset 설정

**Files:**
- Create: `package.json`
- Create: `.changeset/config.json`

- [ ] **Step 1: 루트 package.json 작성**

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

- [ ] **Step 2: npm install로 의존성 설치**

```bash
npm install
```

Expected: `node_modules/` 생성, lock file 생성

- [ ] **Step 3: .changeset/config.json 작성**

```bash
mkdir -p .changeset
```

`.changeset/config.json`:

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

- [ ] **Step 4: .gitignore에 node_modules 추가**

루트 `.gitignore` 확인 후 없으면 생성:

```
node_modules/
```

- [ ] **Step 5: changeset 동작 확인**

```bash
npx changeset status
```

Expected: "No changesets found" (정상)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json .changeset/ .gitignore
git commit -m "feat: add root workspaces config and changeset setup"
```

---

### Task 6: GitHub Actions 릴리즈 워크플로우

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: 워크플로우 파일 생성**

```bash
mkdir -p .github/workflows
```

`.github/workflows/release.yml`:

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

- [ ] **Step 2: 커밋**

```bash
git add .github/
git commit -m "ci: add changeset-based release workflow"
```

---

### Task 7: install.sh 경로 수정

**Files:**
- Modify: `install.sh`

- [ ] **Step 1: degit 경로를 packages/ 하위로 변경**

`install.sh`에서 degit 경로 수정:

```bash
# 변경 전
npx degit jayounglee92/my-claude-skill/$SKILL ~/.claude/skills/$SKILL --force

# 변경 후
npx degit jayounglee92/my-claude-skill/packages/$SKILL ~/.claude/skills/$SKILL --force
```

- [ ] **Step 2: 커밋**

```bash
git add install.sh
git commit -m "fix: update install.sh degit path for packages/ structure"
```

---

### Task 8: README.md 업데이트

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README.md 전면 리라이트**

npm 설치 방법을 우선으로 하고, 모노레포 구조를 반영한 새 README 작성. 포함할 내용:

- 프로젝트 소개
- 스킬 목록 테이블 (이름, 설명, 설치 명령)
- 설치 방법 (npm 우선, curl 대안)
- 각 스킬별 간단 소개 + 사용 예시
- 기여 방법 (changeset 사용법 포함)
- 라이선스

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: update README for monorepo and npm publishing"
```

---

### Task 9: 최종 검증

- [ ] **Step 1: npm workspaces 확인**

```bash
npm ls --workspaces
```

Expected: 3개 패키지 표시

- [ ] **Step 2: 전체 dry-run 테스트**

```bash
for pkg in packages/*/bin/install.js; do node "$pkg" --dry-run; done
```

Expected: 3개 모두 `[dry-run]` 출력

- [ ] **Step 3: changeset status 확인**

```bash
npx changeset status
```

- [ ] **Step 4: npm pack으로 패키지 내용 확인**

```bash
cd packages/work-tracker && npm pack --dry-run && cd ../..
cd packages/fe-sdd-tdd && npm pack --dry-run && cd ../..
cd packages/keycloak-auth-generator && npm pack --dry-run && cd ../..
```

Expected: 각 패키지에 의도한 파일들만 포함되어 있는지 확인

---

## 사전 준비 (수동, 1회)

구현 완료 후 실제 배포 전 필요한 작업:

1. npmjs.com에서 `@jayounglee92` scope 사용 가능 확인
2. npmjs.com > Access Tokens > "Automation" 타입 토큰 생성
3. GitHub repo > Settings > Secrets and variables > Actions > `NPM_TOKEN` 등록
