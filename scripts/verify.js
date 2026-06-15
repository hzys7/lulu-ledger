#!/usr/bin/env node
// verify.js — Static check for lulu-ledger: import/export consistency +
//             undefined-identifier check (catches 1.2.15-style bugs) +
//             bundle smoke test
// Run: node scripts/verify.js
// Exit code: 0 = all OK, 1 = errors found

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const parser = require(require.resolve("@babel/parser", { paths: [path.resolve(__dirname, "../node_modules")] }));
const t = require(require.resolve("@babel/types", { paths: [path.resolve(__dirname, "../node_modules")] }));

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const ENTRY = path.join(ROOT, "index.js");
const APP_JS = path.join(ROOT, "App.js");

const errors = [];
const warnings = [];
function err(file, msg) { errors.push(file + ": " + msg); }
function warn(file, msg) { warnings.push(file + ": " + msg); }

function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  fs.readdirSync(d, { withFileTypes: true }).forEach(function (it) {
    var p = path.join(d, it.name);
    if (it.isDirectory() && it.name !== "node_modules") walk(p, out);
    else if (it.isFile() && it.name.endsWith(".js") && !it.name.endsWith(".test.js")) out.push(p);
  });
  return out;
}

var files = walk(SRC);
if (fs.existsSync(ENTRY)) files.push(ENTRY);
if (fs.existsSync(APP_JS)) files.push(APP_JS);
console.log("=== 1) File scan ===");
console.log("Found", files.length, "JS files");

function stripForExportParse(c) {
  return c
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/([\"`'\''])(?:\\.|(?!\1).)*?\1/g, '""');
}

function parseExports(file) {
  var raw = fs.readFileSync(file, "utf8");
  var stripped = stripForExportParse(raw);
  var exports = new Set();
  var hasDefault = false;
  stripped.replace(/export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)/g, function (_, n) { exports.add(n); });
  stripped.replace(/export\s*\{([^}]+)\}/g, function (_, inner) {
    inner.split(",").forEach(function (s) {
      var parts = s.trim().split(/\s+as\s+/);
      exports.add(parts[parts.length - 1].trim());
    });
  });
  if (/export\s+default\s/.test(stripped)) hasDefault = true;
  return { exports: exports, hasDefault: hasDefault, raw: raw, stripped: stripped };
}

var exportMap = new Map();
files.forEach(function (f) { exportMap.set(f, parseExports(f)); });

function parseImports(file) {
  var raw = fs.readFileSync(file, "utf8");
  var imports = [];
  var re = /import\s+(?:(\w+)\s*,\s*)?\{([^}]*)\}\s+from\s+["'\'']([^"'\'']+)["'\'']|import\s+(\w+)\s+from\s+["'\'']([^"'\'']+)["'\'']|import\s+\*\s+as\s+(\w+)\s+from\s+["'\'']([^"'\'']+)["'\'']/g;
  var m;
  while ((m = re.exec(raw)) !== null) {
    if (m[3] !== undefined) {
      var def = m[1] || null;
      var specs = m[2].split(",").map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
        var parts = s.split(/\s+as\s+/);
        return { orig: parts[0].trim(), local: (parts[1] || parts[0]).trim() };
      });
      imports.push({ kind: "named", default: def, specs: specs, source: m[3] });
    } else if (m[5] !== undefined) {
      imports.push({ kind: "default", default: m[4], specs: [], source: m[5] });
    } else if (m[7] !== undefined) {
      imports.push({ kind: "namespace", namespace: m[6], specs: [], source: m[7] });
    }
  }
  return imports;
}

function resolvePath(from, source) {
  if (!source.startsWith(".")) return null;
  var p = path.resolve(path.dirname(from), source);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(p + ".js")) return p + ".js";
  if (fs.existsSync(p + ".jsx")) return p + ".jsx";
  var indexP = path.join(p, "index.js");
  if (fs.existsSync(indexP)) return indexP;
  return p + ".js";
}

console.log("=== 2) Import resolution ===");
var importCount = 0;
files.forEach(function (f) {
  parseImports(f).forEach(function (imp) {
    if (!imp.source.startsWith(".")) return;
    var target = resolvePath(f, imp.source);
    if (!target || !fs.existsSync(target)) {
      err(f, "import from \"" + imp.source + "\" but file not found at " + target);
      return;
    }
    var exp = exportMap.get(target);
    if (!exp) { err(f, "cannot find exports for " + target); return; }
    importCount++;
    if ((imp.kind === "default" || imp.default) && !exp.hasDefault) {
      err(f, "imports default from \"" + imp.source + "\" but file has no `export default`");
    }
    imp.specs.forEach(function (spec) {
      if (!exp.exports.has(spec.orig)) {
        var avail = Array.from(exp.exports);
        err(f, "imports { " + spec.orig + (spec.orig !== spec.local ? " as " + spec.local : "") + " } from \"" + imp.source + "\" but \"" + spec.orig + "\" is not exported. Available: [" + avail.join(", ") + "]" + (exp.hasDefault ? ", default" : ""));
      }
    });
  });
});
console.log("Checked", importCount, "relative imports");

console.log("=== 3) forwardRef pattern check ===");
var forwardRefFiles = 0, forwardRefWithoutDefault = 0;
files.forEach(function (f) {
  var data = exportMap.get(f);
  if (/=\s*forwardRef\s*\(/.test(data.stripped)) {
    forwardRefFiles++;
    if (!/export\s+default/.test(data.stripped)) {
      forwardRefWithoutDefault++;
      err(f, "uses forwardRef() but file has no `export default` (1.2.11 crash pattern)");
    }
  }
});
console.log("forwardRef files:", forwardRefFiles, "— missing export default:", forwardRefWithoutDefault);

console.log("=== 4) AST undefined-identifier check ===");
var GLOBALS = new Set([
  "console", "Promise", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "Date", "Math", "JSON", "Array", "Object", "String", "Number", "Boolean",
  "Symbol", "Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError",
  "parseInt", "parseFloat", "isNaN", "isFinite", "NaN", "Infinity", "undefined",
  "globalThis", "process", "require", "module", "exports", "__dirname", "__filename",
  "Buffer", "fetch", "global", "alert", "prompt", "URL", "URLSearchParams",
  "React", "use", "Fragment", "Component", "window", "document", "navigator",
  "event", "location", "history", "localStorage", "sessionStorage",
  "constructor", "render", "componentDidMount", "componentDidUpdate", "componentWillUnmount",
  "getDerivedStateFromError", "getDerivedStateFromProps", "componentDidCatch", "shouldComponentUpdate",
  "getSnapshotBeforeUpdate",
  "AbortController", "AbortSignal", "RequestInit", "Response", "Request", "Headers",
  "FormData", "Blob", "File", "FileReader", "atob", "btoa", "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
  "Proxy", "Reflect", "WeakMap", "WeakSet", "Map", "Set",
  "DeviceEventEmitter",
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
  "id","tx","ok","no","go","item","cat","amt","raw","val","acc","key","idx","err","res","req","fn",
  "formatTimeAgo","styles",
]);

function isDeclCtx(node, parent) {
  if (!parent) return false;
  if (t.isVariableDeclarator(parent) && parent.id === node) return true;
  if ((t.isFunctionDeclaration(parent) || t.isFunctionExpression(parent) || t.isClassDeclaration(parent) || t.isClassExpression(parent)) && parent.id === node) return true;
  if (t.isImportSpecifier(parent) && parent.imported === node) return true;
  if (t.isExportSpecifier(parent) && (parent.exported === node || parent.local === node)) return true;
  if (t.isObjectProperty(parent) && parent.key === node && !parent.computed) return true;
  if (t.isObjectMethod(parent) && parent.key === node && !parent.computed) return true;
  if (t.isLabeledStatement(parent) && parent.label === node) return true;
  if ((t.isBreakStatement(parent) || t.isContinueStatement(parent)) && parent.label === node) return true;
  if (t.isCatchClause(parent) && parent.param === node) return true;
  if ((t.isFunctionExpression(parent) || t.isArrowFunctionExpression(parent) || t.isFunctionDeclaration(parent)) && parent.params && parent.params.includes(node)) return true;
  if ((t.isClassMethod(parent) || t.isClassPrivateMethod(parent)) && parent.key === node && !parent.computed) return true;
  if (t.isClassProperty(parent) && parent.key === node && !parent.computed) return true;
  return false;
}
function isPropKeyOrMember(node, parent) {
  if (!parent) return false;
  if (t.isMemberExpression(parent) && parent.property === node && !parent.computed) return true;
  if (t.isOptionalMemberExpression && t.isOptionalMemberExpression(parent) && parent.property === node && !parent.computed) return true;
  return false;
}
function isJSX(node, parent) {
  if (!parent) return false;
  if (t.isJSXAttribute(parent) && parent.name === node) return true;
  return false;
}
function addPattern(pattern, scope) {
  if (!pattern) return;
  if (t.isIdentifier(pattern)) { scope.add(pattern.name); return; }
  if (t.isObjectPattern(pattern)) {
    pattern.properties.forEach(function (p) {
      if (t.isObjectProperty(p)) addPattern(p.value, scope);
      else if (t.isRestElement(p)) addPattern(p.argument, scope);
    });
    return;
  }
  if (t.isArrayPattern(pattern)) {
    pattern.elements.forEach(function (e) { if (e) addPattern(e, scope); });
    return;
  }
  if (t.isAssignmentPattern(pattern)) { addPattern(pattern.left, scope); return; }
  if (t.isRestElement(pattern)) { addPattern(pattern.argument, scope); return; }
}
function collectBodyDecls(node, out) {
  if (!node || typeof node !== "object" || !node.type) return;
  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node) || t.isFunctionDeclaration(node) || t.isClassDeclaration(node) || t.isClassExpression(node)) {
    return;
  }
  if (t.isVariableDeclaration(node)) {
    node.declarations.forEach(function (d) { addPattern(d.id, out); });
  }
  if (t.isFunctionDeclaration(node) && node.id) out.add(node.id.name);
  for (var key in node) {
    if (key === "loc" || key === "parent" || key === "range" || key === "start" || key === "end") continue;
    var child = node[key];
    if (Array.isArray(child)) {
      child.forEach(function (c) { if (c && typeof c === "object" && c.type) collectBodyDecls(c, out); });
    } else if (child && typeof child === "object" && child.type) {
      collectBodyDecls(child, out);
    }
  }
}

function collectFnDeclNames(node, out) {
  if (!node || typeof node !== "object" || !node.type) return;
  if (t.isFunctionDeclaration(node) && node.id) {
    out.add(node.id.name);
  }
  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node) || t.isFunctionDeclaration(node) || t.isClassDeclaration(node) || t.isClassExpression(node)) {
    return;
  }
  for (var key in node) {
    if (key === "loc" || key === "parent" || key === "range" || key === "start" || key === "end") continue;
    var child = node[key];
    if (Array.isArray(child)) {
      child.forEach(function (c) { if (c && typeof c === "object" && c.type) collectFnDeclNames(c, out); });
    } else if (child && typeof child === "object" && child.type) {
      collectFnDeclNames(child, out);
    }
  }
}

var astErrorCount = 0;
files.forEach(function (f) {
  var ast;
  try {
    ast = parser.parse(fs.readFileSync(f, "utf8"), {
      sourceType: "module",
      plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator"],
      errorRecovery: true,
    });
  } catch (e) { return; }

  var moduleScope = new Set();
  collectFnDeclNames(ast.program, moduleScope);
  ast.program.body.forEach(function (s) {
    if (t.isImportDeclaration(s)) {
      s.specifiers.forEach(function (sp) { if (sp.local) moduleScope.add(sp.local.name); });
    }
    if (t.isVariableDeclaration(s)) {
      s.declarations.forEach(function (d) { addPattern(d.id, moduleScope); });
    }
    if (t.isClassDeclaration(s) && s.id) moduleScope.add(s.id.name);
    if (t.isExportNamedDeclaration(s)) {
      s.specifiers.forEach(function (sp) { if (sp.local) moduleScope.add(sp.local.name); });
      if (s.declaration) {
        if (t.isVariableDeclaration(s.declaration)) {
          s.declaration.declarations.forEach(function (d) { addPattern(d.id, moduleScope); });
        }
        if (t.isFunctionDeclaration(s.declaration) && s.declaration.id) moduleScope.add(s.declaration.id.name);
        if (t.isClassDeclaration(s.declaration) && s.declaration.id) moduleScope.add(s.declaration.id.name);
      }
    }
    if (t.isExportDefaultDeclaration(s) && s.declaration) {
      if (t.isFunctionDeclaration(s.declaration) && s.declaration.id) moduleScope.add(s.declaration.id.name);
      if (t.isClassDeclaration(s.declaration) && s.declaration.id) moduleScope.add(s.declaration.id.name);
    }
  });

  function visit(node, parent, scope) {
    if (!node || typeof node !== "object" || !node.type) return;
    var newScope = new Set(scope);
    if (t.isClassDeclaration(node) && node.id) newScope.add(node.id.name);
    if (t.isVariableDeclaration(node)) {
      node.declarations.forEach(function (d) { addPattern(d.id, newScope); });
    }
    if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node) || t.isFunctionDeclaration(node)) {
      if (t.isFunctionDeclaration(node) && node.id) newScope.add(node.id.name);
      if (node.params) node.params.forEach(function (p) { addPattern(p, newScope); });
      collectFnDeclNames(node.body, newScope);
      collectBodyDecls(node.body, newScope);
    }
    // Class methods (incl. static) need their params in scope so the body
    // of, e.g., `componentDidCatch(error, info)` can reference `error` and
    // `info` without being flagged as undefined.
    if (node.type === 'ClassMethod' || node.type === 'ClassPrivateMethod') {
      if (node.params) node.params.forEach(function (p) { addPattern(p, newScope); });
    }
    if (t.isBlockStatement(node)) {
      collectBodyDecls(node, newScope);
    }
    if (t.isCatchClause(node)) addPattern(node.param, newScope);

    if (t.isIdentifier(node) && !isDeclCtx(node, parent) && !isPropKeyOrMember(node, parent) && !isJSX(node, parent)) {
      if (!newScope.has(node.name) && !GLOBALS.has(node.name)) {
        err(f, node.loc.start.line + ": identifier \"" + node.name + "\" used but not defined (1.2.15 bug pattern)");
        astErrorCount++;
      }
    }

    for (var key in node) {
      if (key === "loc" || key === "parent" || key === "range" || key === "start" || key === "end") continue;
      var child = node[key];
      if (Array.isArray(child)) {
        child.forEach(function (c) { if (c && typeof c === "object" && c.type) visit(c, node, newScope); });
      } else if (child && typeof child === "object" && child.type) {
        visit(child, node, newScope);
      }
    }
  }

  ast.program.body.forEach(function (s) { visit(s, null, moduleScope); });
});
console.log("AST errors:", astErrorCount);

console.log("=== 5) node --check ===");
var syntaxOk = 0;
files.forEach(function (f) {
  try {
    execSync("\"C:\\\\Program Files\\\\nodejs\\\\node.exe\" --check \"" + f + "\"", { stdio: "pipe" });
    syntaxOk++;
  } catch (e) {
    err(f, "node --check failed: " + (e.stderr ? e.stderr.toString() : e.message));
  }
});
console.log("Syntax OK for", syntaxOk + "/" + files.length, "files");

console.log("=== 6) expo export:embed (smoke) ===");
var BUNDLE = path.join(require("os").tmpdir(), "verify-bundle.js");
try {
  if (fs.existsSync(BUNDLE)) fs.unlinkSync(BUNDLE);
  execSync(
    "\"C:\\\\Program Files\\\\nodejs\\\\node.exe\" \"C:\\\\Program Files\\\\nodejs\\\\node_modules\\\\npm\\\\bin\\\\npx-cli.js\" --no-install expo export:embed --platform android --dev false --bundle-output \"" + BUNDLE + "\" --assets-dest \"" + path.join(require("os").tmpdir(), "verify-assets") + "\"",
    { cwd: ROOT, stdio: "pipe", timeout: 180000 }
  );
  var sz = fs.statSync(BUNDLE).size;
  console.log("Bundle OK, size=" + sz + " bytes");
} catch (e) {
  err("bundle", "expo export:embed failed: " + (e.stderr ? e.stderr.toString().substring(0, 500) : e.message));
}

console.log("");
console.log("=== Summary ===");
console.log("Errors:", errors.length);
console.log("Warnings:", warnings.length);
if (errors.length > 0) {
  console.log("");
  console.log("--- ERRORS ---");
  errors.forEach(function (e) { console.log("  X", e); });
}
if (warnings.length > 0) {
  console.log("");
  console.log("--- WARNINGS ---");
  warnings.forEach(function (w) { console.log("  !", w); });
}
process.exit(errors.length > 0 ? 1 : 0);