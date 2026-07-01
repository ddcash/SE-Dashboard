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
## 2024-05-24 - Fix XSS via unescaped variables in inline event handlers
**Vulnerability:** User-provided data (like `bm.id`, `catId`, `bm.url`) were interpolated directly into inline event handlers (e.g., `onclick="unhideItem('bookmarks','${bm.id}')"`), which could lead to XSS execution if an attacker crafted malicious input (e.g., `');alert(1);//`).
**Learning:** Interpolating user-supplied strings directly into inline JavaScript event handlers is unsafe, even if HTML-escaped, because the browser decodes HTML entities before evaluating the JavaScript.
**Prevention:** Store sanitized data in `data-*` attributes and access it via the element's dataset inside the handler (`this.dataset.id`).
