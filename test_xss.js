const assert = require('assert');

// ═══════════════════════════════════════════════════════════════
//  SECURITY: URL Sanitization
// ═══════════════════════════════════════════════════════════════
function sanitizeUrl(url) {
  if (!url) return '';
  const u = String(url).trim();
  const sanitized = u.replace(/[\x00-\x20\x7F-\x9F]/g, '');
  if (/^(javascript|data|vbscript):/i.test(sanitized)) return '#';
  return u;
}

assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '#');
assert.strictEqual(sanitizeUrl('  javascript: alert(1) '), '#');
assert.strictEqual(sanitizeUrl('JAVAScript:alert(1)'), '#');
assert.strictEqual(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '#');
assert.strictEqual(sanitizeUrl('https://example.com'), 'https://example.com');
assert.strictEqual(sanitizeUrl('/relative/path'), '/relative/path');
assert.strictEqual(sanitizeUrl('java\tscript:alert(1)'), '#');
assert.strictEqual(sanitizeUrl('\x01javascript:alert(1)'), '#');
assert.strictEqual(sanitizeUrl('java\nscript:alert(1)'), '#');
assert.strictEqual(sanitizeUrl('java\rscript:alert(1)'), '#');
console.log("Tests passed");
