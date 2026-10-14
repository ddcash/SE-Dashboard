## 2024-05-24 - Fix XSS via unescaped quotes, insecure URL protocols, and JS-context injection
**Vulnerability:**
1. Unescaped single quotes (`'`) allowed breaking out of HTML attributes.
2. Insecure URI schemes (`javascript:`, `vbscript:`, `data:`) could be executed.
3. User-provided URLs were interpolated directly into inline `onclick` handlers, causing JavaScript execution upon decoding (`');alert(1);//`).
**Learning:**
1. Single quotes must be properly escaped in our HTML encoding utility.
2. User-provided URLs must be sanitized to ensure safe protocols.
3. Interpolating user-supplied strings directly into inline JavaScript event handlers (like `onclick`) is unsafe, even if HTML-escaped, because the browser decodes HTML entities before evaluating the JavaScript.
**Prevention:**
1. Include single quotes in the `esc()` function.
2. Apply a URL sanitization function (`sanitizeUrl()`).
3. Store user-provided URLs in `data-` attributes and retrieve them dynamically within the event handler (`this.getAttribute('data-url')`), preventing JS execution.

## 2024-05-24 - Fix XSS via string interpolation in inline event handlers
**Vulnerability:** User-controlled inputs were directly interpolated into inline `onclick` event handlers (e.g., `onclick="someFunction('${userInput}')"`). This allowed attackers to break out of the string context and execute arbitrary JS, even if the input was HTML-escaped, because browsers decode HTML entities in attributes before executing JS.
**Learning:** Interpolating user-supplied strings directly into inline JS event handlers is unsafe regardless of standard HTML escaping.
**Prevention:** Store user-provided strings in `data-*` attributes and retrieve them dynamically within the event handler (`this.dataset.propertyName` or `this.getAttribute('data-property-name')`) rather than interpolating them directly into the inline script.
## 2025-02-27 - Fix XSS in inline event handlers
**Vulnerability:** User-controlled bookmark IDs (e.g., from imported JSON) and category IDs were directly interpolated into inline `onclick` event handlers (`onclick="trackClick(event,'${bm.id}','${catId}')"`). An attacker could bypass HTML-escaping because the browser decodes HTML entities before evaluating the JavaScript context.
**Learning:** Interpolating user-supplied strings directly into inline JavaScript event handlers is unsafe, even if HTML-escaped (`esc()`), because the browser decodes HTML entities before evaluating the JavaScript.
**Prevention:** Store user-provided dynamic identifiers (like IDs or URLs) in `data-` attributes on the DOM element and retrieve them dynamically within the event handler (e.g., `this.closest('.card').dataset.id`), preventing injection via entity decoding.
## 2024-10-14 - Fix XSS bypass via entity-encoded null bytes
**Vulnerability:** The URL sanitization function `sanitizeUrl()` was vulnerable to an XSS bypass. Attackers could obfuscate malicious protocols using HTML entities (e.g., `&#106;avascript:`) which bypassed the initial regex check but were later decoded and executed by the browser when placed in an `href` attribute. Additionally, attempting to decode the string using a detached `<textarea>` (which invokes the browser's HTML parser) converted invalid null bytes (`\x00`) to the Unicode Replacement Character (`\uFFFD`). If `\uFFFD` wasn't stripped, it could be used to bypass the protocol regex (`javascript:\uFFFDalert(1)`).
**Learning:** When using DOM APIs like `innerHTML` or `DOMParser` to safely decode HTML entities for validation, be aware of how the browser's HTML parser automatically mutates invalid characters (like null bytes) into `\uFFFD`. Security checks must account for these mutations.
**Prevention:** 1) Decode HTML entities using a detached `<textarea>` before checking for malicious protocols. 2) Ensure the sanitization regex explicitly strips both standard control characters (`\x00-\x20\x7F-\x9F`) and the Unicode Replacement Character (`\uFFFD`) to prevent bypasses post-decoding.
