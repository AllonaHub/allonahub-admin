(function () {
  "use strict";

  const DEFAULT_LOCALES = {
    tr: "tr-TR", az: "az-AZ", en: "en-US", de: "de-DE", ru: "ru-RU",
    ar: "ar-SA", kk: "kk-KZ", uz: "uz-UZ", ky: "ky-KG"
  };

  function joinSpeech(parts) {
    return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  class SpeechToTextProvider {
    supported() { return false; }
    start() { throw new Error("SPEECH_UNSUPPORTED"); }
    stop() {}
    setLanguage() {}
  }

  class BrowserSpeechToTextProvider extends SpeechToTextProvider {
    constructor(options) {
      super();
      this.options = options || {};
      this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
      this.recognition = null;
      this.active = false;
      this.desiredActive = false;
      this.finalText = "";
      this.language = "tr-TR";
      this.restartTimer = 0;
      this.sessionTimer = 0;
      this.restartCount = 0;
      this.startedOnce = false;
      this.lastError = "";
    }

    supported() { return Boolean(this.Recognition && window.isSecureContext); }

    resolveLanguage(language) {
      const locales = window.MarSohI18n?.SPEECH_LOCALES || DEFAULT_LOCALES;
      const key = String(language || "tr").toLowerCase().split("-")[0];
      return locales[key] || language || "tr-TR";
    }

    setLanguage(language) {
      this.language = this.resolveLanguage(language);
      if (this.desiredActive) {
        this.restartCount = 0;
        this.restartRecognition();
      }
    }

    start(language) {
      if (!this.supported()) throw new Error("SPEECH_UNSUPPORTED");
      if (this.desiredActive) return;
      this.language = this.resolveLanguage(language);
      this.finalText = "";
      this.restartCount = 0;
      this.startedOnce = false;
      this.lastError = "";
      this.desiredActive = true;
      this.active = true;
      this.options.onStart?.({ language: this.language });
      this.startRecognition();
    }

    startRecognition() {
      if (!this.desiredActive || this.recognition) return;
      const recognition = new this.Recognition();
      recognition.lang = this.language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        this.startedOnce = true;
        this.active = true;
        this.restartCount = 0;
        this.lastError = "";
        this.options.onListening?.({ language: this.language });
        window.clearTimeout(this.sessionTimer);
        this.sessionTimer = window.setTimeout(() => this.restartRecognition(), 55000);
      };
      recognition.onresult = (event) => {
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const text = String(event.results[index][0]?.transcript || "").trim();
          if (!text) continue;
          if (event.results[index].isFinal) this.finalText = joinSpeech([this.finalText, text]);
          else interimText = joinSpeech([interimText, text]);
        }
        this.options.onText?.({ finalText: this.finalText, interimText, combinedText: joinSpeech([this.finalText, interimText]) });
      };
      recognition.onerror = (event) => {
        const error = String(event.error || "unknown");
        const fatal = ["not-allowed", "service-not-allowed", "audio-capture"].includes(error);
        const code = error === "not-allowed" || error === "service-not-allowed"
          ? "SPEECH_PERMISSION_DENIED"
          : error === "no-speech"
            ? "SPEECH_TIMEOUT"
            : "SPEECH_ERROR";
        this.lastError = code;
        if (fatal) this.desiredActive = false;
        if (error !== "aborted") this.options.onError?.(code, { recoverable: !fatal, browserError: error });
      };
      recognition.onend = () => {
        window.clearTimeout(this.sessionTimer);
        this.sessionTimer = 0;
        this.recognition = null;
        if (this.desiredActive) {
          const delay = Math.min(1200, 220 + (this.restartCount * 180));
          this.restartCount += 1;
          window.clearTimeout(this.restartTimer);
          this.restartTimer = window.setTimeout(() => this.startRecognition(), delay);
          return;
        }
        this.active = false;
        this.options.onEnd?.({ finalText: this.finalText, error: this.lastError });
      };
      this.recognition = recognition;
      try {
        recognition.start();
      } catch (error) {
        this.recognition = null;
        this.desiredActive = false;
        this.active = false;
        this.options.onError?.("SPEECH_ERROR", { recoverable: false, error });
        this.options.onEnd?.({ finalText: this.finalText, error: "SPEECH_ERROR" });
      }
    }

    restartRecognition() {
      window.clearTimeout(this.restartTimer);
      window.clearTimeout(this.sessionTimer);
      if (!this.desiredActive) return;
      if (!this.recognition) {
        this.startRecognition();
        return;
      }
      try { this.recognition.abort(); } catch {}
    }

    stop() {
      this.desiredActive = false;
      this.active = false;
      window.clearTimeout(this.restartTimer);
      window.clearTimeout(this.sessionTimer);
      const recognition = this.recognition;
      this.recognition = null;
      if (recognition) {
        recognition.onend = null;
        try { recognition.stop(); } catch {
          try { recognition.abort(); } catch {}
        }
      }
      this.options.onEnd?.({ finalText: this.finalText, error: this.lastError });
    }
  }

  window.MarSohSpeech = { SpeechToTextProvider, BrowserSpeechToTextProvider };
})();
