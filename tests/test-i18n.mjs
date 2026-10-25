#!/usr/bin/env node
// Regression script for src/app/i18n.js — the desktop's gettext-style
// translation layer: resolveAuto, identity/fallback lookups, the six zh
// dictionary scaffolds' hygiene (tokens, ANSI escapes, cross-file
// duplicates), language switching with subscribers, {token} interpolation,
// init from the stored tweak and the tweakchange live sync.
// Run: node tests/test-i18n.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The six zh dictionary files, in index.html order.
const DICT_FILES = [
  "i18n-zh-settings.js",
  "i18n-zh-chat.js",
  "i18n-zh-composer.js",
  "i18n-zh-shell.js",
  "i18n-zh-panels.js",
  "i18n-zh-logic.js",
];

const load = (win, file) => {
  // eslint-disable-next-line no-new-func
  new Function("window", readFileSync(join(root, "src/app", file), "utf8"))(win);
};

let passed = 0;
function check(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`FAILED: ${label}`);
    throw err;
  }
  passed++;
}

// The shared harness win: i18n.js FIRST, then the dictionaries in
// index.html order. A bare win (no localStorage/navigator/document)
// must resolve to the "en" default.
const win = {};
load(win, "i18n.js");
for (const f of DICT_FILES) load(win, f);
const I = win.OMP_I18N;

check("resolveAuto: zh* → zh, other navigator languages → en, missing navigator → en", () => {
  assert.equal(I.resolveAuto({ language: "zh-CN" }), "zh");
  assert.equal(I.resolveAuto({ language: "en-US" }), "en");
  assert.equal(I.resolveAuto(undefined), "en");
});

check("fallback: a missing key returns the key; the default language is en (identity)", () => {
  assert.equal(I.tr("no such key"), "no such key");
  assert.equal(I.lang(), "en");
  assert.equal(I.tr("Theme"), "Theme");
});

// Dictionary hygiene over the six REAL files — must run before any
// synthetic probe keys are injected below.
check("dictionary hygiene: non-empty string values, no cross-file conflicts, {tokens} and ANSI escapes preserved", () => {
  // Capture each file's entries separately: a fresh win whose OMP_I18N
  // stub records what the file registers via addLang.
  const perFile = DICT_FILES.map((file) => {
    const entries = {};
    load({ OMP_I18N: { addLang: (code, e) => Object.assign(entries, e || {}) } }, file);
    return { file, entries };
  });
  const merged = {};
  for (const { file, entries } of perFile) {
    for (const [k, v] of Object.entries(entries)) {
      assert.equal(typeof v, "string", `${file}: ${JSON.stringify(k)} → non-string value`);
      assert.ok(v.length > 0, `${file}: ${JSON.stringify(k)} → empty value`);
      if (Object.prototype.hasOwnProperty.call(merged, k)) {
        assert.equal(merged[k], v, `${JSON.stringify(k)} registered twice with different values`);
      }
      merged[k] = v;
    }
  }
  const TOKEN_RE = /\{[A-Za-z_][A-Za-z0-9_]*\}/g;
  const ANSI_RE = /\x1b\[[0-9;]*m/g;
  const tokens = (s) => [...new Set(s.match(TOKEN_RE) || [])].sort();
  for (const [k, v] of Object.entries(merged)) {
    if ((k.match(TOKEN_RE) || []).length) {
      assert.deepEqual(tokens(v), tokens(k), `${JSON.stringify(k)}: {token} set not preserved`);
    }
    for (const esc of new Set(k.match(ANSI_RE) || [])) {
      assert.ok(v.includes(esc), `${JSON.stringify(k)}: ANSI escape ${JSON.stringify(esc)} missing from value`);
    }
  }
  // Conditional (the logic step adds these keys later): the terminal-xterm
  // exit/failure lines keep their colour escapes in the zh values.
  const termKeys = [
    "\r\n\x1b[2mshell exited{code} — press Enter to restart\x1b[0m\r\n",
    "\r\n\x1b[31mcould not start the shell: {error}\x1b[0m — press Enter to retry\r\n",
  ];
  for (const k of termKeys) {
    if (!Object.prototype.hasOwnProperty.call(merged, k)) continue;
    for (const esc of ["\x1b[2m", "\x1b[0m", "\x1b[31m"]) {
      if (k.includes(esc)) assert.ok(merged[k].includes(esc), `${JSON.stringify(k)}: lost ${JSON.stringify(esc)}`);
    }
  }
});

check("switching: addLang + setLang('zh') looks up, setLang('en') restores identity", () => {
  const probe = "_i18n probe: theme";
  I.addLang("zh", { [probe]: "主题" });
  I.setLang("zh");
  assert.equal(I.lang(), "zh");
  assert.equal(I.tr(probe), "主题");
  I.setLang("en");
  assert.equal(I.lang(), "en");
  assert.equal(I.tr(probe), probe);
});

check("interpolation: {n} replaced under zh, identity under en, tokens absent from params stay verbatim", () => {
  I.addLang("zh", { "{n} files": "{n} 个文件" });
  I.setLang("zh");
  assert.equal(I.tr("{n} files", { n: 3 }), "3 个文件");
  assert.equal(I.tr("{n} files", { x: 1 }), "{n} 个文件");
  I.setLang("en");
  assert.equal(I.tr("{n} files", { n: 3 }), "3 files");
  assert.equal(I.tr("{n} files", { x: 1 }), "{n} files");
});

check("subscribe: notified on change, unsubscribe removes it, a throwing listener is isolated", () => {
  const seen = [];
  const bad = I.subscribe(() => { throw new Error("boom"); });
  const good = I.subscribe(() => seen.push(I.lang()));
  I.setLang("zh"); // bad throws and is swallowed; good still runs; lang switches
  assert.equal(I.lang(), "zh");
  assert.deepEqual(seen, ["zh"]);
  good();
  I.setLang("en");
  assert.equal(I.lang(), "en");
  assert.deepEqual(seen, ["zh"]);
  bad();
});

check("unknown stored lang: setLang('fr') falls back to en and identity", () => {
  I.setLang("zh"); // not already en, so the fr → en switch really happens
  I.setLang("fr");
  assert.equal(I.lang(), "en");
  assert.equal(I.tr("Theme"), "Theme");
});

check("init from storage: stored zh / auto + zh navigator / bare win / bogus lang", () => {
  const wZh = { localStorage: { getItem: () => '{"lang":"zh"}' } };
  load(wZh, "i18n.js");
  assert.equal(wZh.OMP_I18N.lang(), "zh");

  const wAuto = { navigator: { language: "zh-TW" }, localStorage: { getItem: () => '{"lang":"auto"}' } };
  load(wAuto, "i18n.js");
  assert.equal(wAuto.OMP_I18N.lang(), "zh");

  const wBare = {};
  load(wBare, "i18n.js");
  assert.equal(wBare.OMP_I18N.lang(), "en");

  const wBogus = { localStorage: { getItem: () => '{"lang":"bogus"}' } };
  load(wBogus, "i18n.js");
  assert.equal(wBogus.OMP_I18N.lang(), "en");
});

check("live sync: the tweakchange handler applies detail.lang and ignores a detail without lang", () => {
  const handlers = {};
  const w8 = { addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); } };
  load(w8, "i18n.js");
  const tweakchange = handlers.tweakchange;
  assert.ok(Array.isArray(tweakchange) && tweakchange.length === 1, "tweakchange listener not registered");
  tweakchange[0]({ detail: { lang: "zh" } });
  assert.equal(w8.OMP_I18N.lang(), "zh");
  tweakchange[0]({ detail: {} });
  assert.equal(w8.OMP_I18N.lang(), "zh");
  tweakchange[0]({ detail: { lang: "en" } });
  assert.equal(w8.OMP_I18N.lang(), "en");
});

console.log(`test-i18n: ${passed} checks passed`);
