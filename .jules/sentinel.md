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
## 2024-05-24 - Fix XSS via HTML entities in URLs
**Vulnerability:** The URL sanitization function `sanitizeUrl` used a regular expression `/^(javascript|data|vbscript):/i` to block dangerous protocols. However, this regex ran on the raw user input without first decoding HTML entities. Because browsers automatically decode HTML entities (like `&colon;`, `&#58;`, `&#x3A;`) in attribute values *before* evaluating the protocol, an attacker could bypass the filter by supplying a URL like `javascript&colon;alert(1)`.
**Learning:** When sanitizing URLs intended for HTML attributes (like `href`), you must accurately replicate the browser's HTML entity decoding behavior before performing protocol matching. A standard regex check is insufficient if it operates on the raw, encoded string.
**Prevention:** Always decode HTML entities in URLs before validating them against dangerous protocols. A robust way to do this in the browser is to assign the string to the `innerHTML` of a detached DOM element (like a `<textarea>`) and read back its `value`, which safely decodes entities without executing scripts.
