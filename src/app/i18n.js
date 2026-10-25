// app/i18n.js — gettext-style translation layer for the whole desktop UI.
// Purpose: translate the UI without a bundler. The English source string is
// the dictionary key: tr("Theme") is the identity when the effective
// language is "en" (DICTS.en is null — the identity path, no lookup), and
// otherwise looks the key up in that language's dictionary, falling back to
// the key itself so an untranslated string degrades to English. The
// language setting is auto | en | zh, stored as the "lang" tweak in the
// omp-desktop:tweaks JSON; "auto" follows navigator.language (any zh* →
// zh, else en) and is re-resolved on every setLang("auto"). A
// setTweak("lang", …) re-syncs us live via the "tweakchange" event
// design/tweaks/use-tweaks.js dispatches.
//
// Calling conventions (how consumers reach tr):
// - Plain src/app/*.js IIFE modules destructure INSIDE their IIFE:
//     const { tr } = window.OMP_I18N;
//   (a per-module binding; also works in the Node test harness, which
//   loads these files as new Function("window", src)(win)).
// - Babel src/design/**/*.jsx files call bare tr(…) through window.tr:
//   Babel scripts share one top-level scope, so a per-file top-level
//   const { tr } would be a redeclaration error; window.tr is late-bound
//   and collision-free (same precedent as window.useTweaks).
// - app/marked-setup.js (loaded standalone by tests/test-markdown.mjs,
//   without this engine present) uses the guarded late-bound form inside
//   its renderer body: window.OMP_I18N?.tr("Copy code") ?? "Copy code".
//
// Do NOT translate — strings the code matches back byte-for-byte, or that
// cross a protocol boundary, stay English in BOTH languages: never wrapped
// in tr(), never given dictionary entries. Add new discoveries here.
// - app/session-title.js: RENAME_NOTE_PREFIXES and manualRename's
//   regenerated "Session renamed to …" note (matched against omp output).
// - app/approval.js's omp title/option parsing ("Allow tool:", "Approve",
//   "Deny") and chat/ask-bubble.jsx's msg.answer === "Confirm"/"Deny"
//   comparisons — display labels may translate, the VALUES sent to omp
//   may not.
// - app/session-ui.js PASTE_TOKEN_RE and collapsePaste's
//   "[paste #N +K lines]" chip (typed back into the composer and
//   re-parsed), and app/message-queue.js IMAGE_CHIP "[Image]" (matched
//   against omp's queue snapshot texts).
// - constants.js INTENT_FRAMING / APPROVAL_PROMPT and app/browser.js's
//   annotation prompt — agent-facing prompts sent to the model.
// - Slash command names (/plan, /goal, /skill:…), keymap action ids, file
//   paths, settings search keywords (kw), chord hints (Ctrl+W), the
//   product name "OMP Desktop", document.title.
// Rule: any string the source matches back (regex or === against produced
// text) stays English.

(function () {
  const DICTS = { en: null, zh: {} }; // en is the identity path (null = skip lookup)
  let current = "en";

  // Pure: any zh* navigator language → zh, everything else (or no
  // navigator) → en.
  function resolveAuto(nav) {
    return nav?.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  // Always returns a string: the dictionary value, or the key itself when
  // the active language has no entry for it. params fills {name} tokens by
  // plain split/join; tokens absent from params are left verbatim.
  function tr(key, params) {
    const d = DICTS[current];
    let out = d && Object.prototype.hasOwnProperty.call(d, key) ? d[key] : key;
    if (params && typeof params === "object") {
      for (const k of Object.keys(params)) {
        out = out.split("{" + k + "}").join(String(params[k]));
      }
    }
    return out;
  }

  function lang() {
    return current;
  }

  const subscribers = new Set();

  function setLang(v) {
    const next = v === "auto" ? resolveAuto(window.navigator) : v === "en" || v === "zh" ? v : "en";
    if (next === current) return;
    current = next;
    if (window.document?.documentElement) window.document.documentElement.lang = current;
    for (const fn of subscribers) {
      try {
        fn();
      } catch {} // one bad listener can't break the rest
    }
  }

  // Registers a change listener; returns the unsubscribe function.
  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  // Merges entries into a language's dictionary; last registration wins
  // on duplicate keys.
  function addLang(code, entries) {
    DICTS[code] = DICTS[code] || {};
    Object.assign(DICTS[code], entries);
  }

  // Init from the stored tweak. Everything reaches the environment through
  // the window identifier and is optional-chained, so a bare win = {} (the
  // Node test harness) resolves to the "en" default.
  let stored = "auto";
  try {
    const parsed = JSON.parse(window.localStorage?.getItem?.("omp-desktop:tweaks") ?? "null");
    if (parsed && typeof parsed === "object" && Object.prototype.hasOwnProperty.call(parsed, "lang")
      && (parsed.lang === "en" || parsed.lang === "zh" || parsed.lang === "auto")) {
      stored = parsed.lang;
    }
  } catch {}
  current = stored === "auto" ? resolveAuto(window.navigator) : stored;
  if (window.document?.documentElement) window.document.documentElement.lang = current;

  // Live sync: useTweaks' setTweak dispatches "tweakchange" on every write.
  if (typeof window.addEventListener === "function") {
    window.addEventListener("tweakchange", e => {
      if (e?.detail && "lang" in e.detail) setLang(e.detail.lang);
    });
  }

  window.OMP_I18N = Object.freeze({ tr, lang, setLang, subscribe, addLang, resolveAuto });
  window.tr = tr;
})();
