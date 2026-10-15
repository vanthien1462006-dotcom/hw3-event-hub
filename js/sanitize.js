const HTML_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

const INVISIBLE_AND_BIDI = /[​‎‏‪-‮⁠⁦-⁩﻿]/gu;
const VISIBLE_CHARACTER = /[\p{L}\p{N}\p{P}\p{S}]/u;

function stripControlCharacters(text) {
  return text
    .replace(INVISIBLE_AND_BIDI, '')
    .replace(/\p{Cc}/gu, (char) => (/\s/u.test(char) ? ' ' : ''));
}

export function sanitizeText(value, maxLength) {
  const cleaned = stripControlCharacters(String(value ?? '').normalize('NFC'))
    .replace(/\s+/gu, ' ')
    .trim();
  const limited = Number.isFinite(maxLength)
    ? Array.from(cleaned).slice(0, Math.max(0, maxLength)).join('').trim()
    : cleaned;

  return VISIBLE_CHARACTER.test(limited) ? limited : '';
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
