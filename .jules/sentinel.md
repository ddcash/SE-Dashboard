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

## 2025-05-24 - Fix XSS via entity-encoded URIs bypassing sanitizeUrl filter
**Vulnerability:** User-controlled bookmark URLs could use HTML entity encoding (e.g., `javascript&#x3A;alert(1)`) to bypass the `sanitizeUrl` filter. While the raw input does not match `^javascript:`, when injected into the `href` attribute, the browser decodes the entity back to a colon (`:`) before evaluating the URI, executing the malicious payload.
**Learning:** Regular expressions for URI validation on raw strings are easily bypassed if the string is later decoded by the browser. HTML attribute contexts automatically decode entities, so sanitizers must pre-decode the input to check the *actual* resulting URI.
**Prevention:** When validating URLs against malicious protocols, decode HTML entities (e.g., using `DOMParser`) and strip control characters both before and after decoding prior to regex matching. This ensures the sanitizer accurately evaluates the payload the browser will ultimately see.
