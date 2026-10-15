const HTML_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

function stripControlCharacters(text) {
  return text.replace(/\p{Cc}/gu, (char) => (/\s/u.test(char) ? ' ' : ''));
}

export function sanitizeText(value, maxLength) {
  const cleaned = stripControlCharacters(String(value ?? '').normalize('NFC'))
    .replace(/\s+/gu, ' ')
    .trim();

  if (!Number.isFinite(maxLength)) {
    return cleaned;
  }

  return Array.from(cleaned).slice(0, Math.max(0, maxLength)).join('').trim();
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
