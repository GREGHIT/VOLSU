function scoreCyrillic(text) {
  return (String(text).match(/[?-??-???]/g) || []).length;
}

function hasMojibakePattern(text) {
  const value = String(text || '');
  if (!value) return false;
  const markers = ['??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '???', '?', '?'];
  return markers.some((marker) => value.includes(marker));
}

function tryDecodeCp1251Mojibake(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 128) {
      bytes.push(code);
      continue;
    }
    if (char === '?') {
      bytes.push(0xa8);
      continue;
    }
    if (char === '?') {
      bytes.push(0xb8);
      continue;
    }
    if (code >= 0x0410 && code <= 0x042f) {
      bytes.push(code - 0x0410 + 0xc0);
      continue;
    }
    if (code >= 0x0430 && code <= 0x044f) {
      bytes.push(code - 0x0430 + 0xe0);
      continue;
    }
    return text;
  }

  try {
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    if (!decoded || decoded.includes('?')) return text;
    return scoreCyrillic(decoded) > scoreCyrillic(text) ? decoded : text;
  } catch {
    return text;
  }
}

export function decodeBrokenText(value) {
  if (typeof value !== 'string') return value ?? '';
  const text = String(value);
  if (!hasMojibakePattern(text)) return text;

  const repaired = tryDecodeCp1251Mojibake(text);
  if (repaired !== text) return repaired;

  try {
    const decoded = decodeURIComponent(escape(text));
    return scoreCyrillic(decoded) > scoreCyrillic(text) ? decoded : text;
  } catch {
    return text;
  }
}

export function decodeBrokenPayload(payload) {
  if (Array.isArray(payload)) return payload.map(decodeBrokenPayload);
  if (!payload || typeof payload !== 'object') return decodeBrokenText(payload);
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, decodeBrokenPayload(value)]));
}

export function sanitizeDomText(root) {
  if (!root || typeof document === 'undefined') return;

  const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const attributeNames = ['placeholder', 'title', 'aria-label'];

  while (elementWalker.nextNode()) {
    const node = elementWalker.currentNode;
    attributeNames.forEach((name) => {
      const value = node.getAttribute?.(name);
      if (value) node.setAttribute(name, decodeBrokenText(value));
    });
  }

  while (textWalker.nextNode()) {
    const node = textWalker.currentNode;
    if (!node?.nodeValue?.trim()) continue;
    const decoded = decodeBrokenText(node.nodeValue);
    if (decoded !== node.nodeValue) node.nodeValue = decoded;
  }
}
