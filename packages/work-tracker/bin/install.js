#!/usr/bin/env node

const { cpSync, mkdirSync, writeFileSync, existsSync } = require("fs");
const { join, resolve } = require("path");
const { homedir } = require("os");

const SKILL_NAME = "work-tracker";
const home = homedir();
const skillDest = join(home, ".claude", "skills", SKILL_NAME);
const packageRoot = resolve(__dirname, "..");

if (process.argv.includes("--dry-run")) {
  console.log(`[dry-run] Would install ${SKILL_NAME} to ${skillDest}`);
  process.exit(0);
}

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
