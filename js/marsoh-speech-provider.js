(function () {
  "use strict";

  class SpeechToTextProvider {
    supported() { return false; }
    start() { throw new Error("SPEECH_UNSUPPORTED"); }
    stop() {}
  }

  class BrowserSpeechToTextProvider extends SpeechToTextProvider {
    constructor(options) {
      super();
      this.options = options || {};
      this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
      this.recognition = null;
      this.active = false;
      this.finalText = "";
    }

    supported() { return Boolean(this.Recognition && window.isSecureContext); }

    start(language) {
      if (!this.supported()) throw new Error("SPEECH_UNSUPPORTED");
      if (this.active) return;
      const recognition = new this.Recognition();
      recognition.lang = ({ tr: "tr-TR", az: "az-AZ", en: "en-US" })[language] || language || "tr-TR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      this.finalText = "";
      recognition.onstart = () => { this.active = true; this.options.onStart?.(); };
      recognition.onresult = (event) => {
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const text = event.results[index][0]?.transcript || "";
          if (event.results[index].isFinal) this.finalText += text;
          else interimText += text;
        }
        this.options.onText?.({ finalText: this.finalText, interimText });
      };
      recognition.onerror = (event) => {
        const code = event.error === "not-allowed" || event.error === "service-not-allowed" ? "SPEECH_PERMISSION_DENIED" : event.error === "no-speech" ? "SPEECH_TIMEOUT" : "SPEECH_ERROR";
        this.options.onError?.(code);
      };
      recognition.onend = () => { this.active = false; this.recognition = null; this.options.onEnd?.(); };
      this.recognition = recognition;
      recognition.start();
    }

    stop() {
      if (this.recognition) this.recognition.stop();
    }
  }

  window.MarSohSpeech = { SpeechToTextProvider, BrowserSpeechToTextProvider };
})();
