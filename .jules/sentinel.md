## 2025-02-18 - XSS via HTML Entity Decoding Bypass
**Vulnerability:** URL protocol obfuscation filter bypass (XSS).
**Learning:** Browsers decode HTML entities in attributes (like `href`) before executing them. An attacker can provide a URL like `javascript&#58;alert(1)`. A regex filter checking for `javascript:` will fail to match against the raw string containing `&#58;`, but the browser will still execute it when clicked because it decodes the colon entity first.
**Prevention:** Always decode HTML entities from untrusted input to mirror the browser's view before applying security sanitization regexes. Using a disconnected `<textarea>` allows safe decoding of RCDATA without evaluating embedded scripts.
