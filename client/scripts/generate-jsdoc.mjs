#!/usr/bin/env node
// Annotate constructor params & this.prop assignments in client/*.js (no subfolders).
// Dry-run by default; pass --write to actually modify files.
//
// Effect: when you do `this.someProp.` you get autocompletion from the imported class.
//
// Heuristics:
// - param name "foo" maps to imported "Foo" or "foo" if found
// - prefers direct identifier imports; falls back to filename match
// - if no match, uses `*` (unknown) and still annotates

/*
 *
 *
 *    How to run script: 
 *                  node scripts/annotate-ctor-props.mjs
 *                  node scripts/annotate-ctor-props.mjs --write
 *
 *
*/

import fs from "node:fs";
import path from "node:path";

const ARGS = new Set(process.argv.slice(2));
const SHOULD_WRITE = ARGS.has("--write");
const ROOT = process.cwd();
const CLIENT_DIR = path.resolve(ROOT, "client");

const isIdent = (s) => /^[A-Za-z_$][\w$]*$/.test(s);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// -------- import parsing --------
function parseImports(src) {
  // Map local identifier -> { module, export: 'default' | named, exportedAs: string }
  const map = new Map();

  // default + named + ns (we ignore ns for typing)
  const re = /import\s+([\s\S]+?)\s+from\s+["']([^"']+)["'];?/g;
  let m;
  while ((m = re.exec(src))) {
    const clause = m[1].trim();
    const mod = m[2];

    // namespace import: * as Utils from './x'
    const ns = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (ns) { map.set(ns[1], { module: mod, export: "namespace", exportedAs: "*" }); continue; }

    // default + maybe named: Foo, { Bar as Baz }
    const both = clause.match(/^([A-Za-z_$][\w$]*)(?:\s*,\s*\{([\s\S]*?)\})?$/);
    if (both) {
      const d = both[1];
      map.set(d, { module: mod, export: "default", exportedAs: "default" });
      if (both[2]) {
        for (const spec of both[2].split(",").map(s => s.trim()).filter(Boolean)) {
          const mm = spec.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
          if (mm) {
            const orig = mm[1], local = mm[2] || orig;
            map.set(local, { module: mod, export: "named", exportedAs: orig });
          }
        }
      }
      continue;
    }

    // only named: { Foo, Bar as Baz }
    const named = clause.match(/^\{([\s\S]*?)\}$/);
    if (named) {
      for (const spec of named[1].split(",").map(s => s.trim()).filter(Boolean)) {
        const mm = spec.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (mm) {
          const orig = mm[1], local = mm[2] || orig;
          map.set(local, { module: mod, export: "named", exportedAs: orig });
        }
      }
      continue;
    }

    // default only: Foo
    const def = clause.match(/^([A-Za-z_$][\w$]*)$/);
    if (def) {
      map.set(def[1], { module: mod, export: "default", exportedAs: "default" });
    }
  }

  return map;
}

function makeTypeRef(localName, imp) {
  // /** @typedef {import('./x').default} Foo */  OR  {import('./x').Bar} Foo
  const member = imp.export === "default" ? "default" :
                 imp.export === "named"   ? imp.exportedAs :
                 null;
  if (!member) return null; // ignore namespace for now
  return { typedefName: localName, module: imp.module, member };
}

// -------- class/ctor/assignment parsing --------
function extractClasses(src) {
  // Heuristic: export default class Name ... OR class Name ...
  const re = /(^|\n)(?:export\s+default\s+)?class\s+([A-Za-z_$][\w$]*)\b([\s\S]*?)\n}\s*/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    out.push({ start: m.index + (m[1] ? m[1].length : 0), name: m[2], body: m[3] });
  }
  return out;
}

function extractConstructor(body) {
  const m = body.match(/constructor\s*\(([\s\S]*?)\)\s*{([\s\S]*?)}/m);
  if (!m) return null;
  const paramsRaw = m[1];
  const ctorBody = m[2];

  // Collect simple identifier params only (skip destructured)
  const params = paramsRaw.split(",")
    .map(s => s.trim())
    .map(s => s.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/,"").trim())
    .map(s => s.split("=")[0].trim())      // strip defaults
    .filter(p => p && !p.includes("{") && !p.includes("[") && isIdent(p));

  return { params, ctorBody };
}

function findAssignments(ctorBody, param) {
  // find "this.something = param;" occurrences
  const re = new RegExp(String.raw`this\.([A-Za-z_$][\w$]*)\s*=\s*${param}\s*;`, "g");
  const props = [];
  let m;
  while ((m = re.exec(ctorBody))) props.push(m[1]);
  return props;
}

// -------- injection helpers --------
function ensureTypedef(src, typeRef) {
  const typedefLine =
    `/** @typedef {import('${typeRef.module}').${typeRef.member}} ${typeRef.typedefName} */\n`;
  const exists = new RegExp(
    String.raw`@typedef\s+\{import\(['"]${escapeReg(typeRef.module)}['"]\)\.${escapeReg(typeRef.member)}\}\s+${escapeReg(typeRef.typedefName)}\b`
  ).test(src);
  if (exists) return src;

  // insert after shebang if present; else at top
  if (src.startsWith("#!")) {
    const nl = src.indexOf("\n");
    return src.slice(0, nl + 1) + typedefLine + src.slice(nl + 1);
  }
  return typedefLine + src;
}

function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function ensureParamDoc(src, param, typeName) {
  // Add above the constructor, but only if no existing @param for this param
  const has = new RegExp(String.raw`@param\s+\{[^\}]*\}\s+${escapeReg(param)}\b`).test(src);
  if (has) return src;
  return src.replace(
    /(^|\n)\s*constructor\s*\(/,
    (m, lead) => `${lead}/**\n * @param {${typeName}} ${param}\n */\nconstructor(`
  );
}

function annotateAssignment(src, prop, param, typeName) {
  // Replace first occurrence of "this.prop = param;" with typed grouping
  const re = new RegExp(String.raw`(this\.${escapeReg(prop)}\s*=\s*${escapeReg(param)}\s*;)`);
  if (re.test(src) && !new RegExp(String.raw`@type\s*\{\s*${escapeReg(typeName)}\s*\}`).test(src)) {
    return src.replace(re, "/** @type {"+typeName+"} */ ($1)");
  }
  return src;
}

// -------- main --------
(async () => {
  let touched = 0, written = 0;

  let entries;
  try {
    entries = await fs.promises.readdir(CLIENT_DIR, { withFileTypes: true });
  } catch (e) {
    console.error("Cannot read client directory:", CLIENT_DIR, e.message);
    process.exit(1);
  }

  for (const e of entries) {
    if (!e.isFile()) continue;                 // no folders
    if (!e.name.endsWith(".js")) continue;     // only .js
    if (e.name.endsWith(".min.js")) continue;

    const file = path.join(CLIENT_DIR, e.name);
    let src;
    try { src = await fs.promises.readFile(file, "utf8"); } catch { continue; }

    const imports = parseImports(src);
    const classes = extractClasses(src);
    if (!classes.length) continue;

    let updated = src;
    let changedHere = false;

    for (const cls of classes) {
      const ctor = extractConstructor(cls.body);
      if (!ctor) continue;

      for (const param of ctor.params) {
        const props = findAssignments(ctor.ctorBody, param);
        if (!props.length) continue;

        // Try to resolve param -> imported type
        const candidates = [cap(param), param];
        let typeRef = null;

        for (const c of candidates) {
          const imp = imports.get(c);
          if (imp) { typeRef = makeTypeRef(c, imp); if (typeRef) break; }
        }

        // Fallback: try filename match on default imports (basename equals Cap or param)
        if (!typeRef) {
          for (const [local, imp] of imports) {
            if (imp.export !== "default") continue;
            const base = path.basename(imp.module).replace(/\.[mc]?js$/i, "");
            if (base === cap(param) || base === param) {
              typeRef = makeTypeRef(local, imp);
              if (typeRef) break;
            }
          }
        }

        // If still unknown, we’ll use '*' (unknown type)
        const typeName = typeRef ? typeRef.typedefName : "*";

        if (typeRef) {
          const before = updated;
          updated = ensureTypedef(updated, typeRef);
          changedHere ||= (updated !== before);
        }

        // Add @param for constructor
        {
          const before = updated;
          updated = ensureParamDoc(updated, param, typeName);
          changedHere ||= (updated !== before);
        }

        // Annotate each assignment this.prop = param;
        for (const prop of props) {
          const before = updated;
          updated = annotateAssignment(updated, prop, param, typeName);
          changedHere ||= (updated !== before);
        }
      }
    }

    if (changedHere) {
      touched++;
      if (SHOULD_WRITE) {
        await fs.promises.writeFile(file, updated, "utf8");
        written++;
        console.log(`Annotated: client/${e.name}`);
      } else {
        console.log(`Would annotate: client/${e.name}`);
      }
    }
  }

  console.log(`${SHOULD_WRITE ? "Annotated" : "Dry-run: would annotate"} ${touched} file(s).${SHOULD_WRITE ? ` Wrote ${written} file(s).` : ""}`);
})();
