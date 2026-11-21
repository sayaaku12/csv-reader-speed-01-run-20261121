// Fast drop-in for csv-reader 1.0.0 (make.fun csv-reader-speed-01-run-20261121).
// Returns exactly csv-reader's answer {columns, rows, errors} for every input,
// but parses with indexOf jumps + slices instead of one character at a time.
//
// Semantics (mirroring vendor/csv-reader/index.js exactly):
// - U+FEFF at the very start is dropped.
// - A record ends at LF or CRLF; a line with no characters is no record.
// - Outside quotes a CR not followed by LF is dropped (error stray_cr).
// - A quoted field runs to the next quote that is not doubled ("" = one quote);
//   CRLF / lone CR inside it reads as LF; what follows the closing quote up to
//   the next comma or line break is appended as it stands (quote_junk when the
//   field ends); a quote that never closes is a literal character and the text
//   after it is read again as unquoted (unterminated_quote).
// - A quote inside an unquoted field is a literal character. Fields stay strings.
// - columns is the first record when header is true, else null ([] when header
//   and no records); rows are padded with "" (short_row) or cut (long_row) to
//   the first record's width. Errors are {code, line, row} in the order met.
//
// Speed notes: unquoted fields are found by indexOf jumps (next ',' vs the
// cached next '\n'); a CRLF line break's CR is stripped before the CR check so
// CRLF files never take the slow CR path; quoted fields scan for the closing
// quote with indexOf and only walk characters when the content holds CR/LF.
// (A record-level split(',') fast path was tried in v2 and REVERTED: its
// per-record preamble cost more than the split saved, 196-208 ms vs 137 ms.)

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The line the record being read starts on, and its index in rows (null: header).
  let recordLine = 1;
  let recordRow = null;

  // Index of the next '\n' at or after pos (-1: none / needs recompute).
  let lf = -1;

  // The field being read: its value, how it ended, and chars added by the last
  // unquoted read (for the quote_junk check). Shared so the hot loop allocates
  // no per-field result object.
  let fv = '';
  let fe = 0;
  let fa = 0;

  // Drop the CRs in `seg` (an unquoted field's raw slice, its CRLF already
  // stripped): every CR left in it is a stray_cr.
  function cleanCR(seg) {
    let out = '';
    let s = 0;
    for (let i = 0; i < seg.length; i++) {
      if (seg.charCodeAt(i) === 13) {
        out += seg.slice(s, i);
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        s = i + 1;
      }
    }
    return out + seg.slice(s);
  }

  // Convert CRLF / lone CR inside a quoted value to LF, counting the lines.
  function foldLines(value) {
    let out = '';
    let s = 0;
    let lines = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c === 13) {
        out += value.slice(s, i) + '\n';
        lines += 1;
        if (value.charCodeAt(i + 1) === 10) i += 1;
        s = i + 1;
      } else if (c === 10) {
        lines += 1;
      }
    }
    line += lines;
    return out + value.slice(s);
  }

  // Read an unquoted field from pos, starting from `init` ('"' when re-reading
  // an unterminated quote). Sets fv / fe / fa: `fa` counts the characters kept
  // from this read (not `init`), for the quote_junk check.
  function readUnquoted(init) {
    if (pos > lf) lf = text.indexOf('\n', pos);
    const ic = text.indexOf(',', pos);
    let termEnd;
    let ended;
    if (ic !== -1 && (lf === -1 || ic < lf)) {
      termEnd = ic;
      ended = COMMA;
    } else if (lf !== -1) {
      termEnd = lf;
      ended = LINE_BREAK;
    } else {
      termEnd = n;
      ended = END;
    }
    let seg = text.slice(pos, termEnd);
    if (ended === LINE_BREAK && seg.charCodeAt(seg.length - 1) === 13) {
      // The CR of the CRLF line break: part of the break, not the field.
      seg = seg.slice(0, -1);
    }
    if (seg.indexOf('\r') === -1) {
      fv = init + seg;
      fa = seg.length;
    } else {
      const clean = cleanCR(seg);
      fv = init + clean;
      fa = clean.length;
    }
    fe = ended;
    if (ended === COMMA) {
      pos = termEnd + 1;
    } else if (ended === LINE_BREAK) {
      pos = termEnd + 1;
      line += 1;
    } else {
      pos = n;
    }
  }

  // Read a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    let segStart = pos;
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after
        // it is read again as unquoted.
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        pos = open + 1;
        line = openLine;
        lf = -1;
        readUnquoted('"');
        return;
      }
      if (text.charCodeAt(q + 1) === 34) {
        value += text.slice(segStart, q) + '"';
        pos = q + 2;
        segStart = q + 2;
        continue;
      }
      value += text.slice(segStart, q);
      pos = q + 1;
      break;
    }
    if (value.indexOf('\r') !== -1 || value.indexOf('\n') !== -1) {
      value = foldLines(value);
    }
    if (pos >= n) {
      fv = value;
      fe = END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fv = value;
      fe = COMMA;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fv = value;
      fe = LINE_BREAK;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fv = value;
      fe = LINE_BREAK;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next
    // comma or line break.
    readUnquoted(value);
    if (fa > 0) {
      errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    }
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fv);
    } while (fe === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
