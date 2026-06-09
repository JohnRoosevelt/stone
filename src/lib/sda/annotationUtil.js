// Shared helpers for text annotations.
//
// One record per (cid, book, chapter, lang, p_index) paragraph. The DB
// stores the paragraph's full segment list as a JSON array of
// `{start, end, style, color}` objects. The DOM mirrors this: each
// highlighted span has data-start, data-end, data-style, data-color
// attributes so we can re-collect segments back from the DOM tree.

/** Style code → CSS text fragment. `color` is a CSS color string. */
function styleCss(style, color) {
  switch (style) {
    case "underline_wavy":
      return "text-decoration-line: underline; text-underline-offset: 4px; text-decoration-thickness: 2px; text-decoration-style: wavy; text-decoration-color: " + color + ";";
    case "underline":
      return "text-decoration-line: underline; text-underline-offset: 4px; text-decoration-thickness: 2px; text-decoration-style: solid; text-decoration-color: " + color + ";";
    case "bg":
      return "background-color: " + color + ";";
    case "text":
      return "color: " + color + ";";
    default:
      return "";
  }
}

/** Build a `cssText` string for one segment. */
export function buildSegmentCss(style, color) {
  return styleCss(style, color);
}

/**
 * Collect all segment objects within a paragraph element, in document order.
 * Each segment is `{ start, end, style, color }` — coordinates are character
 * offsets into the paragraph's plain text. The DOM is the source of truth
 * for what's currently shown: the toolbar re-reads the DOM after every edit.
 */
export function collectSegmentsFromDom(pEl) {
  const segments = [];
  if (!pEl) return segments;
  const spans = pEl.querySelectorAll("span[data-start][data-end][data-style]");
  spans.forEach((sp) => {
    const start = Number(sp.getAttribute("data-start"));
    const end = Number(sp.getAttribute("data-end"));
    const style = sp.getAttribute("data-style") || "";
    const color = sp.getAttribute("data-color") || "OrangeRed";
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end > start &&
      style
    ) {
      segments.push({ start, end, style, color });
    }
  });
  return segments;
}

/**
 * Merge `seg` into `segments` using the "one highlight per range" rule.
 *
 * Two segments are considered the "same physical highlight" iff they share
 * the same (start, end). style/color are properties of that single highlight
 * and get replaced, not stacked. Returning a NEW array (never mutating the
 * input) keeps the toolbar's undo/discard logic safe.
 *
 * Outcomes:
 *   - no matching (start,end)          → append
 *   - same (start,end)                 → replace that single entry in place
 *                                       (style/color overwrite, no second
 *                                       entry created — this is what stops
 *                                       "underline + underline_wavy" from
 *                                       stacking on the same range)
 */
export function appendSegment(segments, seg) {
  const idx = segments.findIndex(
    (s) => s.start === seg.start && s.end === seg.end,
  );
  if (idx === -1) return [...segments, seg];
  const out = segments.slice();
  out[idx] = seg;
  return out;
}

/** Remove the segment that matches (start, end, style). */
export function removeSegment(segments, seg) {
  return segments.filter(
    (s) => !(s.start === seg.start && s.end === seg.end && s.style === seg.style),
  );
}
