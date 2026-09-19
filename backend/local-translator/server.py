from __future__ import annotations

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from translation_engine import MAX_TEXT_CHARS, SUPPORTED_LANGUAGES, TranslationEngine


MAX_REQUEST_BYTES = 16 * 1024
MAX_ACTIVE_REQUESTS = max(1, int(os.getenv("MARSOH_TRANSLATOR_MAX_ACTIVE", "4")))
INTERNAL_SECRET = os.getenv("MARSOH_LOCAL_TRANSLATION_SECRET", "").strip()
ENGINE = TranslationEngine()


class TranslationHandler(BaseHTTPRequestHandler):
    server_version = "AllonaMarSohTranslator/1.0"

    def log_message(self, format_string, *args):
        # Never put message bodies in application logs.
        print(f"translator request {self.command} {self.path} {args[1] if len(args) > 1 else '-'}")

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        if not INTERNAL_SECRET:
            return True
        supplied = self.headers.get("X-MarSoh-Internal-Token", "")
        return hmac.compare_digest(supplied, INTERNAL_SECRET)

    def do_GET(self):
        if self.path not in {"/health", "/ready"}:
            return self._json(404, {"ok": False, "code": "NOT_FOUND"})
        ready = ENGINE.ready()
        status = 200 if ready else 503
        return self._json(status, {
            "ok": ready,
            "service": "marsoh-local-translator",
            "provider": "local_ctranslate2",
            "model": "m2m100_418m_int8",
            "languages": sorted(SUPPORTED_LANGUAGES),
        })

    def do_POST(self):
        if self.path != "/translate":
            return self._json(404, {"ok": False, "code": "NOT_FOUND"})
        if not self._authorized():
            return self._json(401, {"ok": False, "code": "UNAUTHORIZED"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_REQUEST_BYTES:
            return self._json(413, {"ok": False, "code": "REQUEST_TOO_LARGE"})
        if not self.server.active_requests.acquire(blocking=False):
            return self._json(429, {"ok": False, "code": "TRANSLATOR_BUSY"})
        try:
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                text = payload.get("text", "")
                source = str(payload.get("source_language", "")).lower()
                target = str(payload.get("target_language", "")).lower()
                if not isinstance(text, str) or len(text) > MAX_TEXT_CHARS:
                    raise ValueError("text_too_long")
                result = ENGINE.translate(text, source, target)
                return self._json(200, {"ok": True, **result})
            except (UnicodeDecodeError, json.JSONDecodeError):
                return self._json(400, {"ok": False, "code": "INVALID_JSON"})
            except ValueError as error:
                return self._json(400, {"ok": False, "code": str(error).upper()})
            except Exception:
                return self._json(503, {"ok": False, "code": "TRANSLATION_UNAVAILABLE"})
        finally:
            self.server.active_requests.release()


class TranslationServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address):
        super().__init__(address, TranslationHandler)
        import threading

        self.active_requests = threading.BoundedSemaphore(MAX_ACTIVE_REQUESTS)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    TranslationServer(("0.0.0.0", port)).serve_forever()
