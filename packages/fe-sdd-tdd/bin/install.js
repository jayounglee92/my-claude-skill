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
console.log(`   📂 ${skillDest}`);
console.log(`\n   Claude Code를 재시작하면 자동완성 목록에 나타납니다.\n`);
