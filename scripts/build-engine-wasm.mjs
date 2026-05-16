#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = { ...process.env };

if (process.platform === "win32" && !env.CC) {
  const llvmClang = "C:/Program Files/LLVM/bin/clang.exe";
  if (existsSync(llvmClang)) {
    env.CC = llvmClang;
  }
}

const result = spawnSync(
  "wasm-pack",
  ["build", "src-engine", "--target", "web", "--out-dir", "../wasm-pkg-app"],
  { stdio: "inherit", shell: process.platform === "win32", env },
);

process.exit(result.status ?? 1);
