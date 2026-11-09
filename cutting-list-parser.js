/* CutPlan cutting-list parser: preserves alphanumeric references and edge-band symbols. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CutPlanParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function emptyEdgeBandingSpec() {
    return { '0.8': { length: 0, width: 0 }, '2': { length: 0, width: 0 } };
  }

  function parseDimensionToken(value) {
    const token = String(value ?? '').trim().replace(/,/g, '.').replace(/\s*mm$/i, '');
    const match = token.match(/^(\d+(?:\.\d+)?)([_~]*)$/);
    if (!match) return null;
    const suffix = match[2] || '';
    return {
      value: Number(match[1]),
      underscoreCount: (suffix.match(/_/g) || []).length,
      tildeCount: (suffix.match(/~/g) || []).length
    };
  }

  function formatDimensionToken(value, spec, axis) {
    const numeric = Number(value);
    const base = Number.isInteger(numeric) ? String(numeric) : String(numeric);
    const bands = spec || emptyEdgeBandingSpec();
    const count08 = Math.max(0, Math.floor(Number(bands['0.8']?.[axis]) || 0));
    const count2 = Math.max(0, Math.floor(Number(bands['2']?.[axis]) || 0));
    return base + '_'.repeat(Math.min(count08, 8)) + '~'.repeat(Math.min(count2, 8));
  }

  function normalizeSpec(lengthParsed, widthParsed) {
    const spec = emptyEdgeBandingSpec();
    if (lengthParsed) {
      spec['0.8'].length = lengthParsed.underscoreCount;
      spec['2'].length = lengthParsed.tildeCount;
    }
    if (widthParsed) {
      spec['0.8'].width = widthParsed.underscoreCount;
      spec['2'].width = widthParsed.tildeCount;
    }
    return spec;
  }

  function tokensForLine(line) {
    // Preserve markers attached to dimensions. OCR sometimes separates marker glyphs.
    const tokens = String(line).match(/#?[A-Za-z][A-Za-z0-9._-]*|#?\d+[A-Za-z][A-Za-z0-9._-]*|#?\d+_[A-Za-z0-9.-]+|#?\d+(?:[.,]\d+)?[_~]*|[_~]+/g) || [];
    const merged = [];
    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i];
      if (/^\d+(?:[.,]\d+)?$/.test(token) && /^[ _~]+$/.test(tokens[i + 1] || '')) {
        token += tokens[++i].replace(/\s/g, '');
      }
      if (/^(?:x|by)$/i.test(token)) continue;
      merged.push(token.replace(/^#/, ''));
    }
    return merged;
  }

  function isDimensionToken(token) {
    return /^\d+(?:[.,]\d+)?[_~]*$/.test(token || '');
  }

  function parseOcrRows(text) {
    const output = [];
    const rejected = [];
    const seen = new Set();
    const headerPattern = /cutting\s*list|length|width|quantity|rotation|\bqty\b|\bmm\b/i;

    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || headerPattern.test(line)) continue;
      const tokens = tokensForLine(line);
      if (tokens.length < 3) continue;

      let prefixCount = 0;
      let rowId = '';
      const first = tokens[0] || '';
      const second = tokens[1] || '';

      // References can be one token (2KB, CAB-A1) or OCR-split (1 A -> 1A).
      if (/[A-Za-z]/.test(first)) {
        prefixCount = 1;
      } else if (/^\d+$/.test(first) && /^[A-Za-z]+[A-Za-z0-9._-]*$/.test(second)) {
        prefixCount = 2;
      } else if (/^\d+$/.test(first) && tokens.filter(isDimensionToken).length >= 4) {
        // A standalone numeric serial/ref precedes the two dimensions and quantity.
        prefixCount = 1;
      }

      if (prefixCount) {
        rowId = tokens.slice(0, prefixCount).join('');
      } else {
        rowId = String(output.length + 1);
      }

      const valueTokens = tokens.slice(prefixCount);
      const dimensions = [];
      let dimensionIndexes = [];
      for (let i = 0; i < valueTokens.length; i++) {
        if (isDimensionToken(valueTokens[i])) {
          const parsed = parseDimensionToken(valueTokens[i]);
          if (parsed && parsed.value > 0) {
            dimensions.push(parsed);
            dimensionIndexes.push(i);
          }
        }
        if (dimensions.length === 2) break;
      }
      if (dimensions.length < 2) { rejected.push(line); continue; }

      const afterWidth = valueTokens.slice(dimensionIndexes[1] + 1);
      const quantityToken = afterWidth.find(token => /^\d+$/.test(token));
      if (!quantityToken) { rejected.push(line); continue; }

      const [lengthParsed, widthParsed] = dimensions;
      const length = lengthParsed.value;
      const width = widthParsed.value;
      const qty = Number(quantityToken);
      const valid = length >= 1 && length <= 100000 && width >= 1 && width <= 100000 &&
        Number.isInteger(qty) && qty >= 1 && qty <= 10000 &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(rowId);
      const key = rowId.toLowerCase();
      if (!valid || seen.has(key)) { rejected.push(line); continue; }

      const rotate = !/\b(no|false|fixed|cannot)\b/i.test(line);
      seen.add(key);
      output.push({
        rowId, length, width, qty, rotate,
        edgeBanding: { top: false, right: false, bottom: false, left: false },
        edgeBandingSpec: normalizeSpec(lengthParsed, widthParsed)
      });
    }
    return { rows: output, rejected };
  }

  return { emptyEdgeBandingSpec, parseDimensionToken, formatDimensionToken, parseOcrRows };
});
