import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const i18nUrl = new URL("../../../js/marsoh-i18n.js", import.meta.url);
const speechUrl = new URL("../../../js/marsoh-speech-provider.js", import.meta.url);

async function loadI18n() {
  const source = await readFile(i18nUrl, "utf8");
  const document = {
    documentElement: { lang: "tr", dir: "ltr" },
    querySelectorAll: () => [],
    querySelector: () => null,
    dispatchEvent: () => {}
  };
  const context = {
    window: {}, document,
    localStorage: { getItem: () => null, setItem: () => {} },
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
  };
  vm.runInNewContext(source, context);
  return { i18n: context.window.MarSohI18n, document };
}

test("MarSoh exposes a complete interface dictionary for all nine platform languages", async () => {
  const { i18n } = await loadI18n();
  assert.deepEqual([...i18n.SUPPORTED], ["tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"]);
  const requiredKeys = Object.keys(i18n.COPY.tr);
  assert.ok(requiredKeys.length >= 95);
  for (const language of i18n.SUPPORTED) {
    for (const key of requiredKeys) {
      assert.equal(typeof i18n.COPY[language][key], "string", `${language}.${key} is missing`);
      assert.ok(i18n.COPY[language][key].trim(), `${language}.${key} is empty`);
    }
  }
});

test("Arabic switches the document to RTL while other languages remain LTR", async () => {
  const { i18n, document } = await loadI18n();
  i18n.apply("ar");
  assert.equal(document.documentElement.dir, "rtl");
  i18n.apply("az");
  assert.equal(document.documentElement.dir, "ltr");
});

test("automatic translation controls are localized in all supported languages", async () => {
  const { i18n } = await loadI18n();
  for (const language of i18n.SUPPORTED) {
    assert.ok(i18n.COPY[language].autoTranslate?.trim(), `${language}.autoTranslate is missing`);
    assert.ok(i18n.COPY[language].translationReady?.trim(), `${language}.translationReady is missing`);
    assert.ok(i18n.COPY[language].autoTranslateHint?.trim(), `${language}.autoTranslateHint is missing`);
  }
});

test("speech provider keeps editable transcript through browser restarts without audio persistence", async () => {
  const source = await readFile(speechUrl, "utf8");
  const instances = [];
  const timers = [];
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  }
  const window = {
    SpeechRecognition: Recognition,
    isSecureContext: true,
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    clearTimeout: () => {},
    MarSohI18n: { SPEECH_LOCALES: { az: "az-AZ" } }
  };
  const context = { window };
  vm.runInNewContext(source, context);
  const transcripts = [];
  const provider = new window.MarSohSpeech.BrowserSpeechToTextProvider({ onText: (value) => transcripts.push(value) });
  provider.start("az");
  assert.equal(instances[0].lang, "az-AZ");
  const result = [{ transcript: "salam dəniz" }];
  result.isFinal = true;
  instances[0].onresult({ resultIndex: 0, results: [result] });
  assert.equal(transcripts.at(-1).combinedText, "salam dəniz");
  instances[0].onend();
  timers.at(-1)();
  assert.equal(instances.length, 2);
  assert.equal(provider.finalText, "salam dəniz");
  provider.stop();
  assert.equal(provider.desiredActive, false);
  assert.doesNotMatch(source, /MediaRecorder|Blob\(|getUserMedia|audio\//);
});
