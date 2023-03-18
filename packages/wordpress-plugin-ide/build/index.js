import { jsx as F, jsxs as Pe } from "react/jsx-runtime";
import De, { useState as L, useEffect as ee, useCallback as de, useMemo as te, useRef as fe, useImperativeHandle as Ie } from "react";
import { Tree as K } from "@geist-ui/core";
import { EditorView as G, keymap as Ce } from "@codemirror/view";
import { javascript as W } from "@codemirror/lang-javascript";
import { json as Fe, jsonParseLinter as Ne } from "@codemirror/lang-json";
import { html as Ae } from "@codemirror/lang-html";
import { css as Me } from "@codemirror/lang-css";
import { markdown as je } from "@codemirror/lang-markdown";
import { php as Be } from "@codemirror/lang-php";
import { linter as me, lintKeymap as Oe, lintGutter as We } from "@codemirror/lint";
import qe from "babel-plugin-import-global";
import * as he from "@babel/standalone";
import * as Le from "@rollup/browser";
import "estree-walker";
function Te(e) {
  const [s, o] = L(null);
  return ee(() => {
    e.then(o);
  }, [e]), s;
}
async function He(e, s) {
  const o = await ge(e, s);
  await Promise.all(
    o.map((n) => e.unlink(N(s, n.fileName)))
  );
}
async function ge(e, s) {
  const o = await e.listFiles(s), n = await Promise.all(
    o.map(
      (c) => e.readFile(N(s, c))
    )
  );
  return o.map((c, f) => ({
    fileName: c,
    contents: n[f]
  }));
}
async function ye(e, s, o) {
  await Promise.all(
    o.map(
      ({ fileName: n, contents: c }) => e.writeFile(N(s, n), c)
    )
  );
}
function Je(e) {
  return e.includes(".") ? e.split(".").pop() : "";
}
function Ve(e) {
  const s = Je(e);
  return s ? `.${s}` : "";
}
function N(...e) {
  return e.join("/").replace(/\/+/g, "/");
}
function Ue(e) {
  return e.replace(/\/+/g, "/");
}
const ze = () => {
};
function Ze({
  chroot: e = "/",
  onSelectFile: s = ze,
  fileSystem: o,
  className: n = ""
}) {
  const c = de((y) => {
    s(N(e, y));
  }, []), f = Ge(o, e), v = Te(f);
  return /* @__PURE__ */ F(K, { onClick: c, className: n, children: v });
}
async function Ge(e, s) {
  return te(() => ve(e, s), [e, s]);
}
async function ve(e, s) {
  const o = await e.listFiles(s);
  return await Promise.all(
    o.map(async (n) => {
      const c = N(s, n);
      return await e.isDir(c) ? /* @__PURE__ */ F(K.Folder, { name: n, children: await ve(e, c) }, n) : /* @__PURE__ */ F(K.File, { name: n }, n);
    })
  );
}
function Xe(e, s) {
  let o = null;
  return (...c) => {
    o !== null && (clearTimeout(o), o = null), o = setTimeout(() => e(...c), s);
  };
}
const Ye = (e, s) => ({
  name: "add-import-extension",
  visitor: {
    ImportDeclaration: (o) => {
      const n = X(o);
      n && (o.replaceWith(
        e.types.importDeclaration(
          o.node.specifiers,
          e.types.stringLiteral(n)
        )
      ), o.skip());
    },
    ExportNamedDeclaration: (o) => {
      const n = X(o);
      n && (o.replaceWith(
        e.types.exportNamedDeclaration(
          o.node.declaration,
          o.node.specifiers,
          e.types.stringLiteral(n)
        )
      ), o.skip());
    },
    ExportAllDeclaration: (o) => {
      const n = X(o);
      n && (o.replaceWith(
        e.types.exportAllDeclaration(
          e.types.stringLiteral(n)
        )
      ), o.skip());
    }
  }
});
function X({ node: { source: e, exportKind: s, importKind: o } }) {
  if (!e || (s === "type" || o === "type"))
    return;
  const c = e && e.value;
  if (!c.startsWith("."))
    return;
  const f = c.split("/"), y = (f[f.length - 1] || "index.js").split("."), d = y.length > 1 ? y.slice(0, y.length - 1).join(".") : y[0], h = y.length > 1 ? y[y.length - 1] : null, u = h || "js";
  return f.slice(0, -1).concat(`${d}.${u}`).join("/");
}
const Ke = () => {
};
function Qe(e = Ke) {
  return [
    qe,
    {
      globals: (s) => {
        const o = {
          "@wordpress/a11y": "wp.a11y",
          "@wordpress/api-fetch": "wp.apiFetch",
          "@wordpress/autop": "wp.autop",
          "@wordpress/blob": "wp.blob",
          "@wordpress/block-directory": "wp.blockDirectory",
          "@wordpress/block-editor": "wp.blockEditor",
          "@wordpress/block-library": "wp.blockLibrary",
          "@wordpress/block-serialization-default-parser": "wp.blockSerializationDefaultParser",
          "@wordpress/blocks": "wp.blocks",
          "@wordpress/components": "wp.components",
          "@wordpress/compose": "wp.compose",
          "@wordpress/core-data": "wp.coreData",
          "@wordpress/data": "wp.data",
          "@wordpress/date": "wp.date",
          "@wordpress/deprecated": "wp.deprecated",
          "@wordpress/dom": "wp.dom",
          "@wordpress/dom-ready": "wp.domReady",
          "@wordpress/edit-navigation": "wp.editNavigation",
          "@wordpress/edit-post": "wp.editPost",
          "@wordpress/edit-site": "wp.editSite",
          "@wordpress/edit-widgets": "wp.editWidgets",
          "@wordpress/editor": "wp.editor",
          "@wordpress/element": "wp.element",
          "@wordpress/escape-html": "wp.escapeHtml",
          "@wordpress/format-library": "wp.formatLibrary",
          "@wordpress/hooks": "wp.hooks",
          "@wordpress/html-entities": "wp.htmlEntities",
          "@wordpress/i18n": "wp.i18n",
          "@wordpress/is-shallow-equal": "wp.isShallowEqual",
          "@wordpress/keyboard-shortcuts": "wp.keyboardShortcuts",
          "@wordpress/keycodes": "wp.keycodes",
          "@wordpress/nux": "wp.nux",
          "@wordpress/plugins": "wp.plugins",
          "@wordpress/preferences": "wp.preferences",
          "@wordpress/preferences-persistence": "wp.preferencesPersistence",
          "@wordpress/primitives": "wp.primitives",
          "@wordpress/reusable-blocks": "wp.reusableBlocks",
          "@wordpress/rich-text": "wp.richText",
          "@wordpress/shortcode": "wp.shortcode",
          "@wordpress/url": "wp.url",
          "@wordpress/viewport": "wp.viewport",
          "@wordpress/warning": "wp.warning",
          "@wordpress/widgets": "wp.widgets",
          "@wordpress/wordcount": "wp.wordcount"
        };
        return e(
          s.replace("@", "").replace("/", "-").replace("wordpress-", "wp-")
        ), o[s];
      }
    }
  ];
}
const et = () => [
  he.availablePlugins["transform-react-jsx"],
  {
    pragma: "window.wp.element.createElement",
    pragmaFrag: "Fragment"
  }
];
function tt(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
function rt(e) {
  if (e.__esModule)
    return e;
  var s = e.default;
  if (typeof s == "function") {
    var o = function n() {
      if (this instanceof n) {
        var c = [null];
        c.push.apply(c, arguments);
        var f = Function.bind.apply(s, c);
        return new f();
      }
      return s.apply(this, arguments);
    };
    o.prototype = s.prototype;
  } else
    o = {};
  return Object.defineProperty(o, "__esModule", { value: !0 }), Object.keys(e).forEach(function(n) {
    var c = Object.getOwnPropertyDescriptor(e, n);
    Object.defineProperty(o, n, c.get ? c : {
      enumerable: !0,
      get: function() {
        return e[n];
      }
    });
  }), o;
}
var Q = {}, nt = {
  get exports() {
    return Q;
  },
  set exports(e) {
    Q = e;
  }
};
function we(e) {
  throw new Error('Could not dynamically require "' + e + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
function st(e) {
  const s = [];
  return {
    update: function(o) {
      return s.push(o), this;
    },
    digest(o) {
      return btoa(ot(s.join("")));
    }
  };
}
function ot(e) {
  for (var s, o = [], n = 0; n < 256; n++) {
    s = n;
    for (var c = 0; c < 8; c++)
      s = 1 & s ? 3988292384 ^ s >>> 1 : s >>> 1;
    o[n] = s;
  }
  for (var f = -1, v = 0; v < e.length; v++)
    f = f >>> 8 ^ o[255 & (f ^ e.charCodeAt(v))];
  return (-1 ^ f) >>> 0;
}
const it = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createHash: st
}, Symbol.toStringTag, { value: "Module" })), xe = /* @__PURE__ */ rt(it);
/**
 * @license React
 * react-refresh-babel.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Y, ie;
function at() {
  return ie || (ie = 1, Y = function(e) {
    function s(i, p) {
      var t = i.scope.generateUidIdentifier("c");
      return k.has(i) || k.set(i, []), k.get(i).push({ handle: t, persistentID: p }), t;
    }
    function o(i) {
      return typeof i == "string" && "A" <= i[0] && "Z" >= i[0];
    }
    function n(i, p, t) {
      var a = p.node;
      switch (a.type) {
        case "Identifier":
          if (!o(a.name))
            break;
          return t(i, a, null), !0;
        case "FunctionDeclaration":
          return t(i, a.id, null), !0;
        case "ArrowFunctionExpression":
          if (a.body.type === "ArrowFunctionExpression")
            break;
          return t(i, a, p), !0;
        case "FunctionExpression":
          return t(
            i,
            a,
            p
          ), !0;
        case "CallExpression":
          var r = p.get("arguments");
          if (r === void 0 || r.length === 0)
            break;
          var l = p.get("callee");
          switch (l.node.type) {
            case "MemberExpression":
            case "Identifier":
              return l = l.getSource(), n(i + "$" + l, r[0], t) ? (t(i, a, p), !0) : !1;
            default:
              return !1;
          }
        case "VariableDeclarator":
          if (r = a.init, r !== null && (l = a.id.name, o(l))) {
            switch (r.type) {
              case "ArrowFunctionExpression":
              case "FunctionExpression":
                break;
              case "CallExpression":
                a = r.callee;
                var m = a.type;
                if (m === "Import" || m === "Identifier" && (a.name.indexOf("require") === 0 || a.name.indexOf("import") === 0))
                  return !1;
                break;
              case "TaggedTemplateExpression":
                break;
              default:
                return !1;
            }
            if (a = p.get("init"), n(i, a, t))
              return !0;
            if (l = p.scope.getBinding(l), l === void 0)
              return;
            for (p = !1, l = l.referencePaths, m = 0; m < l.length; m++) {
              var g = l[m];
              if (!g.node || g.node.type === "JSXIdentifier" || g.node.type === "Identifier") {
                if (g = g.parent, g.type === "JSXOpeningElement")
                  p = !0;
                else if (g.type === "CallExpression") {
                  g = g.callee;
                  var w = void 0;
                  switch (g.type) {
                    case "Identifier":
                      w = g.name;
                      break;
                    case "MemberExpression":
                      w = g.property.name;
                  }
                  switch (w) {
                    case "createElement":
                    case "jsx":
                    case "jsxDEV":
                    case "jsxs":
                      p = !0;
                  }
                }
                if (p)
                  return t(i, r, a), !0;
              }
            }
          }
      }
      return !1;
    }
    function c(i) {
      return i = I.get(i), i === void 0 ? null : { key: i.map(function(p) {
        return p.name + "{" + p.key + "}";
      }).join(`
`), customHooks: i.filter(function(p) {
        e:
          switch (p.name) {
            case "useState":
            case "React.useState":
            case "useReducer":
            case "React.useReducer":
            case "useEffect":
            case "React.useEffect":
            case "useLayoutEffect":
            case "React.useLayoutEffect":
            case "useMemo":
            case "React.useMemo":
            case "useCallback":
            case "React.useCallback":
            case "useRef":
            case "React.useRef":
            case "useContext":
            case "React.useContext":
            case "useImperativeHandle":
            case "React.useImperativeHandle":
            case "useDebugValue":
            case "React.useDebugValue":
              p = !0;
              break e;
            default:
              p = !1;
          }
        return !p;
      }).map(function(p) {
        return u.cloneDeep(p.callee);
      }) };
    }
    function f(i) {
      i = i.hub.file;
      var p = E.get(i);
      if (p !== void 0)
        return p;
      p = !1;
      for (var t = i.ast.comments, a = 0; a < t.length; a++)
        if (t[a].value.indexOf("@refresh reset") !== -1) {
          p = !0;
          break;
        }
      return E.set(i, p), p;
    }
    function v(i, p, t) {
      var a = p.key;
      p = p.customHooks;
      var r = f(t.path), l = [];
      return p.forEach(function(m) {
        switch (m.type) {
          case "MemberExpression":
            if (m.object.type === "Identifier")
              var g = m.object.name;
            break;
          case "Identifier":
            g = m.name;
        }
        t.hasBinding(g) ? l.push(m) : r = !0;
      }), p = a, typeof we != "function" || d.emitFullSignatures || (p = xe.createHash("sha1").update(a).digest("base64")), i = [i, u.stringLiteral(p)], (r || 0 < l.length) && i.push(u.booleanLiteral(r)), 0 < l.length && i.push(u.functionExpression(null, [], u.blockStatement([u.returnStatement(u.arrayExpression(l))]))), i;
    }
    function y(i) {
      for (var p = []; ; ) {
        if (!i)
          return p;
        var t = i.parentPath;
        if (!t)
          return p;
        if (t.node.type === "AssignmentExpression" && i.node === t.node.right)
          i = t;
        else if (t.node.type === "CallExpression" && i.node !== t.node.callee)
          p.push(t), i = t;
        else
          return p;
      }
    }
    var d = 1 < arguments.length && arguments[1] !== void 0 ? arguments[1] : {};
    if (typeof e.env == "function") {
      var h = e.env();
      if (h !== "development" && !d.skipEnvCheck)
        throw Error('React Refresh Babel transform should only be enabled in development environment. Instead, the environment is: "' + h + '". If you want to override this check, pass {skipEnvCheck: true} as plugin options.');
    }
    var u = e.types, b = u.identifier(d.refreshReg || "$RefreshReg$"), x = u.identifier(d.refreshSig || "$RefreshSig$"), k = /* @__PURE__ */ new Map(), E = /* @__PURE__ */ new WeakMap(), S = /* @__PURE__ */ new WeakSet(), C = /* @__PURE__ */ new WeakSet(), D = /* @__PURE__ */ new WeakSet(), I = /* @__PURE__ */ new WeakMap(), B = { CallExpression: function(i) {
      var p = i.node.callee, t = null;
      switch (p.type) {
        case "Identifier":
          t = p.name;
          break;
        case "MemberExpression":
          t = p.property.name;
      }
      if (t !== null && /^use[A-Z]/.test(t) && (p = i.scope.getFunctionParent(), p !== null)) {
        p = p.block, I.has(p) || I.set(p, []), p = I.get(p);
        var a = "";
        i.parent.type === "VariableDeclarator" && (a = i.parentPath.get("id").getSource());
        var r = i.get("arguments");
        t === "useState" && 0 < r.length ? a += "(" + r[0].getSource() + ")" : t === "useReducer" && 1 < r.length && (a += "(" + r[1].getSource() + ")"), p.push({ callee: i.node.callee, name: t, key: a });
      }
    } };
    return { visitor: { ExportDefaultDeclaration: function(i) {
      var p = i.node, t = p.declaration, a = i.get("declaration");
      if (t.type === "CallExpression" && !S.has(p)) {
        S.add(p);
        var r = i.parentPath;
        n("%default%", a, function(l, m, g) {
          g !== null && (l = s(r, l), g.replaceWith(u.assignmentExpression("=", l, m)));
        });
      }
    }, FunctionDeclaration: { enter: function(i) {
      var p = i.node, t = "";
      switch (i.parent.type) {
        case "Program":
          var a = i, r = i.parentPath;
          break;
        case "TSModuleBlock":
          a = i, r = a.parentPath.parentPath;
          break;
        case "ExportNamedDeclaration":
          a = i.parentPath, r = a.parentPath;
          break;
        case "ExportDefaultDeclaration":
          a = i.parentPath, r = a.parentPath;
          break;
        default:
          return;
      }
      if (i.parent.type === "TSModuleBlock" || i.parent.type === "ExportNamedDeclaration")
        for (; r.type !== "Program"; ) {
          if (r.type === "TSModuleDeclaration") {
            if (r.parentPath.type !== "Program" && r.parentPath.type !== "ExportNamedDeclaration")
              return;
            t = r.node.id.name + "$" + t;
          }
          r = r.parentPath;
        }
      var l = p.id;
      l !== null && (l = l.name, o(l) && !S.has(p) && (S.add(p), n(t + l, i, function(m, g) {
        m = s(r, m), a.insertAfter(u.expressionStatement(u.assignmentExpression("=", m, g)));
      })));
    }, exit: function(i) {
      var p = i.node, t = p.id;
      if (t !== null) {
        var a = c(p);
        if (a !== null && !C.has(p)) {
          C.add(p), p = i.scope.generateUidIdentifier("_s"), i.scope.parent.push({ id: p, init: u.callExpression(x, []) }), i.get("body").unshiftContainer("body", u.expressionStatement(u.callExpression(p, [])));
          var r = null;
          i.find(function(l) {
            if (l.parentPath.isBlock())
              return r = l, !0;
          }), r !== null && r.insertAfter(u.expressionStatement(u.callExpression(p, v(t, a, r.scope))));
        }
      }
    } }, "ArrowFunctionExpression|FunctionExpression": { exit: function(i) {
      var p = i.node, t = c(p);
      if (t !== null && !C.has(p)) {
        C.add(p);
        var a = i.scope.generateUidIdentifier("_s");
        if (i.scope.parent.push({ id: a, init: u.callExpression(x, []) }), i.node.body.type !== "BlockStatement" && (i.node.body = u.blockStatement([u.returnStatement(i.node.body)])), i.get("body").unshiftContainer("body", u.expressionStatement(u.callExpression(a, []))), i.parent.type === "VariableDeclarator") {
          var r = null;
          i.find(function(l) {
            if (l.parentPath.isBlock())
              return r = l, !0;
          }), r !== null && r.insertAfter(u.expressionStatement(u.callExpression(a, v(i.parent.id, t, r.scope))));
        } else
          [i].concat(y(i)).forEach(function(l) {
            l.replaceWith(u.callExpression(a, v(l.node, t, l.scope)));
          });
      }
    } }, VariableDeclaration: function(i) {
      var p = i.node, t = "";
      switch (i.parent.type) {
        case "Program":
          var a = i, r = i.parentPath;
          break;
        case "TSModuleBlock":
          a = i, r = a.parentPath.parentPath;
          break;
        case "ExportNamedDeclaration":
          a = i.parentPath, r = a.parentPath;
          break;
        case "ExportDefaultDeclaration":
          a = i.parentPath, r = a.parentPath;
          break;
        default:
          return;
      }
      if (i.parent.type === "TSModuleBlock" || i.parent.type === "ExportNamedDeclaration")
        for (; r.type !== "Program"; ) {
          if (r.type === "TSModuleDeclaration") {
            if (r.parentPath.type !== "Program" && r.parentPath.type !== "ExportNamedDeclaration")
              return;
            t = r.node.id.name + "$" + t;
          }
          r = r.parentPath;
        }
      if (!S.has(p) && (S.add(p), i = i.get("declarations"), i.length === 1)) {
        var l = i[0];
        n(t + l.node.id.name, l, function(m, g, w) {
          w !== null && (m = s(r, m), w.parent.type === "VariableDeclarator" ? a.insertAfter(u.expressionStatement(u.assignmentExpression("=", m, l.node.id))) : w.replaceWith(u.assignmentExpression("=", m, g)));
        });
      }
    }, Program: { enter: function(i) {
      i.traverse(B);
    }, exit: function(i) {
      var p = k.get(i);
      if (p !== void 0) {
        var t = i.node;
        if (!D.has(t)) {
          D.add(t), k.delete(i);
          var a = [];
          i.pushContainer("body", u.variableDeclaration("var", a)), p.forEach(function(r) {
            var l = r.handle;
            i.pushContainer("body", u.expressionStatement(u.callExpression(b, [l, u.stringLiteral(r.persistentID)]))), a.push(u.variableDeclarator(l));
          });
        }
      }
    } } } };
  }), Y;
}
var T = {}, ct = {
  get exports() {
    return T;
  },
  set exports(e) {
    T = e;
  }
};
/**
 * @license React
 * react-refresh-babel.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ae;
function lt() {
  return ae || (ae = 1, process.env.NODE_ENV !== "production" && function() {
    function e(s) {
      var o = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      if (typeof s.env == "function") {
        var n = s.env();
        if (n !== "development" && !o.skipEnvCheck)
          throw new Error('React Refresh Babel transform should only be enabled in development environment. Instead, the environment is: "' + n + '". If you want to override this check, pass {skipEnvCheck: true} as plugin options.');
      }
      var c = s.types, f = c.identifier(o.refreshReg || "$RefreshReg$"), v = c.identifier(o.refreshSig || "$RefreshSig$"), y = /* @__PURE__ */ new Map();
      function d(t, a) {
        var r = t.scope.generateUidIdentifier("c");
        y.has(t) || y.set(t, []);
        var l = y.get(t);
        return l.push({
          handle: r,
          persistentID: a
        }), r;
      }
      function h(t) {
        return typeof t == "string" && t[0] >= "A" && t[0] <= "Z";
      }
      function u(t, a, r) {
        var l = a.node;
        switch (l.type) {
          case "Identifier":
            return h(l.name) ? (r(t, l, null), !0) : !1;
          case "FunctionDeclaration":
            return r(t, l.id, null), !0;
          case "ArrowFunctionExpression":
            return l.body.type === "ArrowFunctionExpression" ? !1 : (r(t, l, a), !0);
          case "FunctionExpression":
            return r(t, l, a), !0;
          case "CallExpression": {
            var m = a.get("arguments");
            if (m === void 0 || m.length === 0)
              return !1;
            var g = a.get("callee");
            switch (g.node.type) {
              case "MemberExpression":
              case "Identifier": {
                var w = g.getSource(), $ = m[0], _ = t + "$" + w, R = u(_, $, r);
                return R ? (r(t, l, a), !0) : !1;
              }
              default:
                return !1;
            }
          }
          case "VariableDeclarator": {
            var P = l.init;
            if (P === null)
              return !1;
            var A = l.id.name;
            if (!h(A))
              return !1;
            switch (P.type) {
              case "ArrowFunctionExpression":
              case "FunctionExpression":
                break;
              case "CallExpression": {
                var M = P.callee, re = M.type;
                if (re === "Import")
                  return !1;
                if (re === "Identifier") {
                  if (M.name.indexOf("require") === 0)
                    return !1;
                  if (M.name.indexOf("import") === 0)
                    return !1;
                }
                break;
              }
              case "TaggedTemplateExpression":
                break;
              default:
                return !1;
            }
            var ne = a.get("init"), Re = u(t, ne, r);
            if (Re)
              return !0;
            var se = a.scope.getBinding(A);
            if (se === void 0)
              return;
            for (var J = !1, oe = se.referencePaths, V = 0; V < oe.length; V++) {
              var O = oe[V];
              if (!(O.node && O.node.type !== "JSXIdentifier" && O.node.type !== "Identifier")) {
                var U = O.parent;
                if (U.type === "JSXOpeningElement")
                  J = !0;
                else if (U.type === "CallExpression") {
                  var z = U.callee, Z = void 0;
                  switch (z.type) {
                    case "Identifier":
                      Z = z.name;
                      break;
                    case "MemberExpression":
                      Z = z.property.name;
                      break;
                  }
                  switch (Z) {
                    case "createElement":
                    case "jsx":
                    case "jsxDEV":
                    case "jsxs":
                      J = !0;
                      break;
                  }
                }
                if (J)
                  return r(t, P, ne), !0;
              }
            }
          }
        }
        return !1;
      }
      function b(t) {
        switch (t) {
          case "useState":
          case "React.useState":
          case "useReducer":
          case "React.useReducer":
          case "useEffect":
          case "React.useEffect":
          case "useLayoutEffect":
          case "React.useLayoutEffect":
          case "useMemo":
          case "React.useMemo":
          case "useCallback":
          case "React.useCallback":
          case "useRef":
          case "React.useRef":
          case "useContext":
          case "React.useContext":
          case "useImperativeHandle":
          case "React.useImperativeHandle":
          case "useDebugValue":
          case "React.useDebugValue":
            return !0;
          default:
            return !1;
        }
      }
      function x(t) {
        var a = i.get(t);
        return a === void 0 ? null : {
          key: a.map(function(r) {
            return r.name + "{" + r.key + "}";
          }).join(`
`),
          customHooks: a.filter(function(r) {
            return !b(r.name);
          }).map(function(r) {
            return c.cloneDeep(r.callee);
          })
        };
      }
      var k = /* @__PURE__ */ new WeakMap();
      function E(t) {
        var a = t.hub.file, r = k.get(a);
        if (r !== void 0)
          return r;
        r = !1;
        for (var l = a.ast.comments, m = 0; m < l.length; m++) {
          var g = l[m];
          if (g.value.indexOf("@refresh reset") !== -1) {
            r = !0;
            break;
          }
        }
        return k.set(a, r), r;
      }
      function S(t, a, r) {
        var l = a.key, m = a.customHooks, g = E(r.path), w = [];
        m.forEach(function(R) {
          var P;
          switch (R.type) {
            case "MemberExpression":
              R.object.type === "Identifier" && (P = R.object.name);
              break;
            case "Identifier":
              P = R.name;
              break;
          }
          r.hasBinding(P) ? w.push(R) : g = !0;
        });
        var $ = l;
        typeof we == "function" && !o.emitFullSignatures && ($ = xe.createHash("sha1").update(l).digest("base64"));
        var _ = [t, c.stringLiteral($)];
        return (g || w.length > 0) && _.push(c.booleanLiteral(g)), w.length > 0 && _.push(
          // TODO: We could use an arrow here to be more compact.
          // However, don't do it until AMA can run them natively.
          c.functionExpression(null, [], c.blockStatement([c.returnStatement(c.arrayExpression(w))]))
        ), _;
      }
      function C(t) {
        for (var a = []; ; ) {
          if (!t)
            return a;
          var r = t.parentPath;
          if (!r)
            return a;
          if (
            // hoc(_c = function() { })
            r.node.type === "AssignmentExpression" && t.node === r.node.right
          ) {
            t = r;
            continue;
          }
          if (
            // hoc1(hoc2(...))
            r.node.type === "CallExpression" && t.node !== r.node.callee
          ) {
            a.push(r), t = r;
            continue;
          }
          return a;
        }
      }
      var D = /* @__PURE__ */ new WeakSet(), I = /* @__PURE__ */ new WeakSet(), B = /* @__PURE__ */ new WeakSet(), i = /* @__PURE__ */ new WeakMap(), p = {
        CallExpression: function(t) {
          var a = t.node, r = a.callee, l = null;
          switch (r.type) {
            case "Identifier":
              l = r.name;
              break;
            case "MemberExpression":
              l = r.property.name;
              break;
          }
          if (!(l === null || !/^use[A-Z]/.test(l))) {
            var m = t.scope.getFunctionParent();
            if (m !== null) {
              var g = m.block;
              i.has(g) || i.set(g, []);
              var w = i.get(g), $ = "";
              t.parent.type === "VariableDeclarator" && ($ = t.parentPath.get("id").getSource());
              var _ = t.get("arguments");
              l === "useState" && _.length > 0 ? $ += "(" + _[0].getSource() + ")" : l === "useReducer" && _.length > 1 && ($ += "(" + _[1].getSource() + ")"), w.push({
                callee: t.node.callee,
                name: l,
                key: $
              });
            }
          }
        }
      };
      return {
        visitor: {
          ExportDefaultDeclaration: function(t) {
            var a = t.node, r = a.declaration, l = t.get("declaration");
            if (r.type === "CallExpression" && !D.has(a)) {
              D.add(a);
              var m = "%default%", g = t.parentPath;
              u(m, l, function(w, $, _) {
                if (_ !== null) {
                  var R = d(g, w);
                  _.replaceWith(c.assignmentExpression("=", R, $));
                }
              });
            }
          },
          FunctionDeclaration: {
            enter: function(t) {
              var a = t.node, r, l, m = "";
              switch (t.parent.type) {
                case "Program":
                  l = t, r = t.parentPath;
                  break;
                case "TSModuleBlock":
                  l = t, r = l.parentPath.parentPath;
                  break;
                case "ExportNamedDeclaration":
                  l = t.parentPath, r = l.parentPath;
                  break;
                case "ExportDefaultDeclaration":
                  l = t.parentPath, r = l.parentPath;
                  break;
                default:
                  return;
              }
              if (t.parent.type === "TSModuleBlock" || t.parent.type === "ExportNamedDeclaration")
                for (; r.type !== "Program"; ) {
                  if (r.type === "TSModuleDeclaration") {
                    if (r.parentPath.type !== "Program" && r.parentPath.type !== "ExportNamedDeclaration")
                      return;
                    m = r.node.id.name + "$" + m;
                  }
                  r = r.parentPath;
                }
              var g = a.id;
              if (g !== null) {
                var w = g.name;
                if (h(w) && !D.has(a)) {
                  D.add(a);
                  var $ = m + w;
                  u($, t, function(_, R) {
                    var P = d(r, _);
                    l.insertAfter(c.expressionStatement(c.assignmentExpression("=", P, R)));
                  });
                }
              }
            },
            exit: function(t) {
              var a = t.node, r = a.id;
              if (r !== null) {
                var l = x(a);
                if (l !== null && !I.has(a)) {
                  I.add(a);
                  var m = t.scope.generateUidIdentifier("_s");
                  t.scope.parent.push({
                    id: m,
                    init: c.callExpression(v, [])
                  }), t.get("body").unshiftContainer("body", c.expressionStatement(c.callExpression(m, [])));
                  var g = null;
                  t.find(function(w) {
                    if (w.parentPath.isBlock())
                      return g = w, !0;
                  }), g !== null && g.insertAfter(c.expressionStatement(c.callExpression(m, S(r, l, g.scope))));
                }
              }
            }
          },
          "ArrowFunctionExpression|FunctionExpression": {
            exit: function(t) {
              var a = t.node, r = x(a);
              if (r !== null && !I.has(a)) {
                I.add(a);
                var l = t.scope.generateUidIdentifier("_s");
                if (t.scope.parent.push({
                  id: l,
                  init: c.callExpression(v, [])
                }), t.node.body.type !== "BlockStatement" && (t.node.body = c.blockStatement([c.returnStatement(t.node.body)])), t.get("body").unshiftContainer("body", c.expressionStatement(c.callExpression(l, []))), t.parent.type === "VariableDeclarator") {
                  var m = null;
                  if (t.find(function(w) {
                    if (w.parentPath.isBlock())
                      return m = w, !0;
                  }), m === null)
                    return;
                  m.insertAfter(c.expressionStatement(c.callExpression(l, S(t.parent.id, r, m.scope))));
                } else {
                  var g = [t].concat(C(t));
                  g.forEach(function(w) {
                    w.replaceWith(c.callExpression(l, S(w.node, r, w.scope)));
                  });
                }
              }
            }
          },
          VariableDeclaration: function(t) {
            var a = t.node, r, l, m = "";
            switch (t.parent.type) {
              case "Program":
                l = t, r = t.parentPath;
                break;
              case "TSModuleBlock":
                l = t, r = l.parentPath.parentPath;
                break;
              case "ExportNamedDeclaration":
                l = t.parentPath, r = l.parentPath;
                break;
              case "ExportDefaultDeclaration":
                l = t.parentPath, r = l.parentPath;
                break;
              default:
                return;
            }
            if (t.parent.type === "TSModuleBlock" || t.parent.type === "ExportNamedDeclaration")
              for (; r.type !== "Program"; ) {
                if (r.type === "TSModuleDeclaration") {
                  if (r.parentPath.type !== "Program" && r.parentPath.type !== "ExportNamedDeclaration")
                    return;
                  m = r.node.id.name + "$" + m;
                }
                r = r.parentPath;
              }
            if (!D.has(a)) {
              D.add(a);
              var g = t.get("declarations");
              if (g.length === 1) {
                var w = g[0], $ = w.node.id.name, _ = m + $;
                u(_, w, function(R, P, A) {
                  if (A !== null) {
                    var M = d(r, R);
                    A.parent.type === "VariableDeclarator" ? l.insertAfter(c.expressionStatement(c.assignmentExpression("=", M, w.node.id))) : A.replaceWith(c.assignmentExpression("=", M, P));
                  }
                });
              }
            }
          },
          Program: {
            enter: function(t) {
              t.traverse(p);
            },
            exit: function(t) {
              var a = y.get(t);
              if (a !== void 0) {
                var r = t.node;
                if (!B.has(r)) {
                  B.add(r), y.delete(t);
                  var l = [];
                  t.pushContainer("body", c.variableDeclaration("var", l)), a.forEach(function(m) {
                    var g = m.handle, w = m.persistentID;
                    t.pushContainer("body", c.expressionStatement(c.callExpression(f, [g, c.stringLiteral(w)]))), l.push(c.variableDeclarator(g));
                  });
                }
              }
            }
          }
        }
      };
    }
    ct.exports = e;
  }()), T;
}
(function(e) {
  process.env.NODE_ENV === "production" ? e.exports = at() : e.exports = lt();
})(nt);
const ut = /* @__PURE__ */ tt(Q);
function pt(e) {
  return e.startsWith("rollup://localhost/") && (e = e.substring(19)), e.startsWith("_virtual/") && (e = e.substring(9)), e.startsWith("./") && (e = e.substring(2)), e;
}
function be(e, s, o) {
  o && o.resolve;
  const n = (v) => {
    if (!(v instanceof RegExp))
      throw new Error("id must be an instance of RegExp");
    return v;
  }, c = ce(e).map(n), f = ce(s).map(n);
  return function(y) {
    if (typeof y != "string" || /\0/.test(y))
      return !1;
    const d = Ue(y);
    for (let h = 0; h < f.length; ++h)
      if (f[h].test(d))
        return !1;
    for (let h = 0; h < c.length; ++h)
      if (c[h].test(d))
        return !0;
    return !c.length;
  };
}
function dt(e, s = {}) {
  const o = s.compact ? "" : "indent" in s ? s.indent : "	", n = s.compact ? "" : " ", c = s.compact ? "" : `
`, f = s.preferConst ? "const" : "var";
  if (s.namedExports === !1 || typeof e != "object" || Array.isArray(e) || e instanceof Date || e instanceof RegExp || e === null) {
    const d = j(e, s.compact ? null : o, "");
    return `export default${n || (/^[{[\-\/]/.test(d) ? "" : " ")}${d};`;
  }
  let v = "";
  const y = [];
  for (const [d, h] of Object.entries(e))
    d === Ee(d) ? (s.objectShorthand ? y.push(d) : y.push(`${d}:${n}${d}`), v += `export ${f} ${d}${n}=${n}${j(
      h,
      s.compact ? null : o,
      ""
    )};${c}`) : y.push(
      `${H(d)}:${n}${j(
        h,
        s.compact ? null : o,
        ""
      )}`
    );
  return `${v}export default${n}{${c}${o}${y.join(
    `,${c}${o}`
  )}${c}};${c}`;
}
function j(e, s, o) {
  if (typeof e == "object" && e !== null)
    return Array.isArray(e) ? ft(e, s, o) : e instanceof Date ? `new Date(${e.getTime()})` : e instanceof RegExp ? e.toString() : mt(e, s, o);
  if (typeof e == "number") {
    if (e === 1 / 0)
      return "Infinity";
    if (e === -1 / 0)
      return "-Infinity";
    if (e === 0)
      return 1 / e === 1 / 0 ? "0" : "-0";
    if (e !== e)
      return "NaN";
  }
  if (typeof e == "symbol") {
    const n = Symbol.keyFor(e);
    if (n !== void 0)
      return `Symbol.for(${H(n)})`;
  }
  return typeof e == "bigint" ? `${e}n` : H(e);
}
function H(e) {
  return (JSON.stringify(e) || "undefined").replace(
    /[\u2028\u2029]/g,
    (s) => `\\u${`000${s.charCodeAt(0).toString(16)}`.slice(-4)}`
  );
}
function ft(e, s, o) {
  let n = "[";
  const c = s ? `
${o}${s}` : "";
  for (let f = 0; f < e.length; f++) {
    const v = e[f];
    n += `${f > 0 ? "," : ""}${c}${j(
      v,
      s,
      o + s
    )}`;
  }
  return `${n}${s ? `
${o}` : ""}]`;
}
function mt(e, s, o) {
  let n = "{";
  const c = s ? `
${o}${s}` : "", f = Object.entries(e);
  for (let v = 0; v < f.length; v++) {
    const [y, d] = f[v], h = Ee(y) === y ? y : H(y);
    n += `${v > 0 ? "," : ""}${c}${h}:${s ? " " : ""}${j(d, s, o + s)}`;
  }
  return `${n}${s ? `
${o}` : ""}}`;
}
function ht(e) {
  return Array.isArray(e);
}
function ce(e) {
  return ht(e) ? e : e == null ? [] : [e];
}
const gt = "break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield enum await implements package protected static interface private public", yt = "arguments Infinity NaN undefined null true false eval uneval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Symbol Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Number Math Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Map Set WeakMap WeakSet SIMD ArrayBuffer DataView JSON Promise Generator GeneratorFunction Reflect Proxy Intl", ke = new Set(`${gt} ${yt}`.split(" "));
ke.add("");
function Ee(e) {
  let s = e.replace(/-(\w)/g, (o, n) => n.toUpperCase()).replace(/[^$_a-zA-Z0-9]/g, "_");
  return (/\d/.test(s[0]) || ke.has(s)) && (s = `_${s}`), s || "_";
}
function vt(e = {}) {
  e.include = e.include || /\.json$/;
  const s = be(e.include, e.exclude), o = "indent" in e ? e.indent : "	";
  return {
    name: "json",
    // eslint-disable-next-line no-shadow
    transform(n, c) {
      if (c.slice(-5) !== ".json" || !s(c))
        return null;
      try {
        const f = JSON.parse(n);
        return {
          code: dt(f, {
            preferConst: e.preferConst,
            compact: e.compact,
            namedExports: e.namedExports,
            indent: o
          }),
          map: { mappings: "" }
        };
      } catch (f) {
        if (f instanceof Error) {
          const v = "Could not parse JSON file", y = parseInt(
            (/[\d]/.exec(f.message) || [])[0],
            10
          );
          this.warn({ message: v, id: c, position: y });
        }
        return console.error(f), null;
      }
    }
  };
}
function wt(e) {
  const s = be(
    e.include ?? /[^/]+\/*.css$/,
    e.exclude ?? []
  );
  return {
    name: "css",
    transform(o, n) {
      if (!s(n))
        return null;
      const c = xt(o + bt(n));
      return this.emitFile({
        type: "asset",
        fileName: n.substring(e.idPrefix.length),
        name: "css",
        source: c
      }), {
        code: `export const css = ${JSON.stringify(c)};export const uniqueCssId = ${JSON.stringify(
          _e(n)
        )}; export const uniqueZIndex = ${JSON.stringify(
          Se
        )}; `,
        map: { mappings: "" }
      };
    }
  };
}
function xt(e) {
  return e = e.replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, ""), e = e.replace(/ {2,}/g, " "), e = e.replace(/ ([{:}]) /g, "$1"), e = e.replace(/([{:}]) /g, "$1"), e = e.replace(/([;,]) /g, "$1"), e = e.replace(/ !/g, "!"), e;
}
const Se = "987432";
function bt(e) {
  return ` #${_e(e)} { z-index: ${Se}; } `;
}
function _e(e) {
  return e.replace(/[^a-zA-Z0-9\-\_]/g, "-");
}
function kt(e) {
  return "(" + function({ reloadOnly: s, entrypoint: o }) {
    const n = window, c = !("define" in window);
    if (c) {
      let d = function(u) {
        return u.startsWith("./") && (u = u.substring(2)), u.endsWith(".js") || (u += ".js"), u;
      }, h = function(u) {
        const b = n.__modulesMeta[u];
        if (!b)
          throw new Error(
            `Could not find module "${u}"`
          );
        return b.needsReloading = !1, f(u).load(b);
      };
      n.__modules = {}, n.__modulesMeta = {}, n.define = function(b, x, k) {
        typeof x == "function" && (k = x, x = []);
        const E = d(b), S = {
          id: E,
          deps: x,
          factory: k
        }, C = f(E);
        S.needsReloading = C.shouldInvalidate(
          S,
          n.__modulesMeta[E]
        ), n.__modulesMeta[E] = S;
      }, n.require = function(b) {
        const x = d(b);
        return n.__modules[x] || (n.__modules[x] = h(x)), n.__modules[x];
      }, n.reloadDirtyModules = function() {
        for (const u in n.__modulesMeta)
          if (n.__modulesMeta[u].needsReloading) {
            const x = h(u);
            n.__modules[u] = x, n.isReactRefreshBoundary(x) && n.__enqueueReactUpdate();
          }
      };
    }
    function f(d) {
      for (const h of v)
        if (d.match(h.pattern))
          return h;
      throw new Error(`No loader found for module "${d}".`);
    }
    const v = [
      {
        pattern: /\.css\.js$/,
        load(d) {
          const { css: h, uniqueCssId: u } = y(d), b = document.createElement("style");
          b.innerHTML = h;
          const x = this.styleSheetsWithSelector(
            `#${u}`
          );
          if (!x.length) {
            document.head.appendChild(b);
            return;
          }
          x[0].ownerNode instanceof Element ? (x[0].ownerNode.id && (b.id = x[0].ownerNode.id), x[0].ownerNode.parentNode.insertBefore(
            b,
            x[0].ownerNode
          )) : document.head.appendChild(b);
          for (const k of x)
            k.ownerNode ? k.ownerNode.remove() : this.deleteAllCssRules(k);
        },
        shouldInvalidate(d) {
          const { uniqueZIndex: h, uniqueCssId: u } = y(d);
          return this.isStyleSheetLoaded(
            u,
            h
          );
        },
        isStyleSheetLoaded(d, h) {
          const u = document.createElement("div");
          u.id = d, u.style.display = "none", document.head.appendChild(u);
          const b = window.getComputedStyle(u).zIndex === h;
          return u.remove(), b;
        },
        styleSheetsWithSelector(d) {
          const h = [];
          for (const u of Array.from(
            document.styleSheets
          ))
            for (const b of Array.from(
              u.cssRules
            ))
              if (b instanceof CSSStyleRule && b.selectorText === d) {
                h.push(u);
                break;
              }
          return h;
        },
        deleteAllCssRules(d) {
          for (let h = d.cssRules.length - 1; h >= 0; h--)
            d.deleteRule(h);
        }
      },
      {
        pattern: /\.js$/,
        load(d) {
          let h = n.$RefreshReg$, u = n.$RefreshSig$;
          n.$RefreshReg$ = (b, x) => {
            const k = JSON.stringify(x) + " " + x;
            n.RefreshRuntime.register(b, k);
          }, n.$RefreshSig$ = n.RefreshRuntime.createSignatureFunctionForTransform;
          try {
            return y(d);
          } finally {
            n.$RefreshReg$ = h, n.$RefreshSig$ = u;
          }
        },
        shouldInvalidate(d, h) {
          return n.__modules[d.id] && d.factory.toString() !== h.factory.toString();
        }
      }
    ];
    function y(d) {
      let h = !1, u = {};
      const b = d.deps.map((k) => k === "exports" ? (h = !0, u) : n.require(k)), x = d.factory(...b);
      return h || (u = x), u;
    }
    setTimeout(() => {
      c ? s ? n.reloadDirtyModules() : n.require(o) : n.reloadDirtyModules();
    });
  } + `)(${JSON.stringify(e)});`;
}
function Et(e) {
  const s = e.files.reduce((o, n) => (o[n.fileName] = n.contents, o), {});
  return {
    name: "rollup-dependency-loader",
    resolveId(o, n) {
      return new URL(o, n).href;
    },
    load(o) {
      const n = o.substring(e.inputPrefix.length);
      if (!(n in s))
        throw new Error(`Could not find file ${n}`);
      return s[n];
    }
  };
}
async function St(e, s, o) {
  const { reloadOnly: n = !1 } = o, c = "rollup://localhost/", f = s.replace(/^\//, ""), v = /* @__PURE__ */ new Set(), y = (u) => v.add(u), h = await (await Le.rollup({
    input: `${c}${f}`,
    external: ["react"],
    // Prevent optimizing away CSS exports:
    treeshake: !1,
    plugins: [
      vt(),
      wt({ idPrefix: c }),
      {
        name: "babel-plugin",
        transform: (u) => $e(u, y).code
      },
      Et({ files: e, inputPrefix: c })
    ]
  })).generate({
    format: "amd",
    amd: {
      autoId: !0,
      forceJsExtensionForImports: !0
    },
    exports: "named",
    entryFileNames: "[name].js",
    chunkFileNames: "[name].js",
    assetFileNames: "[name][extname]",
    preserveModules: !0,
    sanitizeFileName(u) {
      return pt(u).replace(/\.js$/, "");
    }
  });
  return {
    jsBundle: {
      fileName: s,
      contents: `
			${kt({
        reloadOnly: n,
        entrypoint: $t(h.output)
      })}
			${_t(h.output)}
			`
    },
    otherFiles: [
      Pt(v),
      ...Rt(e, h)
    ]
  };
}
function $e(e, s = () => {
}) {
  return he.transform(e, {
    plugins: [
      et(),
      [Ye, { extension: "js" }],
      Qe(s),
      [ut, { skipEnvCheck: !0 }]
    ]
  });
}
function _t(e) {
  return e.filter((s) => s.type === "chunk").map((s) => s.code || s.source || "").join(`
`);
}
function $t(e) {
  return e.find(
    (s) => "isEntry" in s ? s.isEntry : !1
  ).fileName;
}
function Rt(e, s) {
  return e.flatMap((o) => {
    if ([".js"].includes(Ve(o.fileName)))
      return [];
    const n = s.output.find(
      (c) => c.fileName === o.fileName
    );
    return (n == null ? void 0 : n.type) === "asset" ? [{ fileName: o.fileName, contents: n.source }] : [o];
  });
}
function Pt(e) {
  return {
    fileName: "index.asset.php",
    contents: `<?php return array('dependencies' => array(${Array.from(e).map((o) => JSON.stringify(o)).join(", ")}), 'version' => '6b9f26bada2f399976e5');
`
  };
}
const Dt = De.forwardRef(
  function({ onChange: s, initialFile: o, className: n = "" }, c) {
    const f = fe(null), [v, y] = L(
      o || {
        fileName: "fake.js",
        contents: "console.log('hello world!');"
      }
    );
    Ie(c, () => ({
      setFile: y
    }));
    const d = te(() => {
      if (!f.current)
        return null;
      const h = {
        js: () => [W({ jsx: !0 }), q],
        ts: () => [
          W({ typescript: !0, jsx: !0 }),
          q
        ],
        jsx: () => [W({ jsx: !0 }), q],
        tsx: () => [
          W({ typescript: !0, jsx: !0 }),
          q
        ],
        json: () => [Fe(), me(Ne())],
        html: () => [Ae()],
        css: () => [Me()],
        md: () => [je()],
        php: () => [Be()]
      }[v.fileName.split(".").pop()](), u = G.theme({
        "&": {
          height: "350px",
          width: "100%"
        }
      }), b = Ce.of([
        {
          key: "Mod-s",
          run() {
            return !0;
          }
        },
        ...Oe
      ]), x = G.updateListener.of(
        (E) => {
          E.docChanged && typeof s == "function" && s({
            fileName: v.fileName,
            contents: E.state.doc.toString()
          });
        }
      );
      return new G({
        doc: v.contents,
        extensions: [
          // basicSetup,
          u,
          b,
          ...h,
          We(),
          x
        ],
        parent: f.current
      });
    }, [v.fileName, f.current, s]);
    return ee(() => () => d && d.destroy(), [d]), /* @__PURE__ */ F("div", { ref: f, className: n });
  }
), q = me((e) => {
  const s = [], o = e.state.doc.toString();
  try {
    $e(o);
  } catch (n) {
    const c = e.state.doc.lineAt(n.loc.index);
    s.push({
      from: c.from,
      to: c.to,
      severity: "error",
      message: n.message
    });
  }
  return s;
});
async function le(e, s, o, n = {}) {
  let { jsEntrypoint: c = "index.js", reloadOnly: f = !1 } = n;
  await He(e, o);
  const v = await ge(e, s), { jsBundle: y, otherFiles: d } = await St(v, c, {
    reloadOnly: f
  });
  return await ye(e, o, d.concat([y])), y;
}
const It = `<?php
/**
 * Plugin Name:       Example Static
 * Description:       Example block scaffolded with Create Block tool.
 * Requires at least: 5.9
 * Requires PHP:      7.0
 * Version:           0.1.0
 * Author:            The WordPress Contributors
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       example-static
 *
 * @package           create-block
 */


/**
 * Registers the block using the metadata loaded from the \`block.json\` file.
 * Behind the scenes, it registers also all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see https://developer.wordpress.org/reference/functions/register_block_type/
 */
function create_block_example_static_block_init() {
	register_block_type( __DIR__ . '/block.json' );
}
add_action( 'init', 'create_block_example_static_block_init' );
`, Ct = `/**
* Registers a new block provided a unique name and an object defining its behavior.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
*/
import { registerBlockType } from '@wordpress/blocks';

/**
* Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
* All files containing \`style\` keyword are bundled together. The code used
* gets applied both to the front of your site and to the editor.
*
* @see https://www.npmjs.com/package/@wordpress/scripts#using-css
*/
import './style.css';

/**
* Internal dependencies
*/
import Edit from './edit';
import save from './save';
import metadata from './block.json';

/**
* Every block starts by registering a new block type definition.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
*/
registerBlockType( metadata.name, {
	/**
	* @see ./edit.js
	*/
	edit: Edit,

	/**
	* @see ./save.js
	*/
	save,
} );
`, Ft = `/**
* The following styles get applied both on the front of your site
* and in the editor.
*
* Replace them with your own styles or remove the file completely.
*/

.wp-block-create-block-example-static {
	background-color: #21759b;
	color: #fff;
	padding: 2px;
}
`, Nt = `/**
* React hook that is used to mark the block wrapper element.
* It provides all the necessary props like the class name.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
*/
import { useBlockProps } from '@wordpress/block-editor';

/**
* The save function defines the way in which the different attributes should
* be combined into the final markup, which is then serialized by the block
* editor into \`post_content\`.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#save
*
* @return {WPElement} Element to render.
*/
export default function save() {
	return (
		<p { ...useBlockProps.save() }>
			{ 'Example Static – hello from the saved contents!' }
		</p>
	);
}
`, At = `/**
* Retrieves the translation of text.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
*/
import { __ } from '@wordpress/i18n';

/**
* React hook that is used to mark the block wrapper element.
* It provides all the necessary props like the class name.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
*/
import { useBlockProps } from '@wordpress/block-editor';

/**
* The edit function describes the structure of your block in the context of the
* editor. This represents what the editor will render when the block is used.
*
* @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
*
* @return {WPElement} Element to render.
*/
export default function Edit() {
	return (
		<p { ...useBlockProps() }>
			{ __(
				'Example Static – hello from the editor!',
				'example-static'
			) }
		</p>
	);
}
`, Mt = JSON.stringify(
  {
    $schema: "https://schemas.wp.org/trunk/block.json",
    apiVersion: 2,
    name: "create-block/example-static",
    version: "0.1.0",
    title: "Example Static",
    category: "widgets",
    icon: "smiley",
    description: "Example block scaffolded with Create Block tool.",
    supports: {
      html: !1
    },
    textdomain: "example-static",
    editorScript: "file:./index.js",
    style: "file:./style.css"
  },
  null,
  2
) + `
`, Xt = {
  name: "create-block",
  build: !0,
  files: [
    { fileName: "index.php", contents: It },
    { fileName: "block.json", contents: Mt },
    { fileName: "edit.js", contents: At },
    { fileName: "save.js", contents: Nt },
    { fileName: "style.css", contents: Ft },
    { fileName: "index.js", contents: Ct }
  ]
};
function jt(e, s, o) {
  return {
    name: "react-fast-refresh",
    files: [{ fileName: "index.php", contents: `<?php 
/**
 * React fast refresh runtime, required for hot reloading. Must be
 * included before any other scripts.
 */
function __playground_enqueue_react_fast_refresh() {
		wp_register_script( '__playground_react_fast_refresh', ${JSON.stringify(e + "")}, false, '1.0.0' );
		wp_enqueue_script( '__playground_react_fast_refresh' );
}
add_action( 'init', '__playground_enqueue_react_fast_refresh', 10000 );

function __playground_override_react_dom($scripts) {
	__playground_override_script($scripts, 'react', ${JSON.stringify(s + "")});
	__playground_override_script($scripts, 'react-dom', ${JSON.stringify(o + "")});
}
add_action( 'wp_default_scripts', '__playground_override_react_dom' );

function __playground_override_script( $scripts, $handle, $src, $deps = array(), $ver = false, $in_footer = false ) {
	$in_footer = 'wp-i18n' === $handle ? false : $in_footer;
	$script = $scripts->query( $handle, 'registered' );
	
	if ( $script ) {
		$script->src  = $src;
		$script->deps = $deps;
		$script->ver  = $ver;
		$script->args = $in_footer ? 1 : null;
	} else {
		$scripts->add( $handle, $src, $deps, $ver, ( $in_footer ? 1 : null ) );
	}
}
` }]
  };
}
async function ue(e, s, o) {
  const n = `${o}/${s.name}`;
  let c, f;
  return s.build ? (c = `${n}/src`, f = `${n}/build`, await e.mkdirTree(c), await e.mkdirTree(f)) : (c = f = n, await e.mkdirTree(n)), await ye(e, c, s.files), await e.writeFile(
    N(o, `${s.name}.php`),
    `<?php require_once "${f}/index.php"; 
`
  ), { srcPath: c, buildPath: f };
}
const pe = "/wordpress/wp-content/mu-plugins/";
function Yt({
  workerThread: e,
  plugin: s,
  reactDevUrl: o,
  reactDomDevUrl: n,
  fastRefreshScriptUrl: c,
  onBundleReady: f,
  initialEditedFile: v = ""
}) {
  const y = fe(null), [d, h] = L(null), [, u] = L(null), b = de(
    (k) => {
      u(k), e.readFile(k).then(
        (E) => y.current.setFile({
          fileName: k,
          contents: E
        })
      );
    },
    [e]
  );
  ee(() => {
    async function k() {
      await ue(
        e,
        jt(
          c,
          o,
          n
        ),
        pe
      );
      const E = await ue(
        e,
        s,
        pe
      );
      h(E), v && b(N(E.srcPath, v));
      const S = await le(
        e,
        E.srcPath,
        E.buildPath
      );
      f(S.contents);
    }
    k();
  }, []);
  const x = te(
    () => Xe(async ({ fileName: k, contents: E }) => {
      await e.writeFile(k, E);
      const S = await le(
        e,
        d.srcPath,
        d.buildPath,
        {
          reloadOnly: !0
        }
      );
      f(S.contents);
    }, 500),
    [d == null ? void 0 : d.srcPath, e]
  );
  return d ? /* @__PURE__ */ Pe("div", { style: { display: "flex", flexDirection: "row" }, children: [
    /* @__PURE__ */ F(
      Ze,
      {
        chroot: d.srcPath,
        fileSystem: e,
        onSelectFile: b,
        className: "ide-panel is-files-explorer"
      }
    ),
    /* @__PURE__ */ F(
      Dt,
      {
        onChange: x,
        ref: y,
        className: "ide-panel is-code-mirror"
      }
    )
  ] }) : /* @__PURE__ */ F("div", { children: "Loading..." });
}
export {
  Yt as WordPressPluginIDE,
  Xt as createBlockPluginFixture,
  jt as enableReactFastRefreshPluginFixture,
  ue as setupFixture
};
