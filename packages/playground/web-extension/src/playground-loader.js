var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
	target = mod != null ? __create(__getProtoOf(mod)) : {};
	const to =
		isNodeMode || !mod || !mod.__esModule
			? __defProp(target, 'default', { value: mod, enumerable: true })
			: target;
	for (let key of __getOwnPropNames(mod))
		if (!__hasOwnProp.call(to, key))
			__defProp(to, key, {
				get: () => mod[key],
				enumerable: true,
			});
	return to;
};
var __commonJS = (cb, mod) => () => (
	mod || cb((mod = { exports: {} }).exports, mod), mod.exports
);
var __export = (target, all) => {
	for (var name in all)
		__defProp(target, name, {
			get: all[name],
			enumerable: true,
			configurable: true,
			set: (newValue) => (all[name] = () => newValue),
		});
};
var __legacyDecorateClassTS = function (decorators, target, key, desc) {
	var c = arguments.length,
		r =
			c < 3
				? target
				: desc === null
				? (desc = Object.getOwnPropertyDescriptor(target, key))
				: desc,
		d;
	if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
		r = Reflect.decorate(decorators, target, key, desc);
	else
		for (var i = decorators.length - 1; i >= 0; i--)
			if ((d = decorators[i]))
				r =
					(c < 3
						? d(r)
						: c > 3
						? d(target, key, r)
						: d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __legacyMetadataTS = (k, v) => {
	if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
		return Reflect.metadata(k, v);
};
var __require = ((x) =>
	typeof require !== 'undefined'
		? require
		: typeof Proxy !== 'undefined'
		? new Proxy(x, {
				get: (a, b) =>
					(typeof require !== 'undefined' ? require : a)[b],
		  })
		: x)(function (x) {
	if (typeof require !== 'undefined') return require.apply(this, arguments);
	throw Error('Dynamic require of "' + x + '" is not supported');
});

// ../../../node_modules/ini/lib/ini.js
var require_ini = __commonJS((exports, module) => {
	var splitSections = function (str, separator) {
		var lastMatchIndex = 0;
		var lastSeparatorIndex = 0;
		var nextIndex = 0;
		var sections = [];
		do {
			nextIndex = str.indexOf(separator, lastMatchIndex);
			if (nextIndex !== -1) {
				lastMatchIndex = nextIndex + separator.length;
				if (nextIndex > 0 && str[nextIndex - 1] === '\\') {
					continue;
				}
				sections.push(str.slice(lastSeparatorIndex, nextIndex));
				lastSeparatorIndex = nextIndex + separator.length;
			}
		} while (nextIndex !== -1);
		sections.push(str.slice(lastSeparatorIndex));
		return sections;
	};
	var { hasOwnProperty } = Object.prototype;
	var encode = (obj, opt = {}) => {
		if (typeof opt === 'string') {
			opt = { section: opt };
		}
		opt.align = opt.align === true;
		opt.newline = opt.newline === true;
		opt.sort = opt.sort === true;
		opt.whitespace = opt.whitespace === true || opt.align === true;
		opt.platform =
			opt.platform ||
			(typeof process !== 'undefined' && process.platform);
		opt.bracketedArray = opt.bracketedArray !== false;
		const eol2 = opt.platform === 'win32' ? '\r\n' : '\n';
		const separator = opt.whitespace ? ' = ' : '=';
		const children = [];
		const keys = opt.sort ? Object.keys(obj).sort() : Object.keys(obj);
		let padToChars = 0;
		if (opt.align) {
			padToChars = safe(
				keys
					.filter(
						(k) =>
							obj[k] === null ||
							Array.isArray(obj[k]) ||
							typeof obj[k] !== 'object'
					)
					.map((k) => (Array.isArray(obj[k]) ? `${k}[]` : k))
					.concat([''])
					.reduce((a, b) =>
						safe(a).length >= safe(b).length ? a : b
					)
			).length;
		}
		let out = '';
		const arraySuffix = opt.bracketedArray ? '[]' : '';
		for (const k of keys) {
			const val = obj[k];
			if (val && Array.isArray(val)) {
				for (const item of val) {
					out +=
						safe(`${k}${arraySuffix}`).padEnd(padToChars, ' ') +
						separator +
						safe(item) +
						eol2;
				}
			} else if (val && typeof val === 'object') {
				children.push(k);
			} else {
				out +=
					safe(k).padEnd(padToChars, ' ') +
					separator +
					safe(val) +
					eol2;
			}
		}
		if (opt.section && out.length) {
			out =
				'[' +
				safe(opt.section) +
				']' +
				(opt.newline ? eol2 + eol2 : eol2) +
				out;
		}
		for (const k of children) {
			const nk = splitSections(k, '.').join('\\.');
			const section = (opt.section ? opt.section + '.' : '') + nk;
			const child = encode(obj[k], {
				...opt,
				section,
			});
			if (out.length && child.length) {
				out += eol2;
			}
			out += child;
		}
		return out;
	};
	var decode = (str, opt = {}) => {
		opt.bracketedArray = opt.bracketedArray !== false;
		const out = Object.create(null);
		let p = out;
		let section = null;
		const re = /^\[([^\]]*)\]\s*$|^([^=]+)(=(.*))?$/i;
		const lines = str.split(/[\r\n]+/g);
		const duplicates = {};
		for (const line of lines) {
			if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
				continue;
			}
			const match = line.match(re);
			if (!match) {
				continue;
			}
			if (match[1] !== undefined) {
				section = unsafe(match[1]);
				if (section === '__proto__') {
					p = Object.create(null);
					continue;
				}
				p = out[section] = out[section] || Object.create(null);
				continue;
			}
			const keyRaw = unsafe(match[2]);
			let isArray;
			if (opt.bracketedArray) {
				isArray = keyRaw.length > 2 && keyRaw.slice(-2) === '[]';
			} else {
				duplicates[keyRaw] = (duplicates?.[keyRaw] || 0) + 1;
				isArray = duplicates[keyRaw] > 1;
			}
			const key = isArray ? keyRaw.slice(0, -2) : keyRaw;
			if (key === '__proto__') {
				continue;
			}
			const valueRaw = match[3] ? unsafe(match[4]) : true;
			const value =
				valueRaw === 'true' ||
				valueRaw === 'false' ||
				valueRaw === 'null'
					? JSON.parse(valueRaw)
					: valueRaw;
			if (isArray) {
				if (!hasOwnProperty.call(p, key)) {
					p[key] = [];
				} else if (!Array.isArray(p[key])) {
					p[key] = [p[key]];
				}
			}
			if (Array.isArray(p[key])) {
				p[key].push(value);
			} else {
				p[key] = value;
			}
		}
		const remove = [];
		for (const k of Object.keys(out)) {
			if (
				!hasOwnProperty.call(out, k) ||
				typeof out[k] !== 'object' ||
				Array.isArray(out[k])
			) {
				continue;
			}
			const parts = splitSections(k, '.');
			p = out;
			const l = parts.pop();
			const nl = l.replace(/\\\./g, '.');
			for (const part of parts) {
				if (part === '__proto__') {
					continue;
				}
				if (
					!hasOwnProperty.call(p, part) ||
					typeof p[part] !== 'object'
				) {
					p[part] = Object.create(null);
				}
				p = p[part];
			}
			if (p === out && nl === l) {
				continue;
			}
			p[nl] = out[k];
			remove.push(k);
		}
		for (const del of remove) {
			delete out[del];
		}
		return out;
	};
	var isQuoted = (val) => {
		return (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		);
	};
	var safe = (val) => {
		if (
			typeof val !== 'string' ||
			val.match(/[=\r\n]/) ||
			val.match(/^\[/) ||
			(val.length > 1 && isQuoted(val)) ||
			val !== val.trim()
		) {
			return JSON.stringify(val);
		}
		return val.split(';').join('\\;').split('#').join('\\#');
	};
	var unsafe = (val) => {
		val = (val || '').trim();
		if (isQuoted(val)) {
			if (val.charAt(0) === "'") {
				val = val.slice(1, -1);
			}
			try {
				val = JSON.parse(val);
			} catch {}
		} else {
			let esc = false;
			let unesc = '';
			for (let i = 0, l = val.length; i < l; i++) {
				const c = val.charAt(i);
				if (esc) {
					if ('\\;#'.indexOf(c) !== -1) {
						unesc += c;
					} else {
						unesc += '\\' + c;
					}
					esc = false;
				} else if (';#'.indexOf(c) !== -1) {
					break;
				} else if (c === '\\') {
					esc = true;
				} else {
					unesc += c;
				}
			}
			if (esc) {
				unesc += '\\';
			}
			return unesc.trim();
		}
		return val;
	};
	module.exports = {
		parse: decode,
		decode,
		stringify: encode,
		encode,
		safe,
		unsafe,
	};
});

// ../../../node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS((exports) => {
	var _ = function (strs, ...args) {
		const code = [strs[0]];
		let i = 0;
		while (i < args.length) {
			addCodeArg(code, args[i]);
			code.push(strs[++i]);
		}
		return new _Code(code);
	};
	var str = function (strs, ...args) {
		const expr = [safeStringify(strs[0])];
		let i = 0;
		while (i < args.length) {
			expr.push(plus);
			addCodeArg(expr, args[i]);
			expr.push(plus, safeStringify(strs[++i]));
		}
		optimize(expr);
		return new _Code(expr);
	};
	var addCodeArg = function (code, arg) {
		if (arg instanceof _Code) code.push(...arg._items);
		else if (arg instanceof Name) code.push(arg);
		else code.push(interpolate(arg));
	};
	var optimize = function (expr) {
		let i = 1;
		while (i < expr.length - 1) {
			if (expr[i] === plus) {
				const res = mergeExprItems(expr[i - 1], expr[i + 1]);
				if (res !== undefined) {
					expr.splice(i - 1, 3, res);
					continue;
				}
				expr[i++] = '+';
			}
			i++;
		}
	};
	var mergeExprItems = function (a, b) {
		if (b === '""') return a;
		if (a === '""') return b;
		if (typeof a == 'string') {
			if (b instanceof Name || a[a.length - 1] !== '"') return;
			if (typeof b != 'string') return `${a.slice(0, -1)}${b}"`;
			if (b[0] === '"') return a.slice(0, -1) + b.slice(1);
			return;
		}
		if (typeof b == 'string' && b[0] === '"' && !(a instanceof Name))
			return `"${a}${b.slice(1)}`;
		return;
	};
	var strConcat = function (c1, c2) {
		return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
	};
	var interpolate = function (x) {
		return typeof x == 'number' || typeof x == 'boolean' || x === null
			? x
			: safeStringify(Array.isArray(x) ? x.join(',') : x);
	};
	var stringify2 = function (x) {
		return new _Code(safeStringify(x));
	};
	var safeStringify = function (x) {
		return JSON.stringify(x)
			.replace(/\u2028/g, '\\u2028')
			.replace(/\u2029/g, '\\u2029');
	};
	var getProperty = function (key) {
		return typeof key == 'string' && exports.IDENTIFIER.test(key)
			? new _Code(`.${key}`)
			: _`[${key}]`;
	};
	var getEsmExportName = function (key) {
		if (typeof key == 'string' && exports.IDENTIFIER.test(key)) {
			return new _Code(`${key}`);
		}
		throw new Error(
			`CodeGen: invalid export name: ${key}, use explicit \$id name mapping`
		);
	};
	var regexpCode = function (rx) {
		return new _Code(rx.toString());
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.regexpCode =
		exports.getEsmExportName =
		exports.getProperty =
		exports.safeStringify =
		exports.stringify =
		exports.strConcat =
		exports.addCodeArg =
		exports.str =
		exports._ =
		exports.nil =
		exports._Code =
		exports.Name =
		exports.IDENTIFIER =
		exports._CodeOrName =
			undefined;

	class _CodeOrName {}
	exports._CodeOrName = _CodeOrName;
	exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;

	class Name extends _CodeOrName {
		constructor(s) {
			super();
			if (!exports.IDENTIFIER.test(s))
				throw new Error('CodeGen: name must be a valid identifier');
			this.str = s;
		}
		toString() {
			return this.str;
		}
		emptyStr() {
			return false;
		}
		get names() {
			return { [this.str]: 1 };
		}
	}
	exports.Name = Name;

	class _Code extends _CodeOrName {
		constructor(code) {
			super();
			this._items = typeof code === 'string' ? [code] : code;
		}
		toString() {
			return this.str;
		}
		emptyStr() {
			if (this._items.length > 1) return false;
			const item = this._items[0];
			return item === '' || item === '""';
		}
		get str() {
			var _a;
			return (_a = this._str) !== null && _a !== undefined
				? _a
				: (this._str = this._items.reduce((s, c) => `${s}${c}`, ''));
		}
		get names() {
			var _a;
			return (_a = this._names) !== null && _a !== undefined
				? _a
				: (this._names = this._items.reduce((names, c) => {
						if (c instanceof Name)
							names[c.str] = (names[c.str] || 0) + 1;
						return names;
				  }, {}));
		}
	}
	exports._Code = _Code;
	exports.nil = new _Code('');
	exports._ = _;
	var plus = new _Code('+');
	exports.str = str;
	exports.addCodeArg = addCodeArg;
	exports.strConcat = strConcat;
	exports.stringify = stringify2;
	exports.safeStringify = safeStringify;
	exports.getProperty = getProperty;
	exports.getEsmExportName = getEsmExportName;
	exports.regexpCode = regexpCode;
});

// ../../../node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.ValueScope =
		exports.ValueScopeName =
		exports.Scope =
		exports.varKinds =
		exports.UsedValueState =
			undefined;
	var code_1 = require_code();

	class ValueError extends Error {
		constructor(name) {
			super(`CodeGen: "code" for ${name} not defined`);
			this.value = name.value;
		}
	}
	var UsedValueState;
	(function (UsedValueState2) {
		UsedValueState2[(UsedValueState2['Started'] = 0)] = 'Started';
		UsedValueState2[(UsedValueState2['Completed'] = 1)] = 'Completed';
	})(
		(UsedValueState =
			exports.UsedValueState || (exports.UsedValueState = {}))
	);
	exports.varKinds = {
		const: new code_1.Name('const'),
		let: new code_1.Name('let'),
		var: new code_1.Name('var'),
	};

	class Scope {
		constructor({ prefixes, parent } = {}) {
			this._names = {};
			this._prefixes = prefixes;
			this._parent = parent;
		}
		toName(nameOrPrefix) {
			return nameOrPrefix instanceof code_1.Name
				? nameOrPrefix
				: this.name(nameOrPrefix);
		}
		name(prefix) {
			return new code_1.Name(this._newName(prefix));
		}
		_newName(prefix) {
			const ng = this._names[prefix] || this._nameGroup(prefix);
			return `${prefix}${ng.index++}`;
		}
		_nameGroup(prefix) {
			var _a, _b;
			if (
				((_b =
					(_a = this._parent) === null || _a === undefined
						? undefined
						: _a._prefixes) === null || _b === undefined
					? undefined
					: _b.has(prefix)) ||
				(this._prefixes && !this._prefixes.has(prefix))
			) {
				throw new Error(
					`CodeGen: prefix "${prefix}" is not allowed in this scope`
				);
			}
			return (this._names[prefix] = { prefix, index: 0 });
		}
	}
	exports.Scope = Scope;

	class ValueScopeName extends code_1.Name {
		constructor(prefix, nameStr) {
			super(nameStr);
			this.prefix = prefix;
		}
		setValue(value, { property, itemIndex }) {
			this.value = value;
			this.scopePath = (0, code_1._)`.${new code_1.Name(
				property
			)}[${itemIndex}]`;
		}
	}
	exports.ValueScopeName = ValueScopeName;
	var line = (0, code_1._)`\n`;

	class ValueScope extends Scope {
		constructor(opts) {
			super(opts);
			this._values = {};
			this._scope = opts.scope;
			this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
		}
		get() {
			return this._scope;
		}
		name(prefix) {
			return new ValueScopeName(prefix, this._newName(prefix));
		}
		value(nameOrPrefix, value) {
			var _a;
			if (value.ref === undefined)
				throw new Error('CodeGen: ref must be passed in value');
			const name = this.toName(nameOrPrefix);
			const { prefix } = name;
			const valueKey =
				(_a = value.key) !== null && _a !== undefined ? _a : value.ref;
			let vs = this._values[prefix];
			if (vs) {
				const _name = vs.get(valueKey);
				if (_name) return _name;
			} else {
				vs = this._values[prefix] = new Map();
			}
			vs.set(valueKey, name);
			const s = this._scope[prefix] || (this._scope[prefix] = []);
			const itemIndex = s.length;
			s[itemIndex] = value.ref;
			name.setValue(value, { property: prefix, itemIndex });
			return name;
		}
		getValue(prefix, keyOrRef) {
			const vs = this._values[prefix];
			if (!vs) return;
			return vs.get(keyOrRef);
		}
		scopeRefs(scopeName, values = this._values) {
			return this._reduceValues(values, (name) => {
				if (name.scopePath === undefined)
					throw new Error(`CodeGen: name "${name}" has no value`);
				return (0, code_1._)`${scopeName}${name.scopePath}`;
			});
		}
		scopeCode(values = this._values, usedValues, getCode) {
			return this._reduceValues(
				values,
				(name) => {
					if (name.value === undefined)
						throw new Error(`CodeGen: name "${name}" has no value`);
					return name.value.code;
				},
				usedValues,
				getCode
			);
		}
		_reduceValues(values, valueCode, usedValues = {}, getCode) {
			let code = code_1.nil;
			for (const prefix in values) {
				const vs = values[prefix];
				if (!vs) continue;
				const nameSet = (usedValues[prefix] =
					usedValues[prefix] || new Map());
				vs.forEach((name) => {
					if (nameSet.has(name)) return;
					nameSet.set(name, UsedValueState.Started);
					let c = valueCode(name);
					if (c) {
						const def = this.opts.es5
							? exports.varKinds.var
							: exports.varKinds.const;
						code = (0,
						code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
					} else if (
						(c =
							getCode === null || getCode === undefined
								? undefined
								: getCode(name))
					) {
						code = (0, code_1._)`${code}${c}${this.opts._n}`;
					} else {
						throw new ValueError(name);
					}
					nameSet.set(name, UsedValueState.Completed);
				});
			}
			return code;
		}
	}
	exports.ValueScope = ValueScope;
});

// ../../../node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS((exports) => {
	var addNames = function (names, from) {
		for (const n in from) names[n] = (names[n] || 0) + (from[n] || 0);
		return names;
	};
	var addExprNames = function (names, from) {
		return from instanceof code_1._CodeOrName
			? addNames(names, from.names)
			: names;
	};
	var optimizeExpr = function (expr, names, constants) {
		if (expr instanceof code_1.Name) return replaceName(expr);
		if (!canOptimize(expr)) return expr;
		return new code_1._Code(
			expr._items.reduce((items, c) => {
				if (c instanceof code_1.Name) c = replaceName(c);
				if (c instanceof code_1._Code) items.push(...c._items);
				else items.push(c);
				return items;
			}, [])
		);
		function replaceName(n) {
			const c = constants[n.str];
			if (c === undefined || names[n.str] !== 1) return n;
			delete names[n.str];
			return c;
		}
		function canOptimize(e) {
			return (
				e instanceof code_1._Code &&
				e._items.some(
					(c) =>
						c instanceof code_1.Name &&
						names[c.str] === 1 &&
						constants[c.str] !== undefined
				)
			);
		}
	};
	var subtractNames = function (names, from) {
		for (const n in from) names[n] = (names[n] || 0) - (from[n] || 0);
	};
	var not = function (x) {
		return typeof x == 'boolean' || typeof x == 'number' || x === null
			? !x
			: (0, code_1._)`!${par(x)}`;
	};
	var and = function (...args) {
		return args.reduce(andCode);
	};
	var or = function (...args) {
		return args.reduce(orCode);
	};
	var mappend = function (op) {
		return (x, y) =>
			x === code_1.nil
				? y
				: y === code_1.nil
				? x
				: (0, code_1._)`${par(x)} ${op} ${par(y)}`;
	};
	var par = function (x) {
		return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.or =
		exports.and =
		exports.not =
		exports.CodeGen =
		exports.operators =
		exports.varKinds =
		exports.ValueScopeName =
		exports.ValueScope =
		exports.Scope =
		exports.Name =
		exports.regexpCode =
		exports.stringify =
		exports.getProperty =
		exports.nil =
		exports.strConcat =
		exports.str =
		exports._ =
			undefined;
	var code_1 = require_code();
	var scope_1 = require_scope();
	var code_2 = require_code();
	Object.defineProperty(exports, '_', {
		enumerable: true,
		get: function () {
			return code_2._;
		},
	});
	Object.defineProperty(exports, 'str', {
		enumerable: true,
		get: function () {
			return code_2.str;
		},
	});
	Object.defineProperty(exports, 'strConcat', {
		enumerable: true,
		get: function () {
			return code_2.strConcat;
		},
	});
	Object.defineProperty(exports, 'nil', {
		enumerable: true,
		get: function () {
			return code_2.nil;
		},
	});
	Object.defineProperty(exports, 'getProperty', {
		enumerable: true,
		get: function () {
			return code_2.getProperty;
		},
	});
	Object.defineProperty(exports, 'stringify', {
		enumerable: true,
		get: function () {
			return code_2.stringify;
		},
	});
	Object.defineProperty(exports, 'regexpCode', {
		enumerable: true,
		get: function () {
			return code_2.regexpCode;
		},
	});
	Object.defineProperty(exports, 'Name', {
		enumerable: true,
		get: function () {
			return code_2.Name;
		},
	});
	var scope_2 = require_scope();
	Object.defineProperty(exports, 'Scope', {
		enumerable: true,
		get: function () {
			return scope_2.Scope;
		},
	});
	Object.defineProperty(exports, 'ValueScope', {
		enumerable: true,
		get: function () {
			return scope_2.ValueScope;
		},
	});
	Object.defineProperty(exports, 'ValueScopeName', {
		enumerable: true,
		get: function () {
			return scope_2.ValueScopeName;
		},
	});
	Object.defineProperty(exports, 'varKinds', {
		enumerable: true,
		get: function () {
			return scope_2.varKinds;
		},
	});
	exports.operators = {
		GT: new code_1._Code('>'),
		GTE: new code_1._Code('>='),
		LT: new code_1._Code('<'),
		LTE: new code_1._Code('<='),
		EQ: new code_1._Code('==='),
		NEQ: new code_1._Code('!=='),
		NOT: new code_1._Code('!'),
		OR: new code_1._Code('||'),
		AND: new code_1._Code('&&'),
		ADD: new code_1._Code('+'),
	};

	class Node {
		optimizeNodes() {
			return this;
		}
		optimizeNames(_names, _constants) {
			return this;
		}
	}

	class Def extends Node {
		constructor(varKind, name, rhs) {
			super();
			this.varKind = varKind;
			this.name = name;
			this.rhs = rhs;
		}
		render({ es5, _n }) {
			const varKind = es5 ? scope_1.varKinds.var : this.varKind;
			const rhs = this.rhs === undefined ? '' : ` = ${this.rhs}`;
			return `${varKind} ${this.name}${rhs};` + _n;
		}
		optimizeNames(names, constants) {
			if (!names[this.name.str]) return;
			if (this.rhs) this.rhs = optimizeExpr(this.rhs, names, constants);
			return this;
		}
		get names() {
			return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
		}
	}

	class Assign extends Node {
		constructor(lhs, rhs, sideEffects) {
			super();
			this.lhs = lhs;
			this.rhs = rhs;
			this.sideEffects = sideEffects;
		}
		render({ _n }) {
			return `${this.lhs} = ${this.rhs};` + _n;
		}
		optimizeNames(names, constants) {
			if (
				this.lhs instanceof code_1.Name &&
				!names[this.lhs.str] &&
				!this.sideEffects
			)
				return;
			this.rhs = optimizeExpr(this.rhs, names, constants);
			return this;
		}
		get names() {
			const names =
				this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
			return addExprNames(names, this.rhs);
		}
	}

	class AssignOp extends Assign {
		constructor(lhs, op, rhs, sideEffects) {
			super(lhs, rhs, sideEffects);
			this.op = op;
		}
		render({ _n }) {
			return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
		}
	}

	class Label extends Node {
		constructor(label) {
			super();
			this.label = label;
			this.names = {};
		}
		render({ _n }) {
			return `${this.label}:` + _n;
		}
	}

	class Break extends Node {
		constructor(label) {
			super();
			this.label = label;
			this.names = {};
		}
		render({ _n }) {
			const label = this.label ? ` ${this.label}` : '';
			return `break${label};` + _n;
		}
	}

	class Throw extends Node {
		constructor(error) {
			super();
			this.error = error;
		}
		render({ _n }) {
			return `throw ${this.error};` + _n;
		}
		get names() {
			return this.error.names;
		}
	}

	class AnyCode extends Node {
		constructor(code) {
			super();
			this.code = code;
		}
		render({ _n }) {
			return `${this.code};` + _n;
		}
		optimizeNodes() {
			return `${this.code}` ? this : undefined;
		}
		optimizeNames(names, constants) {
			this.code = optimizeExpr(this.code, names, constants);
			return this;
		}
		get names() {
			return this.code instanceof code_1._CodeOrName
				? this.code.names
				: {};
		}
	}

	class ParentNode extends Node {
		constructor(nodes = []) {
			super();
			this.nodes = nodes;
		}
		render(opts) {
			return this.nodes.reduce((code, n) => code + n.render(opts), '');
		}
		optimizeNodes() {
			const { nodes } = this;
			let i = nodes.length;
			while (i--) {
				const n = nodes[i].optimizeNodes();
				if (Array.isArray(n)) nodes.splice(i, 1, ...n);
				else if (n) nodes[i] = n;
				else nodes.splice(i, 1);
			}
			return nodes.length > 0 ? this : undefined;
		}
		optimizeNames(names, constants) {
			const { nodes } = this;
			let i = nodes.length;
			while (i--) {
				const n = nodes[i];
				if (n.optimizeNames(names, constants)) continue;
				subtractNames(names, n.names);
				nodes.splice(i, 1);
			}
			return nodes.length > 0 ? this : undefined;
		}
		get names() {
			return this.nodes.reduce(
				(names, n) => addNames(names, n.names),
				{}
			);
		}
	}

	class BlockNode extends ParentNode {
		render(opts) {
			return '{' + opts._n + super.render(opts) + '}' + opts._n;
		}
	}

	class Root extends ParentNode {}

	class Else extends BlockNode {}
	Else.kind = 'else';

	class If extends BlockNode {
		constructor(condition, nodes) {
			super(nodes);
			this.condition = condition;
		}
		render(opts) {
			let code = `if(${this.condition})` + super.render(opts);
			if (this.else) code += 'else ' + this.else.render(opts);
			return code;
		}
		optimizeNodes() {
			super.optimizeNodes();
			const cond = this.condition;
			if (cond === true) return this.nodes;
			let e = this.else;
			if (e) {
				const ns = e.optimizeNodes();
				e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
			}
			if (e) {
				if (cond === false) return e instanceof If ? e : e.nodes;
				if (this.nodes.length) return this;
				return new If(not(cond), e instanceof If ? [e] : e.nodes);
			}
			if (cond === false || !this.nodes.length) return;
			return this;
		}
		optimizeNames(names, constants) {
			var _a;
			this.else =
				(_a = this.else) === null || _a === undefined
					? undefined
					: _a.optimizeNames(names, constants);
			if (!(super.optimizeNames(names, constants) || this.else)) return;
			this.condition = optimizeExpr(this.condition, names, constants);
			return this;
		}
		get names() {
			const names = super.names;
			addExprNames(names, this.condition);
			if (this.else) addNames(names, this.else.names);
			return names;
		}
	}
	If.kind = 'if';

	class For extends BlockNode {}
	For.kind = 'for';

	class ForLoop extends For {
		constructor(iteration) {
			super();
			this.iteration = iteration;
		}
		render(opts) {
			return `for(${this.iteration})` + super.render(opts);
		}
		optimizeNames(names, constants) {
			if (!super.optimizeNames(names, constants)) return;
			this.iteration = optimizeExpr(this.iteration, names, constants);
			return this;
		}
		get names() {
			return addNames(super.names, this.iteration.names);
		}
	}

	class ForRange extends For {
		constructor(varKind, name, from, to) {
			super();
			this.varKind = varKind;
			this.name = name;
			this.from = from;
			this.to = to;
		}
		render(opts) {
			const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
			const { name, from, to } = this;
			return (
				`for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` +
				super.render(opts)
			);
		}
		get names() {
			const names = addExprNames(super.names, this.from);
			return addExprNames(names, this.to);
		}
	}

	class ForIter extends For {
		constructor(loop, varKind, name, iterable) {
			super();
			this.loop = loop;
			this.varKind = varKind;
			this.name = name;
			this.iterable = iterable;
		}
		render(opts) {
			return (
				`for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` +
				super.render(opts)
			);
		}
		optimizeNames(names, constants) {
			if (!super.optimizeNames(names, constants)) return;
			this.iterable = optimizeExpr(this.iterable, names, constants);
			return this;
		}
		get names() {
			return addNames(super.names, this.iterable.names);
		}
	}

	class Func extends BlockNode {
		constructor(name, args, async) {
			super();
			this.name = name;
			this.args = args;
			this.async = async;
		}
		render(opts) {
			const _async = this.async ? 'async ' : '';
			return (
				`${_async}function ${this.name}(${this.args})` +
				super.render(opts)
			);
		}
	}
	Func.kind = 'func';

	class Return extends ParentNode {
		render(opts) {
			return 'return ' + super.render(opts);
		}
	}
	Return.kind = 'return';

	class Try extends BlockNode {
		render(opts) {
			let code = 'try' + super.render(opts);
			if (this.catch) code += this.catch.render(opts);
			if (this.finally) code += this.finally.render(opts);
			return code;
		}
		optimizeNodes() {
			var _a, _b;
			super.optimizeNodes();
			(_a = this.catch) === null ||
				_a === undefined ||
				_a.optimizeNodes();
			(_b = this.finally) === null ||
				_b === undefined ||
				_b.optimizeNodes();
			return this;
		}
		optimizeNames(names, constants) {
			var _a, _b;
			super.optimizeNames(names, constants);
			(_a = this.catch) === null ||
				_a === undefined ||
				_a.optimizeNames(names, constants);
			(_b = this.finally) === null ||
				_b === undefined ||
				_b.optimizeNames(names, constants);
			return this;
		}
		get names() {
			const names = super.names;
			if (this.catch) addNames(names, this.catch.names);
			if (this.finally) addNames(names, this.finally.names);
			return names;
		}
	}

	class Catch extends BlockNode {
		constructor(error) {
			super();
			this.error = error;
		}
		render(opts) {
			return `catch(${this.error})` + super.render(opts);
		}
	}
	Catch.kind = 'catch';

	class Finally extends BlockNode {
		render(opts) {
			return 'finally' + super.render(opts);
		}
	}
	Finally.kind = 'finally';

	class CodeGen {
		constructor(extScope, opts = {}) {
			this._values = {};
			this._blockStarts = [];
			this._constants = {};
			this.opts = { ...opts, _n: opts.lines ? '\n' : '' };
			this._extScope = extScope;
			this._scope = new scope_1.Scope({ parent: extScope });
			this._nodes = [new Root()];
		}
		toString() {
			return this._root.render(this.opts);
		}
		name(prefix) {
			return this._scope.name(prefix);
		}
		scopeName(prefix) {
			return this._extScope.name(prefix);
		}
		scopeValue(prefixOrName, value) {
			const name = this._extScope.value(prefixOrName, value);
			const vs =
				this._values[name.prefix] ||
				(this._values[name.prefix] = new Set());
			vs.add(name);
			return name;
		}
		getScopeValue(prefix, keyOrRef) {
			return this._extScope.getValue(prefix, keyOrRef);
		}
		scopeRefs(scopeName) {
			return this._extScope.scopeRefs(scopeName, this._values);
		}
		scopeCode() {
			return this._extScope.scopeCode(this._values);
		}
		_def(varKind, nameOrPrefix, rhs, constant) {
			const name = this._scope.toName(nameOrPrefix);
			if (rhs !== undefined && constant) this._constants[name.str] = rhs;
			this._leafNode(new Def(varKind, name, rhs));
			return name;
		}
		const(nameOrPrefix, rhs, _constant) {
			return this._def(
				scope_1.varKinds.const,
				nameOrPrefix,
				rhs,
				_constant
			);
		}
		let(nameOrPrefix, rhs, _constant) {
			return this._def(
				scope_1.varKinds.let,
				nameOrPrefix,
				rhs,
				_constant
			);
		}
		var(nameOrPrefix, rhs, _constant) {
			return this._def(
				scope_1.varKinds.var,
				nameOrPrefix,
				rhs,
				_constant
			);
		}
		assign(lhs, rhs, sideEffects) {
			return this._leafNode(new Assign(lhs, rhs, sideEffects));
		}
		add(lhs, rhs) {
			return this._leafNode(
				new AssignOp(lhs, exports.operators.ADD, rhs)
			);
		}
		code(c) {
			if (typeof c == 'function') c();
			else if (c !== code_1.nil) this._leafNode(new AnyCode(c));
			return this;
		}
		object(...keyValues) {
			const code = ['{'];
			for (const [key, value] of keyValues) {
				if (code.length > 1) code.push(',');
				code.push(key);
				if (key !== value || this.opts.es5) {
					code.push(':');
					(0, code_1.addCodeArg)(code, value);
				}
			}
			code.push('}');
			return new code_1._Code(code);
		}
		if(condition, thenBody, elseBody) {
			this._blockNode(new If(condition));
			if (thenBody && elseBody) {
				this.code(thenBody).else().code(elseBody).endIf();
			} else if (thenBody) {
				this.code(thenBody).endIf();
			} else if (elseBody) {
				throw new Error('CodeGen: "else" body without "then" body');
			}
			return this;
		}
		elseIf(condition) {
			return this._elseNode(new If(condition));
		}
		else() {
			return this._elseNode(new Else());
		}
		endIf() {
			return this._endBlockNode(If, Else);
		}
		_for(node, forBody) {
			this._blockNode(node);
			if (forBody) this.code(forBody).endFor();
			return this;
		}
		for(iteration, forBody) {
			return this._for(new ForLoop(iteration), forBody);
		}
		forRange(
			nameOrPrefix,
			from,
			to,
			forBody,
			varKind = this.opts.es5
				? scope_1.varKinds.var
				: scope_1.varKinds.let
		) {
			const name = this._scope.toName(nameOrPrefix);
			return this._for(new ForRange(varKind, name, from, to), () =>
				forBody(name)
			);
		}
		forOf(
			nameOrPrefix,
			iterable,
			forBody,
			varKind = scope_1.varKinds.const
		) {
			const name = this._scope.toName(nameOrPrefix);
			if (this.opts.es5) {
				const arr =
					iterable instanceof code_1.Name
						? iterable
						: this.var('_arr', iterable);
				return this.forRange(
					'_i',
					0,
					(0, code_1._)`${arr}.length`,
					(i) => {
						this.var(name, (0, code_1._)`${arr}[${i}]`);
						forBody(name);
					}
				);
			}
			return this._for(new ForIter('of', varKind, name, iterable), () =>
				forBody(name)
			);
		}
		forIn(
			nameOrPrefix,
			obj,
			forBody,
			varKind = this.opts.es5
				? scope_1.varKinds.var
				: scope_1.varKinds.const
		) {
			if (this.opts.ownProperties) {
				return this.forOf(
					nameOrPrefix,
					(0, code_1._)`Object.keys(${obj})`,
					forBody
				);
			}
			const name = this._scope.toName(nameOrPrefix);
			return this._for(new ForIter('in', varKind, name, obj), () =>
				forBody(name)
			);
		}
		endFor() {
			return this._endBlockNode(For);
		}
		label(label) {
			return this._leafNode(new Label(label));
		}
		break(label) {
			return this._leafNode(new Break(label));
		}
		return(value) {
			const node = new Return();
			this._blockNode(node);
			this.code(value);
			if (node.nodes.length !== 1)
				throw new Error('CodeGen: "return" should have one node');
			return this._endBlockNode(Return);
		}
		try(tryBody, catchCode, finallyCode) {
			if (!catchCode && !finallyCode)
				throw new Error('CodeGen: "try" without "catch" and "finally"');
			const node = new Try();
			this._blockNode(node);
			this.code(tryBody);
			if (catchCode) {
				const error = this.name('e');
				this._currNode = node.catch = new Catch(error);
				catchCode(error);
			}
			if (finallyCode) {
				this._currNode = node.finally = new Finally();
				this.code(finallyCode);
			}
			return this._endBlockNode(Catch, Finally);
		}
		throw(error) {
			return this._leafNode(new Throw(error));
		}
		block(body, nodeCount) {
			this._blockStarts.push(this._nodes.length);
			if (body) this.code(body).endBlock(nodeCount);
			return this;
		}
		endBlock(nodeCount) {
			const len = this._blockStarts.pop();
			if (len === undefined)
				throw new Error('CodeGen: not in self-balancing block');
			const toClose = this._nodes.length - len;
			if (
				toClose < 0 ||
				(nodeCount !== undefined && toClose !== nodeCount)
			) {
				throw new Error(
					`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`
				);
			}
			this._nodes.length = len;
			return this;
		}
		func(name, args = code_1.nil, async, funcBody) {
			this._blockNode(new Func(name, args, async));
			if (funcBody) this.code(funcBody).endFunc();
			return this;
		}
		endFunc() {
			return this._endBlockNode(Func);
		}
		optimize(n = 1) {
			while (n-- > 0) {
				this._root.optimizeNodes();
				this._root.optimizeNames(this._root.names, this._constants);
			}
		}
		_leafNode(node) {
			this._currNode.nodes.push(node);
			return this;
		}
		_blockNode(node) {
			this._currNode.nodes.push(node);
			this._nodes.push(node);
		}
		_endBlockNode(N1, N2) {
			const n = this._currNode;
			if (n instanceof N1 || (N2 && n instanceof N2)) {
				this._nodes.pop();
				return this;
			}
			throw new Error(
				`CodeGen: not in block "${
					N2 ? `${N1.kind}/${N2.kind}` : N1.kind
				}"`
			);
		}
		_elseNode(node) {
			const n = this._currNode;
			if (!(n instanceof If)) {
				throw new Error('CodeGen: "else" without "if"');
			}
			this._currNode = n.else = node;
			return this;
		}
		get _root() {
			return this._nodes[0];
		}
		get _currNode() {
			const ns = this._nodes;
			return ns[ns.length - 1];
		}
		set _currNode(node) {
			const ns = this._nodes;
			ns[ns.length - 1] = node;
		}
	}
	exports.CodeGen = CodeGen;
	exports.not = not;
	var andCode = mappend(exports.operators.AND);
	exports.and = and;
	var orCode = mappend(exports.operators.OR);
	exports.or = or;
});

// ../../../node_modules/ajv/dist/compile/util.js
var require_util = __commonJS((exports) => {
	var toHash = function (arr) {
		const hash = {};
		for (const item of arr) hash[item] = true;
		return hash;
	};
	var alwaysValidSchema = function (it, schema) {
		if (typeof schema == 'boolean') return schema;
		if (Object.keys(schema).length === 0) return true;
		checkUnknownRules(it, schema);
		return !schemaHasRules(schema, it.self.RULES.all);
	};
	var checkUnknownRules = function (it, schema = it.schema) {
		const { opts, self: self2 } = it;
		if (!opts.strictSchema) return;
		if (typeof schema === 'boolean') return;
		const rules = self2.RULES.keywords;
		for (const key in schema) {
			if (!rules[key]) checkStrictMode(it, `unknown keyword: "${key}"`);
		}
	};
	var schemaHasRules = function (schema, rules) {
		if (typeof schema == 'boolean') return !schema;
		for (const key in schema) if (rules[key]) return true;
		return false;
	};
	var schemaHasRulesButRef = function (schema, RULES) {
		if (typeof schema == 'boolean') return !schema;
		for (const key in schema)
			if (key !== '$ref' && RULES.all[key]) return true;
		return false;
	};
	var schemaRefOrVal = function (
		{ topSchemaRef, schemaPath },
		schema,
		keyword,
		$data
	) {
		if (!$data) {
			if (typeof schema == 'number' || typeof schema == 'boolean')
				return schema;
			if (typeof schema == 'string') return (0, codegen_1._)`${schema}`;
		}
		return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0,
		codegen_1.getProperty)(keyword)}`;
	};
	var unescapeFragment = function (str) {
		return unescapeJsonPointer(decodeURIComponent(str));
	};
	var escapeFragment = function (str) {
		return encodeURIComponent(escapeJsonPointer(str));
	};
	var escapeJsonPointer = function (str) {
		if (typeof str == 'number') return `${str}`;
		return str.replace(/~/g, '~0').replace(/\//g, '~1');
	};
	var unescapeJsonPointer = function (str) {
		return str.replace(/~1/g, '/').replace(/~0/g, '~');
	};
	var eachItem = function (xs, f) {
		if (Array.isArray(xs)) {
			for (const x of xs) f(x);
		} else {
			f(xs);
		}
	};
	var makeMergeEvaluated = function ({
		mergeNames,
		mergeToName,
		mergeValues,
		resultToName,
	}) {
		return (gen, from, to, toName) => {
			const res =
				to === undefined
					? from
					: to instanceof codegen_1.Name
					? (from instanceof codegen_1.Name
							? mergeNames(gen, from, to)
							: mergeToName(gen, from, to),
					  to)
					: from instanceof codegen_1.Name
					? (mergeToName(gen, to, from), from)
					: mergeValues(from, to);
			return toName === codegen_1.Name && !(res instanceof codegen_1.Name)
				? resultToName(gen, res)
				: res;
		};
	};
	var evaluatedPropsToName = function (gen, ps) {
		if (ps === true) return gen.var('props', true);
		const props = gen.var('props', (0, codegen_1._)`{}`);
		if (ps !== undefined) setEvaluated(gen, props, ps);
		return props;
	};
	var setEvaluated = function (gen, props, ps) {
		Object.keys(ps).forEach((p) =>
			gen.assign(
				(0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`,
				true
			)
		);
	};
	var useFunc = function (gen, f) {
		return gen.scopeValue('func', {
			ref: f,
			code:
				snippets[f.code] ||
				(snippets[f.code] = new code_1._Code(f.code)),
		});
	};
	var getErrorPath = function (dataProp, dataPropType, jsPropertySyntax) {
		if (dataProp instanceof codegen_1.Name) {
			const isNumber = dataPropType === Type.Num;
			return jsPropertySyntax
				? isNumber
					? (0, codegen_1._)`"[" + ${dataProp} + "]"`
					: (0, codegen_1._)`"['" + ${dataProp} + "']"`
				: isNumber
				? (0, codegen_1._)`"/" + ${dataProp}`
				: (0,
				  codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
		}
		return jsPropertySyntax
			? (0, codegen_1.getProperty)(dataProp).toString()
			: '/' + escapeJsonPointer(dataProp);
	};
	var checkStrictMode = function (it, msg, mode = it.opts.strictSchema) {
		if (!mode) return;
		msg = `strict mode: ${msg}`;
		if (mode === true) throw new Error(msg);
		it.self.logger.warn(msg);
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.checkStrictMode =
		exports.getErrorPath =
		exports.Type =
		exports.useFunc =
		exports.setEvaluated =
		exports.evaluatedPropsToName =
		exports.mergeEvaluated =
		exports.eachItem =
		exports.unescapeJsonPointer =
		exports.escapeJsonPointer =
		exports.escapeFragment =
		exports.unescapeFragment =
		exports.schemaRefOrVal =
		exports.schemaHasRulesButRef =
		exports.schemaHasRules =
		exports.checkUnknownRules =
		exports.alwaysValidSchema =
		exports.toHash =
			undefined;
	var codegen_1 = require_codegen();
	var code_1 = require_code();
	exports.toHash = toHash;
	exports.alwaysValidSchema = alwaysValidSchema;
	exports.checkUnknownRules = checkUnknownRules;
	exports.schemaHasRules = schemaHasRules;
	exports.schemaHasRulesButRef = schemaHasRulesButRef;
	exports.schemaRefOrVal = schemaRefOrVal;
	exports.unescapeFragment = unescapeFragment;
	exports.escapeFragment = escapeFragment;
	exports.escapeJsonPointer = escapeJsonPointer;
	exports.unescapeJsonPointer = unescapeJsonPointer;
	exports.eachItem = eachItem;
	exports.mergeEvaluated = {
		props: makeMergeEvaluated({
			mergeNames: (gen, from, to) =>
				gen.if(
					(0, codegen_1._)`${to} !== true && ${from} !== undefined`,
					() => {
						gen.if(
							(0, codegen_1._)`${from} === true`,
							() => gen.assign(to, true),
							() =>
								gen
									.assign(to, (0, codegen_1._)`${to} || {}`)
									.code(
										(0,
										codegen_1._)`Object.assign(${to}, ${from})`
									)
						);
					}
				),
			mergeToName: (gen, from, to) =>
				gen.if((0, codegen_1._)`${to} !== true`, () => {
					if (from === true) {
						gen.assign(to, true);
					} else {
						gen.assign(to, (0, codegen_1._)`${to} || {}`);
						setEvaluated(gen, to, from);
					}
				}),
			mergeValues: (from, to) =>
				from === true ? true : { ...from, ...to },
			resultToName: evaluatedPropsToName,
		}),
		items: makeMergeEvaluated({
			mergeNames: (gen, from, to) =>
				gen.if(
					(0, codegen_1._)`${to} !== true && ${from} !== undefined`,
					() =>
						gen.assign(
							to,
							(0,
							codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`
						)
				),
			mergeToName: (gen, from, to) =>
				gen.if((0, codegen_1._)`${to} !== true`, () =>
					gen.assign(
						to,
						from === true
							? true
							: (0,
							  codegen_1._)`${to} > ${from} ? ${to} : ${from}`
					)
				),
			mergeValues: (from, to) =>
				from === true ? true : Math.max(from, to),
			resultToName: (gen, items) => gen.var('items', items),
		}),
	};
	exports.evaluatedPropsToName = evaluatedPropsToName;
	exports.setEvaluated = setEvaluated;
	var snippets = {};
	exports.useFunc = useFunc;
	var Type;
	(function (Type2) {
		Type2[(Type2['Num'] = 0)] = 'Num';
		Type2[(Type2['Str'] = 1)] = 'Str';
	})((Type = exports.Type || (exports.Type = {})));
	exports.getErrorPath = getErrorPath;
	exports.checkStrictMode = checkStrictMode;
});

// ../../../node_modules/ajv/dist/compile/names.js
var require_names = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var names = {
		data: new codegen_1.Name('data'),
		valCxt: new codegen_1.Name('valCxt'),
		instancePath: new codegen_1.Name('instancePath'),
		parentData: new codegen_1.Name('parentData'),
		parentDataProperty: new codegen_1.Name('parentDataProperty'),
		rootData: new codegen_1.Name('rootData'),
		dynamicAnchors: new codegen_1.Name('dynamicAnchors'),
		vErrors: new codegen_1.Name('vErrors'),
		errors: new codegen_1.Name('errors'),
		this: new codegen_1.Name('this'),
		self: new codegen_1.Name('self'),
		scope: new codegen_1.Name('scope'),
		json: new codegen_1.Name('json'),
		jsonPos: new codegen_1.Name('jsonPos'),
		jsonLen: new codegen_1.Name('jsonLen'),
		jsonPart: new codegen_1.Name('jsonPart'),
	};
	exports.default = names;
});

// ../../../node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS((exports) => {
	var reportError = function (
		cxt,
		error = exports.keywordError,
		errorPaths,
		overrideAllErrors
	) {
		const { it } = cxt;
		const { gen, compositeRule, allErrors } = it;
		const errObj = errorObjectCode(cxt, error, errorPaths);
		if (
			overrideAllErrors !== null && overrideAllErrors !== undefined
				? overrideAllErrors
				: compositeRule || allErrors
		) {
			addError(gen, errObj);
		} else {
			returnErrors(it, (0, codegen_1._)`[${errObj}]`);
		}
	};
	var reportExtraError = function (
		cxt,
		error = exports.keywordError,
		errorPaths
	) {
		const { it } = cxt;
		const { gen, compositeRule, allErrors } = it;
		const errObj = errorObjectCode(cxt, error, errorPaths);
		addError(gen, errObj);
		if (!(compositeRule || allErrors)) {
			returnErrors(it, names_1.default.vErrors);
		}
	};
	var resetErrorsCount = function (gen, errsCount) {
		gen.assign(names_1.default.errors, errsCount);
		gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () =>
			gen.if(
				errsCount,
				() =>
					gen.assign(
						(0, codegen_1._)`${names_1.default.vErrors}.length`,
						errsCount
					),
				() => gen.assign(names_1.default.vErrors, null)
			)
		);
	};
	var extendErrors = function ({
		gen,
		keyword,
		schemaValue,
		data,
		errsCount,
		it,
	}) {
		if (errsCount === undefined)
			throw new Error('ajv implementation error');
		const err = gen.name('err');
		gen.forRange('i', errsCount, names_1.default.errors, (i) => {
			gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
			gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () =>
				gen.assign(
					(0, codegen_1._)`${err}.instancePath`,
					(0, codegen_1.strConcat)(
						names_1.default.instancePath,
						it.errorPath
					)
				)
			);
			gen.assign(
				(0, codegen_1._)`${err}.schemaPath`,
				(0, codegen_1.str)`${it.errSchemaPath}/${keyword}`
			);
			if (it.opts.verbose) {
				gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
				gen.assign((0, codegen_1._)`${err}.data`, data);
			}
		});
	};
	var addError = function (gen, errObj) {
		const err = gen.const('err', errObj);
		gen.if(
			(0, codegen_1._)`${names_1.default.vErrors} === null`,
			() =>
				gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`),
			(0, codegen_1._)`${names_1.default.vErrors}.push(${err})`
		);
		gen.code((0, codegen_1._)`${names_1.default.errors}++`);
	};
	var returnErrors = function (it, errs) {
		const { gen, validateName, schemaEnv } = it;
		if (schemaEnv.$async) {
			gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
		} else {
			gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
			gen.return(false);
		}
	};
	var errorObjectCode = function (cxt, error, errorPaths) {
		const { createErrors } = cxt.it;
		if (createErrors === false) return (0, codegen_1._)`{}`;
		return errorObject(cxt, error, errorPaths);
	};
	var errorObject = function (cxt, error, errorPaths = {}) {
		const { gen, it } = cxt;
		const keyValues = [
			errorInstancePath(it, errorPaths),
			errorSchemaPath(cxt, errorPaths),
		];
		extraErrorProps(cxt, error, keyValues);
		return gen.object(...keyValues);
	};
	var errorInstancePath = function ({ errorPath }, { instancePath }) {
		const instPath = instancePath
			? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(
					instancePath,
					util_1.Type.Str
			  )}`
			: errorPath;
		return [
			names_1.default.instancePath,
			(0, codegen_1.strConcat)(names_1.default.instancePath, instPath),
		];
	};
	var errorSchemaPath = function (
		{ keyword, it: { errSchemaPath } },
		{ schemaPath, parentSchema }
	) {
		let schPath = parentSchema
			? errSchemaPath
			: (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
		if (schemaPath) {
			schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(
				schemaPath,
				util_1.Type.Str
			)}`;
		}
		return [E.schemaPath, schPath];
	};
	var extraErrorProps = function (cxt, { params, message }, keyValues) {
		const { keyword, data, schemaValue, it } = cxt;
		const { opts, propertyName, topSchemaRef, schemaPath } = it;
		keyValues.push(
			[E.keyword, keyword],
			[
				E.params,
				typeof params == 'function'
					? params(cxt)
					: params || (0, codegen_1._)`{}`,
			]
		);
		if (opts.messages) {
			keyValues.push([
				E.message,
				typeof message == 'function' ? message(cxt) : message,
			]);
		}
		if (opts.verbose) {
			keyValues.push(
				[E.schema, schemaValue],
				[
					E.parentSchema,
					(0, codegen_1._)`${topSchemaRef}${schemaPath}`,
				],
				[names_1.default.data, data]
			);
		}
		if (propertyName) keyValues.push([E.propertyName, propertyName]);
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.extendErrors =
		exports.resetErrorsCount =
		exports.reportExtraError =
		exports.reportError =
		exports.keyword$DataError =
		exports.keywordError =
			undefined;
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var names_1 = require_names();
	exports.keywordError = {
		message: ({ keyword }) =>
			(0, codegen_1.str)`must pass "${keyword}" keyword validation`,
	};
	exports.keyword$DataError = {
		message: ({ keyword, schemaType }) =>
			schemaType
				? (0,
				  codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)`
				: (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`,
	};
	exports.reportError = reportError;
	exports.reportExtraError = reportExtraError;
	exports.resetErrorsCount = resetErrorsCount;
	exports.extendErrors = extendErrors;
	var E = {
		keyword: new codegen_1.Name('keyword'),
		schemaPath: new codegen_1.Name('schemaPath'),
		params: new codegen_1.Name('params'),
		propertyName: new codegen_1.Name('propertyName'),
		message: new codegen_1.Name('message'),
		schema: new codegen_1.Name('schema'),
		parentSchema: new codegen_1.Name('parentSchema'),
	};
});

// ../../../node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS((exports) => {
	var topBoolOrEmptySchema = function (it) {
		const { gen, schema, validateName } = it;
		if (schema === false) {
			falseSchemaError(it, false);
		} else if (typeof schema == 'object' && schema.$async === true) {
			gen.return(names_1.default.data);
		} else {
			gen.assign((0, codegen_1._)`${validateName}.errors`, null);
			gen.return(true);
		}
	};
	var boolOrEmptySchema = function (it, valid) {
		const { gen, schema } = it;
		if (schema === false) {
			gen.var(valid, false);
			falseSchemaError(it);
		} else {
			gen.var(valid, true);
		}
	};
	var falseSchemaError = function (it, overrideAllErrors) {
		const { gen, data } = it;
		const cxt = {
			gen,
			keyword: 'false schema',
			data,
			schema: false,
			schemaCode: false,
			schemaValue: false,
			params: {},
			it,
		};
		(0, errors_1.reportError)(cxt, boolError, undefined, overrideAllErrors);
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = undefined;
	var errors_1 = require_errors();
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var boolError = {
		message: 'boolean schema is false',
	};
	exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
	exports.boolOrEmptySchema = boolOrEmptySchema;
});

// ../../../node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS((exports) => {
	var isJSONType = function (x) {
		return typeof x == 'string' && jsonTypes.has(x);
	};
	var getRules = function () {
		const groups = {
			number: { type: 'number', rules: [] },
			string: { type: 'string', rules: [] },
			array: { type: 'array', rules: [] },
			object: { type: 'object', rules: [] },
		};
		return {
			types: { ...groups, integer: true, boolean: true, null: true },
			rules: [
				{ rules: [] },
				groups.number,
				groups.string,
				groups.array,
				groups.object,
			],
			post: { rules: [] },
			all: {},
			keywords: {},
		};
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.getRules = exports.isJSONType = undefined;
	var _jsonTypes = [
		'string',
		'number',
		'integer',
		'boolean',
		'null',
		'object',
		'array',
	];
	var jsonTypes = new Set(_jsonTypes);
	exports.isJSONType = isJSONType;
	exports.getRules = getRules;
});

// ../../../node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS((exports) => {
	var schemaHasRulesForType = function ({ schema, self: self2 }, type) {
		const group = self2.RULES.types[type];
		return group && group !== true && shouldUseGroup(schema, group);
	};
	var shouldUseGroup = function (schema, group) {
		return group.rules.some((rule) => shouldUseRule(schema, rule));
	};
	var shouldUseRule = function (schema, rule) {
		var _a;
		return (
			schema[rule.keyword] !== undefined ||
			((_a = rule.definition.implements) === null || _a === undefined
				? undefined
				: _a.some((kwd) => schema[kwd] !== undefined))
		);
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.shouldUseRule =
		exports.shouldUseGroup =
		exports.schemaHasRulesForType =
			undefined;
	exports.schemaHasRulesForType = schemaHasRulesForType;
	exports.shouldUseGroup = shouldUseGroup;
	exports.shouldUseRule = shouldUseRule;
});

// ../../../node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS((exports) => {
	var getSchemaTypes = function (schema) {
		const types5 = getJSONTypes(schema.type);
		const hasNull = types5.includes('null');
		if (hasNull) {
			if (schema.nullable === false)
				throw new Error('type: null contradicts nullable: false');
		} else {
			if (!types5.length && schema.nullable !== undefined) {
				throw new Error('"nullable" cannot be used without "type"');
			}
			if (schema.nullable === true) types5.push('null');
		}
		return types5;
	};
	var getJSONTypes = function (ts) {
		const types5 = Array.isArray(ts) ? ts : ts ? [ts] : [];
		if (types5.every(rules_1.isJSONType)) return types5;
		throw new Error(
			'type must be JSONType or JSONType[]: ' + types5.join(',')
		);
	};
	var coerceAndCheckDataType = function (it, types5) {
		const { gen, data, opts } = it;
		const coerceTo = coerceToTypes(types5, opts.coerceTypes);
		const checkTypes =
			types5.length > 0 &&
			!(
				coerceTo.length === 0 &&
				types5.length === 1 &&
				(0, applicability_1.schemaHasRulesForType)(it, types5[0])
			);
		if (checkTypes) {
			const wrongType = checkDataTypes(
				types5,
				data,
				opts.strictNumbers,
				DataType.Wrong
			);
			gen.if(wrongType, () => {
				if (coerceTo.length) coerceData(it, types5, coerceTo);
				else reportTypeError(it);
			});
		}
		return checkTypes;
	};
	var coerceToTypes = function (types5, coerceTypes) {
		return coerceTypes
			? types5.filter(
					(t) =>
						COERCIBLE.has(t) ||
						(coerceTypes === 'array' && t === 'array')
			  )
			: [];
	};
	var coerceData = function (it, types5, coerceTo) {
		const { gen, data, opts } = it;
		const dataType = gen.let('dataType', (0, codegen_1._)`typeof ${data}`);
		const coerced = gen.let('coerced', (0, codegen_1._)`undefined`);
		if (opts.coerceTypes === 'array') {
			gen.if(
				(0,
				codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`,
				() =>
					gen
						.assign(data, (0, codegen_1._)`${data}[0]`)
						.assign(dataType, (0, codegen_1._)`typeof ${data}`)
						.if(
							checkDataTypes(types5, data, opts.strictNumbers),
							() => gen.assign(coerced, data)
						)
			);
		}
		gen.if((0, codegen_1._)`${coerced} !== undefined`);
		for (const t of coerceTo) {
			if (
				COERCIBLE.has(t) ||
				(t === 'array' && opts.coerceTypes === 'array')
			) {
				coerceSpecificType(t);
			}
		}
		gen.else();
		reportTypeError(it);
		gen.endIf();
		gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
			gen.assign(data, coerced);
			assignParentData(it, coerced);
		});
		function coerceSpecificType(t) {
			switch (t) {
				case 'string':
					gen.elseIf(
						(0,
						codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`
					)
						.assign(coerced, (0, codegen_1._)`"" + ${data}`)
						.elseIf((0, codegen_1._)`${data} === null`)
						.assign(coerced, (0, codegen_1._)`""`);
					return;
				case 'number':
					gen.elseIf(
						(0,
						codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`
					).assign(coerced, (0, codegen_1._)`+${data}`);
					return;
				case 'integer':
					gen.elseIf(
						(0,
						codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`
					).assign(coerced, (0, codegen_1._)`+${data}`);
					return;
				case 'boolean':
					gen.elseIf(
						(0,
						codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`
					)
						.assign(coerced, false)
						.elseIf(
							(0,
							codegen_1._)`${data} === "true" || ${data} === 1`
						)
						.assign(coerced, true);
					return;
				case 'null':
					gen.elseIf(
						(0,
						codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`
					);
					gen.assign(coerced, null);
					return;
				case 'array':
					gen.elseIf(
						(0,
						codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`
					).assign(coerced, (0, codegen_1._)`[${data}]`);
			}
		}
	};
	var assignParentData = function (
		{ gen, parentData, parentDataProperty },
		expr
	) {
		gen.if((0, codegen_1._)`${parentData} !== undefined`, () =>
			gen.assign(
				(0, codegen_1._)`${parentData}[${parentDataProperty}]`,
				expr
			)
		);
	};
	var checkDataType = function (
		dataType,
		data,
		strictNums,
		correct = DataType.Correct
	) {
		const EQ =
			correct === DataType.Correct
				? codegen_1.operators.EQ
				: codegen_1.operators.NEQ;
		let cond;
		switch (dataType) {
			case 'null':
				return (0, codegen_1._)`${data} ${EQ} null`;
			case 'array':
				cond = (0, codegen_1._)`Array.isArray(${data})`;
				break;
			case 'object':
				cond = (0,
				codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
				break;
			case 'integer':
				cond = numCond(
					(0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`
				);
				break;
			case 'number':
				cond = numCond();
				break;
			default:
				return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
		}
		return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
		function numCond(_cond = codegen_1.nil) {
			return (0, codegen_1.and)(
				(0, codegen_1._)`typeof ${data} == "number"`,
				_cond,
				strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil
			);
		}
	};
	var checkDataTypes = function (dataTypes, data, strictNums, correct) {
		if (dataTypes.length === 1) {
			return checkDataType(dataTypes[0], data, strictNums, correct);
		}
		let cond;
		const types5 = (0, util_1.toHash)(dataTypes);
		if (types5.array && types5.object) {
			const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
			cond = types5.null
				? notObj
				: (0, codegen_1._)`!${data} || ${notObj}`;
			delete types5.null;
			delete types5.array;
			delete types5.object;
		} else {
			cond = codegen_1.nil;
		}
		if (types5.number) delete types5.integer;
		for (const t in types5)
			cond = (0, codegen_1.and)(
				cond,
				checkDataType(t, data, strictNums, correct)
			);
		return cond;
	};
	var reportTypeError = function (it) {
		const cxt = getTypeErrorContext(it);
		(0, errors_1.reportError)(cxt, typeError);
	};
	var getTypeErrorContext = function (it) {
		const { gen, data, schema } = it;
		const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, 'type');
		return {
			gen,
			keyword: 'type',
			data,
			schema: schema.type,
			schemaCode,
			schemaValue: schemaCode,
			parentSchema: schema,
			params: {},
			it,
		};
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.reportTypeError =
		exports.checkDataTypes =
		exports.checkDataType =
		exports.coerceAndCheckDataType =
		exports.getJSONTypes =
		exports.getSchemaTypes =
		exports.DataType =
			undefined;
	var rules_1 = require_rules();
	var applicability_1 = require_applicability();
	var errors_1 = require_errors();
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var DataType;
	(function (DataType2) {
		DataType2[(DataType2['Correct'] = 0)] = 'Correct';
		DataType2[(DataType2['Wrong'] = 1)] = 'Wrong';
	})((DataType = exports.DataType || (exports.DataType = {})));
	exports.getSchemaTypes = getSchemaTypes;
	exports.getJSONTypes = getJSONTypes;
	exports.coerceAndCheckDataType = coerceAndCheckDataType;
	var COERCIBLE = new Set(['string', 'number', 'integer', 'boolean', 'null']);
	exports.checkDataType = checkDataType;
	exports.checkDataTypes = checkDataTypes;
	var typeError = {
		message: ({ schema }) => `must be ${schema}`,
		params: ({ schema, schemaValue }) =>
			typeof schema == 'string'
				? (0, codegen_1._)`{type: ${schema}}`
				: (0, codegen_1._)`{type: ${schemaValue}}`,
	};
	exports.reportTypeError = reportTypeError;
});

// ../../../node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS((exports) => {
	var assignDefaults = function (it, ty) {
		const { properties, items } = it.schema;
		if (ty === 'object' && properties) {
			for (const key in properties) {
				assignDefault(it, key, properties[key].default);
			}
		} else if (ty === 'array' && Array.isArray(items)) {
			items.forEach((sch, i) => assignDefault(it, i, sch.default));
		}
	};
	var assignDefault = function (it, prop, defaultValue) {
		const { gen, compositeRule, data, opts } = it;
		if (defaultValue === undefined) return;
		const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(
			prop
		)}`;
		if (compositeRule) {
			(0, util_1.checkStrictMode)(
				it,
				`default is ignored for: ${childData}`
			);
			return;
		}
		let condition = (0, codegen_1._)`${childData} === undefined`;
		if (opts.useDefaults === 'empty') {
			condition = (0,
			codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
		}
		gen.if(
			condition,
			(0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(
				defaultValue
			)}`
		);
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.assignDefaults = undefined;
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	exports.assignDefaults = assignDefaults;
});

// ../../../node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS((exports) => {
	var checkReportMissingProp = function (cxt, prop) {
		const { gen, data, it } = cxt;
		gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
			cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
			cxt.error();
		});
	};
	var checkMissingProp = function (
		{ gen, data, it: { opts } },
		properties,
		missing
	) {
		return (0, codegen_1.or)(
			...properties.map((prop) =>
				(0, codegen_1.and)(
					noPropertyInData(gen, data, prop, opts.ownProperties),
					(0, codegen_1._)`${missing} = ${prop}`
				)
			)
		);
	};
	var reportMissingProp = function (cxt, missing) {
		cxt.setParams({ missingProperty: missing }, true);
		cxt.error();
	};
	var hasPropFunc = function (gen) {
		return gen.scopeValue('func', {
			ref: Object.prototype.hasOwnProperty,
			code: (0, codegen_1._)`Object.prototype.hasOwnProperty`,
		});
	};
	var isOwnProperty = function (gen, data, property) {
		return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
	};
	var propertyInData = function (gen, data, property, ownProperties) {
		const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(
			property
		)} !== undefined`;
		return ownProperties
			? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}`
			: cond;
	};
	var noPropertyInData = function (gen, data, property, ownProperties) {
		const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(
			property
		)} === undefined`;
		return ownProperties
			? (0, codegen_1.or)(
					cond,
					(0, codegen_1.not)(isOwnProperty(gen, data, property))
			  )
			: cond;
	};
	var allSchemaProperties = function (schemaMap) {
		return schemaMap
			? Object.keys(schemaMap).filter((p) => p !== '__proto__')
			: [];
	};
	var schemaProperties = function (it, schemaMap) {
		return allSchemaProperties(schemaMap).filter(
			(p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p])
		);
	};
	var callValidateCode = function (
		{
			schemaCode,
			data,
			it: { gen, topSchemaRef, schemaPath, errorPath },
			it,
		},
		func,
		context,
		passSchema
	) {
		const dataAndSchema = passSchema
			? (0,
			  codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}`
			: data;
		const valCxt = [
			[
				names_1.default.instancePath,
				(0, codegen_1.strConcat)(
					names_1.default.instancePath,
					errorPath
				),
			],
			[names_1.default.parentData, it.parentData],
			[names_1.default.parentDataProperty, it.parentDataProperty],
			[names_1.default.rootData, names_1.default.rootData],
		];
		if (it.opts.dynamicRef)
			valCxt.push([
				names_1.default.dynamicAnchors,
				names_1.default.dynamicAnchors,
			]);
		const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(
			...valCxt
		)}`;
		return context !== codegen_1.nil
			? (0, codegen_1._)`${func}.call(${context}, ${args})`
			: (0, codegen_1._)`${func}(${args})`;
	};
	var usePattern = function ({ gen, it: { opts } }, pattern) {
		const u = opts.unicodeRegExp ? 'u' : '';
		const { regExp } = opts.code;
		const rx = regExp(pattern, u);
		return gen.scopeValue('pattern', {
			key: rx.toString(),
			ref: rx,
			code: (0, codegen_1._)`${
				regExp.code === 'new RegExp'
					? newRegExp
					: (0, util_2.useFunc)(gen, regExp)
			}(${pattern}, ${u})`,
		});
	};
	var validateArray = function (cxt) {
		const { gen, data, keyword, it } = cxt;
		const valid = gen.name('valid');
		if (it.allErrors) {
			const validArr = gen.let('valid', true);
			validateItems(() => gen.assign(validArr, false));
			return validArr;
		}
		gen.var(valid, true);
		validateItems(() => gen.break());
		return valid;
		function validateItems(notValid) {
			const len = gen.const('len', (0, codegen_1._)`${data}.length`);
			gen.forRange('i', 0, len, (i) => {
				cxt.subschema(
					{
						keyword,
						dataProp: i,
						dataPropType: util_1.Type.Num,
					},
					valid
				);
				gen.if((0, codegen_1.not)(valid), notValid);
			});
		}
	};
	var validateUnion = function (cxt) {
		const { gen, schema, keyword, it } = cxt;
		if (!Array.isArray(schema)) throw new Error('ajv implementation error');
		const alwaysValid = schema.some((sch) =>
			(0, util_1.alwaysValidSchema)(it, sch)
		);
		if (alwaysValid && !it.opts.unevaluated) return;
		const valid = gen.let('valid', false);
		const schValid = gen.name('_valid');
		gen.block(() =>
			schema.forEach((_sch, i) => {
				const schCxt = cxt.subschema(
					{
						keyword,
						schemaProp: i,
						compositeRule: true,
					},
					schValid
				);
				gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
				const merged = cxt.mergeValidEvaluated(schCxt, schValid);
				if (!merged) gen.if((0, codegen_1.not)(valid));
			})
		);
		cxt.result(
			valid,
			() => cxt.reset(),
			() => cxt.error(true)
		);
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.validateUnion =
		exports.validateArray =
		exports.usePattern =
		exports.callValidateCode =
		exports.schemaProperties =
		exports.allSchemaProperties =
		exports.noPropertyInData =
		exports.propertyInData =
		exports.isOwnProperty =
		exports.hasPropFunc =
		exports.reportMissingProp =
		exports.checkMissingProp =
		exports.checkReportMissingProp =
			undefined;
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var names_1 = require_names();
	var util_2 = require_util();
	exports.checkReportMissingProp = checkReportMissingProp;
	exports.checkMissingProp = checkMissingProp;
	exports.reportMissingProp = reportMissingProp;
	exports.hasPropFunc = hasPropFunc;
	exports.isOwnProperty = isOwnProperty;
	exports.propertyInData = propertyInData;
	exports.noPropertyInData = noPropertyInData;
	exports.allSchemaProperties = allSchemaProperties;
	exports.schemaProperties = schemaProperties;
	exports.callValidateCode = callValidateCode;
	var newRegExp = (0, codegen_1._)`new RegExp`;
	exports.usePattern = usePattern;
	exports.validateArray = validateArray;
	exports.validateUnion = validateUnion;
});

// ../../../node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS((exports) => {
	var macroKeywordCode = function (cxt, def) {
		const { gen, keyword, schema, parentSchema, it } = cxt;
		const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
		const schemaRef = useKeyword(gen, keyword, macroSchema);
		if (it.opts.validateSchema !== false)
			it.self.validateSchema(macroSchema, true);
		const valid = gen.name('valid');
		cxt.subschema(
			{
				schema: macroSchema,
				schemaPath: codegen_1.nil,
				errSchemaPath: `${it.errSchemaPath}/${keyword}`,
				topSchemaRef: schemaRef,
				compositeRule: true,
			},
			valid
		);
		cxt.pass(valid, () => cxt.error(true));
	};
	var funcKeywordCode = function (cxt, def) {
		var _a;
		const { gen, keyword, schema, parentSchema, $data, it } = cxt;
		checkAsyncKeyword(it, def);
		const validate =
			!$data && def.compile
				? def.compile.call(it.self, schema, parentSchema, it)
				: def.validate;
		const validateRef = useKeyword(gen, keyword, validate);
		const valid = gen.let('valid');
		cxt.block$data(valid, validateKeyword);
		cxt.ok((_a = def.valid) !== null && _a !== undefined ? _a : valid);
		function validateKeyword() {
			if (def.errors === false) {
				assignValid();
				if (def.modifying) modifyData(cxt);
				reportErrs(() => cxt.error());
			} else {
				const ruleErrs = def.async ? validateAsync() : validateSync();
				if (def.modifying) modifyData(cxt);
				reportErrs(() => addErrs(cxt, ruleErrs));
			}
		}
		function validateAsync() {
			const ruleErrs = gen.let('ruleErrs', null);
			gen.try(
				() => assignValid((0, codegen_1._)`await `),
				(e) =>
					gen.assign(valid, false).if(
						(0, codegen_1._)`${e} instanceof ${it.ValidationError}`,
						() =>
							gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`),
						() => gen.throw(e)
					)
			);
			return ruleErrs;
		}
		function validateSync() {
			const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
			gen.assign(validateErrs, null);
			assignValid(codegen_1.nil);
			return validateErrs;
		}
		function assignValid(
			_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil
		) {
			const passCxt = it.opts.passContext
				? names_1.default.this
				: names_1.default.self;
			const passSchema = !(
				('compile' in def && !$data) ||
				def.schema === false
			);
			gen.assign(
				valid,
				(0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(
					cxt,
					validateRef,
					passCxt,
					passSchema
				)}`,
				def.modifying
			);
		}
		function reportErrs(errors) {
			var _a2;
			gen.if(
				(0, codegen_1.not)(
					(_a2 = def.valid) !== null && _a2 !== undefined
						? _a2
						: valid
				),
				errors
			);
		}
	};
	var modifyData = function (cxt) {
		const { gen, data, it } = cxt;
		gen.if(it.parentData, () =>
			gen.assign(
				data,
				(0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`
			)
		);
	};
	var addErrs = function (cxt, errs) {
		const { gen } = cxt;
		gen.if(
			(0, codegen_1._)`Array.isArray(${errs})`,
			() => {
				gen.assign(
					names_1.default.vErrors,
					(0,
					codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`
				).assign(
					names_1.default.errors,
					(0, codegen_1._)`${names_1.default.vErrors}.length`
				);
				(0, errors_1.extendErrors)(cxt);
			},
			() => cxt.error()
		);
	};
	var checkAsyncKeyword = function ({ schemaEnv }, def) {
		if (def.async && !schemaEnv.$async)
			throw new Error('async keyword in sync schema');
	};
	var useKeyword = function (gen, keyword, result) {
		if (result === undefined)
			throw new Error(`keyword "${keyword}" failed to compile`);
		return gen.scopeValue(
			'keyword',
			typeof result == 'function'
				? { ref: result }
				: { ref: result, code: (0, codegen_1.stringify)(result) }
		);
	};
	var validSchemaType = function (
		schema,
		schemaType,
		allowUndefined = false
	) {
		return (
			!schemaType.length ||
			schemaType.some((st) =>
				st === 'array'
					? Array.isArray(schema)
					: st === 'object'
					? schema &&
					  typeof schema == 'object' &&
					  !Array.isArray(schema)
					: typeof schema == st ||
					  (allowUndefined && typeof schema == 'undefined')
			)
		);
	};
	var validateKeywordUsage = function (
		{ schema, opts, self: self2, errSchemaPath },
		def,
		keyword
	) {
		if (
			Array.isArray(def.keyword)
				? !def.keyword.includes(keyword)
				: def.keyword !== keyword
		) {
			throw new Error('ajv implementation error');
		}
		const deps = def.dependencies;
		if (
			deps === null || deps === undefined
				? undefined
				: deps.some(
						(kwd) =>
							!Object.prototype.hasOwnProperty.call(schema, kwd)
				  )
		) {
			throw new Error(
				`parent schema must have dependencies of ${keyword}: ${deps.join(
					','
				)}`
			);
		}
		if (def.validateSchema) {
			const valid = def.validateSchema(schema[keyword]);
			if (!valid) {
				const msg =
					`keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` +
					self2.errorsText(def.validateSchema.errors);
				if (opts.validateSchema === 'log') self2.logger.error(msg);
				else throw new Error(msg);
			}
		}
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.validateKeywordUsage =
		exports.validSchemaType =
		exports.funcKeywordCode =
		exports.macroKeywordCode =
			undefined;
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var code_1 = require_code2();
	var errors_1 = require_errors();
	exports.macroKeywordCode = macroKeywordCode;
	exports.funcKeywordCode = funcKeywordCode;
	exports.validSchemaType = validSchemaType;
	exports.validateKeywordUsage = validateKeywordUsage;
});

// ../../../node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS((exports) => {
	var getSubschema = function (
		it,
		{ keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }
	) {
		if (keyword !== undefined && schema !== undefined) {
			throw new Error(
				'both "keyword" and "schema" passed, only one allowed'
			);
		}
		if (keyword !== undefined) {
			const sch = it.schema[keyword];
			return schemaProp === undefined
				? {
						schema: sch,
						schemaPath: (0, codegen_1._)`${it.schemaPath}${(0,
						codegen_1.getProperty)(keyword)}`,
						errSchemaPath: `${it.errSchemaPath}/${keyword}`,
				  }
				: {
						schema: sch[schemaProp],
						schemaPath: (0, codegen_1._)`${it.schemaPath}${(0,
						codegen_1.getProperty)(keyword)}${(0,
						codegen_1.getProperty)(schemaProp)}`,
						errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0,
						util_1.escapeFragment)(schemaProp)}`,
				  };
		}
		if (schema !== undefined) {
			if (
				schemaPath === undefined ||
				errSchemaPath === undefined ||
				topSchemaRef === undefined
			) {
				throw new Error(
					'"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"'
				);
			}
			return {
				schema,
				schemaPath,
				topSchemaRef,
				errSchemaPath,
			};
		}
		throw new Error('either "keyword" or "schema" must be passed');
	};
	var extendSubschemaData = function (
		subschema,
		it,
		{ dataProp, dataPropType: dpType, data, dataTypes, propertyName }
	) {
		if (data !== undefined && dataProp !== undefined) {
			throw new Error(
				'both "data" and "dataProp" passed, only one allowed'
			);
		}
		const { gen } = it;
		if (dataProp !== undefined) {
			const { errorPath, dataPathArr, opts } = it;
			const nextData = gen.let(
				'data',
				(0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(
					dataProp
				)}`,
				true
			);
			dataContextProps(nextData);
			subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0,
			util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
			subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
			subschema.dataPathArr = [
				...dataPathArr,
				subschema.parentDataProperty,
			];
		}
		if (data !== undefined) {
			const nextData =
				data instanceof codegen_1.Name
					? data
					: gen.let('data', data, true);
			dataContextProps(nextData);
			if (propertyName !== undefined)
				subschema.propertyName = propertyName;
		}
		if (dataTypes) subschema.dataTypes = dataTypes;
		function dataContextProps(_nextData) {
			subschema.data = _nextData;
			subschema.dataLevel = it.dataLevel + 1;
			subschema.dataTypes = [];
			it.definedProperties = new Set();
			subschema.parentData = it.data;
			subschema.dataNames = [...it.dataNames, _nextData];
		}
	};
	var extendSubschemaMode = function (
		subschema,
		{
			jtdDiscriminator,
			jtdMetadata,
			compositeRule,
			createErrors,
			allErrors,
		}
	) {
		if (compositeRule !== undefined)
			subschema.compositeRule = compositeRule;
		if (createErrors !== undefined) subschema.createErrors = createErrors;
		if (allErrors !== undefined) subschema.allErrors = allErrors;
		subschema.jtdDiscriminator = jtdDiscriminator;
		subschema.jtdMetadata = jtdMetadata;
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.extendSubschemaMode =
		exports.extendSubschemaData =
		exports.getSubschema =
			undefined;
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	exports.getSubschema = getSubschema;
	exports.extendSubschemaData = extendSubschemaData;
	exports.extendSubschemaMode = extendSubschemaMode;
});

// ../../../node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS((exports, module) => {
	module.exports = function equal(a, b) {
		if (a === b) return true;
		if (a && b && typeof a == 'object' && typeof b == 'object') {
			if (a.constructor !== b.constructor) return false;
			var length, i, keys;
			if (Array.isArray(a)) {
				length = a.length;
				if (length != b.length) return false;
				for (i = length; i-- !== 0; )
					if (!equal(a[i], b[i])) return false;
				return true;
			}
			if (a.constructor === RegExp)
				return a.source === b.source && a.flags === b.flags;
			if (a.valueOf !== Object.prototype.valueOf)
				return a.valueOf() === b.valueOf();
			if (a.toString !== Object.prototype.toString)
				return a.toString() === b.toString();
			keys = Object.keys(a);
			length = keys.length;
			if (length !== Object.keys(b).length) return false;
			for (i = length; i-- !== 0; )
				if (!Object.prototype.hasOwnProperty.call(b, keys[i]))
					return false;
			for (i = length; i-- !== 0; ) {
				var key = keys[i];
				if (!equal(a[key], b[key])) return false;
			}
			return true;
		}
		return a !== a && b !== b;
	};
});

// ../../../node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS((exports, module) => {
	var _traverse = function (
		opts,
		pre,
		post,
		schema,
		jsonPtr,
		rootSchema,
		parentJsonPtr,
		parentKeyword,
		parentSchema,
		keyIndex
	) {
		if (schema && typeof schema == 'object' && !Array.isArray(schema)) {
			pre(
				schema,
				jsonPtr,
				rootSchema,
				parentJsonPtr,
				parentKeyword,
				parentSchema,
				keyIndex
			);
			for (var key in schema) {
				var sch = schema[key];
				if (Array.isArray(sch)) {
					if (key in traverse.arrayKeywords) {
						for (var i = 0; i < sch.length; i++)
							_traverse(
								opts,
								pre,
								post,
								sch[i],
								jsonPtr + '/' + key + '/' + i,
								rootSchema,
								jsonPtr,
								key,
								schema,
								i
							);
					}
				} else if (key in traverse.propsKeywords) {
					if (sch && typeof sch == 'object') {
						for (var prop in sch)
							_traverse(
								opts,
								pre,
								post,
								sch[prop],
								jsonPtr + '/' + key + '/' + escapeJsonPtr(prop),
								rootSchema,
								jsonPtr,
								key,
								schema,
								prop
							);
					}
				} else if (
					key in traverse.keywords ||
					(opts.allKeys && !(key in traverse.skipKeywords))
				) {
					_traverse(
						opts,
						pre,
						post,
						sch,
						jsonPtr + '/' + key,
						rootSchema,
						jsonPtr,
						key,
						schema
					);
				}
			}
			post(
				schema,
				jsonPtr,
				rootSchema,
				parentJsonPtr,
				parentKeyword,
				parentSchema,
				keyIndex
			);
		}
	};
	var escapeJsonPtr = function (str) {
		return str.replace(/~/g, '~0').replace(/\//g, '~1');
	};
	var traverse = (module.exports = function (schema, opts, cb) {
		if (typeof opts == 'function') {
			cb = opts;
			opts = {};
		}
		cb = opts.cb || cb;
		var pre = typeof cb == 'function' ? cb : cb.pre || function () {};
		var post = cb.post || function () {};
		_traverse(opts, pre, post, schema, '', schema);
	});
	traverse.keywords = {
		additionalItems: true,
		items: true,
		contains: true,
		additionalProperties: true,
		propertyNames: true,
		not: true,
		if: true,
		then: true,
		else: true,
	};
	traverse.arrayKeywords = {
		items: true,
		allOf: true,
		anyOf: true,
		oneOf: true,
	};
	traverse.propsKeywords = {
		$defs: true,
		definitions: true,
		properties: true,
		patternProperties: true,
		dependencies: true,
	};
	traverse.skipKeywords = {
		default: true,
		enum: true,
		const: true,
		required: true,
		maximum: true,
		minimum: true,
		exclusiveMaximum: true,
		exclusiveMinimum: true,
		multipleOf: true,
		maxLength: true,
		minLength: true,
		pattern: true,
		format: true,
		maxItems: true,
		minItems: true,
		uniqueItems: true,
		maxProperties: true,
		minProperties: true,
	};
});

// ../../../node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS((exports) => {
	var inlineRef = function (schema, limit = true) {
		if (typeof schema == 'boolean') return true;
		if (limit === true) return !hasRef(schema);
		if (!limit) return false;
		return countKeys(schema) <= limit;
	};
	var hasRef = function (schema) {
		for (const key in schema) {
			if (REF_KEYWORDS.has(key)) return true;
			const sch = schema[key];
			if (Array.isArray(sch) && sch.some(hasRef)) return true;
			if (typeof sch == 'object' && hasRef(sch)) return true;
		}
		return false;
	};
	var countKeys = function (schema) {
		let count = 0;
		for (const key in schema) {
			if (key === '$ref') return Infinity;
			count++;
			if (SIMPLE_INLINED.has(key)) continue;
			if (typeof schema[key] == 'object') {
				(0, util_1.eachItem)(
					schema[key],
					(sch) => (count += countKeys(sch))
				);
			}
			if (count === Infinity) return Infinity;
		}
		return count;
	};
	var getFullPath = function (resolver, id = '', normalize) {
		if (normalize !== false) id = normalizeId(id);
		const p = resolver.parse(id);
		return _getFullPath(resolver, p);
	};
	var _getFullPath = function (resolver, p) {
		const serialized = resolver.serialize(p);
		return serialized.split('#')[0] + '#';
	};
	var normalizeId = function (id) {
		return id ? id.replace(TRAILING_SLASH_HASH, '') : '';
	};
	var resolveUrl = function (resolver, baseId, id) {
		id = normalizeId(id);
		return resolver.resolve(baseId, id);
	};
	var getSchemaRefs = function (schema, baseId) {
		if (typeof schema == 'boolean') return {};
		const { schemaId, uriResolver } = this.opts;
		const schId = normalizeId(schema[schemaId] || baseId);
		const baseIds = { '': schId };
		const pathPrefix = getFullPath(uriResolver, schId, false);
		const localRefs = {};
		const schemaRefs = new Set();
		traverse(
			schema,
			{ allKeys: true },
			(sch, jsonPtr, _, parentJsonPtr) => {
				if (parentJsonPtr === undefined) return;
				const fullPath = pathPrefix + jsonPtr;
				let baseId2 = baseIds[parentJsonPtr];
				if (typeof sch[schemaId] == 'string')
					baseId2 = addRef.call(this, sch[schemaId]);
				addAnchor.call(this, sch.$anchor);
				addAnchor.call(this, sch.$dynamicAnchor);
				baseIds[jsonPtr] = baseId2;
				function addRef(ref) {
					const _resolve = this.opts.uriResolver.resolve;
					ref = normalizeId(baseId2 ? _resolve(baseId2, ref) : ref);
					if (schemaRefs.has(ref)) throw ambiguos(ref);
					schemaRefs.add(ref);
					let schOrRef = this.refs[ref];
					if (typeof schOrRef == 'string')
						schOrRef = this.refs[schOrRef];
					if (typeof schOrRef == 'object') {
						checkAmbiguosRef(sch, schOrRef.schema, ref);
					} else if (ref !== normalizeId(fullPath)) {
						if (ref[0] === '#') {
							checkAmbiguosRef(sch, localRefs[ref], ref);
							localRefs[ref] = sch;
						} else {
							this.refs[ref] = fullPath;
						}
					}
					return ref;
				}
				function addAnchor(anchor) {
					if (typeof anchor == 'string') {
						if (!ANCHOR.test(anchor))
							throw new Error(`invalid anchor "${anchor}"`);
						addRef.call(this, `#${anchor}`);
					}
				}
			}
		);
		return localRefs;
		function checkAmbiguosRef(sch1, sch2, ref) {
			if (sch2 !== undefined && !equal(sch1, sch2)) throw ambiguos(ref);
		}
		function ambiguos(ref) {
			return new Error(
				`reference "${ref}" resolves to more than one schema`
			);
		}
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.getSchemaRefs =
		exports.resolveUrl =
		exports.normalizeId =
		exports._getFullPath =
		exports.getFullPath =
		exports.inlineRef =
			undefined;
	var util_1 = require_util();
	var equal = require_fast_deep_equal();
	var traverse = require_json_schema_traverse();
	var SIMPLE_INLINED = new Set([
		'type',
		'format',
		'pattern',
		'maxLength',
		'minLength',
		'maxProperties',
		'minProperties',
		'maxItems',
		'minItems',
		'maximum',
		'minimum',
		'uniqueItems',
		'multipleOf',
		'required',
		'enum',
		'const',
	]);
	exports.inlineRef = inlineRef;
	var REF_KEYWORDS = new Set([
		'$ref',
		'$recursiveRef',
		'$recursiveAnchor',
		'$dynamicRef',
		'$dynamicAnchor',
	]);
	exports.getFullPath = getFullPath;
	exports._getFullPath = _getFullPath;
	var TRAILING_SLASH_HASH = /#\/?$/;
	exports.normalizeId = normalizeId;
	exports.resolveUrl = resolveUrl;
	var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
	exports.getSchemaRefs = getSchemaRefs;
});

// ../../../node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS((exports) => {
	var validateFunctionCode = function (it) {
		if (isSchemaObj(it)) {
			checkKeywords(it);
			if (schemaCxtHasRules(it)) {
				topSchemaObjCode(it);
				return;
			}
		}
		validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
	};
	var validateFunction = function (
		{ gen, validateName, schema, schemaEnv, opts },
		body
	) {
		if (opts.code.es5) {
			gen.func(
				validateName,
				(0,
				codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`,
				schemaEnv.$async,
				() => {
					gen.code(
						(0, codegen_1._)`"use strict"; ${funcSourceUrl(
							schema,
							opts
						)}`
					);
					destructureValCxtES5(gen, opts);
					gen.code(body);
				}
			);
		} else {
			gen.func(
				validateName,
				(0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(
					opts
				)}`,
				schemaEnv.$async,
				() => gen.code(funcSourceUrl(schema, opts)).code(body)
			);
		}
	};
	var destructureValCxt = function (opts) {
		return (0, codegen_1._)`{${names_1.default.instancePath}="", ${
			names_1.default.parentData
		}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${
			names_1.default.data
		}${
			opts.dynamicRef
				? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}`
				: codegen_1.nil
		}}={}`;
	};
	var destructureValCxtES5 = function (gen, opts) {
		gen.if(
			names_1.default.valCxt,
			() => {
				gen.var(
					names_1.default.instancePath,
					(0,
					codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`
				);
				gen.var(
					names_1.default.parentData,
					(0,
					codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`
				);
				gen.var(
					names_1.default.parentDataProperty,
					(0,
					codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`
				);
				gen.var(
					names_1.default.rootData,
					(0,
					codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`
				);
				if (opts.dynamicRef)
					gen.var(
						names_1.default.dynamicAnchors,
						(0,
						codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`
					);
			},
			() => {
				gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
				gen.var(
					names_1.default.parentData,
					(0, codegen_1._)`undefined`
				);
				gen.var(
					names_1.default.parentDataProperty,
					(0, codegen_1._)`undefined`
				);
				gen.var(names_1.default.rootData, names_1.default.data);
				if (opts.dynamicRef)
					gen.var(
						names_1.default.dynamicAnchors,
						(0, codegen_1._)`{}`
					);
			}
		);
	};
	var topSchemaObjCode = function (it) {
		const { schema, opts, gen } = it;
		validateFunction(it, () => {
			if (opts.$comment && schema.$comment) commentKeyword(it);
			checkNoDefault(it);
			gen.let(names_1.default.vErrors, null);
			gen.let(names_1.default.errors, 0);
			if (opts.unevaluated) resetEvaluated(it);
			typeAndKeywords(it);
			returnResults(it);
		});
		return;
	};
	var resetEvaluated = function (it) {
		const { gen, validateName } = it;
		it.evaluated = gen.const(
			'evaluated',
			(0, codegen_1._)`${validateName}.evaluated`
		);
		gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () =>
			gen.assign(
				(0, codegen_1._)`${it.evaluated}.props`,
				(0, codegen_1._)`undefined`
			)
		);
		gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () =>
			gen.assign(
				(0, codegen_1._)`${it.evaluated}.items`,
				(0, codegen_1._)`undefined`
			)
		);
	};
	var funcSourceUrl = function (schema, opts) {
		const schId = typeof schema == 'object' && schema[opts.schemaId];
		return schId && (opts.code.source || opts.code.process)
			? (0, codegen_1._)`/*# sourceURL=${schId} */`
			: codegen_1.nil;
	};
	var subschemaCode = function (it, valid) {
		if (isSchemaObj(it)) {
			checkKeywords(it);
			if (schemaCxtHasRules(it)) {
				subSchemaObjCode(it, valid);
				return;
			}
		}
		(0, boolSchema_1.boolOrEmptySchema)(it, valid);
	};
	var schemaCxtHasRules = function ({ schema, self: self2 }) {
		if (typeof schema == 'boolean') return !schema;
		for (const key in schema) if (self2.RULES.all[key]) return true;
		return false;
	};
	var isSchemaObj = function (it) {
		return typeof it.schema != 'boolean';
	};
	var subSchemaObjCode = function (it, valid) {
		const { schema, gen, opts } = it;
		if (opts.$comment && schema.$comment) commentKeyword(it);
		updateContext(it);
		checkAsyncSchema(it);
		const errsCount = gen.const('_errs', names_1.default.errors);
		typeAndKeywords(it, errsCount);
		gen.var(
			valid,
			(0, codegen_1._)`${errsCount} === ${names_1.default.errors}`
		);
	};
	var checkKeywords = function (it) {
		(0, util_1.checkUnknownRules)(it);
		checkRefsAndKeywords(it);
	};
	var typeAndKeywords = function (it, errsCount) {
		if (it.opts.jtd) return schemaKeywords(it, [], false, errsCount);
		const types5 = (0, dataType_1.getSchemaTypes)(it.schema);
		const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types5);
		schemaKeywords(it, types5, !checkedTypes, errsCount);
	};
	var checkRefsAndKeywords = function (it) {
		const { schema, errSchemaPath, opts, self: self2 } = it;
		if (
			schema.$ref &&
			opts.ignoreKeywordsWithRef &&
			(0, util_1.schemaHasRulesButRef)(schema, self2.RULES)
		) {
			self2.logger.warn(
				`\$ref: keywords ignored in schema at path "${errSchemaPath}"`
			);
		}
	};
	var checkNoDefault = function (it) {
		const { schema, opts } = it;
		if (
			schema.default !== undefined &&
			opts.useDefaults &&
			opts.strictSchema
		) {
			(0, util_1.checkStrictMode)(
				it,
				'default is ignored in the schema root'
			);
		}
	};
	var updateContext = function (it) {
		const schId = it.schema[it.opts.schemaId];
		if (schId)
			it.baseId = (0, resolve_1.resolveUrl)(
				it.opts.uriResolver,
				it.baseId,
				schId
			);
	};
	var checkAsyncSchema = function (it) {
		if (it.schema.$async && !it.schemaEnv.$async)
			throw new Error('async schema in sync schema');
	};
	var commentKeyword = function ({
		gen,
		schemaEnv,
		schema,
		errSchemaPath,
		opts,
	}) {
		const msg = schema.$comment;
		if (opts.$comment === true) {
			gen.code(
				(0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`
			);
		} else if (typeof opts.$comment == 'function') {
			const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
			const rootName = gen.scopeValue('root', { ref: schemaEnv.root });
			gen.code(
				(0,
				codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`
			);
		}
	};
	var returnResults = function (it) {
		const { gen, schemaEnv, validateName, ValidationError, opts } = it;
		if (schemaEnv.$async) {
			gen.if(
				(0, codegen_1._)`${names_1.default.errors} === 0`,
				() => gen.return(names_1.default.data),
				() =>
					gen.throw(
						(0,
						codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`
					)
			);
		} else {
			gen.assign(
				(0, codegen_1._)`${validateName}.errors`,
				names_1.default.vErrors
			);
			if (opts.unevaluated) assignEvaluated(it);
			gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
		}
	};
	var assignEvaluated = function ({ gen, evaluated, props, items }) {
		if (props instanceof codegen_1.Name)
			gen.assign((0, codegen_1._)`${evaluated}.props`, props);
		if (items instanceof codegen_1.Name)
			gen.assign((0, codegen_1._)`${evaluated}.items`, items);
	};
	var schemaKeywords = function (it, types5, typeErrors, errsCount) {
		const { gen, schema, data, allErrors, opts, self: self2 } = it;
		const { RULES } = self2;
		if (
			schema.$ref &&
			(opts.ignoreKeywordsWithRef ||
				!(0, util_1.schemaHasRulesButRef)(schema, RULES))
		) {
			gen.block(() => keywordCode(it, '$ref', RULES.all.$ref.definition));
			return;
		}
		if (!opts.jtd) checkStrictTypes(it, types5);
		gen.block(() => {
			for (const group of RULES.rules) groupKeywords(group);
			groupKeywords(RULES.post);
		});
		function groupKeywords(group) {
			if (!(0, applicability_1.shouldUseGroup)(schema, group)) return;
			if (group.type) {
				gen.if(
					(0, dataType_2.checkDataType)(
						group.type,
						data,
						opts.strictNumbers
					)
				);
				iterateKeywords(it, group);
				if (
					types5.length === 1 &&
					types5[0] === group.type &&
					typeErrors
				) {
					gen.else();
					(0, dataType_2.reportTypeError)(it);
				}
				gen.endIf();
			} else {
				iterateKeywords(it, group);
			}
			if (!allErrors)
				gen.if(
					(0, codegen_1._)`${names_1.default.errors} === ${
						errsCount || 0
					}`
				);
		}
	};
	var iterateKeywords = function (it, group) {
		const {
			gen,
			schema,
			opts: { useDefaults },
		} = it;
		if (useDefaults) (0, defaults_1.assignDefaults)(it, group.type);
		gen.block(() => {
			for (const rule of group.rules) {
				if ((0, applicability_1.shouldUseRule)(schema, rule)) {
					keywordCode(it, rule.keyword, rule.definition, group.type);
				}
			}
		});
	};
	var checkStrictTypes = function (it, types5) {
		if (it.schemaEnv.meta || !it.opts.strictTypes) return;
		checkContextTypes(it, types5);
		if (!it.opts.allowUnionTypes) checkMultipleTypes(it, types5);
		checkKeywordTypes(it, it.dataTypes);
	};
	var checkContextTypes = function (it, types5) {
		if (!types5.length) return;
		if (!it.dataTypes.length) {
			it.dataTypes = types5;
			return;
		}
		types5.forEach((t) => {
			if (!includesType(it.dataTypes, t)) {
				strictTypesError(
					it,
					`type "${t}" not allowed by context "${it.dataTypes.join(
						','
					)}"`
				);
			}
		});
		narrowSchemaTypes(it, types5);
	};
	var checkMultipleTypes = function (it, ts) {
		if (ts.length > 1 && !(ts.length === 2 && ts.includes('null'))) {
			strictTypesError(
				it,
				'use allowUnionTypes to allow union type keyword'
			);
		}
	};
	var checkKeywordTypes = function (it, ts) {
		const rules = it.self.RULES.all;
		for (const keyword in rules) {
			const rule = rules[keyword];
			if (
				typeof rule == 'object' &&
				(0, applicability_1.shouldUseRule)(it.schema, rule)
			) {
				const { type } = rule.definition;
				if (
					type.length &&
					!type.some((t) => hasApplicableType(ts, t))
				) {
					strictTypesError(
						it,
						`missing type "${type.join(
							','
						)}" for keyword "${keyword}"`
					);
				}
			}
		}
	};
	var hasApplicableType = function (schTs, kwdT) {
		return (
			schTs.includes(kwdT) ||
			(kwdT === 'number' && schTs.includes('integer'))
		);
	};
	var includesType = function (ts, t) {
		return ts.includes(t) || (t === 'integer' && ts.includes('number'));
	};
	var narrowSchemaTypes = function (it, withTypes) {
		const ts = [];
		for (const t of it.dataTypes) {
			if (includesType(withTypes, t)) ts.push(t);
			else if (withTypes.includes('integer') && t === 'number')
				ts.push('integer');
		}
		it.dataTypes = ts;
	};
	var strictTypesError = function (it, msg) {
		const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
		msg += ` at "${schemaPath}" (strictTypes)`;
		(0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
	};
	var keywordCode = function (it, keyword, def, ruleType) {
		const cxt = new KeywordCxt(it, def, keyword);
		if ('code' in def) {
			def.code(cxt, ruleType);
		} else if (cxt.$data && def.validate) {
			(0, keyword_1.funcKeywordCode)(cxt, def);
		} else if ('macro' in def) {
			(0, keyword_1.macroKeywordCode)(cxt, def);
		} else if (def.compile || def.validate) {
			(0, keyword_1.funcKeywordCode)(cxt, def);
		}
	};
	var getData = function ($data, { dataLevel, dataNames, dataPathArr }) {
		let jsonPointer;
		let data;
		if ($data === '') return names_1.default.rootData;
		if ($data[0] === '/') {
			if (!JSON_POINTER.test($data))
				throw new Error(`Invalid JSON-pointer: ${$data}`);
			jsonPointer = $data;
			data = names_1.default.rootData;
		} else {
			const matches = RELATIVE_JSON_POINTER.exec($data);
			if (!matches) throw new Error(`Invalid JSON-pointer: ${$data}`);
			const up = +matches[1];
			jsonPointer = matches[2];
			if (jsonPointer === '#') {
				if (up >= dataLevel)
					throw new Error(errorMsg('property/index', up));
				return dataPathArr[dataLevel - up];
			}
			if (up > dataLevel) throw new Error(errorMsg('data', up));
			data = dataNames[dataLevel - up];
			if (!jsonPointer) return data;
		}
		let expr = data;
		const segments = jsonPointer.split('/');
		for (const segment of segments) {
			if (segment) {
				data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(
					(0, util_1.unescapeJsonPointer)(segment)
				)}`;
				expr = (0, codegen_1._)`${expr} && ${data}`;
			}
		}
		return expr;
		function errorMsg(pointerType, up) {
			return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
		}
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.getData =
		exports.KeywordCxt =
		exports.validateFunctionCode =
			undefined;
	var boolSchema_1 = require_boolSchema();
	var dataType_1 = require_dataType();
	var applicability_1 = require_applicability();
	var dataType_2 = require_dataType();
	var defaults_1 = require_defaults();
	var keyword_1 = require_keyword();
	var subschema_1 = require_subschema();
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var resolve_1 = require_resolve();
	var util_1 = require_util();
	var errors_1 = require_errors();
	exports.validateFunctionCode = validateFunctionCode;

	class KeywordCxt {
		constructor(it, def, keyword) {
			(0, keyword_1.validateKeywordUsage)(it, def, keyword);
			this.gen = it.gen;
			this.allErrors = it.allErrors;
			this.keyword = keyword;
			this.data = it.data;
			this.schema = it.schema[keyword];
			this.$data =
				def.$data && it.opts.$data && this.schema && this.schema.$data;
			this.schemaValue = (0, util_1.schemaRefOrVal)(
				it,
				this.schema,
				keyword,
				this.$data
			);
			this.schemaType = def.schemaType;
			this.parentSchema = it.schema;
			this.params = {};
			this.it = it;
			this.def = def;
			if (this.$data) {
				this.schemaCode = it.gen.const(
					'vSchema',
					getData(this.$data, it)
				);
			} else {
				this.schemaCode = this.schemaValue;
				if (
					!(0, keyword_1.validSchemaType)(
						this.schema,
						def.schemaType,
						def.allowUndefined
					)
				) {
					throw new Error(
						`${keyword} value must be ${JSON.stringify(
							def.schemaType
						)}`
					);
				}
			}
			if ('code' in def ? def.trackErrors : def.errors !== false) {
				this.errsCount = it.gen.const('_errs', names_1.default.errors);
			}
		}
		result(condition, successAction, failAction) {
			this.failResult(
				(0, codegen_1.not)(condition),
				successAction,
				failAction
			);
		}
		failResult(condition, successAction, failAction) {
			this.gen.if(condition);
			if (failAction) failAction();
			else this.error();
			if (successAction) {
				this.gen.else();
				successAction();
				if (this.allErrors) this.gen.endIf();
			} else {
				if (this.allErrors) this.gen.endIf();
				else this.gen.else();
			}
		}
		pass(condition, failAction) {
			this.failResult(
				(0, codegen_1.not)(condition),
				undefined,
				failAction
			);
		}
		fail(condition) {
			if (condition === undefined) {
				this.error();
				if (!this.allErrors) this.gen.if(false);
				return;
			}
			this.gen.if(condition);
			this.error();
			if (this.allErrors) this.gen.endIf();
			else this.gen.else();
		}
		fail$data(condition) {
			if (!this.$data) return this.fail(condition);
			const { schemaCode } = this;
			this.fail(
				(0, codegen_1._)`${schemaCode} !== undefined && (${(0,
				codegen_1.or)(this.invalid$data(), condition)})`
			);
		}
		error(append, errorParams, errorPaths) {
			if (errorParams) {
				this.setParams(errorParams);
				this._error(append, errorPaths);
				this.setParams({});
				return;
			}
			this._error(append, errorPaths);
		}
		_error(append, errorPaths) {
			(append ? errors_1.reportExtraError : errors_1.reportError)(
				this,
				this.def.error,
				errorPaths
			);
		}
		$dataError() {
			(0, errors_1.reportError)(
				this,
				this.def.$dataError || errors_1.keyword$DataError
			);
		}
		reset() {
			if (this.errsCount === undefined)
				throw new Error('add "trackErrors" to keyword definition');
			(0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
		}
		ok(cond) {
			if (!this.allErrors) this.gen.if(cond);
		}
		setParams(obj, assign) {
			if (assign) Object.assign(this.params, obj);
			else this.params = obj;
		}
		block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
			this.gen.block(() => {
				this.check$data(valid, $dataValid);
				codeBlock();
			});
		}
		check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
			if (!this.$data) return;
			const { gen, schemaCode, schemaType, def } = this;
			gen.if(
				(0, codegen_1.or)(
					(0, codegen_1._)`${schemaCode} === undefined`,
					$dataValid
				)
			);
			if (valid !== codegen_1.nil) gen.assign(valid, true);
			if (schemaType.length || def.validateSchema) {
				gen.elseIf(this.invalid$data());
				this.$dataError();
				if (valid !== codegen_1.nil) gen.assign(valid, false);
			}
			gen.else();
		}
		invalid$data() {
			const { gen, schemaCode, schemaType, def, it } = this;
			return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
			function wrong$DataType() {
				if (schemaType.length) {
					if (!(schemaCode instanceof codegen_1.Name))
						throw new Error('ajv implementation error');
					const st = Array.isArray(schemaType)
						? schemaType
						: [schemaType];
					return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(
						st,
						schemaCode,
						it.opts.strictNumbers,
						dataType_2.DataType.Wrong
					)}`;
				}
				return codegen_1.nil;
			}
			function invalid$DataSchema() {
				if (def.validateSchema) {
					const validateSchemaRef = gen.scopeValue('validate$data', {
						ref: def.validateSchema,
					});
					return (0,
					codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
				}
				return codegen_1.nil;
			}
		}
		subschema(appl, valid) {
			const subschema = (0, subschema_1.getSubschema)(this.it, appl);
			(0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
			(0, subschema_1.extendSubschemaMode)(subschema, appl);
			const nextContext = {
				...this.it,
				...subschema,
				items: undefined,
				props: undefined,
			};
			subschemaCode(nextContext, valid);
			return nextContext;
		}
		mergeEvaluated(schemaCxt, toName) {
			const { it, gen } = this;
			if (!it.opts.unevaluated) return;
			if (it.props !== true && schemaCxt.props !== undefined) {
				it.props = util_1.mergeEvaluated.props(
					gen,
					schemaCxt.props,
					it.props,
					toName
				);
			}
			if (it.items !== true && schemaCxt.items !== undefined) {
				it.items = util_1.mergeEvaluated.items(
					gen,
					schemaCxt.items,
					it.items,
					toName
				);
			}
		}
		mergeValidEvaluated(schemaCxt, valid) {
			const { it, gen } = this;
			if (
				it.opts.unevaluated &&
				(it.props !== true || it.items !== true)
			) {
				gen.if(valid, () =>
					this.mergeEvaluated(schemaCxt, codegen_1.Name)
				);
				return true;
			}
		}
	}
	exports.KeywordCxt = KeywordCxt;
	var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
	var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
	exports.getData = getData;
});

// ../../../node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });

	class ValidationError extends Error {
		constructor(errors) {
			super('validation failed');
			this.errors = errors;
			this.ajv = this.validation = true;
		}
	}
	exports.default = ValidationError;
});

// ../../../node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var resolve_1 = require_resolve();

	class MissingRefError extends Error {
		constructor(resolver, baseId, ref, msg) {
			super(msg || `can't resolve reference ${ref} from id ${baseId}`);
			this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
			this.missingSchema = (0, resolve_1.normalizeId)(
				(0, resolve_1.getFullPath)(resolver, this.missingRef)
			);
		}
	}
	exports.default = MissingRefError;
});

// ../../../node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS((exports) => {
	var compileSchema = function (sch) {
		const _sch = getCompilingSchema.call(this, sch);
		if (_sch) return _sch;
		const rootId = (0, resolve_1.getFullPath)(
			this.opts.uriResolver,
			sch.root.baseId
		);
		const { es5, lines } = this.opts.code;
		const { ownProperties } = this.opts;
		const gen = new codegen_1.CodeGen(this.scope, {
			es5,
			lines,
			ownProperties,
		});
		let _ValidationError;
		if (sch.$async) {
			_ValidationError = gen.scopeValue('Error', {
				ref: validation_error_1.default,
				code: (0,
				codegen_1._)`require("ajv/dist/runtime/validation_error").default`,
			});
		}
		const validateName = gen.scopeName('validate');
		sch.validateName = validateName;
		const schemaCxt = {
			gen,
			allErrors: this.opts.allErrors,
			data: names_1.default.data,
			parentData: names_1.default.parentData,
			parentDataProperty: names_1.default.parentDataProperty,
			dataNames: [names_1.default.data],
			dataPathArr: [codegen_1.nil],
			dataLevel: 0,
			dataTypes: [],
			definedProperties: new Set(),
			topSchemaRef: gen.scopeValue(
				'schema',
				this.opts.code.source === true
					? {
							ref: sch.schema,
							code: (0, codegen_1.stringify)(sch.schema),
					  }
					: { ref: sch.schema }
			),
			validateName,
			ValidationError: _ValidationError,
			schema: sch.schema,
			schemaEnv: sch,
			rootId,
			baseId: sch.baseId || rootId,
			schemaPath: codegen_1.nil,
			errSchemaPath: sch.schemaPath || (this.opts.jtd ? '' : '#'),
			errorPath: (0, codegen_1._)`""`,
			opts: this.opts,
			self: this,
		};
		let sourceCode;
		try {
			this._compilations.add(sch);
			(0, validate_1.validateFunctionCode)(schemaCxt);
			gen.optimize(this.opts.code.optimize);
			const validateCode = gen.toString();
			sourceCode = `${gen.scopeRefs(
				names_1.default.scope
			)}return ${validateCode}`;
			if (this.opts.code.process)
				sourceCode = this.opts.code.process(sourceCode, sch);
			const makeValidate = new Function(
				`${names_1.default.self}`,
				`${names_1.default.scope}`,
				sourceCode
			);
			const validate = makeValidate(this, this.scope.get());
			this.scope.value(validateName, { ref: validate });
			validate.errors = null;
			validate.schema = sch.schema;
			validate.schemaEnv = sch;
			if (sch.$async) validate.$async = true;
			if (this.opts.code.source === true) {
				validate.source = {
					validateName,
					validateCode,
					scopeValues: gen._values,
				};
			}
			if (this.opts.unevaluated) {
				const { props, items } = schemaCxt;
				validate.evaluated = {
					props: props instanceof codegen_1.Name ? undefined : props,
					items: items instanceof codegen_1.Name ? undefined : items,
					dynamicProps: props instanceof codegen_1.Name,
					dynamicItems: items instanceof codegen_1.Name,
				};
				if (validate.source)
					validate.source.evaluated = (0, codegen_1.stringify)(
						validate.evaluated
					);
			}
			sch.validate = validate;
			return sch;
		} catch (e) {
			delete sch.validate;
			delete sch.validateName;
			if (sourceCode)
				this.logger.error(
					'Error compiling schema, function code:',
					sourceCode
				);
			throw e;
		} finally {
			this._compilations.delete(sch);
		}
	};
	var resolveRef = function (root, baseId, ref) {
		var _a;
		ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
		const schOrFunc = root.refs[ref];
		if (schOrFunc) return schOrFunc;
		let _sch = resolve.call(this, root, ref);
		if (_sch === undefined) {
			const schema =
				(_a = root.localRefs) === null || _a === undefined
					? undefined
					: _a[ref];
			const { schemaId } = this.opts;
			if (schema)
				_sch = new SchemaEnv({ schema, schemaId, root, baseId });
		}
		if (_sch === undefined) return;
		return (root.refs[ref] = inlineOrCompile.call(this, _sch));
	};
	var inlineOrCompile = function (sch) {
		if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
			return sch.schema;
		return sch.validate ? sch : compileSchema.call(this, sch);
	};
	var getCompilingSchema = function (schEnv) {
		for (const sch of this._compilations) {
			if (sameSchemaEnv(sch, schEnv)) return sch;
		}
	};
	var sameSchemaEnv = function (s1, s2) {
		return (
			s1.schema === s2.schema &&
			s1.root === s2.root &&
			s1.baseId === s2.baseId
		);
	};
	var resolve = function (root, ref) {
		let sch;
		while (typeof (sch = this.refs[ref]) == 'string') ref = sch;
		return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
	};
	var resolveSchema = function (root, ref) {
		const p = this.opts.uriResolver.parse(ref);
		const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
		let baseId = (0, resolve_1.getFullPath)(
			this.opts.uriResolver,
			root.baseId,
			undefined
		);
		if (Object.keys(root.schema).length > 0 && refPath === baseId) {
			return getJsonPointer.call(this, p, root);
		}
		const id = (0, resolve_1.normalizeId)(refPath);
		const schOrRef = this.refs[id] || this.schemas[id];
		if (typeof schOrRef == 'string') {
			const sch = resolveSchema.call(this, root, schOrRef);
			if (
				typeof (sch === null || sch === undefined
					? undefined
					: sch.schema) !== 'object'
			)
				return;
			return getJsonPointer.call(this, p, sch);
		}
		if (
			typeof (schOrRef === null || schOrRef === undefined
				? undefined
				: schOrRef.schema) !== 'object'
		)
			return;
		if (!schOrRef.validate) compileSchema.call(this, schOrRef);
		if (id === (0, resolve_1.normalizeId)(ref)) {
			const { schema } = schOrRef;
			const { schemaId } = this.opts;
			const schId = schema[schemaId];
			if (schId)
				baseId = (0, resolve_1.resolveUrl)(
					this.opts.uriResolver,
					baseId,
					schId
				);
			return new SchemaEnv({ schema, schemaId, root, baseId });
		}
		return getJsonPointer.call(this, p, schOrRef);
	};
	var getJsonPointer = function (parsedRef, { baseId, schema, root }) {
		var _a;
		if (
			((_a = parsedRef.fragment) === null || _a === undefined
				? undefined
				: _a[0]) !== '/'
		)
			return;
		for (const part of parsedRef.fragment.slice(1).split('/')) {
			if (typeof schema === 'boolean') return;
			const partSchema = schema[(0, util_1.unescapeFragment)(part)];
			if (partSchema === undefined) return;
			schema = partSchema;
			const schId =
				typeof schema === 'object' && schema[this.opts.schemaId];
			if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
				baseId = (0, resolve_1.resolveUrl)(
					this.opts.uriResolver,
					baseId,
					schId
				);
			}
		}
		let env;
		if (
			typeof schema != 'boolean' &&
			schema.$ref &&
			!(0, util_1.schemaHasRulesButRef)(schema, this.RULES)
		) {
			const $ref = (0, resolve_1.resolveUrl)(
				this.opts.uriResolver,
				baseId,
				schema.$ref
			);
			env = resolveSchema.call(this, root, $ref);
		}
		const { schemaId } = this.opts;
		env = env || new SchemaEnv({ schema, schemaId, root, baseId });
		if (env.schema !== env.root.schema) return env;
		return;
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.resolveSchema =
		exports.getCompilingSchema =
		exports.resolveRef =
		exports.compileSchema =
		exports.SchemaEnv =
			undefined;
	var codegen_1 = require_codegen();
	var validation_error_1 = require_validation_error();
	var names_1 = require_names();
	var resolve_1 = require_resolve();
	var util_1 = require_util();
	var validate_1 = require_validate();

	class SchemaEnv {
		constructor(env) {
			var _a;
			this.refs = {};
			this.dynamicAnchors = {};
			let schema;
			if (typeof env.schema == 'object') schema = env.schema;
			this.schema = env.schema;
			this.schemaId = env.schemaId;
			this.root = env.root || this;
			this.baseId =
				(_a = env.baseId) !== null && _a !== undefined
					? _a
					: (0, resolve_1.normalizeId)(
							schema === null || schema === undefined
								? undefined
								: schema[env.schemaId || '$id']
					  );
			this.schemaPath = env.schemaPath;
			this.localRefs = env.localRefs;
			this.meta = env.meta;
			this.$async =
				schema === null || schema === undefined
					? undefined
					: schema.$async;
			this.refs = {};
		}
	}
	exports.SchemaEnv = SchemaEnv;
	exports.compileSchema = compileSchema;
	exports.resolveRef = resolveRef;
	exports.getCompilingSchema = getCompilingSchema;
	exports.resolveSchema = resolveSchema;
	var PREVENT_SCOPE_CHANGE = new Set([
		'properties',
		'patternProperties',
		'enum',
		'dependencies',
		'definitions',
	]);
});

// ../../../node_modules/ajv/dist/refs/data.json
var require_data = __commonJS((exports, module) => {
	module.exports = {
		$id: 'https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#',
		description:
			'Meta-schema for $data reference (JSON AnySchema extension proposal)',
		type: 'object',
		required: ['$data'],
		properties: {
			$data: {
				type: 'string',
				anyOf: [
					{ format: 'relative-json-pointer' },
					{ format: 'json-pointer' },
				],
			},
		},
		additionalProperties: false,
	};
});

// ../../../node_modules/uri-js/dist/es5/uri.all.js
var require_uri_all = __commonJS((exports, module) => {
	(function (global2, factory) {
		typeof exports === 'object' && typeof module !== 'undefined'
			? factory(exports)
			: typeof define === 'function' && define.amd
			? define(['exports'], factory)
			: factory((global2.URI = global2.URI || {}));
	})(exports, function (exports2) {
		function merge() {
			for (
				var _len = arguments.length, sets = Array(_len), _key = 0;
				_key < _len;
				_key++
			) {
				sets[_key] = arguments[_key];
			}
			if (sets.length > 1) {
				sets[0] = sets[0].slice(0, -1);
				var xl = sets.length - 1;
				for (var x = 1; x < xl; ++x) {
					sets[x] = sets[x].slice(1, -1);
				}
				sets[xl] = sets[xl].slice(1);
				return sets.join('');
			} else {
				return sets[0];
			}
		}
		function subexp(str) {
			return '(?:' + str + ')';
		}
		function typeOf(o) {
			return o === undefined
				? 'undefined'
				: o === null
				? 'null'
				: Object.prototype.toString
						.call(o)
						.split(' ')
						.pop()
						.split(']')
						.shift()
						.toLowerCase();
		}
		function toUpperCase(str) {
			return str.toUpperCase();
		}
		function toArray(obj) {
			return obj !== undefined && obj !== null
				? obj instanceof Array
					? obj
					: typeof obj.length !== 'number' ||
					  obj.split ||
					  obj.setInterval ||
					  obj.call
					? [obj]
					: Array.prototype.slice.call(obj)
				: [];
		}
		function assign(target, source) {
			var obj = target;
			if (source) {
				for (var key in source) {
					obj[key] = source[key];
				}
			}
			return obj;
		}
		function buildExps(isIRI2) {
			var ALPHA$$ = '[A-Za-z]',
				CR$ = '[\\x0D]',
				DIGIT$$ = '[0-9]',
				DQUOTE$$ = '[\\x22]',
				HEXDIG$$2 = merge(DIGIT$$, '[A-Fa-f]'),
				LF$$ = '[\\x0A]',
				SP$$ = '[\\x20]',
				PCT_ENCODED$2 = subexp(
					subexp(
						'%[EFef]' +
							HEXDIG$$2 +
							'%' +
							HEXDIG$$2 +
							HEXDIG$$2 +
							'%' +
							HEXDIG$$2 +
							HEXDIG$$2
					) +
						'|' +
						subexp(
							'%[89A-Fa-f]' +
								HEXDIG$$2 +
								'%' +
								HEXDIG$$2 +
								HEXDIG$$2
						) +
						'|' +
						subexp('%' + HEXDIG$$2 + HEXDIG$$2)
				),
				GEN_DELIMS$$ = '[\\:\\/\\?\\#\\[\\]\\@]',
				SUB_DELIMS$$ = "[\\!\\$\\&\\'\\(\\)\\*\\+\\,\\;\\=]",
				RESERVED$$ = merge(GEN_DELIMS$$, SUB_DELIMS$$),
				UCSCHAR$$ = isIRI2
					? '[\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF]'
					: '[]',
				IPRIVATE$$ = isIRI2 ? '[\\uE000-\\uF8FF]' : '[]',
				UNRESERVED$$2 = merge(
					ALPHA$$,
					DIGIT$$,
					'[\\-\\.\\_\\~]',
					UCSCHAR$$
				),
				SCHEME$ = subexp(
					ALPHA$$ + merge(ALPHA$$, DIGIT$$, '[\\+\\-\\.]') + '*'
				),
				USERINFO$ = subexp(
					subexp(
						PCT_ENCODED$2 +
							'|' +
							merge(UNRESERVED$$2, SUB_DELIMS$$, '[\\:]')
					) + '*'
				),
				DEC_OCTET$ = subexp(
					subexp('25[0-5]') +
						'|' +
						subexp('2[0-4]' + DIGIT$$) +
						'|' +
						subexp('1' + DIGIT$$ + DIGIT$$) +
						'|' +
						subexp('[1-9]' + DIGIT$$) +
						'|' +
						DIGIT$$
				),
				DEC_OCTET_RELAXED$ = subexp(
					subexp('25[0-5]') +
						'|' +
						subexp('2[0-4]' + DIGIT$$) +
						'|' +
						subexp('1' + DIGIT$$ + DIGIT$$) +
						'|' +
						subexp('0?[1-9]' + DIGIT$$) +
						'|0?0?' +
						DIGIT$$
				),
				IPV4ADDRESS$ = subexp(
					DEC_OCTET_RELAXED$ +
						'\\.' +
						DEC_OCTET_RELAXED$ +
						'\\.' +
						DEC_OCTET_RELAXED$ +
						'\\.' +
						DEC_OCTET_RELAXED$
				),
				H16$ = subexp(HEXDIG$$2 + '{1,4}'),
				LS32$ = subexp(
					subexp(H16$ + '\\:' + H16$) + '|' + IPV4ADDRESS$
				),
				IPV6ADDRESS1$ = subexp(subexp(H16$ + '\\:') + '{6}' + LS32$),
				IPV6ADDRESS2$ = subexp(
					'\\:\\:' + subexp(H16$ + '\\:') + '{5}' + LS32$
				),
				IPV6ADDRESS3$ = subexp(
					subexp(H16$) +
						'?\\:\\:' +
						subexp(H16$ + '\\:') +
						'{4}' +
						LS32$
				),
				IPV6ADDRESS4$ = subexp(
					subexp(subexp(H16$ + '\\:') + '{0,1}' + H16$) +
						'?\\:\\:' +
						subexp(H16$ + '\\:') +
						'{3}' +
						LS32$
				),
				IPV6ADDRESS5$ = subexp(
					subexp(subexp(H16$ + '\\:') + '{0,2}' + H16$) +
						'?\\:\\:' +
						subexp(H16$ + '\\:') +
						'{2}' +
						LS32$
				),
				IPV6ADDRESS6$ = subexp(
					subexp(subexp(H16$ + '\\:') + '{0,3}' + H16$) +
						'?\\:\\:' +
						H16$ +
						'\\:' +
						LS32$
				),
				IPV6ADDRESS7$ = subexp(
					subexp(subexp(H16$ + '\\:') + '{0,4}' + H16$) +
						'?\\:\\:' +
						LS32$
				),
				IPV6ADDRESS8$ = subexp(
					subexp(subexp(H16$ + '\\:') + '{0,5}' + H16$) +
						'?\\:\\:' +
						H16$
				),
				IPV6ADDRESS9$ = subexp(
					subexp(subexp(H16$ + '\\:') + '{0,6}' + H16$) + '?\\:\\:'
				),
				IPV6ADDRESS$ = subexp(
					[
						IPV6ADDRESS1$,
						IPV6ADDRESS2$,
						IPV6ADDRESS3$,
						IPV6ADDRESS4$,
						IPV6ADDRESS5$,
						IPV6ADDRESS6$,
						IPV6ADDRESS7$,
						IPV6ADDRESS8$,
						IPV6ADDRESS9$,
					].join('|')
				),
				ZONEID$ = subexp(
					subexp(UNRESERVED$$2 + '|' + PCT_ENCODED$2) + '+'
				),
				IPV6ADDRZ$ = subexp(IPV6ADDRESS$ + '\\%25' + ZONEID$),
				IPV6ADDRZ_RELAXED$ = subexp(
					IPV6ADDRESS$ +
						subexp('\\%25|\\%(?!' + HEXDIG$$2 + '{2})') +
						ZONEID$
				),
				IPVFUTURE$ = subexp(
					'[vV]' +
						HEXDIG$$2 +
						'+\\.' +
						merge(UNRESERVED$$2, SUB_DELIMS$$, '[\\:]') +
						'+'
				),
				IP_LITERAL$ = subexp(
					'\\[' +
						subexp(
							IPV6ADDRZ_RELAXED$ +
								'|' +
								IPV6ADDRESS$ +
								'|' +
								IPVFUTURE$
						) +
						'\\]'
				),
				REG_NAME$ = subexp(
					subexp(
						PCT_ENCODED$2 + '|' + merge(UNRESERVED$$2, SUB_DELIMS$$)
					) + '*'
				),
				HOST$ = subexp(
					IP_LITERAL$ +
						'|' +
						IPV4ADDRESS$ +
						'(?!' +
						REG_NAME$ +
						')|' +
						REG_NAME$
				),
				PORT$ = subexp(DIGIT$$ + '*'),
				AUTHORITY$ = subexp(
					subexp(USERINFO$ + '@') +
						'?' +
						HOST$ +
						subexp('\\:' + PORT$) +
						'?'
				),
				PCHAR$ = subexp(
					PCT_ENCODED$2 +
						'|' +
						merge(UNRESERVED$$2, SUB_DELIMS$$, '[\\:\\@]')
				),
				SEGMENT$ = subexp(PCHAR$ + '*'),
				SEGMENT_NZ$ = subexp(PCHAR$ + '+'),
				SEGMENT_NZ_NC$ = subexp(
					subexp(
						PCT_ENCODED$2 +
							'|' +
							merge(UNRESERVED$$2, SUB_DELIMS$$, '[\\@]')
					) + '+'
				),
				PATH_ABEMPTY$ = subexp(subexp('\\/' + SEGMENT$) + '*'),
				PATH_ABSOLUTE$ = subexp(
					'\\/' + subexp(SEGMENT_NZ$ + PATH_ABEMPTY$) + '?'
				),
				PATH_NOSCHEME$ = subexp(SEGMENT_NZ_NC$ + PATH_ABEMPTY$),
				PATH_ROOTLESS$ = subexp(SEGMENT_NZ$ + PATH_ABEMPTY$),
				PATH_EMPTY$ = '(?!' + PCHAR$ + ')',
				PATH$ = subexp(
					PATH_ABEMPTY$ +
						'|' +
						PATH_ABSOLUTE$ +
						'|' +
						PATH_NOSCHEME$ +
						'|' +
						PATH_ROOTLESS$ +
						'|' +
						PATH_EMPTY$
				),
				QUERY$ = subexp(
					subexp(PCHAR$ + '|' + merge('[\\/\\?]', IPRIVATE$$)) + '*'
				),
				FRAGMENT$ = subexp(subexp(PCHAR$ + '|[\\/\\?]') + '*'),
				HIER_PART$ = subexp(
					subexp('\\/\\/' + AUTHORITY$ + PATH_ABEMPTY$) +
						'|' +
						PATH_ABSOLUTE$ +
						'|' +
						PATH_ROOTLESS$ +
						'|' +
						PATH_EMPTY$
				),
				URI$ = subexp(
					SCHEME$ +
						'\\:' +
						HIER_PART$ +
						subexp('\\?' + QUERY$) +
						'?' +
						subexp('\\#' + FRAGMENT$) +
						'?'
				),
				RELATIVE_PART$ = subexp(
					subexp('\\/\\/' + AUTHORITY$ + PATH_ABEMPTY$) +
						'|' +
						PATH_ABSOLUTE$ +
						'|' +
						PATH_NOSCHEME$ +
						'|' +
						PATH_EMPTY$
				),
				RELATIVE$ = subexp(
					RELATIVE_PART$ +
						subexp('\\?' + QUERY$) +
						'?' +
						subexp('\\#' + FRAGMENT$) +
						'?'
				),
				URI_REFERENCE$ = subexp(URI$ + '|' + RELATIVE$),
				ABSOLUTE_URI$ = subexp(
					SCHEME$ + '\\:' + HIER_PART$ + subexp('\\?' + QUERY$) + '?'
				),
				GENERIC_REF$ =
					'^(' +
					SCHEME$ +
					')\\:' +
					subexp(
						subexp(
							'\\/\\/(' +
								subexp('(' + USERINFO$ + ')@') +
								'?(' +
								HOST$ +
								')' +
								subexp('\\:(' + PORT$ + ')') +
								'?)'
						) +
							'?(' +
							PATH_ABEMPTY$ +
							'|' +
							PATH_ABSOLUTE$ +
							'|' +
							PATH_ROOTLESS$ +
							'|' +
							PATH_EMPTY$ +
							')'
					) +
					subexp('\\?(' + QUERY$ + ')') +
					'?' +
					subexp('\\#(' + FRAGMENT$ + ')') +
					'?$',
				RELATIVE_REF$ =
					'^(){0}' +
					subexp(
						subexp(
							'\\/\\/(' +
								subexp('(' + USERINFO$ + ')@') +
								'?(' +
								HOST$ +
								')' +
								subexp('\\:(' + PORT$ + ')') +
								'?)'
						) +
							'?(' +
							PATH_ABEMPTY$ +
							'|' +
							PATH_ABSOLUTE$ +
							'|' +
							PATH_NOSCHEME$ +
							'|' +
							PATH_EMPTY$ +
							')'
					) +
					subexp('\\?(' + QUERY$ + ')') +
					'?' +
					subexp('\\#(' + FRAGMENT$ + ')') +
					'?$',
				ABSOLUTE_REF$ =
					'^(' +
					SCHEME$ +
					')\\:' +
					subexp(
						subexp(
							'\\/\\/(' +
								subexp('(' + USERINFO$ + ')@') +
								'?(' +
								HOST$ +
								')' +
								subexp('\\:(' + PORT$ + ')') +
								'?)'
						) +
							'?(' +
							PATH_ABEMPTY$ +
							'|' +
							PATH_ABSOLUTE$ +
							'|' +
							PATH_ROOTLESS$ +
							'|' +
							PATH_EMPTY$ +
							')'
					) +
					subexp('\\?(' + QUERY$ + ')') +
					'?$',
				SAMEDOC_REF$ = '^' + subexp('\\#(' + FRAGMENT$ + ')') + '?$',
				AUTHORITY_REF$ =
					'^' +
					subexp('(' + USERINFO$ + ')@') +
					'?(' +
					HOST$ +
					')' +
					subexp('\\:(' + PORT$ + ')') +
					'?$';
			return {
				NOT_SCHEME: new RegExp(
					merge('[^]', ALPHA$$, DIGIT$$, '[\\+\\-\\.]'),
					'g'
				),
				NOT_USERINFO: new RegExp(
					merge('[^\\%\\:]', UNRESERVED$$2, SUB_DELIMS$$),
					'g'
				),
				NOT_HOST: new RegExp(
					merge('[^\\%\\[\\]\\:]', UNRESERVED$$2, SUB_DELIMS$$),
					'g'
				),
				NOT_PATH: new RegExp(
					merge('[^\\%\\/\\:\\@]', UNRESERVED$$2, SUB_DELIMS$$),
					'g'
				),
				NOT_PATH_NOSCHEME: new RegExp(
					merge('[^\\%\\/\\@]', UNRESERVED$$2, SUB_DELIMS$$),
					'g'
				),
				NOT_QUERY: new RegExp(
					merge(
						'[^\\%]',
						UNRESERVED$$2,
						SUB_DELIMS$$,
						'[\\:\\@\\/\\?]',
						IPRIVATE$$
					),
					'g'
				),
				NOT_FRAGMENT: new RegExp(
					merge(
						'[^\\%]',
						UNRESERVED$$2,
						SUB_DELIMS$$,
						'[\\:\\@\\/\\?]'
					),
					'g'
				),
				ESCAPE: new RegExp(
					merge('[^]', UNRESERVED$$2, SUB_DELIMS$$),
					'g'
				),
				UNRESERVED: new RegExp(UNRESERVED$$2, 'g'),
				OTHER_CHARS: new RegExp(
					merge('[^\\%]', UNRESERVED$$2, RESERVED$$),
					'g'
				),
				PCT_ENCODED: new RegExp(PCT_ENCODED$2, 'g'),
				IPV4ADDRESS: new RegExp('^(' + IPV4ADDRESS$ + ')$'),
				IPV6ADDRESS: new RegExp(
					'^\\[?(' +
						IPV6ADDRESS$ +
						')' +
						subexp(
							subexp('\\%25|\\%(?!' + HEXDIG$$2 + '{2})') +
								'(' +
								ZONEID$ +
								')'
						) +
						'?\\]?$'
				),
			};
		}
		var URI_PROTOCOL = buildExps(false);
		var IRI_PROTOCOL = buildExps(true);
		var slicedToArray = (function () {
			function sliceIterator(arr, i) {
				var _arr = [];
				var _n = true;
				var _d = false;
				var _e = undefined;
				try {
					for (
						var _i = arr[Symbol.iterator](), _s;
						!(_n = (_s = _i.next()).done);
						_n = true
					) {
						_arr.push(_s.value);
						if (i && _arr.length === i) break;
					}
				} catch (err) {
					_d = true;
					_e = err;
				} finally {
					try {
						if (!_n && _i['return']) _i['return']();
					} finally {
						if (_d) throw _e;
					}
				}
				return _arr;
			}
			return function (arr, i) {
				if (Array.isArray(arr)) {
					return arr;
				} else if (Symbol.iterator in Object(arr)) {
					return sliceIterator(arr, i);
				} else {
					throw new TypeError(
						'Invalid attempt to destructure non-iterable instance'
					);
				}
			};
		})();
		var toConsumableArray = function (arr) {
			if (Array.isArray(arr)) {
				for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++)
					arr2[i] = arr[i];
				return arr2;
			} else {
				return Array.from(arr);
			}
		};
		var maxInt = 2147483647;
		var base = 36;
		var tMin = 1;
		var tMax = 26;
		var skew = 38;
		var damp = 700;
		var initialBias = 72;
		var initialN = 128;
		var delimiter = '-';
		var regexPunycode = /^xn--/;
		var regexNonASCII = /[^\0-\x7E]/;
		var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
		var errors = {
			overflow: 'Overflow: input needs wider integers to process',
			'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
			'invalid-input': 'Invalid input',
		};
		var baseMinusTMin = base - tMin;
		var floor = Math.floor;
		var stringFromCharCode = String.fromCharCode;
		function error$1(type) {
			throw new RangeError(errors[type]);
		}
		function map(array, fn) {
			var result = [];
			var length = array.length;
			while (length--) {
				result[length] = fn(array[length]);
			}
			return result;
		}
		function mapDomain(string, fn) {
			var parts = string.split('@');
			var result = '';
			if (parts.length > 1) {
				result = parts[0] + '@';
				string = parts[1];
			}
			string = string.replace(regexSeparators, '.');
			var labels = string.split('.');
			var encoded = map(labels, fn).join('.');
			return result + encoded;
		}
		function ucs2decode(string) {
			var output = [];
			var counter = 0;
			var length = string.length;
			while (counter < length) {
				var value = string.charCodeAt(counter++);
				if (value >= 55296 && value <= 56319 && counter < length) {
					var extra = string.charCodeAt(counter++);
					if ((extra & 64512) == 56320) {
						output.push(
							((value & 1023) << 10) + (extra & 1023) + 65536
						);
					} else {
						output.push(value);
						counter--;
					}
				} else {
					output.push(value);
				}
			}
			return output;
		}
		var ucs2encode = function ucs2encode(array) {
			return String.fromCodePoint.apply(String, toConsumableArray(array));
		};
		var basicToDigit = function basicToDigit(codePoint) {
			if (codePoint - 48 < 10) {
				return codePoint - 22;
			}
			if (codePoint - 65 < 26) {
				return codePoint - 65;
			}
			if (codePoint - 97 < 26) {
				return codePoint - 97;
			}
			return base;
		};
		var digitToBasic = function digitToBasic(digit, flag) {
			return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
		};
		var adapt = function adapt(delta, numPoints, firstTime) {
			var k = 0;
			delta = firstTime ? floor(delta / damp) : delta >> 1;
			delta += floor(delta / numPoints);
			for (; delta > (baseMinusTMin * tMax) >> 1; k += base) {
				delta = floor(delta / baseMinusTMin);
			}
			return floor(k + ((baseMinusTMin + 1) * delta) / (delta + skew));
		};
		var decode = function decode(input) {
			var output = [];
			var inputLength = input.length;
			var i = 0;
			var n = initialN;
			var bias = initialBias;
			var basic = input.lastIndexOf(delimiter);
			if (basic < 0) {
				basic = 0;
			}
			for (var j = 0; j < basic; ++j) {
				if (input.charCodeAt(j) >= 128) {
					error$1('not-basic');
				}
				output.push(input.charCodeAt(j));
			}
			for (var index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
				var oldi = i;
				for (var w = 1, k = base; ; k += base) {
					if (index >= inputLength) {
						error$1('invalid-input');
					}
					var digit = basicToDigit(input.charCodeAt(index++));
					if (digit >= base || digit > floor((maxInt - i) / w)) {
						error$1('overflow');
					}
					i += digit * w;
					var t =
						k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
					if (digit < t) {
						break;
					}
					var baseMinusT = base - t;
					if (w > floor(maxInt / baseMinusT)) {
						error$1('overflow');
					}
					w *= baseMinusT;
				}
				var out = output.length + 1;
				bias = adapt(i - oldi, out, oldi == 0);
				if (floor(i / out) > maxInt - n) {
					error$1('overflow');
				}
				n += floor(i / out);
				i %= out;
				output.splice(i++, 0, n);
			}
			return String.fromCodePoint.apply(String, output);
		};
		var encode = function encode(input) {
			var output = [];
			input = ucs2decode(input);
			var inputLength = input.length;
			var n = initialN;
			var delta = 0;
			var bias = initialBias;
			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;
			try {
				for (
					var _iterator = input[Symbol.iterator](), _step;
					!(_iteratorNormalCompletion = (_step = _iterator.next())
						.done);
					_iteratorNormalCompletion = true
				) {
					var _currentValue2 = _step.value;
					if (_currentValue2 < 128) {
						output.push(stringFromCharCode(_currentValue2));
					}
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator.return) {
						_iterator.return();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}
			var basicLength = output.length;
			var handledCPCount = basicLength;
			if (basicLength) {
				output.push(delimiter);
			}
			while (handledCPCount < inputLength) {
				var m = maxInt;
				var _iteratorNormalCompletion2 = true;
				var _didIteratorError2 = false;
				var _iteratorError2 = undefined;
				try {
					for (
						var _iterator2 = input[Symbol.iterator](), _step2;
						!(_iteratorNormalCompletion2 = (_step2 =
							_iterator2.next()).done);
						_iteratorNormalCompletion2 = true
					) {
						var currentValue = _step2.value;
						if (currentValue >= n && currentValue < m) {
							m = currentValue;
						}
					}
				} catch (err) {
					_didIteratorError2 = true;
					_iteratorError2 = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion2 && _iterator2.return) {
							_iterator2.return();
						}
					} finally {
						if (_didIteratorError2) {
							throw _iteratorError2;
						}
					}
				}
				var handledCPCountPlusOne = handledCPCount + 1;
				if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
					error$1('overflow');
				}
				delta += (m - n) * handledCPCountPlusOne;
				n = m;
				var _iteratorNormalCompletion3 = true;
				var _didIteratorError3 = false;
				var _iteratorError3 = undefined;
				try {
					for (
						var _iterator3 = input[Symbol.iterator](), _step3;
						!(_iteratorNormalCompletion3 = (_step3 =
							_iterator3.next()).done);
						_iteratorNormalCompletion3 = true
					) {
						var _currentValue = _step3.value;
						if (_currentValue < n && ++delta > maxInt) {
							error$1('overflow');
						}
						if (_currentValue == n) {
							var q = delta;
							for (var k = base; ; k += base) {
								var t =
									k <= bias
										? tMin
										: k >= bias + tMax
										? tMax
										: k - bias;
								if (q < t) {
									break;
								}
								var qMinusT = q - t;
								var baseMinusT = base - t;
								output.push(
									stringFromCharCode(
										digitToBasic(
											t + (qMinusT % baseMinusT),
											0
										)
									)
								);
								q = floor(qMinusT / baseMinusT);
							}
							output.push(stringFromCharCode(digitToBasic(q, 0)));
							bias = adapt(
								delta,
								handledCPCountPlusOne,
								handledCPCount == basicLength
							);
							delta = 0;
							++handledCPCount;
						}
					}
				} catch (err) {
					_didIteratorError3 = true;
					_iteratorError3 = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion3 && _iterator3.return) {
							_iterator3.return();
						}
					} finally {
						if (_didIteratorError3) {
							throw _iteratorError3;
						}
					}
				}
				++delta;
				++n;
			}
			return output.join('');
		};
		var toUnicode = function toUnicode(input) {
			return mapDomain(input, function (string) {
				return regexPunycode.test(string)
					? decode(string.slice(4).toLowerCase())
					: string;
			});
		};
		var toASCII = function toASCII(input) {
			return mapDomain(input, function (string) {
				return regexNonASCII.test(string)
					? 'xn--' + encode(string)
					: string;
			});
		};
		var punycode = {
			version: '2.1.0',
			ucs2: {
				decode: ucs2decode,
				encode: ucs2encode,
			},
			decode,
			encode,
			toASCII,
			toUnicode,
		};
		var SCHEMES = {};
		function pctEncChar(chr) {
			var c = chr.charCodeAt(0);
			var e = undefined;
			if (c < 16) e = '%0' + c.toString(16).toUpperCase();
			else if (c < 128) e = '%' + c.toString(16).toUpperCase();
			else if (c < 2048)
				e =
					'%' +
					((c >> 6) | 192).toString(16).toUpperCase() +
					'%' +
					((c & 63) | 128).toString(16).toUpperCase();
			else
				e =
					'%' +
					((c >> 12) | 224).toString(16).toUpperCase() +
					'%' +
					(((c >> 6) & 63) | 128).toString(16).toUpperCase() +
					'%' +
					((c & 63) | 128).toString(16).toUpperCase();
			return e;
		}
		function pctDecChars(str) {
			var newStr = '';
			var i = 0;
			var il = str.length;
			while (i < il) {
				var c = parseInt(str.substr(i + 1, 2), 16);
				if (c < 128) {
					newStr += String.fromCharCode(c);
					i += 3;
				} else if (c >= 194 && c < 224) {
					if (il - i >= 6) {
						var c2 = parseInt(str.substr(i + 4, 2), 16);
						newStr += String.fromCharCode(
							((c & 31) << 6) | (c2 & 63)
						);
					} else {
						newStr += str.substr(i, 6);
					}
					i += 6;
				} else if (c >= 224) {
					if (il - i >= 9) {
						var _c = parseInt(str.substr(i + 4, 2), 16);
						var c3 = parseInt(str.substr(i + 7, 2), 16);
						newStr += String.fromCharCode(
							((c & 15) << 12) | ((_c & 63) << 6) | (c3 & 63)
						);
					} else {
						newStr += str.substr(i, 9);
					}
					i += 9;
				} else {
					newStr += str.substr(i, 3);
					i += 3;
				}
			}
			return newStr;
		}
		function _normalizeComponentEncoding(components, protocol) {
			function decodeUnreserved2(str) {
				var decStr = pctDecChars(str);
				return !decStr.match(protocol.UNRESERVED) ? str : decStr;
			}
			if (components.scheme)
				components.scheme = String(components.scheme)
					.replace(protocol.PCT_ENCODED, decodeUnreserved2)
					.toLowerCase()
					.replace(protocol.NOT_SCHEME, '');
			if (components.userinfo !== undefined)
				components.userinfo = String(components.userinfo)
					.replace(protocol.PCT_ENCODED, decodeUnreserved2)
					.replace(protocol.NOT_USERINFO, pctEncChar)
					.replace(protocol.PCT_ENCODED, toUpperCase);
			if (components.host !== undefined)
				components.host = String(components.host)
					.replace(protocol.PCT_ENCODED, decodeUnreserved2)
					.toLowerCase()
					.replace(protocol.NOT_HOST, pctEncChar)
					.replace(protocol.PCT_ENCODED, toUpperCase);
			if (components.path !== undefined)
				components.path = String(components.path)
					.replace(protocol.PCT_ENCODED, decodeUnreserved2)
					.replace(
						components.scheme
							? protocol.NOT_PATH
							: protocol.NOT_PATH_NOSCHEME,
						pctEncChar
					)
					.replace(protocol.PCT_ENCODED, toUpperCase);
			if (components.query !== undefined)
				components.query = String(components.query)
					.replace(protocol.PCT_ENCODED, decodeUnreserved2)
					.replace(protocol.NOT_QUERY, pctEncChar)
					.replace(protocol.PCT_ENCODED, toUpperCase);
			if (components.fragment !== undefined)
				components.fragment = String(components.fragment)
					.replace(protocol.PCT_ENCODED, decodeUnreserved2)
					.replace(protocol.NOT_FRAGMENT, pctEncChar)
					.replace(protocol.PCT_ENCODED, toUpperCase);
			return components;
		}
		function _stripLeadingZeros(str) {
			return str.replace(/^0*(.*)/, '$1') || '0';
		}
		function _normalizeIPv4(host, protocol) {
			var matches = host.match(protocol.IPV4ADDRESS) || [];
			var _matches = slicedToArray(matches, 2),
				address = _matches[1];
			if (address) {
				return address.split('.').map(_stripLeadingZeros).join('.');
			} else {
				return host;
			}
		}
		function _normalizeIPv6(host, protocol) {
			var matches = host.match(protocol.IPV6ADDRESS) || [];
			var _matches2 = slicedToArray(matches, 3),
				address = _matches2[1],
				zone = _matches2[2];
			if (address) {
				var _address$toLowerCase$ = address
						.toLowerCase()
						.split('::')
						.reverse(),
					_address$toLowerCase$2 = slicedToArray(
						_address$toLowerCase$,
						2
					),
					last = _address$toLowerCase$2[0],
					first = _address$toLowerCase$2[1];
				var firstFields = first
					? first.split(':').map(_stripLeadingZeros)
					: [];
				var lastFields = last.split(':').map(_stripLeadingZeros);
				var isLastFieldIPv4Address = protocol.IPV4ADDRESS.test(
					lastFields[lastFields.length - 1]
				);
				var fieldCount = isLastFieldIPv4Address ? 7 : 8;
				var lastFieldsStart = lastFields.length - fieldCount;
				var fields = Array(fieldCount);
				for (var x = 0; x < fieldCount; ++x) {
					fields[x] =
						firstFields[x] || lastFields[lastFieldsStart + x] || '';
				}
				if (isLastFieldIPv4Address) {
					fields[fieldCount - 1] = _normalizeIPv4(
						fields[fieldCount - 1],
						protocol
					);
				}
				var allZeroFields = fields.reduce(function (acc, field, index) {
					if (!field || field === '0') {
						var lastLongest = acc[acc.length - 1];
						if (
							lastLongest &&
							lastLongest.index + lastLongest.length === index
						) {
							lastLongest.length++;
						} else {
							acc.push({ index, length: 1 });
						}
					}
					return acc;
				}, []);
				var longestZeroFields = allZeroFields.sort(function (a, b) {
					return b.length - a.length;
				})[0];
				var newHost = undefined;
				if (longestZeroFields && longestZeroFields.length > 1) {
					var newFirst = fields.slice(0, longestZeroFields.index);
					var newLast = fields.slice(
						longestZeroFields.index + longestZeroFields.length
					);
					newHost = newFirst.join(':') + '::' + newLast.join(':');
				} else {
					newHost = fields.join(':');
				}
				if (zone) {
					newHost += '%' + zone;
				}
				return newHost;
			} else {
				return host;
			}
		}
		var URI_PARSE =
			/^(?:([^:\/?#]+):)?(?:\/\/((?:([^\/?#@]*)@)?(\[[^\/?#\]]+\]|[^\/?#:]*)(?:\:(\d*))?))?([^?#]*)(?:\?([^#]*))?(?:#((?:.|\n|\r)*))?/i;
		var NO_MATCH_IS_UNDEFINED = ''.match(/(){0}/)[1] === undefined;
		function parse2(uriString) {
			var options =
				arguments.length > 1 && arguments[1] !== undefined
					? arguments[1]
					: {};
			var components = {};
			var protocol = options.iri !== false ? IRI_PROTOCOL : URI_PROTOCOL;
			if (options.reference === 'suffix')
				uriString =
					(options.scheme ? options.scheme + ':' : '') +
					'//' +
					uriString;
			var matches = uriString.match(URI_PARSE);
			if (matches) {
				if (NO_MATCH_IS_UNDEFINED) {
					components.scheme = matches[1];
					components.userinfo = matches[3];
					components.host = matches[4];
					components.port = parseInt(matches[5], 10);
					components.path = matches[6] || '';
					components.query = matches[7];
					components.fragment = matches[8];
					if (isNaN(components.port)) {
						components.port = matches[5];
					}
				} else {
					components.scheme = matches[1] || undefined;
					components.userinfo =
						uriString.indexOf('@') !== -1 ? matches[3] : undefined;
					components.host =
						uriString.indexOf('//') !== -1 ? matches[4] : undefined;
					components.port = parseInt(matches[5], 10);
					components.path = matches[6] || '';
					components.query =
						uriString.indexOf('?') !== -1 ? matches[7] : undefined;
					components.fragment =
						uriString.indexOf('#') !== -1 ? matches[8] : undefined;
					if (isNaN(components.port)) {
						components.port = uriString.match(
							/\/\/(?:.|\n)*\:(?:\/|\?|\#|$)/
						)
							? matches[4]
							: undefined;
					}
				}
				if (components.host) {
					components.host = _normalizeIPv6(
						_normalizeIPv4(components.host, protocol),
						protocol
					);
				}
				if (
					components.scheme === undefined &&
					components.userinfo === undefined &&
					components.host === undefined &&
					components.port === undefined &&
					!components.path &&
					components.query === undefined
				) {
					components.reference = 'same-document';
				} else if (components.scheme === undefined) {
					components.reference = 'relative';
				} else if (components.fragment === undefined) {
					components.reference = 'absolute';
				} else {
					components.reference = 'uri';
				}
				if (
					options.reference &&
					options.reference !== 'suffix' &&
					options.reference !== components.reference
				) {
					components.error =
						components.error ||
						'URI is not a ' + options.reference + ' reference.';
				}
				var schemeHandler =
					SCHEMES[
						(
							options.scheme ||
							components.scheme ||
							''
						).toLowerCase()
					];
				if (
					!options.unicodeSupport &&
					(!schemeHandler || !schemeHandler.unicodeSupport)
				) {
					if (
						components.host &&
						(options.domainHost ||
							(schemeHandler && schemeHandler.domainHost))
					) {
						try {
							components.host = punycode.toASCII(
								components.host
									.replace(protocol.PCT_ENCODED, pctDecChars)
									.toLowerCase()
							);
						} catch (e) {
							components.error =
								components.error ||
								"Host's domain name can not be converted to ASCII via punycode: " +
									e;
						}
					}
					_normalizeComponentEncoding(components, URI_PROTOCOL);
				} else {
					_normalizeComponentEncoding(components, protocol);
				}
				if (schemeHandler && schemeHandler.parse) {
					schemeHandler.parse(components, options);
				}
			} else {
				components.error = components.error || 'URI can not be parsed.';
			}
			return components;
		}
		function _recomposeAuthority(components, options) {
			var protocol = options.iri !== false ? IRI_PROTOCOL : URI_PROTOCOL;
			var uriTokens = [];
			if (components.userinfo !== undefined) {
				uriTokens.push(components.userinfo);
				uriTokens.push('@');
			}
			if (components.host !== undefined) {
				uriTokens.push(
					_normalizeIPv6(
						_normalizeIPv4(String(components.host), protocol),
						protocol
					).replace(protocol.IPV6ADDRESS, function (_, $1, $2) {
						return '[' + $1 + ($2 ? '%25' + $2 : '') + ']';
					})
				);
			}
			if (
				typeof components.port === 'number' ||
				typeof components.port === 'string'
			) {
				uriTokens.push(':');
				uriTokens.push(String(components.port));
			}
			return uriTokens.length ? uriTokens.join('') : undefined;
		}
		var RDS1 = /^\.\.?\//;
		var RDS2 = /^\/\.(\/|$)/;
		var RDS3 = /^\/\.\.(\/|$)/;
		var RDS5 = /^\/?(?:.|\n)*?(?=\/|$)/;
		function removeDotSegments(input) {
			var output = [];
			while (input.length) {
				if (input.match(RDS1)) {
					input = input.replace(RDS1, '');
				} else if (input.match(RDS2)) {
					input = input.replace(RDS2, '/');
				} else if (input.match(RDS3)) {
					input = input.replace(RDS3, '/');
					output.pop();
				} else if (input === '.' || input === '..') {
					input = '';
				} else {
					var im = input.match(RDS5);
					if (im) {
						var s = im[0];
						input = input.slice(s.length);
						output.push(s);
					} else {
						throw new Error('Unexpected dot segment condition');
					}
				}
			}
			return output.join('');
		}
		function serialize(components) {
			var options =
				arguments.length > 1 && arguments[1] !== undefined
					? arguments[1]
					: {};
			var protocol = options.iri ? IRI_PROTOCOL : URI_PROTOCOL;
			var uriTokens = [];
			var schemeHandler =
				SCHEMES[
					(options.scheme || components.scheme || '').toLowerCase()
				];
			if (schemeHandler && schemeHandler.serialize)
				schemeHandler.serialize(components, options);
			if (components.host) {
				if (protocol.IPV6ADDRESS.test(components.host)) {
				} else if (
					options.domainHost ||
					(schemeHandler && schemeHandler.domainHost)
				) {
					try {
						components.host = !options.iri
							? punycode.toASCII(
									components.host
										.replace(
											protocol.PCT_ENCODED,
											pctDecChars
										)
										.toLowerCase()
							  )
							: punycode.toUnicode(components.host);
					} catch (e) {
						components.error =
							components.error ||
							"Host's domain name can not be converted to " +
								(!options.iri ? 'ASCII' : 'Unicode') +
								' via punycode: ' +
								e;
					}
				}
			}
			_normalizeComponentEncoding(components, protocol);
			if (options.reference !== 'suffix' && components.scheme) {
				uriTokens.push(components.scheme);
				uriTokens.push(':');
			}
			var authority = _recomposeAuthority(components, options);
			if (authority !== undefined) {
				if (options.reference !== 'suffix') {
					uriTokens.push('//');
				}
				uriTokens.push(authority);
				if (components.path && components.path.charAt(0) !== '/') {
					uriTokens.push('/');
				}
			}
			if (components.path !== undefined) {
				var s = components.path;
				if (
					!options.absolutePath &&
					(!schemeHandler || !schemeHandler.absolutePath)
				) {
					s = removeDotSegments(s);
				}
				if (authority === undefined) {
					s = s.replace(/^\/\//, '/%2F');
				}
				uriTokens.push(s);
			}
			if (components.query !== undefined) {
				uriTokens.push('?');
				uriTokens.push(components.query);
			}
			if (components.fragment !== undefined) {
				uriTokens.push('#');
				uriTokens.push(components.fragment);
			}
			return uriTokens.join('');
		}
		function resolveComponents(base2, relative) {
			var options =
				arguments.length > 2 && arguments[2] !== undefined
					? arguments[2]
					: {};
			var skipNormalization = arguments[3];
			var target = {};
			if (!skipNormalization) {
				base2 = parse2(serialize(base2, options), options);
				relative = parse2(serialize(relative, options), options);
			}
			options = options || {};
			if (!options.tolerant && relative.scheme) {
				target.scheme = relative.scheme;
				target.userinfo = relative.userinfo;
				target.host = relative.host;
				target.port = relative.port;
				target.path = removeDotSegments(relative.path || '');
				target.query = relative.query;
			} else {
				if (
					relative.userinfo !== undefined ||
					relative.host !== undefined ||
					relative.port !== undefined
				) {
					target.userinfo = relative.userinfo;
					target.host = relative.host;
					target.port = relative.port;
					target.path = removeDotSegments(relative.path || '');
					target.query = relative.query;
				} else {
					if (!relative.path) {
						target.path = base2.path;
						if (relative.query !== undefined) {
							target.query = relative.query;
						} else {
							target.query = base2.query;
						}
					} else {
						if (relative.path.charAt(0) === '/') {
							target.path = removeDotSegments(relative.path);
						} else {
							if (
								(base2.userinfo !== undefined ||
									base2.host !== undefined ||
									base2.port !== undefined) &&
								!base2.path
							) {
								target.path = '/' + relative.path;
							} else if (!base2.path) {
								target.path = relative.path;
							} else {
								target.path =
									base2.path.slice(
										0,
										base2.path.lastIndexOf('/') + 1
									) + relative.path;
							}
							target.path = removeDotSegments(target.path);
						}
						target.query = relative.query;
					}
					target.userinfo = base2.userinfo;
					target.host = base2.host;
					target.port = base2.port;
				}
				target.scheme = base2.scheme;
			}
			target.fragment = relative.fragment;
			return target;
		}
		function resolve(baseURI, relativeURI, options) {
			var schemelessOptions = assign({ scheme: 'null' }, options);
			return serialize(
				resolveComponents(
					parse2(baseURI, schemelessOptions),
					parse2(relativeURI, schemelessOptions),
					schemelessOptions,
					true
				),
				schemelessOptions
			);
		}
		function normalize(uri, options) {
			if (typeof uri === 'string') {
				uri = serialize(parse2(uri, options), options);
			} else if (typeOf(uri) === 'object') {
				uri = parse2(serialize(uri, options), options);
			}
			return uri;
		}
		function equal(uriA, uriB, options) {
			if (typeof uriA === 'string') {
				uriA = serialize(parse2(uriA, options), options);
			} else if (typeOf(uriA) === 'object') {
				uriA = serialize(uriA, options);
			}
			if (typeof uriB === 'string') {
				uriB = serialize(parse2(uriB, options), options);
			} else if (typeOf(uriB) === 'object') {
				uriB = serialize(uriB, options);
			}
			return uriA === uriB;
		}
		function escapeComponent(str, options) {
			return (
				str &&
				str
					.toString()
					.replace(
						!options || !options.iri
							? URI_PROTOCOL.ESCAPE
							: IRI_PROTOCOL.ESCAPE,
						pctEncChar
					)
			);
		}
		function unescapeComponent(str, options) {
			return (
				str &&
				str
					.toString()
					.replace(
						!options || !options.iri
							? URI_PROTOCOL.PCT_ENCODED
							: IRI_PROTOCOL.PCT_ENCODED,
						pctDecChars
					)
			);
		}
		var handler2 = {
			scheme: 'http',
			domainHost: true,
			parse: function parse(components, options) {
				if (!components.host) {
					components.error =
						components.error || 'HTTP URIs must have a host.';
				}
				return components;
			},
			serialize: function serialize(components, options) {
				var secure =
					String(components.scheme).toLowerCase() === 'https';
				if (
					components.port === (secure ? 443 : 80) ||
					components.port === ''
				) {
					components.port = undefined;
				}
				if (!components.path) {
					components.path = '/';
				}
				return components;
			},
		};
		var handler$1 = {
			scheme: 'https',
			domainHost: handler2.domainHost,
			parse: handler2.parse,
			serialize: handler2.serialize,
		};
		function isSecure(wsComponents) {
			return typeof wsComponents.secure === 'boolean'
				? wsComponents.secure
				: String(wsComponents.scheme).toLowerCase() === 'wss';
		}
		var handler$2 = {
			scheme: 'ws',
			domainHost: true,
			parse: function parse(components, options) {
				var wsComponents = components;
				wsComponents.secure = isSecure(wsComponents);
				wsComponents.resourceName =
					(wsComponents.path || '/') +
					(wsComponents.query ? '?' + wsComponents.query : '');
				wsComponents.path = undefined;
				wsComponents.query = undefined;
				return wsComponents;
			},
			serialize: function serialize(wsComponents, options) {
				if (
					wsComponents.port === (isSecure(wsComponents) ? 443 : 80) ||
					wsComponents.port === ''
				) {
					wsComponents.port = undefined;
				}
				if (typeof wsComponents.secure === 'boolean') {
					wsComponents.scheme = wsComponents.secure ? 'wss' : 'ws';
					wsComponents.secure = undefined;
				}
				if (wsComponents.resourceName) {
					var _wsComponents$resourc =
							wsComponents.resourceName.split('?'),
						_wsComponents$resourc2 = slicedToArray(
							_wsComponents$resourc,
							2
						),
						path = _wsComponents$resourc2[0],
						query = _wsComponents$resourc2[1];
					wsComponents.path = path && path !== '/' ? path : undefined;
					wsComponents.query = query;
					wsComponents.resourceName = undefined;
				}
				wsComponents.fragment = undefined;
				return wsComponents;
			},
		};
		var handler$3 = {
			scheme: 'wss',
			domainHost: handler$2.domainHost,
			parse: handler$2.parse,
			serialize: handler$2.serialize,
		};
		var O = {};
		var isIRI = true;
		var UNRESERVED$$ =
			'[A-Za-z0-9\\-\\.\\_\\~' +
			(isIRI
				? '\\xA0-\\u200D\\u2010-\\u2029\\u202F-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF'
				: '') +
			']';
		var HEXDIG$$ = '[0-9A-Fa-f]';
		var PCT_ENCODED$ = subexp(
			subexp(
				'%[EFef]' +
					HEXDIG$$ +
					'%' +
					HEXDIG$$ +
					HEXDIG$$ +
					'%' +
					HEXDIG$$ +
					HEXDIG$$
			) +
				'|' +
				subexp('%[89A-Fa-f]' + HEXDIG$$ + '%' + HEXDIG$$ + HEXDIG$$) +
				'|' +
				subexp('%' + HEXDIG$$ + HEXDIG$$)
		);
		var ATEXT$$ = "[A-Za-z0-9\\!\\$\\%\\'\\*\\+\\-\\^\\_\\`\\{\\|\\}\\~]";
		var QTEXT$$ =
			"[\\!\\$\\%\\'\\(\\)\\*\\+\\,\\-\\.0-9\\<\\>A-Z\\x5E-\\x7E]";
		var VCHAR$$ = merge(QTEXT$$, '[\\"\\\\]');
		var SOME_DELIMS$$ = "[\\!\\$\\'\\(\\)\\*\\+\\,\\;\\:\\@]";
		var UNRESERVED = new RegExp(UNRESERVED$$, 'g');
		var PCT_ENCODED = new RegExp(PCT_ENCODED$, 'g');
		var NOT_LOCAL_PART = new RegExp(
			merge('[^]', ATEXT$$, '[\\.]', '[\\"]', VCHAR$$),
			'g'
		);
		var NOT_HFNAME = new RegExp(
			merge('[^]', UNRESERVED$$, SOME_DELIMS$$),
			'g'
		);
		var NOT_HFVALUE = NOT_HFNAME;
		function decodeUnreserved(str) {
			var decStr = pctDecChars(str);
			return !decStr.match(UNRESERVED) ? str : decStr;
		}
		var handler$4 = {
			scheme: 'mailto',
			parse: function parse$$1(components, options) {
				var mailtoComponents = components;
				var to = (mailtoComponents.to = mailtoComponents.path
					? mailtoComponents.path.split(',')
					: []);
				mailtoComponents.path = undefined;
				if (mailtoComponents.query) {
					var unknownHeaders = false;
					var headers = {};
					var hfields = mailtoComponents.query.split('&');
					for (var x = 0, xl = hfields.length; x < xl; ++x) {
						var hfield = hfields[x].split('=');
						switch (hfield[0]) {
							case 'to':
								var toAddrs = hfield[1].split(',');
								for (
									var _x = 0, _xl = toAddrs.length;
									_x < _xl;
									++_x
								) {
									to.push(toAddrs[_x]);
								}
								break;
							case 'subject':
								mailtoComponents.subject = unescapeComponent(
									hfield[1],
									options
								);
								break;
							case 'body':
								mailtoComponents.body = unescapeComponent(
									hfield[1],
									options
								);
								break;
							default:
								unknownHeaders = true;
								headers[unescapeComponent(hfield[0], options)] =
									unescapeComponent(hfield[1], options);
								break;
						}
					}
					if (unknownHeaders) mailtoComponents.headers = headers;
				}
				mailtoComponents.query = undefined;
				for (var _x2 = 0, _xl2 = to.length; _x2 < _xl2; ++_x2) {
					var addr = to[_x2].split('@');
					addr[0] = unescapeComponent(addr[0]);
					if (!options.unicodeSupport) {
						try {
							addr[1] = punycode.toASCII(
								unescapeComponent(
									addr[1],
									options
								).toLowerCase()
							);
						} catch (e) {
							mailtoComponents.error =
								mailtoComponents.error ||
								"Email address's domain name can not be converted to ASCII via punycode: " +
									e;
						}
					} else {
						addr[1] = unescapeComponent(
							addr[1],
							options
						).toLowerCase();
					}
					to[_x2] = addr.join('@');
				}
				return mailtoComponents;
			},
			serialize: function serialize$$1(mailtoComponents, options) {
				var components = mailtoComponents;
				var to = toArray(mailtoComponents.to);
				if (to) {
					for (var x = 0, xl = to.length; x < xl; ++x) {
						var toAddr = String(to[x]);
						var atIdx = toAddr.lastIndexOf('@');
						var localPart = toAddr
							.slice(0, atIdx)
							.replace(PCT_ENCODED, decodeUnreserved)
							.replace(PCT_ENCODED, toUpperCase)
							.replace(NOT_LOCAL_PART, pctEncChar);
						var domain = toAddr.slice(atIdx + 1);
						try {
							domain = !options.iri
								? punycode.toASCII(
										unescapeComponent(
											domain,
											options
										).toLowerCase()
								  )
								: punycode.toUnicode(domain);
						} catch (e) {
							components.error =
								components.error ||
								"Email address's domain name can not be converted to " +
									(!options.iri ? 'ASCII' : 'Unicode') +
									' via punycode: ' +
									e;
						}
						to[x] = localPart + '@' + domain;
					}
					components.path = to.join(',');
				}
				var headers = (mailtoComponents.headers =
					mailtoComponents.headers || {});
				if (mailtoComponents.subject)
					headers['subject'] = mailtoComponents.subject;
				if (mailtoComponents.body)
					headers['body'] = mailtoComponents.body;
				var fields = [];
				for (var name in headers) {
					if (headers[name] !== O[name]) {
						fields.push(
							name
								.replace(PCT_ENCODED, decodeUnreserved)
								.replace(PCT_ENCODED, toUpperCase)
								.replace(NOT_HFNAME, pctEncChar) +
								'=' +
								headers[name]
									.replace(PCT_ENCODED, decodeUnreserved)
									.replace(PCT_ENCODED, toUpperCase)
									.replace(NOT_HFVALUE, pctEncChar)
						);
					}
				}
				if (fields.length) {
					components.query = fields.join('&');
				}
				return components;
			},
		};
		var URN_PARSE = /^([^\:]+)\:(.*)/;
		var handler$5 = {
			scheme: 'urn',
			parse: function parse$$1(components, options) {
				var matches =
					components.path && components.path.match(URN_PARSE);
				var urnComponents = components;
				if (matches) {
					var scheme =
						options.scheme || urnComponents.scheme || 'urn';
					var nid = matches[1].toLowerCase();
					var nss = matches[2];
					var urnScheme = scheme + ':' + (options.nid || nid);
					var schemeHandler = SCHEMES[urnScheme];
					urnComponents.nid = nid;
					urnComponents.nss = nss;
					urnComponents.path = undefined;
					if (schemeHandler) {
						urnComponents = schemeHandler.parse(
							urnComponents,
							options
						);
					}
				} else {
					urnComponents.error =
						urnComponents.error || 'URN can not be parsed.';
				}
				return urnComponents;
			},
			serialize: function serialize$$1(urnComponents, options) {
				var scheme = options.scheme || urnComponents.scheme || 'urn';
				var nid = urnComponents.nid;
				var urnScheme = scheme + ':' + (options.nid || nid);
				var schemeHandler = SCHEMES[urnScheme];
				if (schemeHandler) {
					urnComponents = schemeHandler.serialize(
						urnComponents,
						options
					);
				}
				var uriComponents = urnComponents;
				var nss = urnComponents.nss;
				uriComponents.path = (nid || options.nid) + ':' + nss;
				return uriComponents;
			},
		};
		var UUID = /^[0-9A-Fa-f]{8}(?:\-[0-9A-Fa-f]{4}){3}\-[0-9A-Fa-f]{12}$/;
		var handler$6 = {
			scheme: 'urn:uuid',
			parse: function parse(urnComponents, options) {
				var uuidComponents = urnComponents;
				uuidComponents.uuid = uuidComponents.nss;
				uuidComponents.nss = undefined;
				if (
					!options.tolerant &&
					(!uuidComponents.uuid || !uuidComponents.uuid.match(UUID))
				) {
					uuidComponents.error =
						uuidComponents.error || 'UUID is not valid.';
				}
				return uuidComponents;
			},
			serialize: function serialize(uuidComponents, options) {
				var urnComponents = uuidComponents;
				urnComponents.nss = (uuidComponents.uuid || '').toLowerCase();
				return urnComponents;
			},
		};
		SCHEMES[handler2.scheme] = handler2;
		SCHEMES[handler$1.scheme] = handler$1;
		SCHEMES[handler$2.scheme] = handler$2;
		SCHEMES[handler$3.scheme] = handler$3;
		SCHEMES[handler$4.scheme] = handler$4;
		SCHEMES[handler$5.scheme] = handler$5;
		SCHEMES[handler$6.scheme] = handler$6;
		exports2.SCHEMES = SCHEMES;
		exports2.pctEncChar = pctEncChar;
		exports2.pctDecChars = pctDecChars;
		exports2.parse = parse2;
		exports2.removeDotSegments = removeDotSegments;
		exports2.serialize = serialize;
		exports2.resolveComponents = resolveComponents;
		exports2.resolve = resolve;
		exports2.normalize = normalize;
		exports2.equal = equal;
		exports2.escapeComponent = escapeComponent;
		exports2.unescapeComponent = unescapeComponent;
		Object.defineProperty(exports2, '__esModule', { value: true });
	});
});

// ../../../node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var uri = require_uri_all();
	uri.code = 'require("ajv/dist/runtime/uri").default';
	exports.default = uri;
});

// ../../../node_modules/ajv/dist/core.js
var require_core = __commonJS((exports) => {
	var requiredOptions = function (o) {
		var _a,
			_b,
			_c,
			_d,
			_e,
			_f,
			_g,
			_h,
			_j,
			_k,
			_l,
			_m,
			_o,
			_p,
			_q,
			_r,
			_s,
			_t,
			_u,
			_v,
			_w,
			_x,
			_y,
			_z,
			_0;
		const s = o.strict;
		const _optz =
			(_a = o.code) === null || _a === undefined
				? undefined
				: _a.optimize;
		const optimize = _optz === true || _optz === undefined ? 1 : _optz || 0;
		const regExp =
			(_c =
				(_b = o.code) === null || _b === undefined
					? undefined
					: _b.regExp) !== null && _c !== undefined
				? _c
				: defaultRegExp;
		const uriResolver =
			(_d = o.uriResolver) !== null && _d !== undefined
				? _d
				: uri_1.default;
		return {
			strictSchema:
				(_f =
					(_e = o.strictSchema) !== null && _e !== undefined
						? _e
						: s) !== null && _f !== undefined
					? _f
					: true,
			strictNumbers:
				(_h =
					(_g = o.strictNumbers) !== null && _g !== undefined
						? _g
						: s) !== null && _h !== undefined
					? _h
					: true,
			strictTypes:
				(_k =
					(_j = o.strictTypes) !== null && _j !== undefined
						? _j
						: s) !== null && _k !== undefined
					? _k
					: 'log',
			strictTuples:
				(_m =
					(_l = o.strictTuples) !== null && _l !== undefined
						? _l
						: s) !== null && _m !== undefined
					? _m
					: 'log',
			strictRequired:
				(_p =
					(_o = o.strictRequired) !== null && _o !== undefined
						? _o
						: s) !== null && _p !== undefined
					? _p
					: false,
			code: o.code
				? { ...o.code, optimize, regExp }
				: { optimize, regExp },
			loopRequired:
				(_q = o.loopRequired) !== null && _q !== undefined
					? _q
					: MAX_EXPRESSION,
			loopEnum:
				(_r = o.loopEnum) !== null && _r !== undefined
					? _r
					: MAX_EXPRESSION,
			meta: (_s = o.meta) !== null && _s !== undefined ? _s : true,
			messages:
				(_t = o.messages) !== null && _t !== undefined ? _t : true,
			inlineRefs:
				(_u = o.inlineRefs) !== null && _u !== undefined ? _u : true,
			schemaId:
				(_v = o.schemaId) !== null && _v !== undefined ? _v : '$id',
			addUsedSchema:
				(_w = o.addUsedSchema) !== null && _w !== undefined ? _w : true,
			validateSchema:
				(_x = o.validateSchema) !== null && _x !== undefined
					? _x
					: true,
			validateFormats:
				(_y = o.validateFormats) !== null && _y !== undefined
					? _y
					: true,
			unicodeRegExp:
				(_z = o.unicodeRegExp) !== null && _z !== undefined ? _z : true,
			int32range:
				(_0 = o.int32range) !== null && _0 !== undefined ? _0 : true,
			uriResolver,
		};
	};
	var checkOptions = function (checkOpts, options, msg, log = 'error') {
		for (const key in checkOpts) {
			const opt = key;
			if (opt in options)
				this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
		}
	};
	var getSchEnv = function (keyRef) {
		keyRef = (0, resolve_1.normalizeId)(keyRef);
		return this.schemas[keyRef] || this.refs[keyRef];
	};
	var addInitialSchemas = function () {
		const optsSchemas = this.opts.schemas;
		if (!optsSchemas) return;
		if (Array.isArray(optsSchemas)) this.addSchema(optsSchemas);
		else
			for (const key in optsSchemas)
				this.addSchema(optsSchemas[key], key);
	};
	var addInitialFormats = function () {
		for (const name in this.opts.formats) {
			const format = this.opts.formats[name];
			if (format) this.addFormat(name, format);
		}
	};
	var addInitialKeywords = function (defs) {
		if (Array.isArray(defs)) {
			this.addVocabulary(defs);
			return;
		}
		this.logger.warn('keywords option as map is deprecated, pass array');
		for (const keyword in defs) {
			const def = defs[keyword];
			if (!def.keyword) def.keyword = keyword;
			this.addKeyword(def);
		}
	};
	var getMetaSchemaOptions = function () {
		const metaOpts = { ...this.opts };
		for (const opt of META_IGNORE_OPTIONS) delete metaOpts[opt];
		return metaOpts;
	};
	var getLogger = function (logger17) {
		if (logger17 === false) return noLogs;
		if (logger17 === undefined) return console;
		if (logger17.log && logger17.warn && logger17.error) return logger17;
		throw new Error('logger must implement log, warn and error methods');
	};
	var checkKeyword = function (keyword, def) {
		const { RULES } = this;
		(0, util_1.eachItem)(keyword, (kwd) => {
			if (RULES.keywords[kwd])
				throw new Error(`Keyword ${kwd} is already defined`);
			if (!KEYWORD_NAME.test(kwd))
				throw new Error(`Keyword ${kwd} has invalid name`);
		});
		if (!def) return;
		if (def.$data && !('code' in def || 'validate' in def)) {
			throw new Error(
				'$data keyword must have "code" or "validate" function'
			);
		}
	};
	var addRule = function (keyword, definition, dataType) {
		var _a;
		const post =
			definition === null || definition === undefined
				? undefined
				: definition.post;
		if (dataType && post)
			throw new Error('keyword with "post" flag cannot have "type"');
		const { RULES } = this;
		let ruleGroup = post
			? RULES.post
			: RULES.rules.find(({ type: t }) => t === dataType);
		if (!ruleGroup) {
			ruleGroup = { type: dataType, rules: [] };
			RULES.rules.push(ruleGroup);
		}
		RULES.keywords[keyword] = true;
		if (!definition) return;
		const rule = {
			keyword,
			definition: {
				...definition,
				type: (0, dataType_1.getJSONTypes)(definition.type),
				schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType),
			},
		};
		if (definition.before)
			addBeforeRule.call(this, ruleGroup, rule, definition.before);
		else ruleGroup.rules.push(rule);
		RULES.all[keyword] = rule;
		(_a = definition.implements) === null ||
			_a === undefined ||
			_a.forEach((kwd) => this.addKeyword(kwd));
	};
	var addBeforeRule = function (ruleGroup, rule, before) {
		const i = ruleGroup.rules.findIndex(
			(_rule) => _rule.keyword === before
		);
		if (i >= 0) {
			ruleGroup.rules.splice(i, 0, rule);
		} else {
			ruleGroup.rules.push(rule);
			this.logger.warn(`rule ${before} is not defined`);
		}
	};
	var keywordMetaschema = function (def) {
		let { metaSchema } = def;
		if (metaSchema === undefined) return;
		if (def.$data && this.opts.$data) metaSchema = schemaOrData(metaSchema);
		def.validateSchema = this.compile(metaSchema, true);
	};
	var schemaOrData = function (schema) {
		return { anyOf: [schema, $dataRef] };
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.CodeGen =
		exports.Name =
		exports.nil =
		exports.stringify =
		exports.str =
		exports._ =
		exports.KeywordCxt =
			undefined;
	var validate_1 = require_validate();
	Object.defineProperty(exports, 'KeywordCxt', {
		enumerable: true,
		get: function () {
			return validate_1.KeywordCxt;
		},
	});
	var codegen_1 = require_codegen();
	Object.defineProperty(exports, '_', {
		enumerable: true,
		get: function () {
			return codegen_1._;
		},
	});
	Object.defineProperty(exports, 'str', {
		enumerable: true,
		get: function () {
			return codegen_1.str;
		},
	});
	Object.defineProperty(exports, 'stringify', {
		enumerable: true,
		get: function () {
			return codegen_1.stringify;
		},
	});
	Object.defineProperty(exports, 'nil', {
		enumerable: true,
		get: function () {
			return codegen_1.nil;
		},
	});
	Object.defineProperty(exports, 'Name', {
		enumerable: true,
		get: function () {
			return codegen_1.Name;
		},
	});
	Object.defineProperty(exports, 'CodeGen', {
		enumerable: true,
		get: function () {
			return codegen_1.CodeGen;
		},
	});
	var validation_error_1 = require_validation_error();
	var ref_error_1 = require_ref_error();
	var rules_1 = require_rules();
	var compile_1 = require_compile();
	var codegen_2 = require_codegen();
	var resolve_1 = require_resolve();
	var dataType_1 = require_dataType();
	var util_1 = require_util();
	var $dataRefSchema = require_data();
	var uri_1 = require_uri();
	var defaultRegExp = (str, flags) => new RegExp(str, flags);
	defaultRegExp.code = 'new RegExp';
	var META_IGNORE_OPTIONS = [
		'removeAdditional',
		'useDefaults',
		'coerceTypes',
	];
	var EXT_SCOPE_NAMES = new Set([
		'validate',
		'serialize',
		'parse',
		'wrapper',
		'root',
		'schema',
		'keyword',
		'pattern',
		'formats',
		'validate$data',
		'func',
		'obj',
		'Error',
	]);
	var removedOptions = {
		errorDataPath: '',
		format: '`validateFormats: false` can be used instead.',
		nullable: '"nullable" keyword is supported by default.',
		jsonPointers: 'Deprecated jsPropertySyntax can be used instead.',
		extendRefs: 'Deprecated ignoreKeywordsWithRef can be used instead.',
		missingRefs:
			'Pass empty schema with $id that should be ignored to ajv.addSchema.',
		processCode:
			'Use option `code: {process: (code, schemaEnv: object) => string}`',
		sourceCode: 'Use option `code: {source: true}`',
		strictDefaults: 'It is default now, see option `strict`.',
		strictKeywords: 'It is default now, see option `strict`.',
		uniqueItems: '"uniqueItems" keyword is always validated.',
		unknownFormats:
			'Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).',
		cache: 'Map is used as cache, schema object as key.',
		serialize: 'Map is used as cache, schema object as key.',
		ajvErrors: 'It is default now.',
	};
	var deprecatedOptions = {
		ignoreKeywordsWithRef: '',
		jsPropertySyntax: '',
		unicode:
			'"minLength"/"maxLength" account for unicode characters by default.',
	};
	var MAX_EXPRESSION = 200;

	class Ajv {
		constructor(opts = {}) {
			this.schemas = {};
			this.refs = {};
			this.formats = {};
			this._compilations = new Set();
			this._loading = {};
			this._cache = new Map();
			opts = this.opts = { ...opts, ...requiredOptions(opts) };
			const { es5, lines } = this.opts.code;
			this.scope = new codegen_2.ValueScope({
				scope: {},
				prefixes: EXT_SCOPE_NAMES,
				es5,
				lines,
			});
			this.logger = getLogger(opts.logger);
			const formatOpt = opts.validateFormats;
			opts.validateFormats = false;
			this.RULES = (0, rules_1.getRules)();
			checkOptions.call(this, removedOptions, opts, 'NOT SUPPORTED');
			checkOptions.call(
				this,
				deprecatedOptions,
				opts,
				'DEPRECATED',
				'warn'
			);
			this._metaOpts = getMetaSchemaOptions.call(this);
			if (opts.formats) addInitialFormats.call(this);
			this._addVocabularies();
			this._addDefaultMetaSchema();
			if (opts.keywords) addInitialKeywords.call(this, opts.keywords);
			if (typeof opts.meta == 'object') this.addMetaSchema(opts.meta);
			addInitialSchemas.call(this);
			opts.validateFormats = formatOpt;
		}
		_addVocabularies() {
			this.addKeyword('$async');
		}
		_addDefaultMetaSchema() {
			const { $data, meta, schemaId } = this.opts;
			let _dataRefSchema = $dataRefSchema;
			if (schemaId === 'id') {
				_dataRefSchema = { ...$dataRefSchema };
				_dataRefSchema.id = _dataRefSchema.$id;
				delete _dataRefSchema.$id;
			}
			if (meta && $data)
				this.addMetaSchema(
					_dataRefSchema,
					_dataRefSchema[schemaId],
					false
				);
		}
		defaultMeta() {
			const { meta, schemaId } = this.opts;
			return (this.opts.defaultMeta =
				typeof meta == 'object' ? meta[schemaId] || meta : undefined);
		}
		validate(schemaKeyRef, data) {
			let v;
			if (typeof schemaKeyRef == 'string') {
				v = this.getSchema(schemaKeyRef);
				if (!v)
					throw new Error(
						`no schema with key or ref "${schemaKeyRef}"`
					);
			} else {
				v = this.compile(schemaKeyRef);
			}
			const valid = v(data);
			if (!('$async' in v)) this.errors = v.errors;
			return valid;
		}
		compile(schema, _meta) {
			const sch = this._addSchema(schema, _meta);
			return sch.validate || this._compileSchemaEnv(sch);
		}
		compileAsync(schema, meta) {
			if (typeof this.opts.loadSchema != 'function') {
				throw new Error('options.loadSchema should be a function');
			}
			const { loadSchema } = this.opts;
			return runCompileAsync.call(this, schema, meta);
			async function runCompileAsync(_schema, _meta) {
				await loadMetaSchema.call(this, _schema.$schema);
				const sch = this._addSchema(_schema, _meta);
				return sch.validate || _compileAsync.call(this, sch);
			}
			async function loadMetaSchema($ref) {
				if ($ref && !this.getSchema($ref)) {
					await runCompileAsync.call(this, { $ref }, true);
				}
			}
			async function _compileAsync(sch) {
				try {
					return this._compileSchemaEnv(sch);
				} catch (e) {
					if (!(e instanceof ref_error_1.default)) throw e;
					checkLoaded.call(this, e);
					await loadMissingSchema.call(this, e.missingSchema);
					return _compileAsync.call(this, sch);
				}
			}
			function checkLoaded({ missingSchema: ref, missingRef }) {
				if (this.refs[ref]) {
					throw new Error(
						`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`
					);
				}
			}
			async function loadMissingSchema(ref) {
				const _schema = await _loadSchema.call(this, ref);
				if (!this.refs[ref])
					await loadMetaSchema.call(this, _schema.$schema);
				if (!this.refs[ref]) this.addSchema(_schema, ref, meta);
			}
			async function _loadSchema(ref) {
				const p = this._loading[ref];
				if (p) return p;
				try {
					return await (this._loading[ref] = loadSchema(ref));
				} finally {
					delete this._loading[ref];
				}
			}
		}
		addSchema(
			schema,
			key,
			_meta,
			_validateSchema = this.opts.validateSchema
		) {
			if (Array.isArray(schema)) {
				for (const sch of schema)
					this.addSchema(sch, undefined, _meta, _validateSchema);
				return this;
			}
			let id;
			if (typeof schema === 'object') {
				const { schemaId } = this.opts;
				id = schema[schemaId];
				if (id !== undefined && typeof id != 'string') {
					throw new Error(`schema ${schemaId} must be string`);
				}
			}
			key = (0, resolve_1.normalizeId)(key || id);
			this._checkUnique(key);
			this.schemas[key] = this._addSchema(
				schema,
				_meta,
				key,
				_validateSchema,
				true
			);
			return this;
		}
		addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
			this.addSchema(schema, key, true, _validateSchema);
			return this;
		}
		validateSchema(schema, throwOrLogError) {
			if (typeof schema == 'boolean') return true;
			let $schema;
			$schema = schema.$schema;
			if ($schema !== undefined && typeof $schema != 'string') {
				throw new Error('$schema must be a string');
			}
			$schema = $schema || this.opts.defaultMeta || this.defaultMeta();
			if (!$schema) {
				this.logger.warn('meta-schema not available');
				this.errors = null;
				return true;
			}
			const valid = this.validate($schema, schema);
			if (!valid && throwOrLogError) {
				const message = 'schema is invalid: ' + this.errorsText();
				if (this.opts.validateSchema === 'log')
					this.logger.error(message);
				else throw new Error(message);
			}
			return valid;
		}
		getSchema(keyRef) {
			let sch;
			while (typeof (sch = getSchEnv.call(this, keyRef)) == 'string')
				keyRef = sch;
			if (sch === undefined) {
				const { schemaId } = this.opts;
				const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
				sch = compile_1.resolveSchema.call(this, root, keyRef);
				if (!sch) return;
				this.refs[keyRef] = sch;
			}
			return sch.validate || this._compileSchemaEnv(sch);
		}
		removeSchema(schemaKeyRef) {
			if (schemaKeyRef instanceof RegExp) {
				this._removeAllSchemas(this.schemas, schemaKeyRef);
				this._removeAllSchemas(this.refs, schemaKeyRef);
				return this;
			}
			switch (typeof schemaKeyRef) {
				case 'undefined':
					this._removeAllSchemas(this.schemas);
					this._removeAllSchemas(this.refs);
					this._cache.clear();
					return this;
				case 'string': {
					const sch = getSchEnv.call(this, schemaKeyRef);
					if (typeof sch == 'object') this._cache.delete(sch.schema);
					delete this.schemas[schemaKeyRef];
					delete this.refs[schemaKeyRef];
					return this;
				}
				case 'object': {
					const cacheKey = schemaKeyRef;
					this._cache.delete(cacheKey);
					let id = schemaKeyRef[this.opts.schemaId];
					if (id) {
						id = (0, resolve_1.normalizeId)(id);
						delete this.schemas[id];
						delete this.refs[id];
					}
					return this;
				}
				default:
					throw new Error('ajv.removeSchema: invalid parameter');
			}
		}
		addVocabulary(definitions) {
			for (const def of definitions) this.addKeyword(def);
			return this;
		}
		addKeyword(kwdOrDef, def) {
			let keyword;
			if (typeof kwdOrDef == 'string') {
				keyword = kwdOrDef;
				if (typeof def == 'object') {
					this.logger.warn(
						'these parameters are deprecated, see docs for addKeyword'
					);
					def.keyword = keyword;
				}
			} else if (typeof kwdOrDef == 'object' && def === undefined) {
				def = kwdOrDef;
				keyword = def.keyword;
				if (Array.isArray(keyword) && !keyword.length) {
					throw new Error(
						'addKeywords: keyword must be string or non-empty array'
					);
				}
			} else {
				throw new Error('invalid addKeywords parameters');
			}
			checkKeyword.call(this, keyword, def);
			if (!def) {
				(0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
				return this;
			}
			keywordMetaschema.call(this, def);
			const definition = {
				...def,
				type: (0, dataType_1.getJSONTypes)(def.type),
				schemaType: (0, dataType_1.getJSONTypes)(def.schemaType),
			};
			(0, util_1.eachItem)(
				keyword,
				definition.type.length === 0
					? (k) => addRule.call(this, k, definition)
					: (k) =>
							definition.type.forEach((t) =>
								addRule.call(this, k, definition, t)
							)
			);
			return this;
		}
		getKeyword(keyword) {
			const rule = this.RULES.all[keyword];
			return typeof rule == 'object' ? rule.definition : !!rule;
		}
		removeKeyword(keyword) {
			const { RULES } = this;
			delete RULES.keywords[keyword];
			delete RULES.all[keyword];
			for (const group of RULES.rules) {
				const i = group.rules.findIndex(
					(rule) => rule.keyword === keyword
				);
				if (i >= 0) group.rules.splice(i, 1);
			}
			return this;
		}
		addFormat(name, format) {
			if (typeof format == 'string') format = new RegExp(format);
			this.formats[name] = format;
			return this;
		}
		errorsText(
			errors = this.errors,
			{ separator = ', ', dataVar = 'data' } = {}
		) {
			if (!errors || errors.length === 0) return 'No errors';
			return errors
				.map((e) => `${dataVar}${e.instancePath} ${e.message}`)
				.reduce((text, msg) => text + separator + msg);
		}
		$dataMetaSchema(metaSchema, keywordsJsonPointers) {
			const rules = this.RULES.all;
			metaSchema = JSON.parse(JSON.stringify(metaSchema));
			for (const jsonPointer of keywordsJsonPointers) {
				const segments = jsonPointer.split('/').slice(1);
				let keywords = metaSchema;
				for (const seg of segments) keywords = keywords[seg];
				for (const key in rules) {
					const rule = rules[key];
					if (typeof rule != 'object') continue;
					const { $data } = rule.definition;
					const schema = keywords[key];
					if ($data && schema) keywords[key] = schemaOrData(schema);
				}
			}
			return metaSchema;
		}
		_removeAllSchemas(schemas, regex) {
			for (const keyRef in schemas) {
				const sch = schemas[keyRef];
				if (!regex || regex.test(keyRef)) {
					if (typeof sch == 'string') {
						delete schemas[keyRef];
					} else if (sch && !sch.meta) {
						this._cache.delete(sch.schema);
						delete schemas[keyRef];
					}
				}
			}
		}
		_addSchema(
			schema,
			meta,
			baseId,
			validateSchema = this.opts.validateSchema,
			addSchema = this.opts.addUsedSchema
		) {
			let id;
			const { schemaId } = this.opts;
			if (typeof schema == 'object') {
				id = schema[schemaId];
			} else {
				if (this.opts.jtd) throw new Error('schema must be object');
				else if (typeof schema != 'boolean')
					throw new Error('schema must be object or boolean');
			}
			let sch = this._cache.get(schema);
			if (sch !== undefined) return sch;
			baseId = (0, resolve_1.normalizeId)(id || baseId);
			const localRefs = resolve_1.getSchemaRefs.call(
				this,
				schema,
				baseId
			);
			sch = new compile_1.SchemaEnv({
				schema,
				schemaId,
				meta,
				baseId,
				localRefs,
			});
			this._cache.set(sch.schema, sch);
			if (addSchema && !baseId.startsWith('#')) {
				if (baseId) this._checkUnique(baseId);
				this.refs[baseId] = sch;
			}
			if (validateSchema) this.validateSchema(schema, true);
			return sch;
		}
		_checkUnique(id) {
			if (this.schemas[id] || this.refs[id]) {
				throw new Error(`schema with key or id "${id}" already exists`);
			}
		}
		_compileSchemaEnv(sch) {
			if (sch.meta) this._compileMetaSchema(sch);
			else compile_1.compileSchema.call(this, sch);
			if (!sch.validate) throw new Error('ajv implementation error');
			return sch.validate;
		}
		_compileMetaSchema(sch) {
			const currentOpts = this.opts;
			this.opts = this._metaOpts;
			try {
				compile_1.compileSchema.call(this, sch);
			} finally {
				this.opts = currentOpts;
			}
		}
	}
	exports.default = Ajv;
	Ajv.ValidationError = validation_error_1.default;
	Ajv.MissingRefError = ref_error_1.default;
	var noLogs = { log() {}, warn() {}, error() {} };
	var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
	var $dataRef = {
		$ref: 'https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#',
	};
});

// ../../../node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var def = {
		keyword: 'id',
		code() {
			throw new Error(
				'NOT SUPPORTED: keyword "id", use "$id" for schema ID'
			);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS((exports) => {
	var getValidate = function (cxt, sch) {
		const { gen } = cxt;
		return sch.validate
			? gen.scopeValue('validate', { ref: sch.validate })
			: (0, codegen_1._)`${gen.scopeValue('wrapper', {
					ref: sch,
			  })}.validate`;
	};
	var callRef = function (cxt, v, sch, $async) {
		const { gen, it } = cxt;
		const { allErrors, schemaEnv: env, opts } = it;
		const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
		if ($async) callAsyncRef();
		else callSyncRef();
		function callAsyncRef() {
			if (!env.$async)
				throw new Error('async schema referenced by sync schema');
			const valid = gen.let('valid');
			gen.try(
				() => {
					gen.code(
						(0, codegen_1._)`await ${(0, code_1.callValidateCode)(
							cxt,
							v,
							passCxt
						)}`
					);
					addEvaluatedFrom(v);
					if (!allErrors) gen.assign(valid, true);
				},
				(e) => {
					gen.if(
						(0,
						codegen_1._)`!(${e} instanceof ${it.ValidationError})`,
						() => gen.throw(e)
					);
					addErrorsFrom(e);
					if (!allErrors) gen.assign(valid, false);
				}
			);
			cxt.ok(valid);
		}
		function callSyncRef() {
			cxt.result(
				(0, code_1.callValidateCode)(cxt, v, passCxt),
				() => addEvaluatedFrom(v),
				() => addErrorsFrom(v)
			);
		}
		function addErrorsFrom(source) {
			const errs = (0, codegen_1._)`${source}.errors`;
			gen.assign(
				names_1.default.vErrors,
				(0,
				codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`
			);
			gen.assign(
				names_1.default.errors,
				(0, codegen_1._)`${names_1.default.vErrors}.length`
			);
		}
		function addEvaluatedFrom(source) {
			var _a;
			if (!it.opts.unevaluated) return;
			const schEvaluated =
				(_a =
					sch === null || sch === undefined
						? undefined
						: sch.validate) === null || _a === undefined
					? undefined
					: _a.evaluated;
			if (it.props !== true) {
				if (schEvaluated && !schEvaluated.dynamicProps) {
					if (schEvaluated.props !== undefined) {
						it.props = util_1.mergeEvaluated.props(
							gen,
							schEvaluated.props,
							it.props
						);
					}
				} else {
					const props = gen.var(
						'props',
						(0, codegen_1._)`${source}.evaluated.props`
					);
					it.props = util_1.mergeEvaluated.props(
						gen,
						props,
						it.props,
						codegen_1.Name
					);
				}
			}
			if (it.items !== true) {
				if (schEvaluated && !schEvaluated.dynamicItems) {
					if (schEvaluated.items !== undefined) {
						it.items = util_1.mergeEvaluated.items(
							gen,
							schEvaluated.items,
							it.items
						);
					}
				} else {
					const items = gen.var(
						'items',
						(0, codegen_1._)`${source}.evaluated.items`
					);
					it.items = util_1.mergeEvaluated.items(
						gen,
						items,
						it.items,
						codegen_1.Name
					);
				}
			}
		}
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.callRef = exports.getValidate = undefined;
	var ref_error_1 = require_ref_error();
	var code_1 = require_code2();
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var compile_1 = require_compile();
	var util_1 = require_util();
	var def = {
		keyword: '$ref',
		schemaType: 'string',
		code(cxt) {
			const { gen, schema: $ref, it } = cxt;
			const {
				baseId,
				schemaEnv: env,
				validateName,
				opts,
				self: self2,
			} = it;
			const { root } = env;
			if (($ref === '#' || $ref === '#/') && baseId === root.baseId)
				return callRootRef();
			const schOrEnv = compile_1.resolveRef.call(
				self2,
				root,
				baseId,
				$ref
			);
			if (schOrEnv === undefined)
				throw new ref_error_1.default(
					it.opts.uriResolver,
					baseId,
					$ref
				);
			if (schOrEnv instanceof compile_1.SchemaEnv)
				return callValidate(schOrEnv);
			return inlineRefSchema(schOrEnv);
			function callRootRef() {
				if (env === root)
					return callRef(cxt, validateName, env, env.$async);
				const rootName = gen.scopeValue('root', { ref: root });
				return callRef(
					cxt,
					(0, codegen_1._)`${rootName}.validate`,
					root,
					root.$async
				);
			}
			function callValidate(sch) {
				const v = getValidate(cxt, sch);
				callRef(cxt, v, sch, sch.$async);
			}
			function inlineRefSchema(sch) {
				const schName = gen.scopeValue(
					'schema',
					opts.code.source === true
						? { ref: sch, code: (0, codegen_1.stringify)(sch) }
						: { ref: sch }
				);
				const valid = gen.name('valid');
				const schCxt = cxt.subschema(
					{
						schema: sch,
						dataTypes: [],
						schemaPath: codegen_1.nil,
						topSchemaRef: schName,
						errSchemaPath: $ref,
					},
					valid
				);
				cxt.mergeEvaluated(schCxt);
				cxt.ok(valid);
			}
		},
	};
	exports.getValidate = getValidate;
	exports.callRef = callRef;
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var id_1 = require_id();
	var ref_1 = require_ref();
	var core = [
		'$schema',
		'$id',
		'$defs',
		'$vocabulary',
		{ keyword: '$comment' },
		'definitions',
		id_1.default,
		ref_1.default,
	];
	exports.default = core;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var ops = codegen_1.operators;
	var KWDs = {
		maximum: { okStr: '<=', ok: ops.LTE, fail: ops.GT },
		minimum: { okStr: '>=', ok: ops.GTE, fail: ops.LT },
		exclusiveMaximum: { okStr: '<', ok: ops.LT, fail: ops.GTE },
		exclusiveMinimum: { okStr: '>', ok: ops.GT, fail: ops.LTE },
	};
	var error = {
		message: ({ keyword, schemaCode }) =>
			(0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
		params: ({ keyword, schemaCode }) =>
			(0,
			codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`,
	};
	var def = {
		keyword: Object.keys(KWDs),
		type: 'number',
		schemaType: 'number',
		$data: true,
		error,
		code(cxt) {
			const { keyword, data, schemaCode } = cxt;
			cxt.fail$data(
				(0,
				codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`
			);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var error = {
		message: ({ schemaCode }) =>
			(0, codegen_1.str)`must be multiple of ${schemaCode}`,
		params: ({ schemaCode }) =>
			(0, codegen_1._)`{multipleOf: ${schemaCode}}`,
	};
	var def = {
		keyword: 'multipleOf',
		type: 'number',
		schemaType: 'number',
		$data: true,
		error,
		code(cxt) {
			const { gen, data, schemaCode, it } = cxt;
			const prec = it.opts.multipleOfPrecision;
			const res = gen.let('res');
			const invalid = prec
				? (0,
				  codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}`
				: (0, codegen_1._)`${res} !== parseInt(${res})`;
			cxt.fail$data(
				(0,
				codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`
			);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS((exports) => {
	var ucs2length = function (str) {
		const len = str.length;
		let length = 0;
		let pos = 0;
		let value;
		while (pos < len) {
			length++;
			value = str.charCodeAt(pos++);
			if (value >= 55296 && value <= 56319 && pos < len) {
				value = str.charCodeAt(pos);
				if ((value & 64512) === 56320) pos++;
			}
		}
		return length;
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.default = ucs2length;
	ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
});

// ../../../node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var ucs2length_1 = require_ucs2length();
	var error = {
		message({ keyword, schemaCode }) {
			const comp = keyword === 'maxLength' ? 'more' : 'fewer';
			return (0,
			codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
		},
		params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`,
	};
	var def = {
		keyword: ['maxLength', 'minLength'],
		type: 'string',
		schemaType: 'number',
		$data: true,
		error,
		code(cxt) {
			const { keyword, data, schemaCode, it } = cxt;
			const op =
				keyword === 'maxLength'
					? codegen_1.operators.GT
					: codegen_1.operators.LT;
			const len =
				it.opts.unicode === false
					? (0, codegen_1._)`${data}.length`
					: (0, codegen_1._)`${(0, util_1.useFunc)(
							cxt.gen,
							ucs2length_1.default
					  )}(${data})`;
			cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var code_1 = require_code2();
	var codegen_1 = require_codegen();
	var error = {
		message: ({ schemaCode }) =>
			(0, codegen_1.str)`must match pattern "${schemaCode}"`,
		params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`,
	};
	var def = {
		keyword: 'pattern',
		type: 'string',
		schemaType: 'string',
		$data: true,
		error,
		code(cxt) {
			const { data, $data, schema, schemaCode, it } = cxt;
			const u = it.opts.unicodeRegExp ? 'u' : '';
			const regExp = $data
				? (0, codegen_1._)`(new RegExp(${schemaCode}, ${u}))`
				: (0, code_1.usePattern)(cxt, schema);
			cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var error = {
		message({ keyword, schemaCode }) {
			const comp = keyword === 'maxProperties' ? 'more' : 'fewer';
			return (0,
			codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
		},
		params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`,
	};
	var def = {
		keyword: ['maxProperties', 'minProperties'],
		type: 'object',
		schemaType: 'number',
		$data: true,
		error,
		code(cxt) {
			const { keyword, data, schemaCode } = cxt;
			const op =
				keyword === 'maxProperties'
					? codegen_1.operators.GT
					: codegen_1.operators.LT;
			cxt.fail$data(
				(0,
				codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`
			);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var code_1 = require_code2();
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var error = {
		message: ({ params: { missingProperty } }) =>
			(0,
			codegen_1.str)`must have required property '${missingProperty}'`,
		params: ({ params: { missingProperty } }) =>
			(0, codegen_1._)`{missingProperty: ${missingProperty}}`,
	};
	var def = {
		keyword: 'required',
		type: 'object',
		schemaType: 'array',
		$data: true,
		error,
		code(cxt) {
			const { gen, schema, schemaCode, data, $data, it } = cxt;
			const { opts } = it;
			if (!$data && schema.length === 0) return;
			const useLoop = schema.length >= opts.loopRequired;
			if (it.allErrors) allErrorsMode();
			else exitOnErrorMode();
			if (opts.strictRequired) {
				const props = cxt.parentSchema.properties;
				const { definedProperties } = cxt.it;
				for (const requiredKey of schema) {
					if (
						(props === null || props === undefined
							? undefined
							: props[requiredKey]) === undefined &&
						!definedProperties.has(requiredKey)
					) {
						const schemaPath =
							it.schemaEnv.baseId + it.errSchemaPath;
						const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
						(0, util_1.checkStrictMode)(
							it,
							msg,
							it.opts.strictRequired
						);
					}
				}
			}
			function allErrorsMode() {
				if (useLoop || $data) {
					cxt.block$data(codegen_1.nil, loopAllRequired);
				} else {
					for (const prop of schema) {
						(0, code_1.checkReportMissingProp)(cxt, prop);
					}
				}
			}
			function exitOnErrorMode() {
				const missing = gen.let('missing');
				if (useLoop || $data) {
					const valid = gen.let('valid', true);
					cxt.block$data(valid, () =>
						loopUntilMissing(missing, valid)
					);
					cxt.ok(valid);
				} else {
					gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
					(0, code_1.reportMissingProp)(cxt, missing);
					gen.else();
				}
			}
			function loopAllRequired() {
				gen.forOf('prop', schemaCode, (prop) => {
					cxt.setParams({ missingProperty: prop });
					gen.if(
						(0, code_1.noPropertyInData)(
							gen,
							data,
							prop,
							opts.ownProperties
						),
						() => cxt.error()
					);
				});
			}
			function loopUntilMissing(missing, valid) {
				cxt.setParams({ missingProperty: missing });
				gen.forOf(
					missing,
					schemaCode,
					() => {
						gen.assign(
							valid,
							(0, code_1.propertyInData)(
								gen,
								data,
								missing,
								opts.ownProperties
							)
						);
						gen.if((0, codegen_1.not)(valid), () => {
							cxt.error();
							gen.break();
						});
					},
					codegen_1.nil
				);
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var error = {
		message({ keyword, schemaCode }) {
			const comp = keyword === 'maxItems' ? 'more' : 'fewer';
			return (0,
			codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
		},
		params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`,
	};
	var def = {
		keyword: ['maxItems', 'minItems'],
		type: 'array',
		schemaType: 'number',
		$data: true,
		error,
		code(cxt) {
			const { keyword, data, schemaCode } = cxt;
			const op =
				keyword === 'maxItems'
					? codegen_1.operators.GT
					: codegen_1.operators.LT;
			cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var equal = require_fast_deep_equal();
	equal.code = 'require("ajv/dist/runtime/equal").default';
	exports.default = equal;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var dataType_1 = require_dataType();
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var equal_1 = require_equal();
	var error = {
		message: ({ params: { i, j } }) =>
			(0,
			codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
		params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`,
	};
	var def = {
		keyword: 'uniqueItems',
		type: 'array',
		schemaType: 'boolean',
		$data: true,
		error,
		code(cxt) {
			const { gen, data, $data, schema, parentSchema, schemaCode, it } =
				cxt;
			if (!$data && !schema) return;
			const valid = gen.let('valid');
			const itemTypes = parentSchema.items
				? (0, dataType_1.getSchemaTypes)(parentSchema.items)
				: [];
			cxt.block$data(
				valid,
				validateUniqueItems,
				(0, codegen_1._)`${schemaCode} === false`
			);
			cxt.ok(valid);
			function validateUniqueItems() {
				const i = gen.let('i', (0, codegen_1._)`${data}.length`);
				const j = gen.let('j');
				cxt.setParams({ i, j });
				gen.assign(valid, true);
				gen.if((0, codegen_1._)`${i} > 1`, () =>
					(canOptimize() ? loopN : loopN2)(i, j)
				);
			}
			function canOptimize() {
				return (
					itemTypes.length > 0 &&
					!itemTypes.some((t) => t === 'object' || t === 'array')
				);
			}
			function loopN(i, j) {
				const item = gen.name('item');
				const wrongType = (0, dataType_1.checkDataTypes)(
					itemTypes,
					item,
					it.opts.strictNumbers,
					dataType_1.DataType.Wrong
				);
				const indices = gen.const('indices', (0, codegen_1._)`{}`);
				gen.for((0, codegen_1._)`;${i}--;`, () => {
					gen.let(item, (0, codegen_1._)`${data}[${i}]`);
					gen.if(wrongType, (0, codegen_1._)`continue`);
					if (itemTypes.length > 1)
						gen.if(
							(0, codegen_1._)`typeof ${item} == "string"`,
							(0, codegen_1._)`${item} += "_"`
						);
					gen.if(
						(0,
						codegen_1._)`typeof ${indices}[${item}] == "number"`,
						() => {
							gen.assign(
								j,
								(0, codegen_1._)`${indices}[${item}]`
							);
							cxt.error();
							gen.assign(valid, false).break();
						}
					).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
				});
			}
			function loopN2(i, j) {
				const eql = (0, util_1.useFunc)(gen, equal_1.default);
				const outer = gen.name('outer');
				gen.label(outer).for((0, codegen_1._)`;${i}--;`, () =>
					gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () =>
						gen.if(
							(0,
							codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`,
							() => {
								cxt.error();
								gen.assign(valid, false).break(outer);
							}
						)
					)
				);
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var equal_1 = require_equal();
	var error = {
		message: 'must be equal to constant',
		params: ({ schemaCode }) =>
			(0, codegen_1._)`{allowedValue: ${schemaCode}}`,
	};
	var def = {
		keyword: 'const',
		$data: true,
		error,
		code(cxt) {
			const { gen, data, $data, schemaCode, schema } = cxt;
			if ($data || (schema && typeof schema == 'object')) {
				cxt.fail$data(
					(0, codegen_1._)`!${(0, util_1.useFunc)(
						gen,
						equal_1.default
					)}(${data}, ${schemaCode})`
				);
			} else {
				cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var equal_1 = require_equal();
	var error = {
		message: 'must be equal to one of the allowed values',
		params: ({ schemaCode }) =>
			(0, codegen_1._)`{allowedValues: ${schemaCode}}`,
	};
	var def = {
		keyword: 'enum',
		schemaType: 'array',
		$data: true,
		error,
		code(cxt) {
			const { gen, data, $data, schema, schemaCode, it } = cxt;
			if (!$data && schema.length === 0)
				throw new Error('enum must have non-empty array');
			const useLoop = schema.length >= it.opts.loopEnum;
			let eql;
			const getEql = () =>
				eql !== null && eql !== undefined
					? eql
					: (eql = (0, util_1.useFunc)(gen, equal_1.default));
			let valid;
			if (useLoop || $data) {
				valid = gen.let('valid');
				cxt.block$data(valid, loopEnum);
			} else {
				if (!Array.isArray(schema))
					throw new Error('ajv implementation error');
				const vSchema = gen.const('vSchema', schemaCode);
				valid = (0, codegen_1.or)(
					...schema.map((_x, i) => equalCode(vSchema, i))
				);
			}
			cxt.pass(valid);
			function loopEnum() {
				gen.assign(valid, false);
				gen.forOf('v', schemaCode, (v) =>
					gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () =>
						gen.assign(valid, true).break()
					)
				);
			}
			function equalCode(vSchema, i) {
				const sch = schema[i];
				return typeof sch === 'object' && sch !== null
					? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])`
					: (0, codegen_1._)`${data} === ${sch}`;
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var limitNumber_1 = require_limitNumber();
	var multipleOf_1 = require_multipleOf();
	var limitLength_1 = require_limitLength();
	var pattern_1 = require_pattern();
	var limitProperties_1 = require_limitProperties();
	var required_1 = require_required();
	var limitItems_1 = require_limitItems();
	var uniqueItems_1 = require_uniqueItems();
	var const_1 = require_const();
	var enum_1 = require_enum();
	var validation = [
		limitNumber_1.default,
		multipleOf_1.default,
		limitLength_1.default,
		pattern_1.default,
		limitProperties_1.default,
		required_1.default,
		limitItems_1.default,
		uniqueItems_1.default,
		{ keyword: 'type', schemaType: ['string', 'array'] },
		{ keyword: 'nullable', schemaType: 'boolean' },
		const_1.default,
		enum_1.default,
	];
	exports.default = validation;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS((exports) => {
	var validateAdditionalItems = function (cxt, items) {
		const { gen, schema, data, keyword, it } = cxt;
		it.items = true;
		const len = gen.const('len', (0, codegen_1._)`${data}.length`);
		if (schema === false) {
			cxt.setParams({ len: items.length });
			cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
		} else if (
			typeof schema == 'object' &&
			!(0, util_1.alwaysValidSchema)(it, schema)
		) {
			const valid = gen.var(
				'valid',
				(0, codegen_1._)`${len} <= ${items.length}`
			);
			gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
			cxt.ok(valid);
		}
		function validateItems(valid) {
			gen.forRange('i', items.length, len, (i) => {
				cxt.subschema(
					{ keyword, dataProp: i, dataPropType: util_1.Type.Num },
					valid
				);
				if (!it.allErrors)
					gen.if((0, codegen_1.not)(valid), () => gen.break());
			});
		}
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.validateAdditionalItems = undefined;
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var error = {
		message: ({ params: { len } }) =>
			(0, codegen_1.str)`must NOT have more than ${len} items`,
		params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`,
	};
	var def = {
		keyword: 'additionalItems',
		type: 'array',
		schemaType: ['boolean', 'object'],
		before: 'uniqueItems',
		error,
		code(cxt) {
			const { parentSchema, it } = cxt;
			const { items } = parentSchema;
			if (!Array.isArray(items)) {
				(0, util_1.checkStrictMode)(
					it,
					'"additionalItems" is ignored when "items" is not an array of schemas'
				);
				return;
			}
			validateAdditionalItems(cxt, items);
		},
	};
	exports.validateAdditionalItems = validateAdditionalItems;
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS((exports) => {
	var validateTuple = function (cxt, extraItems, schArr = cxt.schema) {
		const { gen, parentSchema, data, keyword, it } = cxt;
		checkStrictTuple(parentSchema);
		if (it.opts.unevaluated && schArr.length && it.items !== true) {
			it.items = util_1.mergeEvaluated.items(
				gen,
				schArr.length,
				it.items
			);
		}
		const valid = gen.name('valid');
		const len = gen.const('len', (0, codegen_1._)`${data}.length`);
		schArr.forEach((sch, i) => {
			if ((0, util_1.alwaysValidSchema)(it, sch)) return;
			gen.if((0, codegen_1._)`${len} > ${i}`, () =>
				cxt.subschema(
					{
						keyword,
						schemaProp: i,
						dataProp: i,
					},
					valid
				)
			);
			cxt.ok(valid);
		});
		function checkStrictTuple(sch) {
			const { opts, errSchemaPath } = it;
			const l = schArr.length;
			const fullTuple =
				l === sch.minItems &&
				(l === sch.maxItems || sch[extraItems] === false);
			if (opts.strictTuples && !fullTuple) {
				const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
				(0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
			}
		}
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.validateTuple = undefined;
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var code_1 = require_code2();
	var def = {
		keyword: 'items',
		type: 'array',
		schemaType: ['object', 'array', 'boolean'],
		before: 'uniqueItems',
		code(cxt) {
			const { schema, it } = cxt;
			if (Array.isArray(schema))
				return validateTuple(cxt, 'additionalItems', schema);
			it.items = true;
			if ((0, util_1.alwaysValidSchema)(it, schema)) return;
			cxt.ok((0, code_1.validateArray)(cxt));
		},
	};
	exports.validateTuple = validateTuple;
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var items_1 = require_items();
	var def = {
		keyword: 'prefixItems',
		type: 'array',
		schemaType: ['array'],
		before: 'uniqueItems',
		code: (cxt) => (0, items_1.validateTuple)(cxt, 'items'),
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var code_1 = require_code2();
	var additionalItems_1 = require_additionalItems();
	var error = {
		message: ({ params: { len } }) =>
			(0, codegen_1.str)`must NOT have more than ${len} items`,
		params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`,
	};
	var def = {
		keyword: 'items',
		type: 'array',
		schemaType: ['object', 'boolean'],
		before: 'uniqueItems',
		error,
		code(cxt) {
			const { schema, parentSchema, it } = cxt;
			const { prefixItems } = parentSchema;
			it.items = true;
			if ((0, util_1.alwaysValidSchema)(it, schema)) return;
			if (prefixItems)
				(0, additionalItems_1.validateAdditionalItems)(
					cxt,
					prefixItems
				);
			else cxt.ok((0, code_1.validateArray)(cxt));
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var error = {
		message: ({ params: { min, max } }) =>
			max === undefined
				? (0, codegen_1.str)`must contain at least ${min} valid item(s)`
				: (0,
				  codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
		params: ({ params: { min, max } }) =>
			max === undefined
				? (0, codegen_1._)`{minContains: ${min}}`
				: (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`,
	};
	var def = {
		keyword: 'contains',
		type: 'array',
		schemaType: ['object', 'boolean'],
		before: 'uniqueItems',
		trackErrors: true,
		error,
		code(cxt) {
			const { gen, schema, parentSchema, data, it } = cxt;
			let min;
			let max;
			const { minContains, maxContains } = parentSchema;
			if (it.opts.next) {
				min = minContains === undefined ? 1 : minContains;
				max = maxContains;
			} else {
				min = 1;
			}
			const len = gen.const('len', (0, codegen_1._)`${data}.length`);
			cxt.setParams({ min, max });
			if (max === undefined && min === 0) {
				(0, util_1.checkStrictMode)(
					it,
					`"minContains" == 0 without "maxContains": "contains" keyword ignored`
				);
				return;
			}
			if (max !== undefined && min > max) {
				(0, util_1.checkStrictMode)(
					it,
					`"minContains" > "maxContains" is always invalid`
				);
				cxt.fail();
				return;
			}
			if ((0, util_1.alwaysValidSchema)(it, schema)) {
				let cond = (0, codegen_1._)`${len} >= ${min}`;
				if (max !== undefined)
					cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
				cxt.pass(cond);
				return;
			}
			it.items = true;
			const valid = gen.name('valid');
			if (max === undefined && min === 1) {
				validateItems(valid, () => gen.if(valid, () => gen.break()));
			} else if (min === 0) {
				gen.let(valid, true);
				if (max !== undefined)
					gen.if(
						(0, codegen_1._)`${data}.length > 0`,
						validateItemsWithCount
					);
			} else {
				gen.let(valid, false);
				validateItemsWithCount();
			}
			cxt.result(valid, () => cxt.reset());
			function validateItemsWithCount() {
				const schValid = gen.name('_valid');
				const count = gen.let('count', 0);
				validateItems(schValid, () =>
					gen.if(schValid, () => checkLimits(count))
				);
			}
			function validateItems(_valid, block) {
				gen.forRange('i', 0, len, (i) => {
					cxt.subschema(
						{
							keyword: 'contains',
							dataProp: i,
							dataPropType: util_1.Type.Num,
							compositeRule: true,
						},
						_valid
					);
					block();
				});
			}
			function checkLimits(count) {
				gen.code((0, codegen_1._)`${count}++`);
				if (max === undefined) {
					gen.if((0, codegen_1._)`${count} >= ${min}`, () =>
						gen.assign(valid, true).break()
					);
				} else {
					gen.if((0, codegen_1._)`${count} > ${max}`, () =>
						gen.assign(valid, false).break()
					);
					if (min === 1) gen.assign(valid, true);
					else
						gen.if((0, codegen_1._)`${count} >= ${min}`, () =>
							gen.assign(valid, true)
						);
				}
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS((exports) => {
	var splitDependencies = function ({ schema }) {
		const propertyDeps = {};
		const schemaDeps = {};
		for (const key in schema) {
			if (key === '__proto__') continue;
			const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
			deps[key] = schema[key];
		}
		return [propertyDeps, schemaDeps];
	};
	var validatePropertyDeps = function (cxt, propertyDeps = cxt.schema) {
		const { gen, data, it } = cxt;
		if (Object.keys(propertyDeps).length === 0) return;
		const missing = gen.let('missing');
		for (const prop in propertyDeps) {
			const deps = propertyDeps[prop];
			if (deps.length === 0) continue;
			const hasProperty = (0, code_1.propertyInData)(
				gen,
				data,
				prop,
				it.opts.ownProperties
			);
			cxt.setParams({
				property: prop,
				depsCount: deps.length,
				deps: deps.join(', '),
			});
			if (it.allErrors) {
				gen.if(hasProperty, () => {
					for (const depProp of deps) {
						(0, code_1.checkReportMissingProp)(cxt, depProp);
					}
				});
			} else {
				gen.if(
					(0, codegen_1._)`${hasProperty} && (${(0,
					code_1.checkMissingProp)(cxt, deps, missing)})`
				);
				(0, code_1.reportMissingProp)(cxt, missing);
				gen.else();
			}
		}
	};
	var validateSchemaDeps = function (cxt, schemaDeps = cxt.schema) {
		const { gen, data, keyword, it } = cxt;
		const valid = gen.name('valid');
		for (const prop in schemaDeps) {
			if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop])) continue;
			gen.if(
				(0, code_1.propertyInData)(
					gen,
					data,
					prop,
					it.opts.ownProperties
				),
				() => {
					const schCxt = cxt.subschema(
						{ keyword, schemaProp: prop },
						valid
					);
					cxt.mergeValidEvaluated(schCxt, valid);
				},
				() => gen.var(valid, true)
			);
			cxt.ok(valid);
		}
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.validateSchemaDeps =
		exports.validatePropertyDeps =
		exports.error =
			undefined;
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var code_1 = require_code2();
	exports.error = {
		message: ({ params: { property, depsCount, deps } }) => {
			const property_ies = depsCount === 1 ? 'property' : 'properties';
			return (0,
			codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
		},
		params: ({
			params: { property, depsCount, deps, missingProperty },
		}) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`,
	};
	var def = {
		keyword: 'dependencies',
		type: 'object',
		schemaType: 'object',
		error: exports.error,
		code(cxt) {
			const [propDeps, schDeps] = splitDependencies(cxt);
			validatePropertyDeps(cxt, propDeps);
			validateSchemaDeps(cxt, schDeps);
		},
	};
	exports.validatePropertyDeps = validatePropertyDeps;
	exports.validateSchemaDeps = validateSchemaDeps;
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var error = {
		message: 'property name must be valid',
		params: ({ params }) =>
			(0, codegen_1._)`{propertyName: ${params.propertyName}}`,
	};
	var def = {
		keyword: 'propertyNames',
		type: 'object',
		schemaType: ['object', 'boolean'],
		error,
		code(cxt) {
			const { gen, schema, data, it } = cxt;
			if ((0, util_1.alwaysValidSchema)(it, schema)) return;
			const valid = gen.name('valid');
			gen.forIn('key', data, (key) => {
				cxt.setParams({ propertyName: key });
				cxt.subschema(
					{
						keyword: 'propertyNames',
						data: key,
						dataTypes: ['string'],
						propertyName: key,
						compositeRule: true,
					},
					valid
				);
				gen.if((0, codegen_1.not)(valid), () => {
					cxt.error(true);
					if (!it.allErrors) gen.break();
				});
			});
			cxt.ok(valid);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var code_1 = require_code2();
	var codegen_1 = require_codegen();
	var names_1 = require_names();
	var util_1 = require_util();
	var error = {
		message: 'must NOT have additional properties',
		params: ({ params }) =>
			(0,
			codegen_1._)`{additionalProperty: ${params.additionalProperty}}`,
	};
	var def = {
		keyword: 'additionalProperties',
		type: ['object'],
		schemaType: ['boolean', 'object'],
		allowUndefined: true,
		trackErrors: true,
		error,
		code(cxt) {
			const { gen, schema, parentSchema, data, errsCount, it } = cxt;
			if (!errsCount) throw new Error('ajv implementation error');
			const { allErrors, opts } = it;
			it.props = true;
			if (
				opts.removeAdditional !== 'all' &&
				(0, util_1.alwaysValidSchema)(it, schema)
			)
				return;
			const props = (0, code_1.allSchemaProperties)(
				parentSchema.properties
			);
			const patProps = (0, code_1.allSchemaProperties)(
				parentSchema.patternProperties
			);
			checkAdditionalProperties();
			cxt.ok(
				(0, codegen_1._)`${errsCount} === ${names_1.default.errors}`
			);
			function checkAdditionalProperties() {
				gen.forIn('key', data, (key) => {
					if (!props.length && !patProps.length)
						additionalPropertyCode(key);
					else
						gen.if(isAdditional(key), () =>
							additionalPropertyCode(key)
						);
				});
			}
			function isAdditional(key) {
				let definedProp;
				if (props.length > 8) {
					const propsSchema = (0, util_1.schemaRefOrVal)(
						it,
						parentSchema.properties,
						'properties'
					);
					definedProp = (0, code_1.isOwnProperty)(
						gen,
						propsSchema,
						key
					);
				} else if (props.length) {
					definedProp = (0, codegen_1.or)(
						...props.map((p) => (0, codegen_1._)`${key} === ${p}`)
					);
				} else {
					definedProp = codegen_1.nil;
				}
				if (patProps.length) {
					definedProp = (0, codegen_1.or)(
						definedProp,
						...patProps.map(
							(p) =>
								(0, codegen_1._)`${(0, code_1.usePattern)(
									cxt,
									p
								)}.test(${key})`
						)
					);
				}
				return (0, codegen_1.not)(definedProp);
			}
			function deleteAdditional(key) {
				gen.code((0, codegen_1._)`delete ${data}[${key}]`);
			}
			function additionalPropertyCode(key) {
				if (
					opts.removeAdditional === 'all' ||
					(opts.removeAdditional && schema === false)
				) {
					deleteAdditional(key);
					return;
				}
				if (schema === false) {
					cxt.setParams({ additionalProperty: key });
					cxt.error();
					if (!allErrors) gen.break();
					return;
				}
				if (
					typeof schema == 'object' &&
					!(0, util_1.alwaysValidSchema)(it, schema)
				) {
					const valid = gen.name('valid');
					if (opts.removeAdditional === 'failing') {
						applyAdditionalSchema(key, valid, false);
						gen.if((0, codegen_1.not)(valid), () => {
							cxt.reset();
							deleteAdditional(key);
						});
					} else {
						applyAdditionalSchema(key, valid);
						if (!allErrors)
							gen.if((0, codegen_1.not)(valid), () =>
								gen.break()
							);
					}
				}
			}
			function applyAdditionalSchema(key, valid, errors) {
				const subschema = {
					keyword: 'additionalProperties',
					dataProp: key,
					dataPropType: util_1.Type.Str,
				};
				if (errors === false) {
					Object.assign(subschema, {
						compositeRule: true,
						createErrors: false,
						allErrors: false,
					});
				}
				cxt.subschema(subschema, valid);
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var validate_1 = require_validate();
	var code_1 = require_code2();
	var util_1 = require_util();
	var additionalProperties_1 = require_additionalProperties();
	var def = {
		keyword: 'properties',
		type: 'object',
		schemaType: 'object',
		code(cxt) {
			const { gen, schema, parentSchema, data, it } = cxt;
			if (
				it.opts.removeAdditional === 'all' &&
				parentSchema.additionalProperties === undefined
			) {
				additionalProperties_1.default.code(
					new validate_1.KeywordCxt(
						it,
						additionalProperties_1.default,
						'additionalProperties'
					)
				);
			}
			const allProps = (0, code_1.allSchemaProperties)(schema);
			for (const prop of allProps) {
				it.definedProperties.add(prop);
			}
			if (it.opts.unevaluated && allProps.length && it.props !== true) {
				it.props = util_1.mergeEvaluated.props(
					gen,
					(0, util_1.toHash)(allProps),
					it.props
				);
			}
			const properties = allProps.filter(
				(p) => !(0, util_1.alwaysValidSchema)(it, schema[p])
			);
			if (properties.length === 0) return;
			const valid = gen.name('valid');
			for (const prop of properties) {
				if (hasDefault(prop)) {
					applyPropertySchema(prop);
				} else {
					gen.if(
						(0, code_1.propertyInData)(
							gen,
							data,
							prop,
							it.opts.ownProperties
						)
					);
					applyPropertySchema(prop);
					if (!it.allErrors) gen.else().var(valid, true);
					gen.endIf();
				}
				cxt.it.definedProperties.add(prop);
				cxt.ok(valid);
			}
			function hasDefault(prop) {
				return (
					it.opts.useDefaults &&
					!it.compositeRule &&
					schema[prop].default !== undefined
				);
			}
			function applyPropertySchema(prop) {
				cxt.subschema(
					{
						keyword: 'properties',
						schemaProp: prop,
						dataProp: prop,
					},
					valid
				);
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var code_1 = require_code2();
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var util_2 = require_util();
	var def = {
		keyword: 'patternProperties',
		type: 'object',
		schemaType: 'object',
		code(cxt) {
			const { gen, schema, data, parentSchema, it } = cxt;
			const { opts } = it;
			const patterns = (0, code_1.allSchemaProperties)(schema);
			const alwaysValidPatterns = patterns.filter((p) =>
				(0, util_1.alwaysValidSchema)(it, schema[p])
			);
			if (
				patterns.length === 0 ||
				(alwaysValidPatterns.length === patterns.length &&
					(!it.opts.unevaluated || it.props === true))
			) {
				return;
			}
			const checkProperties =
				opts.strictSchema &&
				!opts.allowMatchingProperties &&
				parentSchema.properties;
			const valid = gen.name('valid');
			if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
				it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
			}
			const { props } = it;
			validatePatternProperties();
			function validatePatternProperties() {
				for (const pat of patterns) {
					if (checkProperties) checkMatchingProperties(pat);
					if (it.allErrors) {
						validateProperties(pat);
					} else {
						gen.var(valid, true);
						validateProperties(pat);
						gen.if(valid);
					}
				}
			}
			function checkMatchingProperties(pat) {
				for (const prop in checkProperties) {
					if (new RegExp(pat).test(prop)) {
						(0, util_1.checkStrictMode)(
							it,
							`property ${prop} matches pattern ${pat} (use allowMatchingProperties)`
						);
					}
				}
			}
			function validateProperties(pat) {
				gen.forIn('key', data, (key) => {
					gen.if(
						(0, codegen_1._)`${(0, code_1.usePattern)(
							cxt,
							pat
						)}.test(${key})`,
						() => {
							const alwaysValid =
								alwaysValidPatterns.includes(pat);
							if (!alwaysValid) {
								cxt.subschema(
									{
										keyword: 'patternProperties',
										schemaProp: pat,
										dataProp: key,
										dataPropType: util_2.Type.Str,
									},
									valid
								);
							}
							if (it.opts.unevaluated && props !== true) {
								gen.assign(
									(0, codegen_1._)`${props}[${key}]`,
									true
								);
							} else if (!alwaysValid && !it.allErrors) {
								gen.if((0, codegen_1.not)(valid), () =>
									gen.break()
								);
							}
						}
					);
				});
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var util_1 = require_util();
	var def = {
		keyword: 'not',
		schemaType: ['object', 'boolean'],
		trackErrors: true,
		code(cxt) {
			const { gen, schema, it } = cxt;
			if ((0, util_1.alwaysValidSchema)(it, schema)) {
				cxt.fail();
				return;
			}
			const valid = gen.name('valid');
			cxt.subschema(
				{
					keyword: 'not',
					compositeRule: true,
					createErrors: false,
					allErrors: false,
				},
				valid
			);
			cxt.failResult(
				valid,
				() => cxt.reset(),
				() => cxt.error()
			);
		},
		error: { message: 'must NOT be valid' },
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var code_1 = require_code2();
	var def = {
		keyword: 'anyOf',
		schemaType: 'array',
		trackErrors: true,
		code: code_1.validateUnion,
		error: { message: 'must match a schema in anyOf' },
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var error = {
		message: 'must match exactly one schema in oneOf',
		params: ({ params }) =>
			(0, codegen_1._)`{passingSchemas: ${params.passing}}`,
	};
	var def = {
		keyword: 'oneOf',
		schemaType: 'array',
		trackErrors: true,
		error,
		code(cxt) {
			const { gen, schema, parentSchema, it } = cxt;
			if (!Array.isArray(schema))
				throw new Error('ajv implementation error');
			if (it.opts.discriminator && parentSchema.discriminator) return;
			const schArr = schema;
			const valid = gen.let('valid', false);
			const passing = gen.let('passing', null);
			const schValid = gen.name('_valid');
			cxt.setParams({ passing });
			gen.block(validateOneOf);
			cxt.result(
				valid,
				() => cxt.reset(),
				() => cxt.error(true)
			);
			function validateOneOf() {
				schArr.forEach((sch, i) => {
					let schCxt;
					if ((0, util_1.alwaysValidSchema)(it, sch)) {
						gen.var(schValid, true);
					} else {
						schCxt = cxt.subschema(
							{
								keyword: 'oneOf',
								schemaProp: i,
								compositeRule: true,
							},
							schValid
						);
					}
					if (i > 0) {
						gen.if((0, codegen_1._)`${schValid} && ${valid}`)
							.assign(valid, false)
							.assign(
								passing,
								(0, codegen_1._)`[${passing}, ${i}]`
							)
							.else();
					}
					gen.if(schValid, () => {
						gen.assign(valid, true);
						gen.assign(passing, i);
						if (schCxt) cxt.mergeEvaluated(schCxt, codegen_1.Name);
					});
				});
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var util_1 = require_util();
	var def = {
		keyword: 'allOf',
		schemaType: 'array',
		code(cxt) {
			const { gen, schema, it } = cxt;
			if (!Array.isArray(schema))
				throw new Error('ajv implementation error');
			const valid = gen.name('valid');
			schema.forEach((sch, i) => {
				if ((0, util_1.alwaysValidSchema)(it, sch)) return;
				const schCxt = cxt.subschema(
					{ keyword: 'allOf', schemaProp: i },
					valid
				);
				cxt.ok(valid);
				cxt.mergeEvaluated(schCxt);
			});
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS((exports) => {
	var hasSchema = function (it, keyword) {
		const schema = it.schema[keyword];
		return (
			schema !== undefined && !(0, util_1.alwaysValidSchema)(it, schema)
		);
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var util_1 = require_util();
	var error = {
		message: ({ params }) =>
			(0, codegen_1.str)`must match "${params.ifClause}" schema`,
		params: ({ params }) =>
			(0, codegen_1._)`{failingKeyword: ${params.ifClause}}`,
	};
	var def = {
		keyword: 'if',
		schemaType: ['object', 'boolean'],
		trackErrors: true,
		error,
		code(cxt) {
			const { gen, parentSchema, it } = cxt;
			if (
				parentSchema.then === undefined &&
				parentSchema.else === undefined
			) {
				(0, util_1.checkStrictMode)(
					it,
					'"if" without "then" and "else" is ignored'
				);
			}
			const hasThen = hasSchema(it, 'then');
			const hasElse = hasSchema(it, 'else');
			if (!hasThen && !hasElse) return;
			const valid = gen.let('valid', true);
			const schValid = gen.name('_valid');
			validateIf();
			cxt.reset();
			if (hasThen && hasElse) {
				const ifClause = gen.let('ifClause');
				cxt.setParams({ ifClause });
				gen.if(
					schValid,
					validateClause('then', ifClause),
					validateClause('else', ifClause)
				);
			} else if (hasThen) {
				gen.if(schValid, validateClause('then'));
			} else {
				gen.if((0, codegen_1.not)(schValid), validateClause('else'));
			}
			cxt.pass(valid, () => cxt.error(true));
			function validateIf() {
				const schCxt = cxt.subschema(
					{
						keyword: 'if',
						compositeRule: true,
						createErrors: false,
						allErrors: false,
					},
					schValid
				);
				cxt.mergeEvaluated(schCxt);
			}
			function validateClause(keyword, ifClause) {
				return () => {
					const schCxt = cxt.subschema({ keyword }, schValid);
					gen.assign(valid, schValid);
					cxt.mergeValidEvaluated(schCxt, valid);
					if (ifClause)
						gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
					else cxt.setParams({ ifClause: keyword });
				};
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var util_1 = require_util();
	var def = {
		keyword: ['then', 'else'],
		schemaType: ['object', 'boolean'],
		code({ keyword, parentSchema, it }) {
			if (parentSchema.if === undefined)
				(0, util_1.checkStrictMode)(
					it,
					`"${keyword}" without "if" is ignored`
				);
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS((exports) => {
	var getApplicator = function (draft2020 = false) {
		const applicator = [
			not_1.default,
			anyOf_1.default,
			oneOf_1.default,
			allOf_1.default,
			if_1.default,
			thenElse_1.default,
			propertyNames_1.default,
			additionalProperties_1.default,
			dependencies_1.default,
			properties_1.default,
			patternProperties_1.default,
		];
		if (draft2020)
			applicator.push(prefixItems_1.default, items2020_1.default);
		else applicator.push(additionalItems_1.default, items_1.default);
		applicator.push(contains_1.default);
		return applicator;
	};
	Object.defineProperty(exports, '__esModule', { value: true });
	var additionalItems_1 = require_additionalItems();
	var prefixItems_1 = require_prefixItems();
	var items_1 = require_items();
	var items2020_1 = require_items2020();
	var contains_1 = require_contains();
	var dependencies_1 = require_dependencies();
	var propertyNames_1 = require_propertyNames();
	var additionalProperties_1 = require_additionalProperties();
	var properties_1 = require_properties();
	var patternProperties_1 = require_patternProperties();
	var not_1 = require_not();
	var anyOf_1 = require_anyOf();
	var oneOf_1 = require_oneOf();
	var allOf_1 = require_allOf();
	var if_1 = require_if();
	var thenElse_1 = require_thenElse();
	exports.default = getApplicator;
});

// ../../../node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var error = {
		message: ({ schemaCode }) =>
			(0, codegen_1.str)`must match format "${schemaCode}"`,
		params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`,
	};
	var def = {
		keyword: 'format',
		type: ['number', 'string'],
		schemaType: 'string',
		$data: true,
		error,
		code(cxt, ruleType) {
			const { gen, data, $data, schema, schemaCode, it } = cxt;
			const { opts, errSchemaPath, schemaEnv, self: self2 } = it;
			if (!opts.validateFormats) return;
			if ($data) validate$DataFormat();
			else validateFormat();
			function validate$DataFormat() {
				const fmts = gen.scopeValue('formats', {
					ref: self2.formats,
					code: opts.code.formats,
				});
				const fDef = gen.const(
					'fDef',
					(0, codegen_1._)`${fmts}[${schemaCode}]`
				);
				const fType = gen.let('fType');
				const format = gen.let('format');
				gen.if(
					(0,
					codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`,
					() =>
						gen
							.assign(
								fType,
								(0, codegen_1._)`${fDef}.type || "string"`
							)
							.assign(format, (0, codegen_1._)`${fDef}.validate`),
					() =>
						gen
							.assign(fType, (0, codegen_1._)`"string"`)
							.assign(format, fDef)
				);
				cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
				function unknownFmt() {
					if (opts.strictSchema === false) return codegen_1.nil;
					return (0, codegen_1._)`${schemaCode} && !${format}`;
				}
				function invalidFmt() {
					const callFormat = schemaEnv.$async
						? (0,
						  codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))`
						: (0, codegen_1._)`${format}(${data})`;
					const validData = (0,
					codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
					return (0,
					codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
				}
			}
			function validateFormat() {
				const formatDef = self2.formats[schema];
				if (!formatDef) {
					unknownFormat();
					return;
				}
				if (formatDef === true) return;
				const [fmtType, format, fmtRef] = getFormat(formatDef);
				if (fmtType === ruleType) cxt.pass(validCondition());
				function unknownFormat() {
					if (opts.strictSchema === false) {
						self2.logger.warn(unknownMsg());
						return;
					}
					throw new Error(unknownMsg());
					function unknownMsg() {
						return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
					}
				}
				function getFormat(fmtDef) {
					const code =
						fmtDef instanceof RegExp
							? (0, codegen_1.regexpCode)(fmtDef)
							: opts.code.formats
							? (0, codegen_1._)`${opts.code.formats}${(0,
							  codegen_1.getProperty)(schema)}`
							: undefined;
					const fmt = gen.scopeValue('formats', {
						key: schema,
						ref: fmtDef,
						code,
					});
					if (
						typeof fmtDef == 'object' &&
						!(fmtDef instanceof RegExp)
					) {
						return [
							fmtDef.type || 'string',
							fmtDef.validate,
							(0, codegen_1._)`${fmt}.validate`,
						];
					}
					return ['string', fmtDef, fmt];
				}
				function validCondition() {
					if (
						typeof formatDef == 'object' &&
						!(formatDef instanceof RegExp) &&
						formatDef.async
					) {
						if (!schemaEnv.$async)
							throw new Error('async format in sync schema');
						return (0, codegen_1._)`await ${fmtRef}(${data})`;
					}
					return typeof format == 'function'
						? (0, codegen_1._)`${fmtRef}(${data})`
						: (0, codegen_1._)`${fmtRef}.test(${data})`;
				}
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var format_1 = require_format();
	var format = [format_1.default];
	exports.default = format;
});

// ../../../node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.contentVocabulary = exports.metadataVocabulary = undefined;
	exports.metadataVocabulary = [
		'title',
		'description',
		'default',
		'deprecated',
		'readOnly',
		'writeOnly',
		'examples',
	];
	exports.contentVocabulary = [
		'contentMediaType',
		'contentEncoding',
		'contentSchema',
	];
});

// ../../../node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var core_1 = require_core2();
	var validation_1 = require_validation();
	var applicator_1 = require_applicator();
	var format_1 = require_format2();
	var metadata_1 = require_metadata();
	var draft7Vocabularies = [
		core_1.default,
		validation_1.default,
		(0, applicator_1.default)(),
		format_1.default,
		metadata_1.metadataVocabulary,
		metadata_1.contentVocabulary,
	];
	exports.default = draft7Vocabularies;
});

// ../../../node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.DiscrError = undefined;
	var DiscrError;
	(function (DiscrError2) {
		DiscrError2['Tag'] = 'tag';
		DiscrError2['Mapping'] = 'mapping';
	})((DiscrError = exports.DiscrError || (exports.DiscrError = {})));
});

// ../../../node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS((exports) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	var codegen_1 = require_codegen();
	var types_1 = require_types();
	var compile_1 = require_compile();
	var util_1 = require_util();
	var error = {
		message: ({ params: { discrError, tagName } }) =>
			discrError === types_1.DiscrError.Tag
				? `tag "${tagName}" must be string`
				: `value of tag "${tagName}" must be in oneOf`,
		params: ({ params: { discrError, tag, tagName } }) =>
			(0,
			codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`,
	};
	var def = {
		keyword: 'discriminator',
		type: 'object',
		schemaType: 'object',
		error,
		code(cxt) {
			const { gen, data, schema, parentSchema, it } = cxt;
			const { oneOf } = parentSchema;
			if (!it.opts.discriminator) {
				throw new Error('discriminator: requires discriminator option');
			}
			const tagName = schema.propertyName;
			if (typeof tagName != 'string')
				throw new Error('discriminator: requires propertyName');
			if (schema.mapping)
				throw new Error('discriminator: mapping is not supported');
			if (!oneOf)
				throw new Error('discriminator: requires oneOf keyword');
			const valid = gen.let('valid', false);
			const tag = gen.const(
				'tag',
				(0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`
			);
			gen.if(
				(0, codegen_1._)`typeof ${tag} == "string"`,
				() => validateMapping(),
				() =>
					cxt.error(false, {
						discrError: types_1.DiscrError.Tag,
						tag,
						tagName,
					})
			);
			cxt.ok(valid);
			function validateMapping() {
				const mapping = getMapping();
				gen.if(false);
				for (const tagValue in mapping) {
					gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
					gen.assign(valid, applyTagSchema(mapping[tagValue]));
				}
				gen.else();
				cxt.error(false, {
					discrError: types_1.DiscrError.Mapping,
					tag,
					tagName,
				});
				gen.endIf();
			}
			function applyTagSchema(schemaProp) {
				const _valid = gen.name('valid');
				const schCxt = cxt.subschema(
					{ keyword: 'oneOf', schemaProp },
					_valid
				);
				cxt.mergeEvaluated(schCxt, codegen_1.Name);
				return _valid;
			}
			function getMapping() {
				var _a;
				const oneOfMapping = {};
				const topRequired = hasRequired(parentSchema);
				let tagRequired = true;
				for (let i = 0; i < oneOf.length; i++) {
					let sch = oneOf[i];
					if (
						(sch === null || sch === undefined
							? undefined
							: sch.$ref) &&
						!(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)
					) {
						sch = compile_1.resolveRef.call(
							it.self,
							it.schemaEnv.root,
							it.baseId,
							sch === null || sch === undefined
								? undefined
								: sch.$ref
						);
						if (sch instanceof compile_1.SchemaEnv)
							sch = sch.schema;
					}
					const propSch =
						(_a =
							sch === null || sch === undefined
								? undefined
								: sch.properties) === null || _a === undefined
							? undefined
							: _a[tagName];
					if (typeof propSch != 'object') {
						throw new Error(
							`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`
						);
					}
					tagRequired =
						tagRequired && (topRequired || hasRequired(sch));
					addMappings(propSch, i);
				}
				if (!tagRequired)
					throw new Error(
						`discriminator: "${tagName}" must be required`
					);
				return oneOfMapping;
				function hasRequired({ required }) {
					return (
						Array.isArray(required) && required.includes(tagName)
					);
				}
				function addMappings(sch, i) {
					if (sch.const) {
						addMapping(sch.const, i);
					} else if (sch.enum) {
						for (const tagValue of sch.enum) {
							addMapping(tagValue, i);
						}
					} else {
						throw new Error(
							`discriminator: "properties/${tagName}" must have "const" or "enum"`
						);
					}
				}
				function addMapping(tagValue, i) {
					if (
						typeof tagValue != 'string' ||
						tagValue in oneOfMapping
					) {
						throw new Error(
							`discriminator: "${tagName}" values must be unique strings`
						);
					}
					oneOfMapping[tagValue] = i;
				}
			}
		},
	};
	exports.default = def;
});

// ../../../node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS((exports, module) => {
	module.exports = {
		$schema: 'http://json-schema.org/draft-07/schema#',
		$id: 'http://json-schema.org/draft-07/schema#',
		title: 'Core schema meta-schema',
		definitions: {
			schemaArray: {
				type: 'array',
				minItems: 1,
				items: { $ref: '#' },
			},
			nonNegativeInteger: {
				type: 'integer',
				minimum: 0,
			},
			nonNegativeIntegerDefault0: {
				allOf: [
					{ $ref: '#/definitions/nonNegativeInteger' },
					{ default: 0 },
				],
			},
			simpleTypes: {
				enum: [
					'array',
					'boolean',
					'integer',
					'null',
					'number',
					'object',
					'string',
				],
			},
			stringArray: {
				type: 'array',
				items: { type: 'string' },
				uniqueItems: true,
				default: [],
			},
		},
		type: ['object', 'boolean'],
		properties: {
			$id: {
				type: 'string',
				format: 'uri-reference',
			},
			$schema: {
				type: 'string',
				format: 'uri',
			},
			$ref: {
				type: 'string',
				format: 'uri-reference',
			},
			$comment: {
				type: 'string',
			},
			title: {
				type: 'string',
			},
			description: {
				type: 'string',
			},
			default: true,
			readOnly: {
				type: 'boolean',
				default: false,
			},
			examples: {
				type: 'array',
				items: true,
			},
			multipleOf: {
				type: 'number',
				exclusiveMinimum: 0,
			},
			maximum: {
				type: 'number',
			},
			exclusiveMaximum: {
				type: 'number',
			},
			minimum: {
				type: 'number',
			},
			exclusiveMinimum: {
				type: 'number',
			},
			maxLength: { $ref: '#/definitions/nonNegativeInteger' },
			minLength: { $ref: '#/definitions/nonNegativeIntegerDefault0' },
			pattern: {
				type: 'string',
				format: 'regex',
			},
			additionalItems: { $ref: '#' },
			items: {
				anyOf: [{ $ref: '#' }, { $ref: '#/definitions/schemaArray' }],
				default: true,
			},
			maxItems: { $ref: '#/definitions/nonNegativeInteger' },
			minItems: { $ref: '#/definitions/nonNegativeIntegerDefault0' },
			uniqueItems: {
				type: 'boolean',
				default: false,
			},
			contains: { $ref: '#' },
			maxProperties: { $ref: '#/definitions/nonNegativeInteger' },
			minProperties: { $ref: '#/definitions/nonNegativeIntegerDefault0' },
			required: { $ref: '#/definitions/stringArray' },
			additionalProperties: { $ref: '#' },
			definitions: {
				type: 'object',
				additionalProperties: { $ref: '#' },
				default: {},
			},
			properties: {
				type: 'object',
				additionalProperties: { $ref: '#' },
				default: {},
			},
			patternProperties: {
				type: 'object',
				additionalProperties: { $ref: '#' },
				propertyNames: { format: 'regex' },
				default: {},
			},
			dependencies: {
				type: 'object',
				additionalProperties: {
					anyOf: [
						{ $ref: '#' },
						{ $ref: '#/definitions/stringArray' },
					],
				},
			},
			propertyNames: { $ref: '#' },
			const: true,
			enum: {
				type: 'array',
				items: true,
				minItems: 1,
				uniqueItems: true,
			},
			type: {
				anyOf: [
					{ $ref: '#/definitions/simpleTypes' },
					{
						type: 'array',
						items: { $ref: '#/definitions/simpleTypes' },
						minItems: 1,
						uniqueItems: true,
					},
				],
			},
			format: { type: 'string' },
			contentMediaType: { type: 'string' },
			contentEncoding: { type: 'string' },
			if: { $ref: '#' },
			then: { $ref: '#' },
			else: { $ref: '#' },
			allOf: { $ref: '#/definitions/schemaArray' },
			anyOf: { $ref: '#/definitions/schemaArray' },
			oneOf: { $ref: '#/definitions/schemaArray' },
			not: { $ref: '#' },
		},
		default: true,
	};
});

// ../../../node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS((exports, module) => {
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.MissingRefError =
		exports.ValidationError =
		exports.CodeGen =
		exports.Name =
		exports.nil =
		exports.stringify =
		exports.str =
		exports._ =
		exports.KeywordCxt =
			undefined;
	var core_1 = require_core();
	var draft7_1 = require_draft7();
	var discriminator_1 = require_discriminator();
	var draft7MetaSchema = require_json_schema_draft_07();
	var META_SUPPORT_DATA = ['/properties'];
	var META_SCHEMA_ID = 'http://json-schema.org/draft-07/schema';

	class Ajv extends core_1.default {
		_addVocabularies() {
			super._addVocabularies();
			draft7_1.default.forEach((v) => this.addVocabulary(v));
			if (this.opts.discriminator)
				this.addKeyword(discriminator_1.default);
		}
		_addDefaultMetaSchema() {
			super._addDefaultMetaSchema();
			if (!this.opts.meta) return;
			const metaSchema = this.opts.$data
				? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA)
				: draft7MetaSchema;
			this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
			this.refs['http://json-schema.org/schema'] = META_SCHEMA_ID;
		}
		defaultMeta() {
			return (this.opts.defaultMeta =
				super.defaultMeta() ||
				(this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : undefined));
		}
	}
	module.exports = exports = Ajv;
	Object.defineProperty(exports, '__esModule', { value: true });
	exports.default = Ajv;
	var validate_1 = require_validate();
	Object.defineProperty(exports, 'KeywordCxt', {
		enumerable: true,
		get: function () {
			return validate_1.KeywordCxt;
		},
	});
	var codegen_1 = require_codegen();
	Object.defineProperty(exports, '_', {
		enumerable: true,
		get: function () {
			return codegen_1._;
		},
	});
	Object.defineProperty(exports, 'str', {
		enumerable: true,
		get: function () {
			return codegen_1.str;
		},
	});
	Object.defineProperty(exports, 'stringify', {
		enumerable: true,
		get: function () {
			return codegen_1.stringify;
		},
	});
	Object.defineProperty(exports, 'nil', {
		enumerable: true,
		get: function () {
			return codegen_1.nil;
		},
	});
	Object.defineProperty(exports, 'Name', {
		enumerable: true,
		get: function () {
			return codegen_1.Name;
		},
	});
	Object.defineProperty(exports, 'CodeGen', {
		enumerable: true,
		get: function () {
			return codegen_1.CodeGen;
		},
	});
	var validation_error_1 = require_validation_error();
	Object.defineProperty(exports, 'ValidationError', {
		enumerable: true,
		get: function () {
			return validation_error_1.default;
		},
	});
	var ref_error_1 = require_ref_error();
	Object.defineProperty(exports, 'MissingRefError', {
		enumerable: true,
		get: function () {
			return ref_error_1.default;
		},
	});
});

// ../../php-wasm/node-polyfills/src/lib/current-js-runtime.ts
var currentJsRuntime = (function () {
	if (typeof process !== 'undefined' && process.release?.name === 'node') {
		return 'NODE';
	} else if (typeof window !== 'undefined') {
		return 'WEB';
	} else if (
		typeof WorkerGlobalScope !== 'undefined' &&
		self instanceof WorkerGlobalScope
	) {
		return 'WORKER';
	} else {
		return 'NODE';
	}
})();

// ../../php-wasm/node-polyfills/src/lib/blob.ts
if (currentJsRuntime === 'NODE') {
	let asPromise = function (obj) {
			return new Promise(function (resolve, reject) {
				obj.onload = obj.onerror = function (event) {
					obj.onload = obj.onerror = null;
					if (event.type === 'load') {
						resolve(obj.result);
					} else {
						reject(new Error('Failed to read the blob/file'));
					}
				};
			});
		},
		isByobSupported = function () {
			const inputBytes = new Uint8Array([1, 2, 3, 4]);
			const file = new File([inputBytes], 'test');
			const stream = file.stream();
			try {
				stream.getReader({ mode: 'byob' });
				return true;
			} catch (e) {
				return false;
			}
		};
	if (typeof File === 'undefined') {
		class File2 extends Blob {
			name;
			lastModified;
			lastModifiedDate;
			webkitRelativePath;
			constructor(sources, fileName, options) {
				super(sources);
				let date;
				if (options?.lastModified) {
					date = new Date();
				}
				if (!date || isNaN(date.getFullYear())) {
					date = new Date();
				}
				this.lastModifiedDate = date;
				this.lastModified = date.getMilliseconds();
				this.name = fileName || '';
			}
		}
		global.File = File2;
	}
	if (typeof Blob.prototype.arrayBuffer === 'undefined') {
		Blob.prototype.arrayBuffer = function arrayBuffer() {
			const reader = new FileReader();
			reader.readAsArrayBuffer(this);
			return asPromise(reader);
		};
	}
	if (typeof Blob.prototype.text === 'undefined') {
		Blob.prototype.text = function text() {
			const reader = new FileReader();
			reader.readAsText(this);
			return asPromise(reader);
		};
	}
	if (typeof Blob.prototype.stream === 'undefined' || !isByobSupported()) {
		Blob.prototype.stream = function () {
			let position = 0;
			const blob = this;
			return new ReadableStream({
				type: 'bytes',
				autoAllocateChunkSize: 524288,
				async pull(controller) {
					const view = controller.byobRequest.view;
					const chunk = blob.slice(
						position,
						position + view.byteLength
					);
					const buffer = await chunk.arrayBuffer();
					const uint8array = new Uint8Array(buffer);
					new Uint8Array(view.buffer).set(uint8array);
					const bytesRead = uint8array.byteLength;
					controller.byobRequest.respond(bytesRead);
					position += bytesRead;
					if (position >= blob.size) {
						controller.close();
					}
				},
			});
		};
	}
}

// ../../php-wasm/node-polyfills/src/lib/custom-event.ts
if (currentJsRuntime === 'NODE' && typeof CustomEvent === 'undefined') {
	class CustomEvent2 extends Event {
		detail;
		constructor(name, options = {}) {
			super(name, options);
			this.detail = options.detail;
		}
		initCustomEvent() {}
	}
	globalThis.CustomEvent = CustomEvent2;
}

// ../blueprints/src/lib/utils/wp-content-files-excluded-from-exports.ts
var wpContentFilesExcludedFromExport = [
	'db.php',
	'plugins/akismet',
	'plugins/hello.php',
	'plugins/wordpress-importer',
	'mu-plugins/sqlite-database-integration',
	'mu-plugins/playground-includes',
	'mu-plugins/0-playground.php',
	'themes/twentytwenty',
	'themes/twentytwentyone',
	'themes/twentytwentytwo',
	'themes/twentytwentythree',
	'themes/twentytwentyfour',
	'themes/twentytwentyfive',
	'themes/twentytwentysix',
];
// ../blueprints/src/lib/steps/handlers.ts
var exports_handlers = {};
__export(exports_handlers, {
	zipWpContent: () => {
		{
			return zipWpContent;
		}
	},
	writeFile: () => {
		{
			return writeFile;
		}
	},
	wpCLI: () => {
		{
			return wpCLI;
		}
	},
	updateUserMeta: () => {
		{
			return updateUserMeta;
		}
	},
	unzip: () => {
		{
			return unzip;
		}
	},
	setSiteOptions: () => {
		{
			return setSiteOptions;
		}
	},
	runWpInstallationWizard: () => {
		{
			return runWpInstallationWizard;
		}
	},
	runSql: () => {
		{
			return runSql;
		}
	},
	runPHPWithOptions: () => {
		{
			return runPHPWithOptions;
		}
	},
	runPHP: () => {
		{
			return runPHP;
		}
	},
	rmdir: () => {
		{
			return rmdir;
		}
	},
	rm: () => {
		{
			return rm;
		}
	},
	resetData: () => {
		{
			return resetData;
		}
	},
	request: () => {
		{
			return request;
		}
	},
	mv: () => {
		{
			return mv;
		}
	},
	mkdir: () => {
		{
			return mkdir;
		}
	},
	login: () => {
		{
			return login;
		}
	},
	installTheme: () => {
		{
			return installTheme;
		}
	},
	installPlugin: () => {
		{
			return installPlugin;
		}
	},
	importWxr: () => {
		{
			return importWxr;
		}
	},
	importWordPressFiles: () => {
		{
			return importWordPressFiles;
		}
	},
	exportWXR: () => {
		{
			return exportWXR;
		}
	},
	enableMultisite: () => {
		{
			return enableMultisite;
		}
	},
	defineWpConfigConsts: () => {
		{
			return defineWpConfigConsts;
		}
	},
	defineSiteUrl: () => {
		{
			return defineSiteUrl;
		}
	},
	cp: () => {
		{
			return cp;
		}
	},
	activateTheme: () => {
		{
			return activateTheme;
		}
	},
	activatePlugin: () => {
		{
			return activatePlugin;
		}
	},
});

// ../../php-wasm/util/src/lib/sleep.ts
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(SleepFinished), ms);
	});
}
var SleepFinished = Symbol('SleepFinished');

// ../../php-wasm/util/src/lib/semaphore.ts
class AcquireTimeoutError extends Error {
	constructor() {
		super('Acquiring lock timed out');
	}
}

class Semaphore {
	_running = 0;
	concurrency;
	timeout;
	queue;
	constructor({ concurrency, timeout }) {
		this.concurrency = concurrency;
		this.timeout = timeout;
		this.queue = [];
	}
	get remaining() {
		return this.concurrency - this.running;
	}
	get running() {
		return this._running;
	}
	async acquire() {
		while (true) {
			if (this._running >= this.concurrency) {
				const acquired = new Promise((resolve) => {
					this.queue.push(resolve);
				});
				if (this.timeout !== undefined) {
					await Promise.race([acquired, sleep(this.timeout)]).then(
						(value) => {
							if (value === SleepFinished) {
								throw new AcquireTimeoutError();
							}
						}
					);
				} else {
					await acquired;
				}
			} else {
				this._running++;
				let released = false;
				return () => {
					if (released) {
						return;
					}
					released = true;
					this._running--;
					if (this.queue.length > 0) {
						this.queue.shift()();
					}
				};
			}
		}
	}
	async run(fn) {
		const release = await this.acquire();
		try {
			return await fn();
		} finally {
			release();
		}
	}
}
// ../../php-wasm/util/src/lib/paths.ts
function joinPaths(...paths) {
	let path = paths.join('/');
	const isAbsolute = path[0] === '/';
	const trailingSlash = path.substring(path.length - 1) === '/';
	path = normalizePath(path);
	if (!path && !isAbsolute) {
		path = '.';
	}
	if (path && trailingSlash) {
		path += '/';
	}
	return path;
}
function dirname(path) {
	if (path === '/') {
		return '/';
	}
	path = normalizePath(path);
	const lastSlash = path.lastIndexOf('/');
	if (lastSlash === -1) {
		return '';
	} else if (lastSlash === 0) {
		return '/';
	}
	return path.substr(0, lastSlash);
}
function normalizePath(path) {
	const isAbsolute = path[0] === '/';
	path = normalizePathsArray(
		path.split('/').filter((p) => !!p),
		!isAbsolute
	).join('/');
	return (isAbsolute ? '/' : '') + path.replace(/\/$/, '');
}
function normalizePathsArray(parts, allowAboveRoot) {
	let up = 0;
	for (let i = parts.length - 1; i >= 0; i--) {
		const last = parts[i];
		if (last === '.') {
			parts.splice(i, 1);
		} else if (last === '..') {
			parts.splice(i, 1);
			up++;
		} else if (up) {
			parts.splice(i, 1);
			up--;
		}
	}
	if (allowAboveRoot) {
		for (; up; up--) {
			parts.unshift('..');
		}
	}
	return parts;
}
// ../../php-wasm/util/src/lib/split-shell-command.ts
function splitShellCommand(command) {
	const MODE_UNQUOTED = 0;
	const MODE_IN_QUOTE = 1;
	let mode = MODE_UNQUOTED;
	let quote = '';
	const parts = [];
	let currentPart = '';
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (char === '\\') {
			if (command[i + 1] === '"' || command[i + 1] === "'") {
				i++;
			}
			currentPart += command[i];
		} else if (mode === MODE_UNQUOTED) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
			} else if (char.match(/\s/)) {
				if (currentPart.trim().length) {
					parts.push(currentPart.trim());
				}
				currentPart = char;
			} else if (parts.length && !currentPart) {
				currentPart = parts.pop() + char;
			} else {
				currentPart += char;
			}
		} else if (mode === MODE_IN_QUOTE) {
			if (char === quote) {
				mode = MODE_UNQUOTED;
				quote = '';
			} else {
				currentPart += char;
			}
		}
	}
	if (currentPart) {
		parts.push(currentPart.trim());
	}
	return parts;
}

// ../../php-wasm/util/src/lib/create-spawn-handler.ts
function createSpawnHandler(program) {
	return function (command, argsArray = [], options = {}) {
		const childProcess = new ChildProcess();
		const processApi = new ProcessApi(childProcess);
		setTimeout(async () => {
			let commandArray = [];
			if (argsArray.length) {
				commandArray = [command, ...argsArray];
			} else if (typeof command === 'string') {
				commandArray = splitShellCommand(command);
			} else if (Array.isArray(command)) {
				commandArray = command;
			} else {
				throw new Error('Invalid command ', command);
			}
			try {
				await program(commandArray, processApi, options);
			} catch (e) {
				childProcess.emit('error', e);
				if (
					typeof e === 'object' &&
					e !== null &&
					'message' in e &&
					typeof e.message === 'string'
				) {
					processApi.stderr(e.message);
				}
				processApi.exit(1);
			}
			childProcess.emit('spawn', true);
		});
		return childProcess;
	};
}

class EventEmitter {
	listeners = {};
	emit(eventName, data) {
		if (this.listeners[eventName]) {
			this.listeners[eventName].forEach(function (listener) {
				listener(data);
			});
		}
	}
	on(eventName, listener) {
		if (!this.listeners[eventName]) {
			this.listeners[eventName] = [];
		}
		this.listeners[eventName].push(listener);
	}
}

class ProcessApi extends EventEmitter {
	childProcess;
	exited = false;
	stdinData = [];
	constructor(childProcess) {
		super();
		this.childProcess = childProcess;
		childProcess.on('stdin', (data) => {
			if (this.stdinData) {
				this.stdinData.push(data.slice());
			} else {
				this.emit('stdin', data);
			}
		});
	}
	stdout(data) {
		if (typeof data === 'string') {
			data = new TextEncoder().encode(data);
		}
		this.childProcess.stdout.emit('data', data);
	}
	stdoutEnd() {
		this.childProcess.stdout.emit('end', {});
	}
	stderr(data) {
		if (typeof data === 'string') {
			data = new TextEncoder().encode(data);
		}
		this.childProcess.stderr.emit('data', data);
	}
	stderrEnd() {
		this.childProcess.stderr.emit('end', {});
	}
	exit(code) {
		if (!this.exited) {
			this.exited = true;
			this.childProcess.emit('exit', code);
		}
	}
	flushStdin() {
		if (this.stdinData) {
			for (let i = 0; i < this.stdinData.length; i++) {
				this.emit('stdin', this.stdinData[i]);
			}
		}
		this.stdinData = null;
	}
}
var lastPid = 9743;

class ChildProcess extends EventEmitter {
	pid;
	stdout = new EventEmitter();
	stderr = new EventEmitter();
	stdin;
	constructor(pid = lastPid++) {
		super();
		this.pid = pid;
		const self2 = this;
		this.stdin = {
			write: (data) => {
				self2.emit('stdin', data);
			},
		};
	}
}
// ../../php-wasm/util/src/lib/random-string.ts
function randomString(length = 36, specialChars = '!@#$%^&*()_+=-[]/.,<>?') {
	const chars =
		'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
		specialChars;
	let result = '';
	for (let i = length; i > 0; --i)
		result += chars[Math.floor(Math.random() * chars.length)];
	return result;
}
// ../../php-wasm/util/src/lib/random-filename.ts
function randomFilename() {
	return randomString(36, '-_');
}
// ../../php-wasm/util/src/lib/php-vars.ts
function phpVar(value) {
	return `json_decode(base64_decode('${stringToBase64(
		JSON.stringify(value)
	)}'), true)`;
}
function phpVars(vars) {
	const result = {};
	for (const key in vars) {
		result[key] = phpVar(vars[key]);
	}
	return result;
}
var stringToBase64 = function (str) {
	return bytesToBase64(new TextEncoder().encode(str));
};
var bytesToBase64 = function (bytes) {
	const binString = String.fromCodePoint(...bytes);
	return btoa(binString);
};
// ../../php-wasm/logger/src/lib/handlers/log-to-console.ts
var logToConsole = (log, ...args) => {
	if (typeof log.message === 'string') {
		log.message = prepareLogMessage(log.message);
	} else if (log.message.message && typeof log.message.message === 'string') {
		log.message.message = prepareLogMessage(log.message.message);
	}
	switch (log.severity) {
		case 'Debug':
			console.debug(log.message, ...args);
			break;
		case 'Info':
			console.info(log.message, ...args);
			break;
		case 'Warn':
			console.warn(log.message, ...args);
			break;
		case 'Error':
			console.error(log.message, ...args);
			break;
		case 'Fatal':
			console.error(log.message, ...args);
			break;
		default:
			console.log(log.message, ...args);
	}
};
// ../../php-wasm/logger/src/lib/handlers/log-to-memory.ts
var prepareLogMessage2 = (logMessage) => {
	if (logMessage instanceof Error) {
		return [logMessage.message, logMessage.stack].join('\n');
	}
	return JSON.stringify(logMessage, null, 2);
};
var logs = [];
var addToLogArray = (message) => {
	logs.push(message);
};
var logToMemory = (log) => {
	if (log.raw === true) {
		addToLogArray(log.message);
	} else {
		const message = formatLogEntry(
			typeof log.message === 'object'
				? prepareLogMessage2(log.message)
				: log.message,
			log.severity ?? 'Info',
			log.prefix ?? 'JavaScript'
		);
		addToLogArray(message);
	}
};
// ../../php-wasm/logger/src/lib/logger.ts
class Logger extends EventTarget {
	handlers;
	fatalErrorEvent = 'playground-fatal-error';
	constructor(handlers = []) {
		super();
		this.handlers = handlers;
	}
	getLogs() {
		if (!this.handlers.includes(logToMemory)) {
			this
				.error(`Logs aren't stored because the logToMemory handler isn't registered.
				If you're using a custom logger instance, make sure to register logToMemory handler.
			`);
			return [];
		}
		return [...logs];
	}
	logMessage(log, ...args) {
		for (const handler2 of this.handlers) {
			handler2(log, ...args);
		}
	}
	log(message, ...args) {
		this.logMessage(
			{
				message,
				severity: undefined,
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
	debug(message, ...args) {
		this.logMessage(
			{
				message,
				severity: 'Debug',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
	info(message, ...args) {
		this.logMessage(
			{
				message,
				severity: 'Info',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
	warn(message, ...args) {
		this.logMessage(
			{
				message,
				severity: 'Warn',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
	error(message, ...args) {
		this.logMessage(
			{
				message,
				severity: 'Error',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
}
var getDefaultHandlers = () => {
	try {
		if (false) {
		}
	} catch (e) {}
	return [logToMemory, logToConsole];
};
var logger3 = new Logger(getDefaultHandlers());
var prepareLogMessage = (message) => {
	return message.replace(/\t/g, '');
};
var formatLogEntry = (message, severity, prefix) => {
	const date = new Date();
	const formattedDate = new Intl.DateTimeFormat('en-GB', {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
		timeZone: 'UTC',
	})
		.format(date)
		.replace(/ /g, '-');
	const formattedTime = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZone: 'UTC',
		timeZoneName: 'short',
	}).format(date);
	const now = formattedDate + ' ' + formattedTime;
	message = prepareLogMessage(message);
	return `[${now}] ${prefix} ${severity}: ${message}`;
};
// ../blueprints/src/lib/steps/activate-plugin.ts
var activatePlugin = async (
	playground,
	{ pluginPath, pluginName },
	progress
) => {
	progress?.tracker.setCaption(`Activating ${pluginName || pluginPath}`);
	const docroot = await playground.documentRoot;
	const result = await playground.run({
		code: `<?php
			define( 'WP_ADMIN', true );
			require_once( ${phpVar(docroot)}. "/wp-load.php" );
			require_once( ${phpVar(docroot)}. "/wp-admin/includes/plugin.php" );

			// Set current user to admin
			wp_set_current_user( get_users(array('role' => 'Administrator') )[0]->ID );

			\$plugin_path = ${phpVar(pluginPath)};
			\$response = false;
			if (!is_dir(\$plugin_path)) {
				\$response = activate_plugin(\$plugin_path);
			}

			// Activate plugin by name if activation by path wasn't successful
			if ( null !== \$response ) {
				foreach ( ( glob( \$plugin_path . '/*.php' ) ?: array() ) as \$file ) {
					\$info = get_plugin_data( \$file, false, false );
					if ( ! empty( \$info['Name'] ) ) {
						\$response = activate_plugin( \$file );
						break;
					}
				}
			}

			if ( null === \$response ) {
				die('Plugin activated successfully');
			} else if ( is_wp_error( \$response ) ) {
				throw new Exception( \$response->get_error_message() );
			}

			throw new Exception( 'Unable to activate plugin' );
		`,
	});
	if (result.text !== 'Plugin activated successfully') {
		logger3.debug(result);
		throw new Error(
			`Plugin ${pluginPath} could not be activated \u2013 WordPress exited with no error. ` +
				`Sometimes, when \$_SERVER or site options are not configured correctly, WordPress exits early with a 301 redirect. Inspect the "debug" logs in the console for more details`
		);
	}
};
// ../blueprints/src/lib/steps/activate-theme.ts
var activateTheme = async (playground, { themeFolderName }, progress) => {
	progress?.tracker.setCaption(`Activating ${themeFolderName}`);
	const docroot = await playground.documentRoot;
	const themeFolderPath = `${docroot}/wp-content/themes/${themeFolderName}`;
	if (!(await playground.fileExists(themeFolderPath))) {
		throw new Error(`
			Couldn't activate theme ${themeFolderName}.
			Theme not found at the provided theme path: ${themeFolderPath}.
			Check the theme path to ensure it's correct.
			If the theme is not installed, you can install it using the installTheme step.
			More info can be found in the Blueprint documentation: https://wordpress.github.io/wordpress-playground/blueprints-api/steps/#ActivateThemeStep
		`);
	}
	const result = await playground.run({
		code: `<?php
			define( 'WP_ADMIN', true );
			require_once( getenv('docroot') . "/wp-load.php" );

			// Set current user to admin
			wp_set_current_user( get_users(array('role' => 'Administrator') )[0]->ID );

			switch_theme( getenv('themeFolderName') );

			if( wp_get_theme()->get_stylesheet() !== getenv('themeFolderName') ) {
				throw new Exception( 'Theme ' . getenv('themeFolderName') . ' could not be activated.' );				
			}
			die('Theme activated successfully');
		`,
		env: {
			docroot,
			themeFolderName,
		},
	});
	if (result.text !== 'Theme activated successfully') {
		logger3.debug(result);
		throw new Error(
			`Theme ${themeFolderName} could not be activated \u2013 WordPress exited with no error. ` +
				`Sometimes, when \$_SERVER or site options are not configured correctly, WordPress exits early with a 301 redirect. Inspect the "debug" logs in the console for more details`
		);
	}
};
// ../blueprints/src/lib/steps/run-php.ts
var runPHP = async (playground, { code }) => {
	return await playground.run({ code });
};
// ../blueprints/src/lib/steps/run-php-with-options.ts
var runPHPWithOptions = async (playground, { options }) => {
	return await playground.run(options);
};
// ../blueprints/src/lib/steps/rm.ts
var rm = async (playground, { path }) => {
	await playground.unlink(path);
};

// ../blueprints/src/lib/steps/run-sql.ts
var runSql = async (playground, { sql }, progress) => {
	progress?.tracker.setCaption(`Executing SQL Queries`);
	const sqlFilename = `/tmp/${randomFilename()}.sql`;
	await playground.writeFile(
		sqlFilename,
		new Uint8Array(await sql.arrayBuffer())
	);
	const docroot = await playground.documentRoot;
	const js = phpVars({ docroot, sqlFilename });
	const runPhp = await playground.run({
		code: `<?php
		require_once ${js.docroot} . '/wp-load.php';

		\$handle = fopen(${js.sqlFilename}, 'r');
		\$buffer = '';

		global \$wpdb;

		while (\$bytes = fgets(\$handle)) {
			\$buffer .= \$bytes;

			if (!feof(\$handle) && substr(\$buffer, -1, 1) !== "\n") {
				continue;
			}

			\$wpdb->query(\$buffer);
			\$buffer = '';
		}
	`,
	});
	await rm(playground, { path: sqlFilename });
	return runPhp;
};
// ../blueprints/src/lib/steps/request.ts
var request = async (playground, { request: request2 }) => {
	logger3.warn(
		'Deprecated: The Blueprint step "request" is deprecated and will be removed in a future release.'
	);
	const response = await playground.request(request2);
	if (response.httpStatusCode > 399 || response.httpStatusCode < 200) {
		logger3.warn('WordPress response was', { response });
		throw new Error(
			`Request failed with status ${response.httpStatusCode}`
		);
	}
	return response;
};
// ../blueprints/src/lib/steps/define-wp-config-consts.ts
async function defineBeforeRun(playground, consts) {
	for (const key in consts) {
		await playground.defineConstant(key, consts[key]);
	}
}
async function rewriteDefineCalls(playground, phpCode, consts) {
	await playground.writeFile('/tmp/code.php', phpCode);
	const js = phpVars({
		consts,
	});
	await playground.run({
		code: `${rewriteWpConfigToDefineConstants}
	\$wp_config_path = '/tmp/code.php';
	\$wp_config = file_get_contents(\$wp_config_path);
	\$new_wp_config = rewrite_wp_config_to_define_constants(\$wp_config, ${js.consts});
	file_put_contents(\$wp_config_path, \$new_wp_config);
	`,
	});
	return await playground.readFileAsText('/tmp/code.php');
}
var rewriteWpConfigToDefineConstants = '';
var defineWpConfigConsts = async (
	playground,
	{ consts, method = 'define-before-run' }
) => {
	switch (method) {
		case 'define-before-run':
			await defineBeforeRun(playground, consts);
			break;
		case 'rewrite-wp-config': {
			const documentRoot = await playground.documentRoot;
			const wpConfigPath = joinPaths(documentRoot, '/wp-config.php');
			const wpConfig = await playground.readFileAsText(wpConfigPath);
			const updatedWpConfig = await rewriteDefineCalls(
				playground,
				wpConfig,
				consts
			);
			await playground.writeFile(wpConfigPath, updatedWpConfig);
			break;
		}
		default:
			throw new Error(`Invalid method: ${method}`);
	}
};

// ../blueprints/src/lib/steps/login.ts
var login = async (
	playground,
	{ username = 'admin', password = 'password' } = {},
	progress
) => {
	progress?.tracker.setCaption(progress?.initialCaption || 'Logging in');
	await playground.request({
		url: '/wp-login.php',
	});
	const response = await playground.request({
		url: '/wp-login.php',
		method: 'POST',
		body: {
			log: username,
			pwd: password,
			rememberme: 'forever',
		},
	});
	if (!response.headers?.['location']?.[0]?.includes('/wp-admin/')) {
		logger3.warn('WordPress response was', {
			response,
			text: response.text,
		});
		throw new Error(
			`Failed to log in as ${username} with password ${password}`
		);
	}
};

// ../blueprints/src/lib/steps/site-data.ts
var setSiteOptions = async (php, { options }) => {
	const docroot = await php.documentRoot;
	await php.run({
		code: `<?php
		include ${phpVar(docroot)} . '/wp-load.php';
		\$site_options = ${phpVar(options)};
		foreach(\$site_options as \$name => \$value) {
			update_option(\$name, \$value);
		}
		echo "Success";
		`,
	});
};
var updateUserMeta = async (php, { meta, userId }) => {
	const docroot = await php.documentRoot;
	await php.run({
		code: `<?php
		include ${phpVar(docroot)} . '/wp-load.php';
		\$meta = ${phpVar(meta)};
		foreach(\$meta as \$name => \$value) {
			update_user_meta(${phpVar(userId)}, \$name, \$value);
		}
		`,
	});
};

// ../../php-wasm/scopes/src/index.ts
function isURLScoped(url) {
	return url.pathname.startsWith(`/scope:`);
}
function getURLScope(url) {
	if (isURLScoped(url)) {
		return url.pathname.split('/')[1].split(':')[1];
	}
	return null;
}

// ../blueprints/src/lib/steps/enable-multisite.ts
var jsonToUrlEncoded = function (json) {
	return Object.keys(json)
		.map(
			(key) =>
				encodeURIComponent(key) + '=' + encodeURIComponent(json[key])
		)
		.join('&');
};
var enableMultisite = async (playground) => {
	await defineWpConfigConsts(playground, {
		consts: {
			WP_ALLOW_MULTISITE: 1,
		},
	});
	const url = new URL(await playground.absoluteUrl);
	if (url.port !== '') {
		let errorMessage = `The current host is ${url.host}, but WordPress multisites do not support custom ports.`;
		if (url.hostname === 'localhost') {
			errorMessage += ` For development, you can set up a playground.test domain using the instructions at https://wordpress.github.io/wordpress-playground/contributing/code.`;
		}
		throw new Error(errorMessage);
	}
	const sitePath = url.pathname.replace(/\/$/, '') + '/';
	const siteUrl = `${url.protocol}//${url.hostname}${sitePath}`;
	await setSiteOptions(playground, {
		options: {
			siteurl: siteUrl,
			home: siteUrl,
		},
	});
	await login(playground, {});
	const docroot = await playground.documentRoot;
	const result = await playground.run({
		code: `<?php
define( 'WP_ADMIN', true );
require_once(${phpVar(docroot)} . "/wp-load.php");

// Set current user to admin
( get_users(array('role' => 'Administrator') )[0] );

require_once(${phpVar(docroot)} . "/wp-admin/includes/plugin.php");
\$plugins_root = ${phpVar(docroot)} . "/wp-content/plugins";
\$plugins = glob(\$plugins_root . "/*");

\$deactivated_plugins = [];
foreach(\$plugins as \$plugin_path) {
	if (str_ends_with(\$plugin_path, '/index.php')) {
		continue;
	}
	if (!is_dir(\$plugin_path)) {
		\$deactivated_plugins[] = substr(\$plugin_path, strlen(\$plugins_root) + 1);
		deactivate_plugins(\$plugin_path);
		continue;
	}
	// Find plugin entry file
	foreach ( ( glob( \$plugin_path . '/*.php' ) ?: array() ) as \$file ) {
		\$info = get_plugin_data( \$file, false, false );
		if ( ! empty( \$info['Name'] ) ) {
			deactivate_plugins( \$file );
			\$deactivated_plugins[] = substr(\$file, strlen(\$plugins_root) + 1);
			break;
		}
	}
}
echo json_encode(\$deactivated_plugins);
`,
	});
	const deactivatedPlugins = result.json;
	const networkForm = await request(playground, {
		request: {
			url: '/wp-admin/network.php',
		},
	});
	const nonce = networkForm.text.match(
		/name="_wpnonce"\s+value="([^"]+)"/
	)?.[1];
	const response = await request(playground, {
		request: {
			url: '/wp-admin/network.php',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: jsonToUrlEncoded({
				_wpnonce: nonce,
				_wp_http_referer: sitePath + 'wp-admin/network.php',
				sitename: 'My WordPress Website Sites',
				email: 'admin@localhost.com',
				submit: 'Install',
			}),
		},
	});
	if (response.httpStatusCode !== 200) {
		logger3.warn('WordPress response was', {
			response,
			text: response.text,
			headers: response.headers,
		});
		throw new Error(
			`Failed to enable multisite. Response code was ${response.httpStatusCode}`
		);
	}
	await defineWpConfigConsts(playground, {
		consts: {
			MULTISITE: true,
			SUBDOMAIN_INSTALL: false,
			SITE_ID_CURRENT_SITE: 1,
			BLOG_ID_CURRENT_SITE: 1,
			DOMAIN_CURRENT_SITE: url.hostname,
			PATH_CURRENT_SITE: sitePath,
		},
	});
	const playgroundUrl = new URL(await playground.absoluteUrl);
	const wpInstallationFolder = isURLScoped(playgroundUrl)
		? 'scope:' + getURLScope(playgroundUrl)
		: null;
	await playground.writeFile(
		'/internal/shared/preload/sunrise.php',
		`<?php
	\$_SERVER['HTTP_HOST'] = ${phpVar(playgroundUrl.hostname)};
	\$folder = ${phpVar(wpInstallationFolder)};
	if (\$folder && strpos(\$_SERVER['REQUEST_URI'],"/\$folder") === false) {
		\$_SERVER['REQUEST_URI'] = "/\$folder/" . ltrim(\$_SERVER['REQUEST_URI'], '/');
	}
`
	);
	await playground.writeFile(
		'/internal/shared/mu-plugins/sunrise.php',
		`<?php
		if ( !defined( 'BLOG_ID_CURRENT_SITE' ) ) {
			define( 'BLOG_ID_CURRENT_SITE', 1 );
		}
`
	);
	await login(playground, {});
	for (const plugin of deactivatedPlugins) {
		await activatePlugin(playground, {
			pluginPath: plugin,
		});
	}
};
// ../blueprints/src/lib/steps/cp.ts
var cp = async (playground, { fromPath, toPath }) => {
	await playground.writeFile(
		toPath,
		await playground.readFileAsBuffer(fromPath)
	);
};
// ../blueprints/src/lib/steps/mv.ts
var mv = async (playground, { fromPath, toPath }) => {
	await playground.mv(fromPath, toPath);
};
// ../blueprints/src/lib/steps/mkdir.ts
var mkdir = async (playground, { path }) => {
	await playground.mkdir(path);
};
// ../blueprints/src/lib/steps/rmdir.ts
var rmdir = async (playground, { path }) => {
	await playground.rmdir(path);
};
// ../blueprints/src/lib/steps/write-file.ts
var writeFile = async (playground, { path, data }) => {
	if (data instanceof File) {
		data = new Uint8Array(await data.arrayBuffer());
	}
	if (
		path.startsWith('/wordpress/wp-content/mu-plugins') &&
		!(await playground.fileExists('/wordpress/wp-content/mu-plugins'))
	) {
		await playground.mkdir('/wordpress/wp-content/mu-plugins');
	}
	await playground.writeFile(path, data);
};
// ../blueprints/src/lib/steps/define-site-url.ts
var defineSiteUrl = async (playground, { siteUrl }) => {
	await defineWpConfigConsts(playground, {
		consts: {
			WP_HOME: siteUrl,
			WP_SITEURL: siteUrl,
		},
	});
};
// ../blueprints/src/lib/steps/import-wxr.ts
var importWxr = async (playground, { file }, progress) => {
	progress?.tracker?.setCaption('Importing content');
	await writeFile(playground, {
		path: '/tmp/import.wxr',
		data: file,
	});
	const docroot = await playground.documentRoot;
	await playground.run({
		code: `<?php
		require ${phpVar(docroot)} . '/wp-load.php';
		require ${phpVar(docroot)} . '/wp-admin/includes/admin.php';
  
		kses_remove_filters();
		\$admin_id = get_users(array('role' => 'Administrator') )[0]->ID;
        wp_set_current_user( \$admin_id );
		\$importer = new WXR_Importer( array(
			'fetch_attachments' => true,
			'default_author' => \$admin_id
		) );
		\$logger = new WP_Importer_Logger_CLI();
		\$importer->set_logger( \$logger );

		// Slashes from the imported content are lost if we don't call wp_slash here.
		add_action( 'wp_insert_post_data', function( \$data ) {
			return wp_slash(\$data);
		});

		\$result = \$importer->import( '/tmp/import.wxr' );
		`,
	});
};
// ../common/src/index.ts
var tmpPath = '/tmp/file.zip';
var unzipFile = async (php, zipPath, extractToPath) => {
	if (zipPath instanceof File) {
		const zipFile = zipPath;
		zipPath = tmpPath;
		await php.writeFile(
			zipPath,
			new Uint8Array(await zipFile.arrayBuffer())
		);
	}
	const js = phpVars({
		zipPath,
		extractToPath,
	});
	await php.run({
		code: `<?php
        function unzip(\$zipPath, \$extractTo, \$overwrite = true)
        {
            if (!is_dir(\$extractTo)) {
                mkdir(\$extractTo, 0777, true);
            }
            \$zip = new ZipArchive;
            \$res = \$zip->open(\$zipPath);
            if (\$res === TRUE) {
                \$zip->extractTo(\$extractTo);
                \$zip->close();
                chmod(\$extractTo, 0777);
            } else {
                throw new Exception("Could not unzip file");
            }
        }
        unzip(${js.zipPath}, ${js.extractToPath});
        `,
	});
	if (await php.fileExists(tmpPath)) {
		await php.unlink(tmpPath);
	}
};

// ../blueprints/src/lib/steps/unzip.ts
var unzip = async (playground, { zipFile, zipPath, extractToPath }) => {
	if (zipPath) {
		logger3.warn(
			`The "zipPath" option of the unzip() Blueprint step is deprecated and will be removed. Use "zipFile" instead.`
		);
	} else if (!zipFile) {
		throw new Error('Either zipPath or zipFile must be provided');
	}
	await unzipFile(playground, zipFile || zipPath, extractToPath);
};

// ../blueprints/src/lib/steps/import-wordpress-files.ts
async function removePath(playground, path) {
	if (await playground.fileExists(path)) {
		if (await playground.isDir(path)) {
			await playground.rmdir(path);
		} else {
			await playground.unlink(path);
		}
	}
}
var importWordPressFiles = async (
	playground,
	{ wordPressFilesZip, pathInZip = '' }
) => {
	const documentRoot = await playground.documentRoot;
	let importPath = joinPaths('/tmp', 'import');
	await playground.mkdir(importPath);
	await unzip(playground, {
		zipFile: wordPressFilesZip,
		extractToPath: importPath,
	});
	importPath = joinPaths(importPath, pathInZip);
	const importedWpContentPath = joinPaths(importPath, 'wp-content');
	const wpContentPath = joinPaths(documentRoot, 'wp-content');
	for (const relativePath of wpContentFilesExcludedFromExport) {
		const excludedImportPath = joinPaths(
			importedWpContentPath,
			relativePath
		);
		await removePath(playground, excludedImportPath);
		const restoreFromPath = joinPaths(wpContentPath, relativePath);
		if (await playground.fileExists(restoreFromPath)) {
			await playground.mkdir(dirname(excludedImportPath));
			await playground.mv(restoreFromPath, excludedImportPath);
		}
	}
	const importedDatabasePath = joinPaths(
		importPath,
		'wp-content',
		'database'
	);
	if (!(await playground.fileExists(importedDatabasePath))) {
		await playground.mv(
			joinPaths(documentRoot, 'wp-content', 'database'),
			importedDatabasePath
		);
	}
	const importedFilenames = await playground.listFiles(importPath);
	for (const fileName of importedFilenames) {
		await removePath(playground, joinPaths(documentRoot, fileName));
		await playground.mv(
			joinPaths(importPath, fileName),
			joinPaths(documentRoot, fileName)
		);
	}
	await playground.rmdir(importPath);
	await defineSiteUrl(playground, {
		siteUrl: await playground.absoluteUrl,
	});
	const upgradePhp = phpVar(
		joinPaths(documentRoot, 'wp-admin', 'upgrade.php')
	);
	await playground.run({
		code: `<?php
            \$_GET['step'] = 'upgrade_db';
            require ${upgradePhp};
            `,
	});
};
// ../blueprints/src/lib/steps/export-wxr.ts
async function exportWXR(playground) {
	const databaseExportResponse = await playground.request({
		url: '/wp-admin/export.php?download=true&content=all',
	});
	return new File([databaseExportResponse.bytes], 'export.xml');
}
// ../blueprints/src/lib/steps/install-asset.ts
async function installAsset(
	playground,
	{ targetPath, zipFile, ifAlreadyInstalled = 'overwrite' }
) {
	const zipFileName = zipFile.name;
	const assetNameGuess = zipFileName.replace(/\.zip$/, '');
	const wpContent = joinPaths(await playground.documentRoot, 'wp-content');
	const tmpDir = joinPaths(wpContent, randomString());
	const tmpUnzippedFilesPath = joinPaths(tmpDir, 'assets', assetNameGuess);
	if (await playground.fileExists(tmpUnzippedFilesPath)) {
		await playground.rmdir(tmpDir, {
			recursive: true,
		});
	}
	await playground.mkdir(tmpDir);
	try {
		await unzip(playground, {
			zipFile,
			extractToPath: tmpUnzippedFilesPath,
		});
		let files = await playground.listFiles(tmpUnzippedFilesPath, {
			prependPath: true,
		});
		files = files.filter((name) => !name.endsWith('/__MACOSX'));
		const zipHasRootFolder =
			files.length === 1 && (await playground.isDir(files[0]));
		let assetFolderName;
		let tmpAssetPath = '';
		if (zipHasRootFolder) {
			tmpAssetPath = files[0];
			assetFolderName = files[0].split('/').pop();
		} else {
			tmpAssetPath = tmpUnzippedFilesPath;
			assetFolderName = assetNameGuess;
		}
		const assetFolderPath = `${targetPath}/${assetFolderName}`;
		if (await playground.fileExists(assetFolderPath)) {
			if (!(await playground.isDir(assetFolderPath))) {
				throw new Error(
					`Cannot install asset ${assetFolderName} to ${assetFolderPath} because a file with the same name already exists. Note it's a file, not a directory! Is this by mistake?`
				);
			}
			if (ifAlreadyInstalled === 'overwrite') {
				await playground.rmdir(assetFolderPath, {
					recursive: true,
				});
			} else if (ifAlreadyInstalled === 'skip') {
				return {
					assetFolderPath,
					assetFolderName,
				};
			} else {
				throw new Error(
					`Cannot install asset ${assetFolderName} to ${targetPath} because it already exists and ` +
						`the ifAlreadyInstalled option was set to ${ifAlreadyInstalled}`
				);
			}
		}
		await playground.mv(tmpAssetPath, assetFolderPath);
		return {
			assetFolderPath,
			assetFolderName,
		};
	} finally {
		await playground.rmdir(tmpDir, {
			recursive: true,
		});
	}
}

// ../blueprints/src/lib/utils/zip-name-to-human-name.ts
function zipNameToHumanName(zipName) {
	const mixedCaseName = zipName.split('.').shift().replace(/-/g, ' ');
	return (
		mixedCaseName.charAt(0).toUpperCase() +
		mixedCaseName.slice(1).toLowerCase()
	);
}

// ../blueprints/src/lib/steps/install-plugin.ts
var installPlugin = async (
	playground,
	{ pluginZipFile, ifAlreadyInstalled, options = {} },
	progress
) => {
	const zipFileName = pluginZipFile.name.split('/').pop() || 'plugin.zip';
	const zipNiceName = zipNameToHumanName(zipFileName);
	progress?.tracker.setCaption(`Installing the ${zipNiceName} plugin`);
	const { assetFolderPath } = await installAsset(playground, {
		ifAlreadyInstalled,
		zipFile: pluginZipFile,
		targetPath: `${await playground.documentRoot}/wp-content/plugins`,
	});
	const activate = 'activate' in options ? options.activate : true;
	if (activate) {
		await activatePlugin(
			playground,
			{
				pluginPath: assetFolderPath,
				pluginName: zipNiceName,
			},
			progress
		);
	}
};
// ../blueprints/src/lib/steps/install-theme.ts
var installTheme = async (
	playground,
	{ themeZipFile, ifAlreadyInstalled, options = {} },
	progress
) => {
	const zipNiceName = zipNameToHumanName(themeZipFile.name);
	progress?.tracker.setCaption(`Installing the ${zipNiceName} theme`);
	const { assetFolderName } = await installAsset(playground, {
		ifAlreadyInstalled,
		zipFile: themeZipFile,
		targetPath: `${await playground.documentRoot}/wp-content/themes`,
	});
	const activate = 'activate' in options ? options.activate : true;
	if (activate) {
		await activateTheme(
			playground,
			{
				themeFolderName: assetFolderName,
			},
			progress
		);
	}
};
// ../blueprints/src/lib/steps/reset-data.ts
var resetData = async (playground, _options, progress) => {
	progress?.tracker?.setCaption('Resetting WordPress data');
	const docroot = await playground.documentRoot;
	await playground.run({
		env: {
			DOCROOT: docroot,
		},
		code: `<?php
		require getenv('DOCROOT') . '/wp-load.php';

		\$GLOBALS['@pdo']->query('DELETE FROM wp_posts WHERE id > 0');
		\$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_posts'");
		
		\$GLOBALS['@pdo']->query('DELETE FROM wp_postmeta WHERE post_id > 1');
		\$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=20 WHERE NAME='wp_postmeta'");

		\$GLOBALS['@pdo']->query('DELETE FROM wp_comments');
		\$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_comments'");

		\$GLOBALS['@pdo']->query('DELETE FROM wp_commentmeta');
		\$GLOBALS['@pdo']->query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='wp_commentmeta'");
		`,
	});
};
// ../blueprints/src/lib/steps/run-wp-installation-wizard.ts
var runWpInstallationWizard = async (playground, { options }) => {
	await playground.request({
		url: '/wp-admin/install.php?step=2',
		method: 'POST',
		body: {
			language: 'en',
			prefix: 'wp_',
			weblog_title: 'My WordPress Website',
			user_name: options.adminPassword || 'admin',
			admin_password: options.adminPassword || 'password',
			admin_password2: options.adminPassword || 'password',
			Submit: 'Install WordPress',
			pw_weak: '1',
			admin_email: 'admin@localhost.com',
		},
	});
};
// ../blueprints/src/lib/steps/zip-wp-content.ts
async function runPhpWithZipFunctions(playground, code) {
	return await playground.run({
		code: zipFunctions + code,
	});
}
var zipWpContent = async (playground, { selfContained = false } = {}) => {
	const zipPath = '/tmp/wordpress-playground.zip';
	const documentRoot = await playground.documentRoot;
	const wpContentPath = joinPaths(documentRoot, 'wp-content');
	let exceptPaths = wpContentFilesExcludedFromExport;
	if (selfContained) {
		exceptPaths = exceptPaths
			.filter((path) => !path.startsWith('themes/twenty'))
			.filter(
				(path) => path !== 'mu-plugins/sqlite-database-integration'
			);
	}
	const js = phpVars({
		zipPath,
		wpContentPath,
		documentRoot,
		exceptPaths: exceptPaths.map((path) =>
			joinPaths(documentRoot, 'wp-content', path)
		),
		additionalPaths: selfContained
			? {
					[joinPaths(documentRoot, 'wp-config.php')]: 'wp-config.php',
			  }
			: {},
	});
	await runPhpWithZipFunctions(
		playground,
		`zipDir(${js.wpContentPath}, ${js.zipPath}, array(
			'exclude_paths' => ${js.exceptPaths},
			'zip_root'      => ${js.documentRoot},
			'additional_paths' => ${js.additionalPaths}
		));`
	);
	const fileBuffer = await playground.readFileAsBuffer(zipPath);
	playground.unlink(zipPath);
	return fileBuffer;
};
var zipFunctions = `<?php

function zipDir(\$root, \$output, \$options = array())
{
    \$root = rtrim(\$root, '/');
    \$additionalPaths = array_key_exists('additional_paths', \$options) ? \$options['additional_paths'] : array();
    \$excludePaths = array_key_exists('exclude_paths', \$options) ? \$options['exclude_paths'] : array();
    \$zip_root = array_key_exists('zip_root', \$options) ? \$options['zip_root'] : \$root;

    \$zip = new ZipArchive;
    \$res = \$zip->open(\$output, ZipArchive::CREATE);
    if (\$res === TRUE) {
        \$directories = array(
            \$root . '/'
        );
        while (sizeof(\$directories)) {
            \$current_dir = array_pop(\$directories);

            if (\$handle = opendir(\$current_dir)) {
                while (false !== (\$entry = readdir(\$handle))) {
                    if (\$entry == '.' || \$entry == '..') {
                        continue;
                    }

                    \$entry = join_paths(\$current_dir, \$entry);
                    if (in_array(\$entry, \$excludePaths)) {
                        continue;
                    }

                    if (is_dir(\$entry)) {
                        \$directory_path = \$entry . '/';
                        array_push(\$directories, \$directory_path);
                    } else if (is_file(\$entry)) {
                        \$zip->addFile(\$entry, substr(\$entry, strlen(\$zip_root)));
                    }
                }
                closedir(\$handle);
            }
        }
        foreach (\$additionalPaths as \$disk_path => \$zip_path) {
            \$zip->addFile(\$disk_path, \$zip_path);
        }
        \$zip->close();
        chmod(\$output, 0777);
    }
}

function join_paths()
{
    \$paths = array();

    foreach (func_get_args() as \$arg) {
        if (\$arg !== '') {
            \$paths[] = \$arg;
        }
    }

    return preg_replace('#/+#', '/', join('/', \$paths));
}
`;
// ../blueprints/src/lib/steps/wp-cli.ts
function splitShellCommand2(command) {
	const MODE_NORMAL = 0;
	const MODE_IN_QUOTE = 1;
	let mode = MODE_NORMAL;
	let quote = '';
	const parts = [];
	let currentPart = '';
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (mode === MODE_NORMAL) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
			} else if (char.match(/\s/)) {
				if (currentPart) {
					parts.push(currentPart);
				}
				currentPart = '';
			} else {
				currentPart += char;
			}
		} else if (mode === MODE_IN_QUOTE) {
			if (char === '\\') {
				i++;
				currentPart += command[i];
			} else if (char === quote) {
				mode = MODE_NORMAL;
				quote = '';
			} else {
				currentPart += char;
			}
		}
	}
	if (currentPart) {
		parts.push(currentPart);
	}
	return parts;
}
var wpCLI = async (playground, { command, wpCliPath = '/tmp/wp-cli.phar' }) => {
	if (!(await playground.fileExists(wpCliPath))) {
		throw new Error(`wp-cli.phar not found at ${wpCliPath}`);
	}
	let args;
	if (typeof command === 'string') {
		command = command.trim();
		args = splitShellCommand2(command);
	} else {
		args = command;
	}
	const cmd = args.shift();
	if (cmd !== 'wp') {
		throw new Error(`The first argument must be "wp".`);
	}
	await playground.writeFile('/tmp/stdout', '');
	await playground.writeFile('/tmp/stderr', '');
	await playground.writeFile(
		'/wordpress/run-cli.php',
		`<?php
		// Set up the environment to emulate a shell script
		// call.

		// Set SHELL_PIPE to 0 to ensure WP-CLI formats
		// the output as ASCII tables.
		// @see https://github.com/wp-cli/wp-cli/issues/1102
		putenv( 'SHELL_PIPE=0' );

		// Set the argv global.
		\$GLOBALS['argv'] = array_merge([
		  "/tmp/wp-cli.phar",
		  "--path=/wordpress"
		], ${phpVar(args)});

		// Provide stdin, stdout, stderr streams outside of
		// the CLI SAPI.
		define('STDIN', fopen('php://stdin', 'rb'));
		define('STDOUT', fopen('php://stdout', 'wb'));
		define('STDERR', fopen('php://stderr', 'wb'));

		require( ${phpVar(wpCliPath)} );
		`
	);
	const result = await playground.run({
		scriptPath: '/wordpress/run-cli.php',
	});
	if (result.errors) {
		throw new Error(result.errors);
	}
	return result;
};
// ../../php-wasm/progress/src/lib/emscripten-download-monitor.ts
var sumValues = function (obj) {
	return Object.values(obj).reduce((total, value) => total + value, 0);
};
function cloneResponseMonitorProgress(response, onProgress) {
	const contentLength = response.headers.get('content-length') || '';
	const total = parseInt(contentLength, 10) || FALLBACK_FILE_SIZE;
	function notify(loaded, total2) {
		onProgress(
			new CustomEvent('progress', {
				detail: {
					loaded,
					total: total2,
				},
			})
		);
	}
	return new Response(
		new ReadableStream({
			async start(controller) {
				if (!response.body) {
					controller.close();
					return;
				}
				const reader = response.body.getReader();
				let loaded = 0;
				for (;;) {
					try {
						const { done, value } = await reader.read();
						if (value) {
							loaded += value.byteLength;
						}
						if (done) {
							notify(loaded, loaded);
							controller.close();
							break;
						} else {
							notify(loaded, total);
							controller.enqueue(value);
						}
					} catch (e) {
						logger3.error({ e });
						controller.error(e);
						break;
					}
				}
			},
		}),
		{
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		}
	);
}
var FALLBACK_FILE_SIZE = 5242880;

class EmscriptenDownloadMonitor extends EventTarget {
	constructor() {
		super(...arguments);
	}
	#assetsSizes = {};
	#progress = {};
	expectAssets(assets) {
		for (const [urlLike, size] of Object.entries(assets)) {
			const dummyBaseUrl = 'http://example.com/';
			const pathname = new URL(urlLike, dummyBaseUrl).pathname;
			const filename = pathname.split('/').pop();
			if (!(filename in this.#assetsSizes)) {
				this.#assetsSizes[filename] = size;
			}
			if (!(filename in this.#progress)) {
				this.#progress[filename] = 0;
			}
		}
	}
	async monitorFetch(fetchPromise) {
		const response = await fetchPromise;
		const onProgress = (event) => {
			this.#notify(response.url, event.detail.loaded, event.detail.total);
		};
		return cloneResponseMonitorProgress(response, onProgress);
	}
	#notify(file, loaded, fileSize) {
		const fileName = new URL(file, 'http://example.com').pathname
			.split('/')
			.pop();
		if (!fileSize) {
			fileSize = this.#assetsSizes[fileName];
		} else if (!(fileName in this.#assetsSizes)) {
			this.#assetsSizes[fileName] = fileSize;
			this.#progress[fileName] = loaded;
		}
		if (!(fileName in this.#progress)) {
			logger3.warn(
				`Registered a download #progress of an unregistered file "${fileName}". ` +
					`This may cause a sudden **decrease** in the #progress percentage as the total number of bytes increases during the download.`
			);
		}
		this.#progress[fileName] = loaded;
		this.dispatchEvent(
			new CustomEvent('progress', {
				detail: {
					loaded: sumValues(this.#progress),
					total: sumValues(this.#assetsSizes),
				},
			})
		);
	}
}
// ../../php-wasm/progress/src/lib/progress-observer.ts
class ProgressObserver extends EventTarget {
	constructor() {
		super(...arguments);
	}
	#observedProgresses = {};
	#lastObserverId = 0;
	progress = 0;
	mode = 'REAL_TIME';
	caption = '';
	partialObserver(progressBudget, caption = '') {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = 0;
		return (progress) => {
			const { loaded, total } = progress?.detail || {};
			this.#observedProgresses[id] = (loaded / total) * progressBudget;
			this.#onProgress(this.totalProgress, 'REAL_TIME', caption);
		};
	}
	slowlyIncrementBy(progress) {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = progress;
		this.#onProgress(this.totalProgress, 'SLOWLY_INCREMENT');
	}
	get totalProgress() {
		return Object.values(this.#observedProgresses).reduce(
			(total, progress) => total + progress,
			0
		);
	}
	#onProgress(progress, mode, caption) {
		this.dispatchEvent(
			new CustomEvent('progress', {
				detail: {
					progress,
					mode,
					caption,
				},
			})
		);
	}
}
// ../../php-wasm/universal/src/lib/emscripten-types.ts
var Emscripten;
(function (Emscripten) {
	let FS;
	(function (FS) {})((FS = Emscripten.FS || (Emscripten.FS = {})));
})(Emscripten || (Emscripten = {}));

// ../../php-wasm/universal/src/lib/rethrow-file-system-error.ts
function getEmscriptenFsError(e) {
	const errno = typeof e === 'object' ? e?.errno : null;
	if (errno in FileErrorCodes) {
		return FileErrorCodes[errno];
	}
}
function rethrowFileSystemError(messagePrefix = '') {
	return function catchFileSystemError(target, methodName, descriptor) {
		const method = descriptor.value;
		descriptor.value = function (...args) {
			try {
				return method.apply(this, args);
			} catch (e) {
				const errno = typeof e === 'object' ? e?.errno : null;
				if (errno in FileErrorCodes) {
					const errmsg = FileErrorCodes[errno];
					const path = typeof args[1] === 'string' ? args[1] : null;
					const formattedPrefix =
						path !== null
							? messagePrefix.replaceAll('{path}', path)
							: messagePrefix;
					throw new Error(`${formattedPrefix}: ${errmsg}`, {
						cause: e,
					});
				}
				throw e;
			}
		};
	};
}
var FileErrorCodes = {
	0: 'No error occurred. System call completed successfully.',
	1: 'Argument list too long.',
	2: 'Permission denied.',
	3: 'Address in use.',
	4: 'Address not available.',
	5: 'Address family not supported.',
	6: 'Resource unavailable, or operation would block.',
	7: 'Connection already in progress.',
	8: 'Bad file descriptor.',
	9: 'Bad message.',
	10: 'Device or resource busy.',
	11: 'Operation canceled.',
	12: 'No child processes.',
	13: 'Connection aborted.',
	14: 'Connection refused.',
	15: 'Connection reset.',
	16: 'Resource deadlock would occur.',
	17: 'Destination address required.',
	18: 'Mathematics argument out of domain of function.',
	19: 'Reserved.',
	20: 'File exists.',
	21: 'Bad address.',
	22: 'File too large.',
	23: 'Host is unreachable.',
	24: 'Identifier removed.',
	25: 'Illegal byte sequence.',
	26: 'Operation in progress.',
	27: 'Interrupted function.',
	28: 'Invalid argument.',
	29: 'I/O error.',
	30: 'Socket is connected.',
	31: 'There is a directory under that path.',
	32: 'Too many levels of symbolic links.',
	33: 'File descriptor value too large.',
	34: 'Too many links.',
	35: 'Message too large.',
	36: 'Reserved.',
	37: 'Filename too long.',
	38: 'Network is down.',
	39: 'Connection aborted by network.',
	40: 'Network unreachable.',
	41: 'Too many files open in system.',
	42: 'No buffer space available.',
	43: 'No such device.',
	44: 'There is no such file or directory OR the parent directory does not exist.',
	45: 'Executable file format error.',
	46: 'No locks available.',
	47: 'Reserved.',
	48: 'Not enough space.',
	49: 'No message of the desired type.',
	50: 'Protocol not available.',
	51: 'No space left on device.',
	52: 'Function not supported.',
	53: 'The socket is not connected.',
	54: 'Not a directory or a symbolic link to a directory.',
	55: 'Directory not empty.',
	56: 'State not recoverable.',
	57: 'Not a socket.',
	58: 'Not supported, or operation not supported on socket.',
	59: 'Inappropriate I/O control operation.',
	60: 'No such device or address.',
	61: 'Value too large to be stored in data type.',
	62: 'Previous owner died.',
	63: 'Operation not permitted.',
	64: 'Broken pipe.',
	65: 'Protocol error.',
	66: 'Protocol not supported.',
	67: 'Protocol wrong type for socket.',
	68: 'Result too large.',
	69: 'Read-only file system.',
	70: 'Invalid seek.',
	71: 'No such process.',
	72: 'Reserved.',
	73: 'Connection timed out.',
	74: 'Text file busy.',
	75: 'Cross-device link.',
	76: 'Extension: Capabilities insufficient.',
};

// ../../php-wasm/universal/src/lib/fs-helpers.ts
class FSHelpers {
	static readFileAsText(FS, path) {
		return new TextDecoder().decode(FSHelpers.readFileAsBuffer(FS, path));
	}
	static readFileAsBuffer(FS, path) {
		return FS.readFile(path);
	}
	static writeFile(FS, path, data) {
		FS.writeFile(path, data);
	}
	static unlink(FS, path) {
		FS.unlink(path);
	}
	static mv(FS, fromPath, toPath) {
		try {
			const fromMount = FS.lookupPath(fromPath).node.mount;
			const toMount = FSHelpers.fileExists(FS, toPath)
				? FS.lookupPath(toPath).node.mount
				: FS.lookupPath(dirname(toPath)).node.mount;
			const movingBetweenFilesystems =
				fromMount.mountpoint !== toMount.mountpoint;
			if (movingBetweenFilesystems) {
				FSHelpers.copyRecursive(FS, fromPath, toPath);
				FSHelpers.rmdir(FS, fromPath, { recursive: true });
			} else {
				FS.rename(fromPath, toPath);
			}
		} catch (e) {
			const errmsg = getEmscriptenFsError(e);
			if (!errmsg) {
				throw e;
			}
			throw new Error(
				`Could not move ${fromPath} to ${toPath}: ${errmsg}`,
				{
					cause: e,
				}
			);
		}
	}
	static rmdir(FS, path, options = { recursive: true }) {
		if (options?.recursive) {
			FSHelpers.listFiles(FS, path).forEach((file) => {
				const filePath = `${path}/${file}`;
				if (FSHelpers.isDir(FS, filePath)) {
					FSHelpers.rmdir(FS, filePath, options);
				} else {
					FSHelpers.unlink(FS, filePath);
				}
			});
		}
		FS.rmdir(path);
	}
	static listFiles(FS, path, options = { prependPath: false }) {
		if (!FSHelpers.fileExists(FS, path)) {
			return [];
		}
		try {
			const files = FS.readdir(path).filter(
				(name) => name !== '.' && name !== '..'
			);
			if (options.prependPath) {
				const prepend = path.replace(/\/$/, '');
				return files.map((name) => `${prepend}/${name}`);
			}
			return files;
		} catch (e) {
			logger3.error(e, { path });
			return [];
		}
	}
	static isDir(FS, path) {
		if (!FSHelpers.fileExists(FS, path)) {
			return false;
		}
		return FS.isDir(FS.lookupPath(path).node.mode);
	}
	static fileExists(FS, path) {
		try {
			FS.lookupPath(path);
			return true;
		} catch (e) {
			return false;
		}
	}
	static mkdir(FS, path) {
		FS.mkdirTree(path);
	}
	static copyRecursive(FS, fromPath, toPath) {
		const fromNode = FS.lookupPath(fromPath).node;
		if (FS.isDir(fromNode.mode)) {
			FS.mkdirTree(toPath);
			const filenames = FS.readdir(fromPath).filter(
				(name) => name !== '.' && name !== '..'
			);
			for (const filename of filenames) {
				FSHelpers.copyRecursive(
					FS,
					joinPaths(fromPath, filename),
					joinPaths(toPath, filename)
				);
			}
		} else {
			FS.writeFile(toPath, FS.readFile(fromPath));
		}
	}
}
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not read "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'readFileAsText',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not read "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS(
			'design:returntype',
			typeof Uint8Array === 'undefined' ? Object : Uint8Array
		),
	],
	FSHelpers,
	'readFileAsBuffer',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not write to "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
			Object,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'writeFile',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not unlink "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'unlink',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not remove directory "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
			typeof RmDirOptions === 'undefined' ? Object : RmDirOptions,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'rmdir',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not list files in "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
			typeof ListFilesOptions === 'undefined' ? Object : ListFilesOptions,
		]),
		__legacyMetadataTS('design:returntype', Array),
	],
	FSHelpers,
	'listFiles',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not stat "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', Boolean),
	],
	FSHelpers,
	'isDir',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not stat "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', Boolean),
	],
	FSHelpers,
	'fileExists',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not create directory "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'mkdir',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not copy files from "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.FileSystemInstance === 'undefined'
				? Object
				: Emscripten.FileSystemInstance,
			String,
			String,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'copyRecursive',
	null
);
// ../../php-wasm/universal/src/lib/php-worker.ts
var _private = new WeakMap();
// ../../php-wasm/universal/src/lib/php-response.ts
var responseTexts = {
	500: 'Internal Server Error',
	502: 'Bad Gateway',
	404: 'Not Found',
	403: 'Forbidden',
	401: 'Unauthorized',
	400: 'Bad Request',
	301: 'Moved Permanently',
	302: 'Found',
	307: 'Temporary Redirect',
	308: 'Permanent Redirect',
	204: 'No Content',
	201: 'Created',
	200: 'OK',
};

class PHPResponse {
	headers;
	bytes;
	errors;
	exitCode;
	httpStatusCode;
	constructor(httpStatusCode, headers, body, errors = '', exitCode = 0) {
		this.httpStatusCode = httpStatusCode;
		this.headers = headers;
		this.bytes = body;
		this.exitCode = exitCode;
		this.errors = errors;
	}
	static forHttpCode(httpStatusCode, text = '') {
		return new PHPResponse(
			httpStatusCode,
			{},
			new TextEncoder().encode(
				text || responseTexts[httpStatusCode] || ''
			)
		);
	}
	static fromRawData(data) {
		return new PHPResponse(
			data.httpStatusCode,
			data.headers,
			data.bytes,
			data.errors,
			data.exitCode
		);
	}
	toRawData() {
		return {
			headers: this.headers,
			bytes: this.bytes,
			errors: this.errors,
			exitCode: this.exitCode,
			httpStatusCode: this.httpStatusCode,
		};
	}
	get json() {
		return JSON.parse(this.text);
	}
	get text() {
		return new TextDecoder().decode(this.bytes);
	}
}

// ../../php-wasm/universal/src/lib/load-php-runtime.ts
async function loadPHPRuntime(phpLoaderModule, phpModuleArgs = {}) {
	const [phpReady, resolvePHP, rejectPHP] = makePromise();
	const PHPRuntime = phpLoaderModule.init(currentJsRuntime2, {
		onAbort(reason) {
			rejectPHP(reason);
			logger3.error(reason);
		},
		ENV: {},
		locateFile: (path) => path,
		...phpModuleArgs,
		noInitialRun: true,
		onRuntimeInitialized() {
			if (phpModuleArgs.onRuntimeInitialized) {
				phpModuleArgs.onRuntimeInitialized();
			}
			resolvePHP();
		},
	});
	await phpReady;
	const id = ++lastRuntimeId;
	PHPRuntime.id = id;
	PHPRuntime.originalExit = PHPRuntime._exit;
	PHPRuntime._exit = function (code) {
		loadedRuntimes.delete(id);
		return PHPRuntime.originalExit(code);
	};
	PHPRuntime[RuntimeId] = id;
	loadedRuntimes.set(id, PHPRuntime);
	return id;
}
function getLoadedRuntime(id) {
	return loadedRuntimes.get(id);
}
var RuntimeId = Symbol('RuntimeId');
var loadedRuntimes = new Map();
var lastRuntimeId = 0;
var currentJsRuntime2 = (function () {
	if (typeof process !== 'undefined' && process.release?.name === 'node') {
		return 'NODE';
	} else if (typeof window !== 'undefined') {
		return 'WEB';
	} else if (
		typeof WorkerGlobalScope !== 'undefined' &&
		self instanceof WorkerGlobalScope
	) {
		return 'WORKER';
	} else {
		return 'NODE';
	}
})();
var makePromise = () => {
	const methods = [];
	const promise = new Promise((resolve, reject) => {
		methods.push(resolve, reject);
	});
	methods.unshift(promise);
	return methods;
};

// ../../php-wasm/universal/src/lib/error-event-polyfill.ts
var kError = Symbol('error');
var kMessage = Symbol('message');

class ErrorEvent2 extends Event {
	[kError];
	[kMessage];
	constructor(type, options = {}) {
		super(type);
		this[kError] = options.error === undefined ? null : options.error;
		this[kMessage] = options.message === undefined ? '' : options.message;
	}
	get error() {
		return this[kError];
	}
	get message() {
		return this[kMessage];
	}
}
Object.defineProperty(ErrorEvent2.prototype, 'error', { enumerable: true });
Object.defineProperty(ErrorEvent2.prototype, 'message', { enumerable: true });
var ErrorEvent =
	typeof globalThis.ErrorEvent === 'function'
		? globalThis.ErrorEvent
		: ErrorEvent2;

// ../../php-wasm/universal/src/lib/is-exit-code-zero.ts
function isExitCodeZero(e) {
	if (!(e instanceof Error)) {
		return false;
	}
	return (
		('exitCode' in e && e?.exitCode === 0) ||
		(e?.name === 'ExitStatus' && 'status' in e && e.status === 0)
	);
}

// ../../php-wasm/universal/src/lib/wasm-error-reporting.ts
function improveWASMErrorReporting(runtime) {
	const target = new UnhandledRejectionsTarget();
	for (const key in runtime.wasmExports) {
		if (typeof runtime.wasmExports[key] == 'function') {
			const original = runtime.wasmExports[key];
			runtime.wasmExports[key] = function (...args) {
				try {
					return original(...args);
				} catch (e) {
					if (!(e instanceof Error)) {
						throw e;
					}
					const clearMessage = clarifyErrorMessage(
						e,
						runtime.lastAsyncifyStackSource?.stack
					);
					if (runtime.lastAsyncifyStackSource) {
						e.cause = runtime.lastAsyncifyStackSource;
					}
					if (target.hasListeners()) {
						target.dispatchEvent(
							new ErrorEvent('error', {
								error: e,
								message: clearMessage,
							})
						);
						return;
					}
					if (!isExitCodeZero(e)) {
						showCriticalErrorBox(clearMessage);
					}
					throw e;
				}
			};
		}
	}
	return target;
}
function getFunctionsMaybeMissingFromAsyncify() {
	return functionsMaybeMissingFromAsyncify;
}
function clarifyErrorMessage(crypticError, asyncifyStack) {
	if (crypticError.message === 'unreachable') {
		let betterMessage = UNREACHABLE_ERROR;
		if (!asyncifyStack) {
			betterMessage += `\n\nThis stack trace is lacking. For a better one initialize \nthe PHP runtime with { debug: true }, e.g. PHPNode.load('8.1', { debug: true }).\n\n`;
		}
		functionsMaybeMissingFromAsyncify = extractPHPFunctionsFromStack(
			asyncifyStack || crypticError.stack || ''
		);
		for (const fn of functionsMaybeMissingFromAsyncify) {
			betterMessage += `    * ${fn}\n`;
		}
		return betterMessage;
	}
	return crypticError.message;
}
function showCriticalErrorBox(message) {
	if (logged) {
		return;
	}
	logged = true;
	if (message?.trim().startsWith('Program terminated with exit')) {
		return;
	}
	logger3.log(`${redBg}\n${eol}\n${bold}  WASM ERROR${reset}${redBg}`);
	for (const line of message.split('\n')) {
		logger3.log(`${eol}  ${line} `);
	}
	logger3.log(`${reset}`);
}
var extractPHPFunctionsFromStack = function (stack) {
	try {
		const names = stack
			.split('\n')
			.slice(1)
			.map((line) => {
				const parts = line.trim().substring('at '.length).split(' ');
				return {
					fn: parts.length >= 2 ? parts[0] : '<unknown>',
					isWasm: line.includes('wasm://'),
				};
			})
			.filter(
				({ fn, isWasm }) =>
					isWasm &&
					!fn.startsWith('dynCall_') &&
					!fn.startsWith('invoke_')
			)
			.map(({ fn }) => fn);
		return Array.from(new Set(names));
	} catch (err) {
		return [];
	}
};

class UnhandledRejectionsTarget extends EventTarget {
	constructor() {
		super(...arguments);
	}
	listenersCount = 0;
	addEventListener(type, callback) {
		++this.listenersCount;
		super.addEventListener(type, callback);
	}
	removeEventListener(type, callback) {
		--this.listenersCount;
		super.removeEventListener(type, callback);
	}
	hasListeners() {
		return this.listenersCount > 0;
	}
}
var functionsMaybeMissingFromAsyncify = [];
var UNREACHABLE_ERROR = `
"unreachable" WASM instruction executed.

The typical reason is a PHP function missing from the ASYNCIFY_ONLY
list when building PHP.wasm.

You will need to file a new issue in the WordPress Playground repository
and paste this error message there:

https://github.com/WordPress/wordpress-playground/issues/new

If you're a core developer, the typical fix is to:

* Isolate a minimal reproduction of the error
* Add a reproduction of the error to php-asyncify.spec.ts in the WordPress Playground repository
* Run 'npm run fix-asyncify'
* Commit the changes, push to the repo, release updated NPM packages

Below is a list of all the PHP functions found in the stack trace to
help with the minimal reproduction. If they're all already listed in
the Dockerfile, you'll need to trigger this error again with long stack
traces enabled. In node.js, you can do it using the --stack-trace-limit=100
CLI option: \n\n`;
var redBg = '\x1B[41m';
var bold = '\x1B[1m';
var reset = '\x1B[0m';
var eol = '\x1B[K';
var logged = false;

// ../../php-wasm/universal/src/lib/php.ts
function normalizeHeaders(headers) {
	const normalized = {};
	for (const key in headers) {
		normalized[key.toLowerCase()] = headers[key];
	}
	return normalized;
}
function copyFS(source, target, path) {
	let oldNode;
	try {
		oldNode = source.lookupPath(path);
	} catch (e) {
		return;
	}
	if (!('contents' in oldNode.node)) {
		return;
	}
	try {
	} catch (e) {}
	if (!source.isDir(oldNode.node.mode)) {
		target.writeFile(path, source.readFile(path));
		return;
	}
	target.mkdirTree(path);
	const filenames = source
		.readdir(path)
		.filter((name) => name !== '.' && name !== '..');
	for (const filename of filenames) {
		copyFS(source, target, joinPaths(path, filename));
	}
}
var STRING = 'string';
var NUMBER = 'number';
var __private__dont__use = Symbol('__private__dont__use');

class PHPExecutionFailureError extends Error {
	response;
	source;
	constructor(message, response, source) {
		super(message);
		this.response = response;
		this.source = source;
	}
}
var PHP_INI_PATH = '/internal/shared/php.ini';
var AUTO_PREPEND_SCRIPT = '/internal/shared/auto_prepend_file.php';

class PHP {
	[__private__dont__use];
	#sapiName;
	#webSapiInitialized = false;
	#wasmErrorsTarget = null;
	#eventListeners = new Map();
	#messageListeners = [];
	requestHandler;
	semaphore;
	constructor(PHPRuntimeId) {
		this.semaphore = new Semaphore({ concurrency: 1 });
		if (PHPRuntimeId !== undefined) {
			this.initializeRuntime(PHPRuntimeId);
		}
	}
	addEventListener(eventType, listener) {
		if (!this.#eventListeners.has(eventType)) {
			this.#eventListeners.set(eventType, new Set());
		}
		this.#eventListeners.get(eventType).add(listener);
	}
	removeEventListener(eventType, listener) {
		this.#eventListeners.get(eventType)?.delete(listener);
	}
	dispatchEvent(event) {
		const listeners = this.#eventListeners.get(event.type);
		if (!listeners) {
			return;
		}
		for (const listener of listeners) {
			listener(event);
		}
	}
	onMessage(listener) {
		this.#messageListeners.push(listener);
	}
	async setSpawnHandler(handler) {
		if (typeof handler === 'string') {
			handler = createSpawnHandler(eval(handler));
		}
		this[__private__dont__use].spawnProcess = handler;
	}
	get absoluteUrl() {
		return this.requestHandler.absoluteUrl;
	}
	get documentRoot() {
		return this.requestHandler.documentRoot;
	}
	pathToInternalUrl(path) {
		return this.requestHandler.pathToInternalUrl(path);
	}
	internalUrlToPath(internalUrl) {
		return this.requestHandler.internalUrlToPath(internalUrl);
	}
	initializeRuntime(runtimeId) {
		if (this[__private__dont__use]) {
			throw new Error('PHP runtime already initialized.');
		}
		const runtime = getLoadedRuntime(runtimeId);
		if (!runtime) {
			throw new Error('Invalid PHP runtime id.');
		}
		this[__private__dont__use] = runtime;
		this[__private__dont__use].ccall(
			'wasm_set_phpini_path',
			null,
			['string'],
			[PHP_INI_PATH]
		);
		if (!this.fileExists(PHP_INI_PATH)) {
			this.writeFile(
				PHP_INI_PATH,
				[
					'auto_prepend_file=' + AUTO_PREPEND_SCRIPT,
					'memory_limit=256M',
					'ignore_repeated_errors = 1',
					'error_reporting = E_ALL',
					'display_errors = 1',
					'html_errors = 1',
					'display_startup_errors = On',
					'log_errors = 1',
					'always_populate_raw_post_data = -1',
					'upload_max_filesize = 2000M',
					'post_max_size = 2000M',
					'disable_functions = curl_exec,curl_multi_exec',
					'allow_url_fopen = Off',
					'allow_url_include = Off',
					'session.save_path = /home/web_user',
					'implicit_flush = 1',
					'output_buffering = 0',
					'max_execution_time = 0',
					'max_input_time = -1',
				].join('\n')
			);
		}
		if (!this.fileExists(AUTO_PREPEND_SCRIPT)) {
			this.writeFile(
				AUTO_PREPEND_SCRIPT,
				`<?php
				// Define constants set via defineConstant() calls
				if(file_exists('/internal/shared/consts.json')) {
					\$consts = json_decode(file_get_contents('/internal/shared/consts.json'), true);
					foreach (\$consts as \$const => \$value) {
						if (!defined(\$const) && is_scalar(\$value)) {
							define(\$const, \$value);
						}
					}
				}
				// Preload all the files from /internal/shared/preload
				foreach (glob('/internal/shared/preload/*.php') as \$file) {
					require_once \$file;
				}
				`
			);
		}
		runtime['onMessage'] = async (data) => {
			for (const listener of this.#messageListeners) {
				const returnData = await listener(data);
				if (returnData) {
					return returnData;
				}
			}
			return '';
		};
		this.#wasmErrorsTarget = improveWASMErrorReporting(runtime);
		this.dispatchEvent({
			type: 'runtime.initialized',
		});
	}
	async setSapiName(newName) {
		const result = this[__private__dont__use].ccall(
			'wasm_set_sapi_name',
			NUMBER,
			[STRING],
			[newName]
		);
		if (result !== 0) {
			throw new Error(
				'Could not set SAPI name. This can only be done before the PHP WASM module is initialized.Did you already dispatch any requests?'
			);
		}
		this.#sapiName = newName;
	}
	chdir(path) {
		this[__private__dont__use].FS.chdir(path);
	}
	async request(request3) {
		logger3.warn(
			'PHP.request() is deprecated. Please use new PHPRequestHandler() instead.'
		);
		if (!this.requestHandler) {
			throw new Error('No request handler available.');
		}
		return this.requestHandler.request(request3);
	}
	async run(request3) {
		console.log('PHP run', request3);
		const release = await this.semaphore.acquire();
		let heapBodyPointer;
		try {
			if (!this.#webSapiInitialized) {
				this.#initWebRuntime();
				this.#webSapiInitialized = true;
			}
			if (request3.scriptPath && !this.fileExists(request3.scriptPath)) {
				throw new Error(
					`The script path "${request3.scriptPath}" does not exist.`
				);
			}
			this.#setRelativeRequestUri(request3.relativeUri || '');
			this.#setRequestMethod(request3.method || 'GET');
			const headers = normalizeHeaders(request3.headers || {});
			const host = headers['host'] || 'example.com:443';
			const port = this.#inferPortFromHostAndProtocol(
				host,
				request3.protocol || 'http'
			);
			this.#setRequestHost(host);
			this.#setRequestPort(port);
			this.#setRequestHeaders(headers);
			if (request3.body) {
				heapBodyPointer = this.#setRequestBody(request3.body);
			}
			if (typeof request3.code === 'string') {
				this.writeFile('/internal/eval.php', request3.code);
				this.#setScriptPath('/internal/eval.php');
			} else {
				this.#setScriptPath(request3.scriptPath || '');
			}
			const $_SERVER = this.#prepareServerEntries(
				request3.$_SERVER,
				headers,
				port
			);
			for (const key in $_SERVER) {
				this.#setServerGlobalEntry(key, $_SERVER[key]);
			}
			const env = request3.env || {};
			for (const key in env) {
				this.#setEnv(key, env[key]);
			}
			const response = await this.#handleRequest();
			if (response.exitCode !== 0) {
				logger3.warn(`PHP.run() output was:`, response.text);
				const error = new PHPExecutionFailureError(
					`PHP.run() failed with exit code ${response.exitCode} and the following output: ` +
						response.errors,
					response,
					'request'
				);
				logger3.error(error);
				throw error;
			}
			return response;
		} catch (e) {
			this.dispatchEvent({
				type: 'request.error',
				error: e,
				source: e.source ?? 'php-wasm',
			});
			throw e;
		} finally {
			try {
				if (heapBodyPointer) {
					this[__private__dont__use].free(heapBodyPointer);
				}
			} finally {
				release();
				this.dispatchEvent({
					type: 'request.end',
				});
			}
		}
	}
	#prepareServerEntries(defaults, headers, port) {
		const $_SERVER = {
			...(defaults || {}),
		};
		$_SERVER['HTTPS'] = $_SERVER['HTTPS'] || port === 443 ? 'on' : 'off';
		for (const name in headers) {
			let HTTP_prefix = 'HTTP_';
			if (
				['content-type', 'content-length'].includes(name.toLowerCase())
			) {
				HTTP_prefix = '';
			}
			$_SERVER[`${HTTP_prefix}${name.toUpperCase().replace(/-/g, '_')}`] =
				headers[name];
		}
		return $_SERVER;
	}
	#initWebRuntime() {
		this[__private__dont__use].ccall('php_wasm_init', null, [], []);
	}
	#getResponseHeaders() {
		const headersFilePath = '/internal/headers.json';
		if (!this.fileExists(headersFilePath)) {
			throw new Error(
				'SAPI Error: Could not find response headers file.'
			);
		}
		const headersData = JSON.parse(this.readFileAsText(headersFilePath));
		const headers = {};
		for (const line of headersData.headers) {
			if (!line.includes(': ')) {
				continue;
			}
			const colonIndex = line.indexOf(': ');
			const headerName = line.substring(0, colonIndex).toLowerCase();
			const headerValue = line.substring(colonIndex + 2);
			if (!(headerName in headers)) {
				headers[headerName] = [];
			}
			headers[headerName].push(headerValue);
		}
		return {
			headers,
			httpStatusCode: headersData.status,
		};
	}
	#setRelativeRequestUri(uri) {
		this[__private__dont__use].ccall(
			'wasm_set_request_uri',
			null,
			[STRING],
			[uri]
		);
		if (uri.includes('?')) {
			const queryString = uri.substring(uri.indexOf('?') + 1);
			this[__private__dont__use].ccall(
				'wasm_set_query_string',
				null,
				[STRING],
				[queryString]
			);
		}
	}
	#setRequestHost(host) {
		this[__private__dont__use].ccall(
			'wasm_set_request_host',
			null,
			[STRING],
			[host]
		);
	}
	#setRequestPort(port) {
		this[__private__dont__use].ccall(
			'wasm_set_request_port',
			null,
			[NUMBER],
			[port]
		);
	}
	#inferPortFromHostAndProtocol(host, protocol) {
		let port;
		try {
			port = parseInt(new URL(host).port, 10);
		} catch (e) {}
		if (!port || isNaN(port) || port === 80) {
			port = protocol === 'https' ? 443 : 80;
		}
		return port;
	}
	#setRequestMethod(method) {
		this[__private__dont__use].ccall(
			'wasm_set_request_method',
			null,
			[STRING],
			[method]
		);
	}
	#setRequestHeaders(headers) {
		if (headers['cookie']) {
			this[__private__dont__use].ccall(
				'wasm_set_cookies',
				null,
				[STRING],
				[headers['cookie']]
			);
		}
		if (headers['content-type']) {
			this[__private__dont__use].ccall(
				'wasm_set_content_type',
				null,
				[STRING],
				[headers['content-type']]
			);
		}
		if (headers['content-length']) {
			this[__private__dont__use].ccall(
				'wasm_set_content_length',
				null,
				[NUMBER],
				[parseInt(headers['content-length'], 10)]
			);
		}
	}
	#setRequestBody(body) {
		let size, contentLength;
		if (typeof body === 'string') {
			logger3.warn(
				'Passing a string as the request body is deprecated. Please use a Uint8Array instead. See https://github.com/WordPress/wordpress-playground/issues/997 for more details'
			);
			contentLength = this[__private__dont__use].lengthBytesUTF8(body);
			size = contentLength + 1;
		} else {
			contentLength = body.byteLength;
			size = body.byteLength;
		}
		const heapBodyPointer = this[__private__dont__use].malloc(size);
		if (!heapBodyPointer) {
			throw new Error('Could not allocate memory for the request body.');
		}
		if (typeof body === 'string') {
			this[__private__dont__use].stringToUTF8(
				body,
				heapBodyPointer,
				size + 1
			);
		} else {
			this[__private__dont__use].HEAPU8.set(body, heapBodyPointer);
		}
		this[__private__dont__use].ccall(
			'wasm_set_request_body',
			null,
			[NUMBER],
			[heapBodyPointer]
		);
		this[__private__dont__use].ccall(
			'wasm_set_content_length',
			null,
			[NUMBER],
			[contentLength]
		);
		return heapBodyPointer;
	}
	#setScriptPath(path) {
		this[__private__dont__use].ccall(
			'wasm_set_path_translated',
			null,
			[STRING],
			[path]
		);
	}
	#setServerGlobalEntry(key, value) {
		this[__private__dont__use].ccall(
			'wasm_add_SERVER_entry',
			null,
			[STRING, STRING],
			[key, value]
		);
	}
	#setEnv(name, value) {
		this[__private__dont__use].ccall(
			'wasm_add_ENV_entry',
			null,
			[STRING, STRING],
			[name, value]
		);
	}
	defineConstant(key, value) {
		let consts = {};
		try {
			consts = JSON.parse(
				this.fileExists('/internal/shared/consts.json')
					? this.readFileAsText('/internal/shared/consts.json') ||
							'{}'
					: '{}'
			);
		} catch (e) {}
		this.writeFile(
			'/internal/shared/consts.json',
			JSON.stringify({
				...consts,
				[key]: value,
			})
		);
	}
	async #handleRequest() {
		let exitCode;
		let errorListener;
		try {
			exitCode = await new Promise((resolve, reject) => {
				errorListener = (e) => {
					logger3.error(e);
					logger3.error(e.error);
					const rethrown = new Error('Rethrown');
					rethrown.cause = e.error;
					rethrown.betterMessage = e.message;
					reject(rethrown);
				};
				this.#wasmErrorsTarget?.addEventListener(
					'error',
					errorListener
				);
				const response = this[__private__dont__use].ccall(
					'wasm_sapi_handle_request',
					NUMBER,
					[],
					[],
					{ async: true }
				);
				if (response instanceof Promise) {
					return response.then(resolve, reject);
				}
				return resolve(response);
			});
		} catch (e) {
			for (const name in this) {
				if (typeof this[name] === 'function') {
					this[name] = () => {
						throw new Error(
							`PHP runtime has crashed \u2013 see the earlier error for details.`
						);
					};
				}
			}
			this.functionsMaybeMissingFromAsyncify =
				getFunctionsMaybeMissingFromAsyncify();
			const err = e;
			const message =
				'betterMessage' in err ? err.betterMessage : err.message;
			const rethrown = new Error(message);
			rethrown.cause = err;
			logger3.error(rethrown);
			throw rethrown;
		} finally {
			this.#wasmErrorsTarget?.removeEventListener('error', errorListener);
		}
		const { headers, httpStatusCode } = this.#getResponseHeaders();
		return new PHPResponse(
			exitCode === 0 ? httpStatusCode : 500,
			headers,
			this.readFileAsBuffer('/internal/stdout'),
			this.readFileAsText('/internal/stderr'),
			exitCode
		);
	}
	mkdir(path) {
		return FSHelpers.mkdir(this[__private__dont__use].FS, path);
	}
	mkdirTree(path) {
		return FSHelpers.mkdir(this[__private__dont__use].FS, path);
	}
	readFileAsText(path) {
		return FSHelpers.readFileAsText(this[__private__dont__use].FS, path);
	}
	readFileAsBuffer(path) {
		return FSHelpers.readFileAsBuffer(this[__private__dont__use].FS, path);
	}
	writeFile(path, data) {
		return FSHelpers.writeFile(this[__private__dont__use].FS, path, data);
	}
	unlink(path) {
		return FSHelpers.unlink(this[__private__dont__use].FS, path);
	}
	mv(fromPath, toPath) {
		return FSHelpers.mv(this[__private__dont__use].FS, fromPath, toPath);
	}
	rmdir(path, options = { recursive: true }) {
		return FSHelpers.rmdir(this[__private__dont__use].FS, path, options);
	}
	listFiles(path, options = { prependPath: false }) {
		return FSHelpers.listFiles(
			this[__private__dont__use].FS,
			path,
			options
		);
	}
	isDir(path) {
		return FSHelpers.isDir(this[__private__dont__use].FS, path);
	}
	fileExists(path) {
		return FSHelpers.fileExists(this[__private__dont__use].FS, path);
	}
	hotSwapPHPRuntime(runtime, cwd) {
		const oldFS = this[__private__dont__use].FS;
		try {
			this.exit();
		} catch (e) {}
		this.initializeRuntime(runtime);
		if (this.#sapiName) {
			this.setSapiName(this.#sapiName);
		}
		if (cwd) {
			copyFS(oldFS, this[__private__dont__use].FS, cwd);
		}
	}
	async mount(virtualFSPath, mountHandler) {
		return await mountHandler(
			this,
			this[__private__dont__use].FS,
			virtualFSPath
		);
	}
	async cli(argv) {
		for (const arg of argv) {
			this[__private__dont__use].ccall(
				'wasm_add_cli_arg',
				null,
				[STRING],
				[arg]
			);
		}
		try {
			return await this[__private__dont__use].ccall(
				'run_cli',
				null,
				[],
				[],
				{
					async: true,
				}
			);
		} catch (error) {
			if (isExitCodeZero(error)) {
				return 0;
			}
			throw error;
		}
	}
	setSkipShebang(shouldSkip) {
		this[__private__dont__use].ccall(
			'wasm_set_skip_shebang',
			null,
			[NUMBER],
			[shouldSkip ? 1 : 0]
		);
	}
	exit(code = 0) {
		this.dispatchEvent({
			type: 'runtime.beforedestroy',
		});
		try {
			this[__private__dont__use]._exit(code);
		} catch (e) {}
		this.#webSapiInitialized = false;
		this.#wasmErrorsTarget = null;
		delete this[__private__dont__use]['onMessage'];
		delete this[__private__dont__use];
	}
	[Symbol.dispose]() {
		if (this.#webSapiInitialized) {
			this.exit(0);
		}
	}
}

// ../../php-wasm/universal/src/lib/ini.ts
var import_ini = __toESM(require_ini(), 1);
async function setPhpIniEntries(php2, entries) {
	const ini = import_ini.parse(await php2.readFileAsText(PHP_INI_PATH));
	for (const [key, value] of Object.entries(entries)) {
		if (value === undefined || value === null) {
			delete ini[key];
		} else {
			ini[key] = value;
		}
	}
	await php2.writeFile(PHP_INI_PATH, import_ini.stringify(ini));
}
async function withPHPIniValues(php2, phpIniValues, callback) {
	const iniBefore = await php2.readFileAsText(PHP_INI_PATH);
	try {
		await setPhpIniEntries(php2, phpIniValues);
		return await callback();
	} finally {
		await php2.writeFile(PHP_INI_PATH, iniBefore);
	}
}
// ../../php-wasm/universal/src/lib/http-cookie-store.ts
class HttpCookieStore {
	cookies = {};
	rememberCookiesFromResponseHeaders(headers) {
		if (!headers?.['set-cookie']) {
			return;
		}
		for (const setCookie of headers['set-cookie']) {
			try {
				if (!setCookie.includes('=')) {
					continue;
				}
				const equalsIndex = setCookie.indexOf('=');
				const name = setCookie.substring(0, equalsIndex);
				const value = setCookie
					.substring(equalsIndex + 1)
					.split(';')[0];
				this.cookies[name] = value;
			} catch (e) {
				logger3.error(e);
			}
		}
	}
	getCookieRequestHeader() {
		const cookiesArray = [];
		for (const name in this.cookies) {
			cookiesArray.push(`${name}=${this.cookies[name]}`);
		}
		return cookiesArray.join('; ');
	}
}
// ../../php-wasm/stream-compression/src/utils/iterable-stream-polyfill.ts
if (!ReadableStream.prototype[Symbol.asyncIterator]) {
	ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
		const reader = this.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					return;
				}
				yield value;
			}
		} finally {
			reader.releaseLock();
		}
	};
	ReadableStream.prototype.iterate =
		ReadableStream.prototype[Symbol.asyncIterator];
}
// ../../php-wasm/stream-compression/src/zip/decode-remote-zip.ts
var fetchSemaphore = new Semaphore({ concurrency: 10 });
// ../../php-wasm/universal/src/lib/php-process-manager.ts
class MaxPhpInstancesError extends Error {
	constructor(limit) {
		super(
			`Requested more concurrent PHP instances than the limit (${limit}).`
		);
		this.name = this.constructor.name;
	}
}

class PHPProcessManager {
	primaryPhp;
	primaryIdle = true;
	nextInstance = null;
	allInstances = [];
	phpFactory;
	maxPhpInstances;
	semaphore;
	constructor(options) {
		this.maxPhpInstances = options?.maxPhpInstances ?? 5;
		this.phpFactory = options?.phpFactory;
		this.primaryPhp = options?.primaryPhp;
		this.semaphore = new Semaphore({
			concurrency: this.maxPhpInstances,
			timeout: options?.timeout || 5000,
		});
	}
	async getPrimaryPhp() {
		if (!this.phpFactory && !this.primaryPhp) {
			throw new Error(
				'phpFactory or primaryPhp must be set before calling getPrimaryPhp().'
			);
		} else if (!this.primaryPhp) {
			const spawned = await this.spawn({ isPrimary: true });
			this.primaryPhp = spawned.php;
		}
		return this.primaryPhp;
	}
	async acquirePHPInstance() {
		if (this.primaryIdle) {
			this.primaryIdle = false;
			return {
				php: await this.getPrimaryPhp(),
				reap: () => (this.primaryIdle = true),
			};
		}
		const spawnedPhp =
			this.nextInstance || this.spawn({ isPrimary: false });
		if (this.semaphore.remaining > 0) {
			this.nextInstance = this.spawn({ isPrimary: false });
		} else {
			this.nextInstance = null;
		}
		return await spawnedPhp;
	}
	spawn(factoryArgs) {
		if (factoryArgs.isPrimary && this.allInstances.length > 0) {
			throw new Error(
				'Requested spawning a primary PHP instance when another primary instance already started spawning.'
			);
		}
		const spawned = this.doSpawn(factoryArgs);
		this.allInstances.push(spawned);
		const pop = () => {
			this.allInstances = this.allInstances.filter(
				(instance) => instance !== spawned
			);
		};
		return spawned
			.catch((rejection) => {
				pop();
				throw rejection;
			})
			.then((result) => ({
				...result,
				reap: () => {
					pop();
					result.reap();
				},
			}));
	}
	async doSpawn(factoryArgs) {
		let release;
		try {
			release = await this.semaphore.acquire();
		} catch (error) {
			if (error instanceof AcquireTimeoutError) {
				throw new MaxPhpInstancesError(this.maxPhpInstances);
			}
			throw error;
		}
		try {
			const php2 = await this.phpFactory(factoryArgs);
			return {
				php: php2,
				reap() {
					php2.exit();
					release();
				},
			};
		} catch (e) {
			release();
			throw e;
		}
	}
	async [Symbol.asyncDispose]() {
		if (this.primaryPhp) {
			this.primaryPhp.exit();
		}
		await Promise.all(
			this.allInstances.map((instance) =>
				instance.then(({ reap }) => reap())
			)
		);
	}
}
// ../../php-wasm/universal/src/lib/supported-php-versions.ts
var SupportedPHPVersions = [
	'8.3',
	'8.2',
	'8.1',
	'8.0',
	'7.4',
	'7.3',
	'7.2',
	'7.1',
	'7.0',
];
var LatestSupportedPHPVersion = SupportedPHPVersions[0];
// ../../php-wasm/universal/src/lib/urls.ts
function toRelativeUrl(url) {
	return url.toString().substring(url.origin.length);
}
function removePathPrefix(path, prefix) {
	if (!prefix || !path.startsWith(prefix)) {
		return path;
	}
	return path.substring(prefix.length);
}
function ensurePathPrefix(path, prefix) {
	if (!prefix || path.startsWith(prefix)) {
		return path;
	}
	return prefix + path;
}
var DEFAULT_BASE_URL = 'http://example.com';

// ../../php-wasm/universal/src/lib/encode-as-multipart.ts
async function encodeAsMultipart(data) {
	const boundary = `----${Math.random().toString(36).slice(2)}`;
	const contentType = `multipart/form-data; boundary=${boundary}`;
	const textEncoder = new TextEncoder();
	const parts = [];
	for (const [name, value] of Object.entries(data)) {
		parts.push(`--${boundary}\r\n`);
		parts.push(`Content-Disposition: form-data; name="${name}"`);
		if (value instanceof File) {
			parts.push(`; filename="${value.name}"`);
		}
		parts.push(`\r\n`);
		if (value instanceof File) {
			parts.push(`Content-Type: application/octet-stream`);
			parts.push(`\r\n`);
		}
		parts.push(`\r\n`);
		if (value instanceof File) {
			parts.push(await fileToUint8Array(value));
		} else {
			parts.push(value);
		}
		parts.push(`\r\n`);
	}
	parts.push(`--${boundary}--\r\n`);
	const length = parts.reduce((acc, part) => acc + part.length, 0);
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		bytes.set(
			typeof part === 'string' ? textEncoder.encode(part) : part,
			offset
		);
		offset += part.length;
	}
	return { bytes, contentType };
}
var fileToUint8Array = function (file) {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => {
			resolve(new Uint8Array(reader.result));
		};
		reader.readAsArrayBuffer(file);
	});
};
// ../../php-wasm/universal/src/lib/mime-types.json
var mime_types_default = {
	_default: 'application/octet-stream',
	'3gpp': 'video/3gpp',
	'7z': 'application/x-7z-compressed',
	asx: 'video/x-ms-asf',
	atom: 'application/atom+xml',
	avi: 'video/x-msvideo',
	avif: 'image/avif',
	bin: 'application/octet-stream',
	bmp: 'image/x-ms-bmp',
	cco: 'application/x-cocoa',
	css: 'text/css',
	data: 'application/octet-stream',
	deb: 'application/octet-stream',
	der: 'application/x-x509-ca-cert',
	dmg: 'application/octet-stream',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	eot: 'application/vnd.ms-fontobject',
	flv: 'video/x-flv',
	gif: 'image/gif',
	gz: 'application/gzip',
	hqx: 'application/mac-binhex40',
	htc: 'text/x-component',
	html: 'text/html',
	ico: 'image/x-icon',
	iso: 'application/octet-stream',
	jad: 'text/vnd.sun.j2me.app-descriptor',
	jar: 'application/java-archive',
	jardiff: 'application/x-java-archive-diff',
	jng: 'image/x-jng',
	jnlp: 'application/x-java-jnlp-file',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	js: 'application/javascript',
	json: 'application/json',
	kml: 'application/vnd.google-earth.kml+xml',
	kmz: 'application/vnd.google-earth.kmz',
	m3u8: 'application/vnd.apple.mpegurl',
	m4a: 'audio/x-m4a',
	m4v: 'video/x-m4v',
	md: 'text/plain',
	mid: 'audio/midi',
	mml: 'text/mathml',
	mng: 'video/x-mng',
	mov: 'video/quicktime',
	mp3: 'audio/mpeg',
	mp4: 'video/mp4',
	mpeg: 'video/mpeg',
	msi: 'application/octet-stream',
	odg: 'application/vnd.oasis.opendocument.graphics',
	odp: 'application/vnd.oasis.opendocument.presentation',
	ods: 'application/vnd.oasis.opendocument.spreadsheet',
	odt: 'application/vnd.oasis.opendocument.text',
	ogg: 'audio/ogg',
	otf: 'font/otf',
	pdf: 'application/pdf',
	pl: 'application/x-perl',
	png: 'image/png',
	ppt: 'application/vnd.ms-powerpoint',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	prc: 'application/x-pilot',
	ps: 'application/postscript',
	ra: 'audio/x-realaudio',
	rar: 'application/x-rar-compressed',
	rpm: 'application/x-redhat-package-manager',
	rss: 'application/rss+xml',
	rtf: 'application/rtf',
	run: 'application/x-makeself',
	sea: 'application/x-sea',
	sit: 'application/x-stuffit',
	svg: 'image/svg+xml',
	swf: 'application/x-shockwave-flash',
	tcl: 'application/x-tcl',
	tar: 'application/x-tar',
	tif: 'image/tiff',
	ts: 'video/mp2t',
	ttf: 'font/ttf',
	txt: 'text/plain',
	wasm: 'application/wasm',
	wbmp: 'image/vnd.wap.wbmp',
	webm: 'video/webm',
	webp: 'image/webp',
	wml: 'text/vnd.wap.wml',
	wmlc: 'application/vnd.wap.wmlc',
	wmv: 'video/x-ms-wmv',
	woff: 'font/woff',
	woff2: 'font/woff2',
	xhtml: 'application/xhtml+xml',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xml: 'text/xml',
	xpi: 'application/x-xpinstall',
	xspf: 'application/xspf+xml',
	zip: 'application/zip',
};

// ../../php-wasm/universal/src/lib/php-request-handler.ts
var inferMimeType = function (path) {
	const extension = path.split('.').pop();
	return mime_types_default[extension] || mime_types_default['_default'];
};
function seemsLikeAPHPRequestHandlerPath(path) {
	return seemsLikeAPHPFile(path) || seemsLikeADirectoryRoot(path);
}
var seemsLikeAPHPFile = function (path) {
	return path.endsWith('.php') || path.includes('.php/');
};
var seemsLikeADirectoryRoot = function (path) {
	const lastSegment = path.split('/').pop();
	return !lastSegment.includes('.');
};
function applyRewriteRules(path, rules) {
	for (const rule of rules) {
		if (new RegExp(rule.match).test(path)) {
			return path.replace(rule.match, rule.replacement);
		}
	}
	return path;
}

class PHPRequestHandler {
	#DOCROOT;
	#PROTOCOL;
	#HOSTNAME;
	#PORT;
	#HOST;
	#PATHNAME;
	#ABSOLUTE_URL;
	#cookieStore;
	rewriteRules;
	processManager;
	constructor(config) {
		const {
			documentRoot = '/www/',
			absoluteUrl = typeof location === 'object' ? location?.href : '',
			rewriteRules = [],
		} = config;
		if ('processManager' in config) {
			this.processManager = config.processManager;
		} else {
			this.processManager = new PHPProcessManager({
				phpFactory: async (info) => {
					const php3 = await config.phpFactory({
						...info,
						requestHandler: this,
					});
					php3.requestHandler = this;
					return php3;
				},
				maxPhpInstances: config.maxPhpInstances,
			});
		}
		this.#cookieStore = new HttpCookieStore();
		this.#DOCROOT = documentRoot;
		const url = new URL(absoluteUrl);
		this.#HOSTNAME = url.hostname;
		this.#PORT = url.port
			? Number(url.port)
			: url.protocol === 'https:'
			? 443
			: 80;
		this.#PROTOCOL = (url.protocol || '').replace(':', '');
		const isNonStandardPort = this.#PORT !== 443 && this.#PORT !== 80;
		this.#HOST = [
			this.#HOSTNAME,
			isNonStandardPort ? `:${this.#PORT}` : '',
		].join('');
		this.#PATHNAME = url.pathname.replace(/\/+$/, '');
		this.#ABSOLUTE_URL = [
			`${this.#PROTOCOL}://`,
			this.#HOST,
			this.#PATHNAME,
		].join('');
		this.rewriteRules = rewriteRules;
	}
	async getPrimaryPhp() {
		return await this.processManager.getPrimaryPhp();
	}
	pathToInternalUrl(path) {
		return `${this.absoluteUrl}${path}`;
	}
	internalUrlToPath(internalUrl) {
		const url = new URL(internalUrl);
		if (url.pathname.startsWith(this.#PATHNAME)) {
			url.pathname = url.pathname.slice(this.#PATHNAME.length);
		}
		return toRelativeUrl(url);
	}
	get absoluteUrl() {
		return this.#ABSOLUTE_URL;
	}
	get documentRoot() {
		return this.#DOCROOT;
	}
	async request(request3) {
		const isAbsolute =
			request3.url.startsWith('http://') ||
			request3.url.startsWith('https://');
		const requestedUrl = new URL(
			request3.url.split('#')[0],
			isAbsolute ? undefined : DEFAULT_BASE_URL
		);
		const normalizedRequestedPath = applyRewriteRules(
			removePathPrefix(
				decodeURIComponent(requestedUrl.pathname),
				this.#PATHNAME
			),
			this.rewriteRules
		);
		const fsPath = joinPaths(this.#DOCROOT, normalizedRequestedPath);
		if (!seemsLikeAPHPRequestHandlerPath(fsPath)) {
			return this.#serveStaticFile(
				await this.processManager.getPrimaryPhp(),
				fsPath
			);
		}
		return this.#spawnPHPAndDispatchRequest(request3, requestedUrl);
	}
	#serveStaticFile(php3, fsPath) {
		if (!php3.fileExists(fsPath)) {
			return new PHPResponse(
				404,
				{
					'x-file-type': ['static'],
				},
				new TextEncoder().encode('404 File not found')
			);
		}
		const arrayBuffer = php3.readFileAsBuffer(fsPath);
		return new PHPResponse(
			200,
			{
				'content-length': [`${arrayBuffer.byteLength}`],
				'content-type': [inferMimeType(fsPath)],
				'accept-ranges': ['bytes'],
				'cache-control': ['public, max-age=0'],
			},
			arrayBuffer
		);
	}
	async #spawnPHPAndDispatchRequest(request3, requestedUrl) {
		let spawnedPHP = undefined;
		try {
			spawnedPHP = await this.processManager.acquirePHPInstance();
		} catch (e) {
			if (e instanceof MaxPhpInstancesError) {
				return PHPResponse.forHttpCode(502);
			} else {
				return PHPResponse.forHttpCode(500);
			}
		}
		try {
			return await this.#dispatchToPHP(
				spawnedPHP.php,
				request3,
				requestedUrl
			);
		} finally {
			spawnedPHP.reap();
		}
	}
	async #dispatchToPHP(php3, request3, requestedUrl) {
		let preferredMethod = 'GET';
		const headers = {
			host: this.#HOST,
			...normalizeHeaders(request3.headers || {}),
			cookie: this.#cookieStore.getCookieRequestHeader(),
		};
		let body = request3.body;
		if (typeof body === 'object' && !(body instanceof Uint8Array)) {
			preferredMethod = 'POST';
			const { bytes, contentType } = await encodeAsMultipart(body);
			body = bytes;
			headers['content-type'] = contentType;
		}
		let scriptPath;
		try {
			scriptPath = this.#resolvePHPFilePath(
				php3,
				decodeURIComponent(requestedUrl.pathname)
			);
		} catch (error) {
			return PHPResponse.forHttpCode(404);
		}
		try {
			const response = await php3.run({
				relativeUri: ensurePathPrefix(
					toRelativeUrl(requestedUrl),
					this.#PATHNAME
				),
				protocol: this.#PROTOCOL,
				method: request3.method || preferredMethod,
				$_SERVER: {
					REMOTE_ADDR: '127.0.0.1',
					DOCUMENT_ROOT: this.#DOCROOT,
					HTTPS: this.#ABSOLUTE_URL.startsWith('https://')
						? 'on'
						: '',
				},
				body,
				scriptPath,
				headers,
			});
			this.#cookieStore.rememberCookiesFromResponseHeaders(
				response.headers
			);
			return response;
		} catch (error) {
			const executionError = error;
			if (executionError?.response) {
				return executionError.response;
			}
			throw error;
		}
	}
	#resolvePHPFilePath(php3, requestedPath) {
		let filePath = removePathPrefix(requestedPath, this.#PATHNAME);
		filePath = applyRewriteRules(filePath, this.rewriteRules);
		if (filePath.includes('.php')) {
			filePath = filePath.split('.php')[0] + '.php';
		} else if (php3.isDir(`${this.#DOCROOT}${filePath}`)) {
			if (!filePath.endsWith('/')) {
				filePath = `${filePath}/`;
			}
			filePath = `${filePath}index.php`;
		} else {
			filePath = '/index.php';
		}
		let resolvedFsPath = `${this.#DOCROOT}${filePath}`;
		if (!php3.fileExists(resolvedFsPath)) {
			resolvedFsPath = `${this.#DOCROOT}/index.php`;
		}
		if (php3.fileExists(resolvedFsPath)) {
			return resolvedFsPath;
		}
		throw new Error(`File not found: ${resolvedFsPath}`);
	}
}
// ../../php-wasm/universal/src/lib/rotate-php-runtime.ts
function rotatePHPRuntime({
	php: php3,
	cwd,
	recreateRuntime,
	maxRequests = 400,
}) {
	let handledCalls = 0;
	async function rotateRuntime() {
		if (++handledCalls < maxRequests) {
			return;
		}
		handledCalls = 0;
		const release = await php3.semaphore.acquire();
		try {
			php3.hotSwapPHPRuntime(await recreateRuntime(), cwd);
		} finally {
			release();
		}
	}
	php3.addEventListener('request.end', rotateRuntime);
	return function () {
		php3.removeEventListener('request.end', rotateRuntime);
	};
}
// ../../php-wasm/universal/src/lib/write-files.ts
async function writeFiles(php3, root, newFiles, { rmRoot = false } = {}) {
	if (rmRoot) {
		if (await php3.isDir(root)) {
			await php3.rmdir(root, { recursive: true });
		}
	}
	for (const [relativePath, content] of Object.entries(newFiles)) {
		const filePath = joinPaths(root, relativePath);
		if (!(await php3.fileExists(dirname(filePath)))) {
			await php3.mkdir(dirname(filePath));
		}
		if (content instanceof Uint8Array || typeof content === 'string') {
			await php3.writeFile(filePath, content);
		} else {
			await writeFiles(php3, filePath, content);
		}
	}
}
// ../../php-wasm/universal/src/lib/proxy-file-system.ts
function proxyFileSystem(sourceOfTruth, replica, paths) {
	const __private__symbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];
	for (const path of paths) {
		if (!replica.fileExists(path)) {
			replica.mkdir(path);
		}
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		replica[__private__symbol].FS.mount(
			replica[__private__symbol].PROXYFS,
			{
				root: path,
				fs: sourceOfTruth[__private__symbol].FS,
			},
			path
		);
	}
}
// ../blueprints/src/lib/compile.ts
var import_ajv = __toESM(require_ajv(), 1);
var { wpCLI: wpCLI2, ...otherStepHandlers } = exports_handlers;
var keyedStepHandlers = {
	...otherStepHandlers,
	'wp-cli': wpCLI2,
	importFile: otherStepHandlers.importWxr,
};
var ajv = new import_ajv.default({ discriminator: true });
// ../wordpress/src/boot.ts
async function bootWordPress(options) {
	async function createPhp(requestHandler2, isPrimary) {
		const php4 = new PHP(await options.createPhpRuntime());
		if (options.sapiName) {
			php4.setSapiName(options.sapiName);
		}
		if (requestHandler2) {
			php4.requestHandler = requestHandler2;
		}
		if (options.phpIniEntries) {
			setPhpIniEntries(php4, options.phpIniEntries);
		}
		if (isPrimary) {
			await setupPlatformLevelMuPlugins(php4);
			await writeFiles(php4, '/', options.createFiles || {});
			await preloadPhpInfoRoute(
				php4,
				joinPaths(new URL(options.siteUrl).pathname, 'phpinfo.php')
			);
		} else {
			proxyFileSystem(await requestHandler2.getPrimaryPhp(), php4, [
				'/tmp',
				requestHandler2.documentRoot,
				'/internal/shared',
			]);
		}
		if (options.spawnHandler) {
			await php4.setSpawnHandler(
				options.spawnHandler(requestHandler2.processManager)
			);
		}
		rotatePHPRuntime({
			php: php4,
			cwd: requestHandler2.documentRoot,
			recreateRuntime: options.createPhpRuntime,
			maxRequests: 400,
		});
		return php4;
	}
	const requestHandler = new PHPRequestHandler({
		phpFactory: async ({ isPrimary }) =>
			createPhp(requestHandler, isPrimary),
		documentRoot: options.documentRoot || '/wordpress',
		absoluteUrl: options.siteUrl,
		rewriteRules: wordPressRewriteRules,
	});
	const php3 = await requestHandler.getPrimaryPhp();
	if (options.hooks?.beforeWordPressFiles) {
		await options.hooks.beforeWordPressFiles(php3);
	}
	if (options.wordPressZip) {
		await unzipWordPress(php3, await options.wordPressZip);
	}
	if (options.constants) {
		for (const key in options.constants) {
			php3.defineConstant(key, options.constants[key]);
		}
	}
	php3.defineConstant('WP_HOME', options.siteUrl);
	php3.defineConstant('WP_SITEURL', options.siteUrl);
	if (options.hooks?.beforeDatabaseSetup) {
		await options.hooks.beforeDatabaseSetup(php3);
	}
	if (options.sqliteIntegrationPluginZip) {
		await preloadSqliteIntegration(
			php3,
			await options.sqliteIntegrationPluginZip
		);
	}
	if (!(await isWordPressInstalled(php3))) {
		await installWordPress(php3);
	}
	if (!(await isWordPressInstalled(php3))) {
		throw new Error('WordPress installation has failed.');
	}
	return requestHandler;
}
async function isWordPressInstalled(php3) {
	return (
		(
			await php3.run({
				code: `<?php 
	require '${php3.documentRoot}/wp-load.php';
	echo is_blog_installed() ? '1' : '0';
	`,
			})
		).text === '1'
	);
}
async function installWordPress(php3) {
	await withPHPIniValues(
		php3,
		{
			disable_functions: 'fsockopen',
			allow_url_fopen: '0',
		},
		async () =>
			await php3.request({
				url: '/wp-admin/install.php?step=2',
				method: 'POST',
				body: {
					language: 'en',
					prefix: 'wp_',
					weblog_title: 'My WordPress Website',
					user_name: 'admin',
					admin_password: 'password',
					admin_password2: 'password',
					Submit: 'Install WordPress',
					pw_weak: '1',
					admin_email: 'admin@localhost.com',
				},
			})
	);
}
// ../wordpress/src/rewrite-rules.ts
var wordPressRewriteRules = [
	{
		match: /^\/(.*?)(\/wp-(content|admin|includes)\/.*)/g,
		replacement: '$2',
	},
];

// ../wordpress/src/index.ts
async function setupPlatformLevelMuPlugins(php3) {
	await php3.mkdir('/internal/shared/mu-plugins');
	await php3.writeFile(
		'/internal/shared/preload/env.php',
		`<?php
    
        // Allow adding filters/actions prior to loading WordPress.
        // \$function_to_add MUST be a string.
        function playground_add_filter( \$tag, \$function_to_add, \$priority = 10, \$accepted_args = 1 ) {
            global \$wp_filter;
            \$wp_filter[\$tag][\$priority][\$function_to_add] = array('function' => \$function_to_add, 'accepted_args' => \$accepted_args);
        }
        function playground_add_action( \$tag, \$function_to_add, \$priority = 10, \$accepted_args = 1 ) {
            playground_add_filter( \$tag, \$function_to_add, \$priority, \$accepted_args );
        }
        
        // Load our mu-plugins after customer mu-plugins
        // NOTE: this means our mu-plugins can't use the muplugins_loaded action!
        playground_add_action( 'muplugins_loaded', 'playground_load_mu_plugins', 0 );
        function playground_load_mu_plugins() {
            // Load all PHP files from /internal/shared/mu-plugins, sorted by filename
            \$mu_plugins_dir = '/internal/shared/mu-plugins';
            if(!is_dir(\$mu_plugins_dir)){
                return;
            }
            \$mu_plugins = glob( \$mu_plugins_dir . '/*.php' );
            sort( \$mu_plugins );
            foreach ( \$mu_plugins as \$mu_plugin ) {
                require_once \$mu_plugin;
            }
        }
    `
	);
	await php3.writeFile(
		'/internal/shared/mu-plugins/0-playground.php',
		`<?php
        // Redirect /wp-admin to /wp-admin/
        add_filter( 'redirect_canonical', function( \$redirect_url ) {
            if ( '/wp-admin' === \$redirect_url ) {
                return \$redirect_url . '/';
            }
            return \$redirect_url;
        } );
		
        // Needed because gethostbyname( 'wordpress.org' ) returns
        // a private network IP address for some reason.
        add_filter( 'allowed_redirect_hosts', function( \$deprecated = '' ) {
            return array(
                'wordpress.org',
                'api.wordpress.org',
                'downloads.wordpress.org',
            );
        } );

		// Support pretty permalinks
        add_filter( 'got_url_rewrite', '__return_true' );

        // Create the fonts directory if missing
        if(!file_exists(WP_CONTENT_DIR . '/fonts')) {
            mkdir(WP_CONTENT_DIR . '/fonts');
        }
		
        \$log_file = WP_CONTENT_DIR . '/debug.log';
        define('ERROR_LOG_FILE', \$log_file);
        ini_set('error_log', \$log_file);
        ?>`
	);
	await php3.writeFile(
		'/internal/shared/preload/error-handler.php',
		`<?php
		(function() { 
			\$playground_consts = [];
			if(file_exists('/internal/shared/consts.json')) {
				\$playground_consts = @json_decode(file_get_contents('/internal/shared/consts.json'), true) ?: [];
				\$playground_consts = array_keys(\$playground_consts);
			}
			set_error_handler(function(\$severity, \$message, \$file, \$line) use(\$playground_consts) {
				/**
				 * This is a temporary workaround to hide the 32bit integer warnings that
				 * appear when using various time related function, such as strtotime and mktime.
				 * Examples of the warnings that are displayed:
				 *
				 * Warning: mktime(): Epoch doesn't fit in a PHP integer in <file>
				 * Warning: strtotime(): Epoch doesn't fit in a PHP integer in <file>
				 */
				if (strpos(\$message, "fit in a PHP integer") !== false) {
					return;
				}
				/**
				 * Playground defines some constants upfront, and some of them may be redefined
				 * in wp-config.php. For example, SITE_URL or WP_DEBUG. This is expected and
				 * we want Playground constants to take priority without showing warnings like:
				 *
				 * Warning: Constant SITE_URL already defined in
				 */
				if (strpos(\$message, "already defined") !== false) {
					foreach(\$playground_consts as \$const) {
						if(strpos(\$message, "Constant \$const already defined") !== false) {
							return;
						}
					}
				}
				/**
				 * Don't complain about network errors when not connected to the network.
				 */
				if (
					(
						! defined('USE_FETCH_FOR_REQUESTS') ||
						! USE_FETCH_FOR_REQUESTS
					) &&
					strpos(\$message, "WordPress could not establish a secure connection to WordPress.org") !== false)
				{
					return;
				}
				return false;
			});
		})();`
	);
}
async function preloadPhpInfoRoute(php3, requestPath = '/phpinfo.php') {
	await php3.writeFile(
		'/internal/shared/preload/phpinfo.php',
		`<?php
    // Render PHPInfo if the requested page is /phpinfo.php
    if ( ${phpVar(requestPath)} === \$_SERVER['REQUEST_URI'] ) {
        phpinfo();
        exit;
    }
    `
	);
}
async function preloadSqliteIntegration(php3, sqliteZip) {
	if (await php3.isDir('/tmp/sqlite-database-integration')) {
		await php3.rmdir('/tmp/sqlite-database-integration', {
			recursive: true,
		});
	}
	await php3.mkdir('/tmp/sqlite-database-integration');
	await unzipFile(php3, sqliteZip, '/tmp/sqlite-database-integration');
	const SQLITE_PLUGIN_FOLDER = '/internal/shared/sqlite-database-integration';
	await php3.mv(
		'/tmp/sqlite-database-integration/sqlite-database-integration-main',
		SQLITE_PLUGIN_FOLDER
	);
	await php3.defineConstant('SQLITE_MAIN_FILE', '1');
	const dbCopy = await php3.readFileAsText(
		joinPaths(SQLITE_PLUGIN_FOLDER, 'db.copy')
	);
	const dbPhp = dbCopy
		.replace(
			"'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'",
			phpVar(SQLITE_PLUGIN_FOLDER)
		)
		.replace(
			"'{SQLITE_PLUGIN}'",
			phpVar(joinPaths(SQLITE_PLUGIN_FOLDER, 'load.php'))
		);
	const dbPhpPath = joinPaths(await php3.documentRoot, 'wp-content/db.php');
	const stopIfDbPhpExists = `<?php
	// Do not preload this if WordPress comes with a custom db.php file.
	if(file_exists(${phpVar(dbPhpPath)})) {
		return;
	}
	?>`;
	const SQLITE_MUPLUGIN_PATH =
		'/internal/shared/mu-plugins/sqlite-database-integration.php';
	await php3.writeFile(SQLITE_MUPLUGIN_PATH, stopIfDbPhpExists + dbPhp);
	await php3.writeFile(
		`/internal/shared/preload/0-sqlite.php`,
		stopIfDbPhpExists +
			`<?php

/**
 * Loads the SQLite integration plugin before WordPress is loaded
 * and without creating a drop-in "db.php" file. 
 *
 * Technically, it creates a global $wpdb object whose only two
 * purposes are to:
 *
 * * Exist \u2013 because the require_wp_db() WordPress function won't
 *           connect to MySQL if $wpdb is already set.
 * * Load the SQLite integration plugin the first time it's used
 *   and replace the global $wpdb reference with the SQLite one.
 *
 * This lets Playground keep the WordPress installation clean and
 * solves dillemas like:
 *
 * * Should we include db.php in Playground exports?
 * * Should we remove db.php from Playground imports?
 * * How should we treat stale db.php from long-lived OPFS sites?
 *
 * @see https://github.com/WordPress/wordpress-playground/discussions/1379 for
 *      more context.
 */
class Playground_SQLite_Integration_Loader {
	public function __call($name, $arguments) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb \u2013 SQLite integration plugin could not be loaded');
		}
		return call_user_func_array(
			array($GLOBALS['wpdb'], $name),
			$arguments
		);
	}
	public function __get($name) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb \u2013 SQLite integration plugin could not be loaded');
		}
		return $GLOBALS['wpdb']->$name;
	}
	public function __set($name, $value) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb \u2013 SQLite integration plugin could not be loaded');
		}
		$GLOBALS['wpdb']->$name = $value;
	}
    protected function load_sqlite_integration() {
        require_once ${phpVar(SQLITE_MUPLUGIN_PATH)};
    }
}
\$wpdb = \$GLOBALS['wpdb'] = new Playground_SQLite_Integration_Loader();

/**
 * WordPress is capable of using a preloaded global \$wpdb. However, if
 * it cannot find the drop-in db.php plugin it still checks whether
 * the mysqli_connect() function exists even though it's not used.
 *
 * What WordPress demands, Playground shall provide.
 */
if(!function_exists('mysqli_connect')) {
	function mysqli_connect() {}
}

		`
	);
	await php3.writeFile(
		`/internal/shared/mu-plugins/sqlite-test.php`,
		`<?php
		global \$wpdb;
		if(!(\$wpdb instanceof WP_SQLite_DB)) {
			var_dump(isset(\$wpdb));
			die("SQLite integration not loaded " . get_class(\$wpdb));
		}
		`
	);
}
async function unzipWordPress(php3, wpZip) {
	php3.mkdir('/tmp/unzipped-wordpress');
	await unzipFile(php3, wpZip, '/tmp/unzipped-wordpress');
	if (php3.fileExists('/tmp/unzipped-wordpress/wordpress.zip')) {
		await unzipFile(
			php3,
			'/tmp/unzipped-wordpress/wordpress.zip',
			'/tmp/unzipped-wordpress'
		);
	}
	const wpPath = php3.fileExists('/tmp/unzipped-wordpress/wordpress')
		? '/tmp/unzipped-wordpress/wordpress'
		: php3.fileExists('/tmp/unzipped-wordpress/build')
		? '/tmp/unzipped-wordpress/build'
		: '/tmp/unzipped-wordpress';
	php3.mv(wpPath, php3.documentRoot);
	if (
		!php3.fileExists(joinPaths(php3.documentRoot, 'wp-config.php')) &&
		php3.fileExists(joinPaths(php3.documentRoot, 'wp-config-sample.php'))
	) {
		php3.writeFile(
			joinPaths(php3.documentRoot, 'wp-config.php'),
			php3.readFileAsText(
				joinPaths(php3.documentRoot, '/wp-config-sample.php')
			)
		);
	}
}

// ../../php-wasm/web-service-worker/src/messaging.ts
function responseTo(requestId, response) {
	return {
		type: 'response',
		requestId,
		response,
	};
}
// src/messaging.ts
var uint8ArrayToBase64 = (bytes) => {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
};
var base64ToUint8Array = (base64) => {
	const byteCharacters = atob(base64);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	return new Uint8Array(byteNumbers);
};
var listenForPhpRequests = (callback) => {
	chrome.runtime.onMessage.addListener(
		async (message, sender, sendResponse) => {
			if (message.type === 'PLAYGROUND_REQUEST') {
				const decodedRequest = { ...message.request };
				if (
					decodedRequest.body &&
					typeof decodedRequest.body === 'string'
				) {
					decodedRequest.body = base64ToUint8Array(
						decodedRequest.body
					);
				}
				const response = await callback(decodedRequest);
				const encodedResponse = {
					headers: response.headers,
					httpStatusCode: response.httpStatusCode,
					errors: response.errors,
					bytes: uint8ArrayToBase64(new Uint8Array(response.bytes)),
				};
				sendResponse(encodedResponse);
			}
		}
	);
};

// src/playground-loader.ts
async function prerenderEditor() {
	await requestHandler;
	const iframe = document.createElement('iframe');
	iframe.src = 'http://localhost:5400/scope:777777777/wp-admin/post-new.php';
	document.body.appendChild(iframe);
	await new Promise((resolve) => {
		iframe.addEventListener('load', resolve);
	});
	setTimeout(() => {
		document.body.removeChild(iframe);
	}, 1e4);
}
async function bootWorker() {
	const iframe = document.querySelector('#playground-remote-service-worker');
	iframe.src = 'http://localhost:5400/extension.html';
	setTimeout(() => {
		iframe.contentWindow.addEventListener('message', (event) => {
			console.log({ event });
		});
	}, 3000);
	const [wordPressZip, sqliteIntegrationPluginZip] = await Promise.all([
		readFileFromCurrentExtension('wordpress-6.5.4.zip'),
		readFileFromCurrentExtension('sqlite-database-integration.zip'),
	]);
	const requestHandler = await bootWordPress({
		siteUrl: 'http://localhost:5400/scope:777777777/',
		createPhpRuntime: async () => {
			const phpModule = await import('./php_8_0.js');
			return await loadPHPRuntime(phpModule, {
				...fakeWebsocket(),
			});
		},
		wordPressZip,
		sqliteIntegrationPluginZip,
		sapiName: 'cli',
		phpIniEntries: {
			allow_url_fopen: '0',
			disable_functions: '',
		},
	});
	const url = 'http://localhost:5400/scope:777777777/';
	const primaryPHP = await requestHandler.getPrimaryPhp();
	primaryPHP.defineConstant('WP_HOME', url);
	primaryPHP.defineConstant('WP_SITEURL', url);
	primaryPHP.mkdir('/wordpress/wp-content/plugins/playground-editor');
	await installPlugin(primaryPHP, {
		pluginZipFile: new File(
			[await (await fetch('blocky-formats.zip')).blob()],
			'blocky-formats.zip'
		),
		options: {
			activate: false,
		},
	});
	primaryPHP.mv(
		'/wordpress/wp-content/plugins/blocky-formats-trunk',
		'/wordpress/wp-content/plugins/blocky-formats'
	);
	await activatePlugin(primaryPHP, {
		pluginPath: 'blocky-formats/blocky-formats.php',
	});
	await login(primaryPHP, {});
	primaryPHP.writeFile(
		'/wordpress/wp-content/plugins/playground-editor/script.js',
		`
		
		// Accept commands from the parent window
		let lastKnownFormat = '';
		window.addEventListener('message', (event) => {
			if(typeof event.data !== 'object') {
				return;
			}
			
			const { command, format, text } = event.data;
			lastKnownFormat = format;
	
			if(command === 'setEditorContent') {
				populateEditorWithFormattedText(text, format);
			} else if(command === 'getEditorContent') {
				const blocks = wp.data.select('core/block-editor').getBlocks();
				window.opener.postMessage({
					command: 'playgroundEditorTextChanged',
					format: format,
					text: formatConverters[format].fromBlocks(blocks),
					type: 'relay'
				}, '*');
			}
		});
	
	function waitForDOMContentLoaded() {
		return new Promise((resolve) => {
			if (
				document.readyState === 'complete' ||
				document.readyState === 'interactive'
			) {
				resolve();
			} else {
				document.addEventListener('DOMContentLoaded', resolve);
			}
		});
	}

	// @TODO: Figure out why this import is needed \u2013 blocky formats should hook this
	//        file on its own. Do I need WP nightly with modules support?
	await import('../blocky-formats/src/blocky-formats.js');
	await import('../blocky-formats/vendor/commonmark.min.js');
	const { markdownToBlocks, blocks2markdown } = await import('../blocky-formats/src/markdown.js');
	const formatConverters = {
		markdown: {
			toBlocks: markdownToBlocks,
			fromBlocks: blocks2markdown
		}
	};

	const createBlocks = blocks => blocks.map(block =>
		wp.blocks.createBlock(block.name, block.attributes, createBlocks(block.innerBlocks))
	);
	function populateEditorWithFormattedText(text, format) {
		console.log(format, {text});
		if(!(format in formatConverters)) {
			throw new Error('Unsupported format');
		}

		const rawBlocks = formatConverters[format].toBlocks(text);
		window.wp.data
			.dispatch('core/block-editor')
			.resetBlocks(createBlocks(rawBlocks))
	}

	function pushEditorContentsToParent(format) {
		const blocks = wp.data.select('core/block-editor').getBlocks();
		window.opener.postMessage({
			command: 'playgroundEditorTextChanged',
			format: format,
			text: formatConverters[format].fromBlocks(blocks),
			type: 'relay'
		}, '*');
	}

	waitForDOMContentLoaded().then(() => {
		// Experiment with sending the updated value back to the parent window
		// when typing. Debounce by 600ms.
		function debounce(func, wait) {
			let timeout;
			return function(...args) {
				const context = this;
				clearTimeout(timeout);
				timeout = setTimeout(() => func.apply(context, args), wait);
			};
		}

		setInterval(() => {
			pushEditorContentsToParent('markdown');
		}, 1000);
	});

    const { subscribe, select, dispatch } = wp.data;
    const { store } = wp.editPost;

    // Store the current post visibility
    let isSavingPost = false;

    subscribe(() => {
        const currentPost = select('core/editor').getCurrentPost();
        const isSaving = select('core/editor').isSavingPost();

        // Detect when the user initiated a save (publish or update)
        if (!isSavingPost && isSaving) {
            const postStatus = currentPost.status;
            const postType = currentPost.type;

            // Check if it is an actual publish or update action
            if (postStatus === 'publish' && postType !== 'auto-draft') {
                onPublish()
            }
        }

        // Update the saving post flag
        isSavingPost = isSaving;
    });

	function onPublish() {
		pushEditorContentsToParent('markdown');
		window.close();
		window.opener.focus();
	}	

	const initialText = decodeURIComponent((new URL(location.href)).hash?.substring(1));
	const initialFormat = 'markdown';
	if(initialText) {
		console.log(initialText, initialFormat);
		populateEditorWithFormattedText(initialText, initialFormat);
	} else {
		const blocks = [{
			name: 'core/paragraph',
			attributes: {
				content: ''
			},
			innerBlocks: []
		}];
		wp.data.dispatch('core/block-editor').resetBlocks(createBlocks(blocks));

        const firstEditableBlock = document.querySelector('.editor-canvas__iframe').contentDocument.querySelector('.wp-block:not(.wp-block-post-title)');
        if (firstEditableBlock) {
            firstEditableBlock.focus();
		}		
	}
	`
	);
	primaryPHP.writeFile(
		'/wordpress/wp-content/plugins/playground-editor/index.php',
		`<?php
    /**
    * Plugin Name: Playground Editor
    * Description: A simple plugin to edit rich text formats in Gutenberg.
    */
    // Disable welcome panel every time a user accesses the editor
    function disable_gutenberg_welcome_on_load() {
		if (is_admin()) {
			update_user_meta(get_current_user_id(), 'show_welcome_panel', 0);
			remove_action('enqueue_block_editor_assets', 'wp_enqueue_editor_tips');
		}
    }
    add_action('admin_init', 'disable_gutenberg_welcome_on_load');
    
    function enqueue_script() {
    	wp_enqueue_script( 'playground-editor-script', plugin_dir_url( __FILE__ ) . 'script.js', array( 'jquery' ), '1.0', true );
    }
    add_action( 'admin_init', 'enqueue_script' );

	add_action('enqueue_block_editor_assets', 'myplugin_add_inline_editor_styles');

	function myplugin_add_inline_editor_styles() {
		\$custom_css = "
			.editor-editor-canvas__post-title-wrapper {
				display: none;
			}
			.is-root-container {
				padding-top: 10px;
			}
		";
		wp_add_inline_style('wp-block-library', \$custom_css);
	}
    
    // Set script attribute to module
    add_filter('script_loader_tag', function(\$tag, \$handle, \$src) {
		if (\$handle === 'playground-editor-script') {
			\$tag = '<script type="module" src="' . esc_url(\$src) . '">'.'<'.'/script>';
		}
		return \$tag;
    }, 10, 3);
                `
	);
	await activatePlugin(primaryPHP, {
		pluginPath: 'playground-editor/index.php',
	});
	return requestHandler;
}
async function readFileFromCurrentExtension(path) {
	const response = await fetch(path);
	return new File([await response.blob()], path);
}
var requestHandler = bootWorker();
prerenderEditor();
listenForPhpRequests(async (request3) => {
	const handler2 = await requestHandler;
	console.log({
		'handling a request': request3,
	});
	request3.headers = {
		...(request3.headers || {}),
		Host: 'playground.internal',
		Origin: 'http://playground.internal',
		Referer: 'http://playground.internal',
	};
	const response = await handler2.request(request3);
	const newHeaders = {};
	for (const [key, value] of Object.entries(response.headers)) {
		newHeaders[key.toLowerCase()] = value.map((v) =>
			v.replace('http://playground.internal', chrome.runtime.getURL(''))
		);
	}
	console.log({
		'Got a response': response,
		newHeaders,
	});
	return {
		...response,
		headers: newHeaders,
		bytes: new TextEncoder().encode(
			response.text.replaceAll(
				'http://playground.internal',
				chrome.runtime.getURL('')
			)
		),
	};
});
var putInCache = async (request3, response) => {
	const cache = await caches.open('v1');
	await cache.put(request3, response);
};
var iframe = document.querySelector('#playground-remote-service-worker');
window.addEventListener('message', async (event) => {
	console.log('Got some message!', event);
	if (event.data.type === 'playground-extension-sw-message') {
		if (event.data.data.method === 'request') {
			const phpRequest = event.data.data.args[0];
			const requestUrl = new URL(phpRequest.url);
			requestUrl.searchParams.delete('_ajax_nonce');
			const request3 = new Request(requestUrl.toString(), {
				method: event.data.data.args[0].method,
			});
			const response = await caches.match(request3);
			let phpResponse = undefined;
			if (!response) {
				phpResponse = await (
					await requestHandler
				).request(event.data.data.args[0]);
				if (
					requestUrl.searchParams.has('rest_route') ||
					requestUrl.pathname.includes('wp-includes')
				) {
					putInCache(
						request3,
						new Response(phpResponse.bytes, {
							headers: phpResponse.headers,
							status: phpResponse.httpStatusCode,
						})
					);
				}
			}
			if (response && !phpResponse) {
				const phpResponseHeaders = {};
				response.headers.forEach((value, key) => {
					phpResponseHeaders[key.toLowerCase()] = [value];
				});
				phpResponse = {
					bytes: await response.arrayBuffer(),
					headers: phpResponseHeaders,
					httpStatusCode: response.status,
				};
			}
			iframe.contentWindow.postMessage(
				responseTo(event.data.requestId, phpResponse),
				'*'
			);
		}
		console.log('Got SW message!', event);
	}
});
var fakeWebsocket = () => {
	return {
		websocket: {
			decorator: (WebSocketConstructor) => {
				return class FakeWebsocketConstructor extends WebSocketConstructor {
					constructor() {
						try {
							super();
						} catch (e) {}
					}
					send() {
						return null;
					}
				};
			},
		},
	};
};
