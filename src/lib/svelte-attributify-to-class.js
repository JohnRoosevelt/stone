/**
 * svelte-attributify-to-class — Vite plugin
 * =========================================
 *
 * Before Svelte compilation, automatically converts attributify-style standalone attributes
 * to class="...", while removing the converted original attributes to avoid Svelte errors
 * caused by the ":" character.
 *
 * ── Supported Input Syntax ──────────────────────────────────────────
 *
 *   1. Valueless attributes
 *      <div w-full h-12 flex-cc />
 *      → <div class="w-full h-12 flex-cc" />
 *
 *   2. Variant valueless attributes with colon
 *      <div hover:bg-purple-700 hover:scale-105 />
 *      → <div class="hover:bg-purple-700 hover:scale-105" />
 *
 *   3. Variant prefix valued attributes
 *      <div dark="bg-gray-800" sm="w-80" />
 *      → <div class="dark:bg-gray-800 sm:w-80" />
 *
 *   4. Common valued attributify
 *      <div bg="white dark:black" text="sm white" />
 *      → <div class="bg-white dark:bg-black text-sm text-white" />
 *
 *   5. Self-reference syntax "~"
 *      <div grid="~ cols-3" divide-y="1 gray-300" />
 *      → <div class="grid grid-cols-3 divide-y-1 divide-gray-300" />
 *
 *   6. Merge with existing class
 *      <div flex-cc class="text-sm" />
 *      → <div class="flex-cc text-sm" />
 *
 *   7. Class as template literal
 *      <div class={`text-sm ${cond ? "active" : ""}`} flex-cc />
 *      → <div class={`flex-cc text-sm ${cond ? "active" : ""}`} />
 *
 *   8. Class as expression
 *      <div class={cond ? "active" : ""} flex-cc />
 *      → <div class={"flex-cc " + (cond ? "active" : "")} />
 *
 * ── Attributes That Will NOT Be Processed ─────────────────────────────────────────
 *
 *   - Standard HTML attributes:  id, style, href, src, alt, title, type, …
 *   - Svelte directives:     on:click, bind:value, use:action, class:name, …
 *   - Event handlers:      onclick, onchange, oninput, …
 *   - data-* / aria-*
 *   - Svelte 5 shorthand:   {variable}
 *   - Content inside <script> / <style> / <svelte:*> tags
 *
 * ── Processing Order (enforce: "pre") ────────────────────────────────
 *
 *   Runs in the "pre" phase of the Vite plugin, completing the transformation
 *   before the Svelte compiler sees the file, so Svelte won't warn about
 *   the original attributify attributes.
 */

/**
 * @returns {import("vite").Plugin}
 */
export default function svelteAttributifyToClass() {
  // HTML reserved attributes that are not UnoCSS utility classes
  const skipSet = new Set([
    "class",
    "id",
    "style",
    "href",
    "src",
    "alt",
    "title",
    "type",
    "value",
    "name",
    "for",
    "role",
    "rel",
    "target",
    "lang",
    "dir",
    "disabled",
    "readonly",
    "required",
    "autofocus",
    "placeholder",
    "hidden",
    "download",
    "draggable",
    "tabindex",
    "accesskey",
    "contenteditable",
    "spellcheck",
    "translate",
    "width",
    "height",
    "viewBox",
    "fill",
    "xmlns",
    "d",
    "clip-path",
    "clipPath",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x",
    "y",
    "dx",
    "dy",
    "points",
    "stdDeviation",
    "mode",
    "values",
    "min",
    "max",
    "step",
    "accept",
    "action",
    "autocomplete",
    "enctype",
    "method",
    "novalidate",
    "cols",
    "rows",
    "span",
    "colspan",
    "rowspan",
    "headers",
    "scope",
    "media",
    "sizes",
    "srcset",
    "poster",
    "preload",
    "autoplay",
    "controls",
    "loop",
    "muted",
    "playsinline",
    "crossorigin",
    "integrity",
    "referrerpolicy",
    "loading",
    "decoding",
    "ismap",
    "usemap",
    "coords",
    "shape",
    "ping",
    "charset",
    "http-equiv",
    "itemprop",
    "itemscope",
    "itemtype",
    "itemid",
    "itemref",
    "slot",
    "part",
    "exportparts",
    "open",
    "selected",
    "checked",
    "multiple",
    "wrap",
    "nowrap",
    "reversed",
    "start",
    "compact",
    "declare",
    "standby",
    "codebase",
    "codetype",
    "archive",
    "classid",
    "code",
    "data",
    "hspace",
    "vspace",
    "marginheight",
    "marginwidth",
    "longdesc",
    "frameborder",
    "allowfullscreen",
    "sandbox",
    "srcdoc",
    "let",
    "this",
  ]);

  // UnoCSS attributify variant prefixes
  const variantNames = new Set([
    "dark",
    "light",
    "sm",
    "md",
    "lg",
    "xl",
    "xxl",
    "rtl",
    "ltr",
    "portrait",
    "landscape",
    "motion-safe",
    "motion-reduce",
    "contrast-more",
    "contrast-less",
    "print",
  ]);

  // Common valued attributify attributes (values will be split into multiple classes)
  const valuedAttrs = new Set([
    "bg",
    "grid",
    "divide",
    "divide-x",
    "divide-y",
    "text",
    "border",
    "m",
    "p",
    "gap",
    "font",
    "rounded",
    "shadow",
    "ring",
    "inset-shadow",
  ]);

  function isSkippable(name) {
    if (skipSet.has(name)) return true;
    if (name.startsWith("data-") || name.startsWith("aria-")) return true;
    if (
      name.startsWith("on") &&
      name.length > 2 &&
      name[2] === name[2].toLowerCase()
    )
      return true;
    if (
      /^(on:|bind:|use:|class:|transition:|animate:|in:|out:|let:)/.test(name)
    )
      return true;
    return false;
  }

  /**
   * Scan character by character to find the actual closing `>` of a tag.
   * Correctly handle quotes, backticks, and brace nesting to avoid misidentifying `>` inside `${...}`.
   */
  function findTagEnd(str, start) {
    let i = start;
    let inDQ = false,
      inSQ = false,
      inBT = false;
    let braceDepth = 0;
    while (i < str.length) {
      const ch = str[i];
      if (inDQ) {
        if (ch === '"' && str[i - 1] !== "\\") inDQ = false;
      } else if (inSQ) {
        if (ch === "'" && str[i - 1] !== "\\") inSQ = false;
      } else if (inBT) {
        if (ch === "`" && str[i - 1] !== "\\") inBT = false;
      } else if (ch === '"') inDQ = true;
      else if (ch === "'") inSQ = true;
      else if (ch === "`") inBT = true;
      else if (ch === "{") braceDepth++;
      else if (ch === "}") braceDepth--;
      else if (ch === ">" && braceDepth === 0) return i;
      i++;
    }
    return -1;
  }

  return {
    name: "svelte-attributify-to-class",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".svelte") || id.includes("node_modules")) return null;
      if (!code.includes("<")) return null;

      let result = "";
      let i = 0;
      while (i < code.length) {
        const tagStart = code.indexOf("<", i);
        if (tagStart === -1) {
          result += code.slice(i);
          break;
        }

        result += code.slice(i, tagStart);

        // Closing tag </xxx>
        if (code[tagStart + 1] === "/") {
          const end = code.indexOf(">", tagStart + 2);
          result += code.slice(tagStart, end + 1);
          i = end + 1;
          continue;
        }

        // Extract tag name (including colon to support svelte:head, etc.)
        let j = tagStart + 1;
        while (j < code.length && /[\w:-]/.test(code[j])) j++;
        const tagName = code.slice(tagStart + 1, j);
        if (
          ["script", "style", "template"].includes(tagName) ||
          tagName.startsWith("svelte:")
        ) {
          const end = findTagEnd(code, tagStart + 1);
          result += code.slice(tagStart, end + 1);
          i = end + 1;
          continue;
        }
        if (!tagName || tagName.length === 0) {
          result += code[tagStart];
          i = tagStart + 1;
          continue;
        }

        const tagEnd = findTagEnd(code, tagStart + 1);
        if (tagEnd === -1) {
          result += code.slice(tagStart);
          break;
        }

        const fullTag = code.slice(tagStart, tagEnd + 1);
        const attrPart = fullTag
          .slice(tagName.length + 1, -1)
          .replace(/\/\s*$/, "")
          .trim();
        if (!attrPart) {
          result += fullTag;
          i = tagEnd + 1;
          continue;
        }

        // ── Parse attributes ──
        const kept = [];
        const classParts = [];
        let existingClass = null;

        let pos = 0;
        while (pos < attrPart.length) {
          const attrStart = pos;
          while (pos < attrPart.length && /\s/.test(attrPart[pos])) pos++;
          if (pos >= attrPart.length) break;
          const nameStart = pos;

          // Svelte 5 shorthand attribute {name}
          if (attrPart[pos] === "{") {
            const closeBrace = attrPart.indexOf("}", pos + 1);
            if (closeBrace !== -1) {
              const inner = attrPart.slice(pos + 1, closeBrace).trim();
              if (/^[\w$]+$/.test(inner)) {
                kept.push(attrPart.slice(attrStart, closeBrace + 1));
                pos = closeBrace + 1;
                continue;
              }
            }
          }

          // Read attribute name
          while (pos < attrPart.length && /[\w:-]/.test(attrPart[pos])) pos++;
          const name = attrPart.slice(nameStart, pos);
          if (!name) {
            pos++;
            continue;
          }

          const rawStart = attrStart;

          // Check if there's a = after
          while (pos < attrPart.length && /\s/.test(attrPart[pos])) pos++;
          if (pos < attrPart.length && attrPart[pos] === "=") {
            pos++; // skip =
            while (pos < attrPart.length && /\s/.test(attrPart[pos])) pos++;

            const ch = attrPart[pos];
            let valEnd = pos;

            if (ch === '"') {
              valEnd = attrPart.indexOf('"', pos + 1);
              if (valEnd !== -1) valEnd++;
            } else if (ch === "'") {
              valEnd = attrPart.indexOf("'", pos + 1);
              if (valEnd !== -1) valEnd++;
            } else if (ch === "`") {
              valEnd = attrPart.indexOf("`", pos + 1);
              if (valEnd !== -1) valEnd++;
            } else if (ch === "{") {
              let depth = 1;
              valEnd = pos + 1;
              while (valEnd < attrPart.length && depth > 0) {
                if (attrPart[valEnd] === "{") depth++;
                else if (attrPart[valEnd] === "}") depth--;
                if (depth > 0) valEnd++;
              }
              if (depth === 0) valEnd++;
            }

            if (valEnd !== -1 && valEnd > pos) {
              const raw = attrPart.slice(rawStart, valEnd);
              const value = attrPart.slice(
                pos + 1,
                ch === "{"
                  ? valEnd - 1
                  : ch === '"' || ch === "'" || ch === "`"
                    ? valEnd - 1
                    : valEnd,
              );

              if (name === "class") {
                const quoteMap = { '"': '"', "'": "'", "`": "`", "{": "{" };
                existingClass = { value, quote: quoteMap[ch] || '"', raw };
                // Don't keep the original class, will be reconstructed later
              } else if (variantNames.has(name)) {
                for (const v of value.split(/\s+/).filter(Boolean)) {
                  if (v === "~") classParts.push(name);
                  else classParts.push(`${name}:${name}-${v}`);
                }
              } else if (valuedAttrs.has(name)) {
                for (const v of value.split(/\s+/).filter(Boolean)) {
                  if (v === "~") classParts.push(name);
                  else if (v.includes(":")) {
                    const [variant, rest] = v.split(":", 2);
                    classParts.push(`${variant}:${name}-${rest}`);
                  } else classParts.push(`${name}-${v}`);
                }
              } else {
                kept.push(raw);
              }
              pos = valEnd;
            } else {
              kept.push(attrPart.slice(rawStart, pos));
            }
          } else {
            // Valueless attribute
            const raw = attrPart.slice(rawStart, pos);
            if (name === "class" || isSkippable(name)) {
              kept.push(raw);
            } else {
              classParts.push(name);
            }
          }
        }

        // ── Rebuild tag ──
        let newTag;
        if (classParts.length > 0) {
          const close = fullTag.endsWith("/>") ? " />" : "";
          const keptStr = kept.length > 0 ? " " + kept.join(" ").trim() : "";
          let classAttr;
          if (existingClass) {
            const { value, quote } = existingClass;
            if (quote === "`")
              classAttr = ` class="${classParts.join(" ")} ${value}"`;
            else if (quote === "{")
              classAttr = ` class={"${classParts.join(" ") + " "}" + (${value})}`;
            else classAttr = ` class="${classParts.join(" ")} ${value}"`;
          } else {
            classAttr = ` class="${classParts.join(" ")}"`;
          }
          newTag = `<${tagName}${keptStr}${classAttr}${close}>`;
        } else {
          newTag = fullTag;
        }

        result += newTag;
        i = tagEnd + 1;
      }

      return result;
    },
  };
}
