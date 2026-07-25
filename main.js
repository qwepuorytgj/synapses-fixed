"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SynapsesPlugin
});
module.exports = __toCommonJS(main_exports);

// ../core/src/ontology.ts
var DEFAULT_ONTOLOGY = {
  parent: ["parent", "parents", "up"],
  child: ["child", "children", "down"],
  jump: ["jump", "jumps", "friend", "friends"]
};
function normalizeKey(k) {
  return String(k || "").toLowerCase().trim().replace(/\s+/g, "-");
}
function parseList(v) {
  if (typeof v !== "string") return null;
  const arr = v.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : null;
}
function buildOntology(config = {}) {
  return {
    parent: parseList(config.parent) || DEFAULT_ONTOLOGY.parent,
    child: parseList(config.child) || DEFAULT_ONTOLOGY.child,
    jump: parseList(config.jump) || DEFAULT_ONTOLOGY.jump
  };
}
function roleForKey(key, ont) {
  const k = normalizeKey(key);
  for (const role of Object.keys(ont)) {
    if (ont[role].map(normalizeKey).includes(k)) return role;
  }
  return null;
}

// ../core/src/ignore.ts
function isInLogseqFolder(path) {
  return /(^|\/)logseq\//i.test(String(path || ""));
}
function matchesIgnoreFilters(path, filters) {
  const p = String(path || "");
  for (const raw of filters || []) {
    let f = String(raw || "").trim();
    if (!f) continue;
    if (f.length >= 2 && f.startsWith("/") && f.endsWith("/")) {
      try {
        if (new RegExp(f.slice(1, -1)).test(p)) return true;
      } catch {
      }
      continue;
    }
    f = f.replace(/\/+$/, "");
    if (f && (p === f || p.startsWith(f + "/"))) return true;
  }
  return false;
}

// ../core/src/graph/index-pure.ts
function toNames(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map((v) => stripBrackets(String(v))).filter(Boolean);
  if (typeof val !== "string") return [];
  const s = val.trim();
  if (!s) return [];
  const refs = [];
  let rest = "";
  let last = 0;
  for (const m of s.matchAll(/\[\[(.+?)\]\]/g)) {
    refs.push(m[1].trim());
    rest += s.slice(last, m.index ?? last);
    last = (m.index ?? last) + m[0].length;
  }
  rest += s.slice(last);
  const plain = rest.split(",").map((v) => stripBrackets(v)).filter(Boolean);
  return [...refs.filter(Boolean), ...plain];
}
function stripBrackets(v) {
  return v.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
}
function collect(props, role, ont) {
  const out = [];
  for (const key of Object.keys(props || {})) {
    if (roleForKey(key, ont) === role) out.push(...props[key]);
  }
  return out;
}
function uniqNames(names, selfLower, exclude) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const n of names) {
    const l = n.toLowerCase();
    if (l === selfLower || seen.has(l) || exclude?.(l)) continue;
    seen.add(l);
    out.push(n);
  }
  return out;
}
var SIBLING_CAP = 50;
function assembleGraph(focusName, focusAdj, parentsAdj) {
  const f = String(focusName).toLowerCase();
  const { parents, children, jumps } = focusAdj;
  const parentSet = new Set(parents.map((p) => p.toLowerCase()));
  const childSet = new Set(children.map((c) => c.toLowerCase()));
  const jumpSet = new Set(jumps.map((j) => j.toLowerCase()));
  const siblings = [];
  const sibSeen = /* @__PURE__ */ new Set();
  const siblingParent = {};
  for (const p of parents) {
    const pAdj = parentsAdj[p.toLowerCase()];
    if (!pAdj) continue;
    for (const c of pAdj.children) {
      const l = c.toLowerCase();
      if (l === f || parentSet.has(l) || childSet.has(l) || jumpSet.has(l) || sibSeen.has(l)) continue;
      sibSeen.add(l);
      siblings.push(c);
      siblingParent[c] = p;
    }
  }
  return {
    focus: focusName,
    parents,
    children,
    jumps,
    siblings: siblings.slice(0, SIBLING_CAP),
    siblingsTruncated: siblings.length > SIBLING_CAP,
    siblingParent
  };
}
var ROLES = ["parent", "child", "jump"];
function pickStructuralParent(members, struct) {
  const [m0, m1] = members;
  const first = m0 < m1 ? m0 : m1;
  const second = first === m0 ? m1 : m0;
  const firstAssert = new Set(struct.filter((s) => s.by === first).map((s) => s.parent));
  const secondAssert = new Set(struct.filter((s) => s.by === second).map((s) => s.parent));
  if (firstAssert.size === 1) return [...firstAssert][0];
  if (secondAssert.size === 1) return [...secondAssert][0];
  return first;
}
function resolvePair(p) {
  const structParents = new Set(p.struct.map((s) => s.parent));
  if (structParents.size === 0) return p.hasJump ? { role: "jump" } : null;
  const parent = structParents.size === 1 ? [...structParents][0] : pickStructuralParent(p.members, p.struct);
  const [m0, m1] = p.members;
  return { role: "struct", parent, child: parent === m0 ? m1 : m0 };
}
function getOrCreatePair(pairs, a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  const key = `${x} ${y}`;
  let e = pairs.get(key);
  if (!e) {
    e = { members: [x, y], hasJump: false, struct: [] };
    pairs.set(key, e);
  }
  return e;
}
function recordLink(aLower, role, target, pairs, display) {
  const tLower = target.toLowerCase();
  if (tLower === aLower) return;
  if (!display.has(tLower)) display.set(tLower, target);
  const pair = getOrCreatePair(pairs, aLower, tLower);
  if (role === "jump") pair.hasJump = true;
  else pair.struct.push({ by: aLower, parent: role === "parent" ? tLower : aLower });
}
function buildPairMap(pages, display, ont) {
  const pairs = /* @__PURE__ */ new Map();
  for (const p of pages) {
    const aLower = p.name.toLowerCase();
    for (const role of ROLES) {
      for (const target of collect(p.props, role, ont)) recordLink(aLower, role, target, pairs, display);
    }
  }
  return pairs;
}
function buildDesiredRoles(pairs, display) {
  const desired = /* @__PURE__ */ new Map();
  const emptyRoles = () => ({ parent: /* @__PURE__ */ new Map(), child: /* @__PURE__ */ new Map(), jump: /* @__PURE__ */ new Map() });
  const bucket = (lower) => {
    let e = desired.get(lower);
    if (!e) {
      e = emptyRoles();
      desired.set(lower, e);
    }
    return e;
  };
  const keep = (pageLower, role, targetLower) => bucket(pageLower)[role].set(targetLower, display.get(targetLower) ?? targetLower);
  for (const pair of pairs.values()) {
    const win = resolvePair(pair);
    if (!win) continue;
    const [m0, m1] = pair.members;
    bucket(m0);
    bucket(m1);
    if (win.role === "jump") {
      keep(m0, "jump", m1);
      keep(m1, "jump", m0);
    } else {
      keep(win.parent, "child", win.child);
      keep(win.child, "parent", win.parent);
    }
  }
  return desired;
}
function reconcileGraph(pages, ont) {
  const display = /* @__PURE__ */ new Map();
  for (const p of pages) {
    const l = p.name.toLowerCase();
    if (!display.has(l)) display.set(l, p.name);
  }
  const pairs = buildPairMap(pages, display, ont);
  const desired = buildDesiredRoles(pairs, display);
  const out = /* @__PURE__ */ new Map();
  for (const [lower, roles] of desired) {
    out.set(lower, {
      parents: [...roles.parent.values()],
      children: [...roles.child.values()],
      jumps: [...roles.jump.values()]
    });
  }
  return out;
}
function reconcileNoteAdjacency(name, ownProps, backlinkers, ont) {
  const map = reconcileGraph([{ name, props: ownProps }, ...backlinkers], ont);
  return map.get(name.toLowerCase()) ?? { parents: [], children: [], jumps: [] };
}
function applyRawLinks(graph, refs, cfg) {
  if (cfg.outgoing === "off" && cfg.incoming === "off") return graph;
  const f = graph.focus.toLowerCase();
  const exclude = /* @__PURE__ */ new Set([
    f,
    ...graph.parents.map((n) => n.toLowerCase()),
    ...graph.children.map((n) => n.toLowerCase()),
    ...graph.jumps.map((n) => n.toLowerCase()),
    ...graph.siblings.map((n) => n.toLowerCase())
  ]);
  const jumpAdds = [];
  const childAdds = [];
  const seen = /* @__PURE__ */ new Set();
  const addDirection = (names, mode) => {
    if (mode === "off") return;
    const capped = uniqNames(names, f, (l) => exclude.has(l) || seen.has(l)).slice(0, SIBLING_CAP);
    const bucket = mode === "jump" ? jumpAdds : childAdds;
    for (const n of capped) {
      seen.add(n.toLowerCase());
      bucket.push(n);
    }
  };
  addDirection(refs.outgoing, cfg.outgoing);
  addDirection(refs.incoming, cfg.incoming);
  if (!jumpAdds.length && !childAdds.length) return graph;
  return {
    ...graph,
    jumps: [...graph.jumps, ...jumpAdds],
    children: [...graph.children, ...childAdds],
    raw: [...jumpAdds, ...childAdds].map((n) => n.toLowerCase())
  };
}

// ../core/src/history.ts
var CAP = 50;
var same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
function pushEntry({ stack, idx }, name, cap = CAP) {
  if (idx >= 0 && same(stack[idx], name)) return { stack: stack.slice(), idx };
  const next = stack.slice(0, idx + 1).filter((s) => !same(s, name));
  next.push(name);
  const overflow = next.length - cap;
  const trimmed = overflow > 0 ? next.slice(overflow) : next;
  return { stack: trimmed, idx: trimmed.length - 1 };
}
function jumpTo({ stack, idx }, i) {
  const ni = i >= 0 && i < stack.length ? i : idx;
  return { stack: stack.slice(), idx: ni };
}
function removeEntry({ stack, idx }, name) {
  const keep = stack.map((s) => !same(s, name));
  const next = stack.filter((_, i) => keep[i]);
  if (next.length === stack.length) return { stack: next, idx };
  if (next.length === 0) return { stack: next, idx: -1 };
  let target = -1;
  for (let i = Math.min(idx, stack.length - 1); i >= 0; i--) {
    if (keep[i]) {
      target = i;
      break;
    }
  }
  if (target === -1) {
    for (let i = idx + 1; i < stack.length; i++) {
      if (keep[i]) {
        target = i;
        break;
      }
    }
  }
  let ni = 0;
  for (let i = 0; i < target; i++) if (keep[i]) ni++;
  return { stack: next, idx: ni };
}
function serialize({ stack, idx }) {
  return JSON.stringify({ stack, idx });
}
function deserialize(raw) {
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const rec = o;
    if (!Array.isArray(rec.stack)) return null;
    const items = rec.stack;
    const keep = items.map((s) => typeof s === "string");
    const stack = items.filter((s) => typeof s === "string");
    const filteredIndexAt = (rawIdx2) => {
      let n = -1;
      for (let i = 0; i <= rawIdx2 && i < items.length; i++) if (keep[i]) n++;
      return n;
    };
    const rawIdx = Number.isInteger(rec.idx) ? rec.idx : items.length - 1;
    let idx = rawIdx >= 0 && rawIdx < items.length ? filteredIndexAt(rawIdx) : stack.length - 1;
    if (idx < 0 || idx >= stack.length) idx = stack.length - 1;
    return { stack, idx };
  } catch {
    return null;
  }
}
function createHistory(onChange) {
  let state = { stack: [], idx: -1 };
  const snapshot = () => ({ list: state.stack.slice(), index: state.idx });
  return {
    state: snapshot,
    push(name) {
      state = pushEntry(state, name);
      if (onChange) onChange(state);
      return snapshot();
    },
    jump(i) {
      state = jumpTo(state, i);
      if (onChange) onChange(state);
      return { name: state.stack[state.idx] || null, ...snapshot() };
    },
    remove(name) {
      state = removeEntry(state, name);
      if (onChange) onChange(state);
      return snapshot();
    },
    load(loaded) {
      if (loaded && Array.isArray(loaded.stack)) state = { stack: loaded.stack.slice(), idx: loaded.idx };
      return snapshot();
    }
  };
}

// ../core/src/pins.ts
var CAP2 = 50;
var same2 = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
function addPin(list, name, cap = CAP2) {
  if (list.some((p) => same2(p, name))) return list.slice();
  const next = [...list, name];
  const overflow = next.length - cap;
  return overflow > 0 ? next.slice(overflow) : next;
}
function removePin(list, name) {
  return list.filter((p) => !same2(p, name));
}
function serializePins(list) {
  return JSON.stringify({ pins: list });
}
function deserializePins(raw) {
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const rec = o;
    if (!Array.isArray(rec.pins)) return null;
    return rec.pins.filter((p) => typeof p === "string");
  } catch {
    return null;
  }
}
function createPins(onChange) {
  let list = [];
  const snapshot = () => list.slice();
  return {
    state: snapshot,
    add(name) {
      const next = addPin(list, name);
      const changed = next.length !== list.length;
      list = next;
      if (changed && onChange) onChange(snapshot());
      return snapshot();
    },
    remove(name) {
      const next = removePin(list, name);
      const changed = next.length !== list.length;
      list = next;
      if (changed && onChange) onChange(snapshot());
      return snapshot();
    },
    load(loaded) {
      if (loaded && Array.isArray(loaded)) list = loaded.slice();
      return snapshot();
    }
  };
}

// ../core/src/mutations.ts
function removeFromLinkList(names, target) {
  const t = String(target).toLowerCase();
  return names.filter((n) => n.toLowerCase() !== t);
}
var isSelf = (a, b) => a.toLowerCase() === b.toLowerCase();
function createMutations(dataSource, getOntology) {
  async function addPropLink(pageName, role, target) {
    await dataSource.ensurePage(pageName);
    const props = await dataSource.getPageProps(pageName);
    const ont = getOntology();
    const exists = collect(props, role, ont).some((n) => n.toLowerCase() === target.toLowerCase());
    if (exists) return;
    const key = Object.keys(props).find((k) => roleForKey(k, ont) === role) ?? ont[role][0];
    await dataSource.setPropertyLinks(pageName, key, [...props[key] || [], target]);
  }
  async function removeRoleLinks(pageName, role, target) {
    const props = await dataSource.getPageProps(pageName);
    const ont = getOntology();
    for (const key of Object.keys(props)) {
      if (roleForKey(key, ont) !== role) continue;
      const current = props[key];
      const remaining = removeFromLinkList(current, target);
      if (remaining.length === current.length) continue;
      if (remaining.length) await dataSource.setPropertyLinks(pageName, key, remaining);
      else await dataSource.removePropertyKey(pageName, key);
    }
  }
  async function rolesBetween(focus, target) {
    const props = await dataSource.getPageProps(focus);
    const ont = getOntology();
    const t = target.toLowerCase();
    const out = /* @__PURE__ */ new Set();
    for (const key of Object.keys(props)) {
      const role = roleForKey(key, ont);
      if (role && props[key].some((n) => n.toLowerCase() === t)) out.add(role);
    }
    return [...out];
  }
  async function removeAllLinks(focus, target) {
    for (const role of await rolesBetween(focus, target)) await removeRoleLinks(focus, role, target);
    for (const role of await rolesBetween(target, focus)) await removeRoleLinks(target, role, focus);
  }
  async function setLink(focus, target, role) {
    const focusRoles = await rolesBetween(focus, target);
    const targetRoles = await rolesBetween(target, focus);
    await addPropLink(focus, role, target);
    for (const e of focusRoles) if (e !== role) await removeRoleLinks(focus, e, target);
    for (const e of targetRoles) await removeRoleLinks(target, e, focus);
  }
  async function create(role, focus, name) {
    if (isSelf(focus, name)) return false;
    await setLink(focus, name, role);
    return true;
  }
  return {
    createChild: (focus, name) => create("child", focus, name),
    createParent: (focus, name) => create("parent", focus, name),
    createJump: (focus, name) => create("jump", focus, name),
    async linkExisting(focus, name, role) {
      if (isSelf(focus, name)) return false;
      await setLink(focus, name, role);
      return true;
    },
    async removeLink(focus, target) {
      if (isSelf(focus, target)) return false;
      await removeAllLinks(focus, target);
      return true;
    }
  };
}

// ../core/src/errText.ts
function errText(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = e.message;
    if (typeof m === "string") return m;
  }
  try {
    return JSON.stringify(e) ?? "unknown error";
  } catch {
    return "unknown error";
  }
}

// ../core/src/log.ts
var log = {
  // Intentional, user-facing breadcrumb (e.g. where the debug log file lives) — kept
  // here so the '[synapses]' prefix stays in one place.
  info: (...args) => console.info("[synapses]", ...args),
  warn: (...args) => console.warn("[synapses]", ...args),
  error: (...args) => console.error("[synapses]", ...args)
};

// ../core/src/logger.ts
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
function formatPlain(rec) {
  const { t, ctx, cat, act, ...rest } = rec;
  const time = typeof t === "string" ? t.slice(11, 23) : "";
  const head = [time, ctx, `${String(cat ?? "")}/${String(act ?? "")}`].filter(Boolean).join(" ");
  const kv = Object.entries(rest).map(([k, v]) => `${k}=${v !== null && typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" ");
  return kv ? `${head} ${kv}` : head;
}
function createLogger(write, opts) {
  let on = opts.enabled ?? false;
  const mirror = opts.mirror;
  const emit = (line, rec) => {
    if (!on) return;
    write(line);
    if (mirror) {
      try {
        mirror(formatPlain(rec ?? JSON.parse(line)));
      } catch {
        mirror(line);
      }
    }
  };
  return {
    enabled: () => on,
    setEnabled: (v) => {
      on = v;
    },
    log(cat, act, data) {
      if (!on) return;
      const rec = { t: nowIso(), ctx: opts.ctx, cat, act, ...data ?? {} };
      try {
        emit(JSON.stringify(rec), rec);
      } catch {
      }
    },
    ingest(line) {
      emit(line);
    }
  };
}
var noopLogger = {
  enabled: () => false,
  setEnabled: () => {
  },
  log: () => {
  },
  ingest: () => {
  }
};
var DEFAULT_CAP = 1e6;
var DEFAULT_FLUSH = 500;
function capFront(text, capBytes) {
  if (text.length <= capBytes) return text;
  const cut = text.length - capBytes;
  const nl = text.indexOf("\n", cut);
  return nl >= 0 ? text.slice(nl + 1) : text.slice(cut);
}
function createBufferedSink(opts) {
  const cap = opts.capBytes ?? DEFAULT_CAP;
  const flushMs = opts.flushMs ?? DEFAULT_FLUSH;
  let buffer = "";
  let loaded = false;
  const pre = [];
  let timer;
  let disposed = false;
  let cleared = false;
  void opts.load().then((txt) => {
    if (!cleared) buffer = capFront((txt ?? "") + pre.join(""), cap);
  }).catch(() => {
    if (!cleared) buffer = capFront(pre.join(""), cap);
  }).finally(() => {
    loaded = true;
    pre.length = 0;
    if (buffer) schedule();
  });
  function doFlush() {
    timer = void 0;
    void opts.persist(buffer).catch(() => {
    });
  }
  function schedule() {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(doFlush, flushMs);
  }
  return {
    write(line) {
      if (disposed) return;
      if (!loaded) {
        pre.push(line + "\n");
        return;
      }
      buffer = capFront(buffer + line + "\n", cap);
      schedule();
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        doFlush();
      }
    },
    clear() {
      if (disposed) return;
      cleared = true;
      loaded = true;
      pre.length = 0;
      buffer = "";
      if (timer) clearTimeout(timer);
      doFlush();
    },
    dispose() {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
        doFlush();
      }
    }
  };
}
function brief(args) {
  return args.map((a) => Array.isArray(a) ? { n: a.length } : a);
}
var BACKEND_LOGGED = [
  "getActivePage",
  "getTheme",
  "getUiMode",
  "buildGraph",
  "nodeAdjacency",
  "histState",
  "histPush",
  "histJump",
  "histRemove",
  "navigate",
  "createChild",
  "createParent",
  "createJump",
  "linkExisting",
  "removeLink",
  "searchPages",
  "getSize",
  "setSize",
  "getConnectorColors",
  "setConnectorColors",
  "isPanelExpanded",
  "togglePanel",
  "pinsState",
  "pinAdd",
  "pinRemove"
];
function wrapBackendWithLogging(backend, logger) {
  const out = { on: backend.on.bind(backend) };
  for (const name of BACKEND_LOGGED) {
    const orig = backend[name];
    const wrapped = async (...a) => {
      if (!logger.enabled()) return orig(...a);
      const start = Date.now();
      try {
        const r = await orig(...a);
        logger.log("call", name, { args: brief(a), ok: true, ms: Date.now() - start });
        return r;
      } catch (e) {
        logger.log("call", name, { args: brief(a), ok: false, err: errText(e), ms: Date.now() - start });
        throw e;
      }
    };
    out[name] = wrapped;
  }
  return out;
}
function wrapDataSource(ds, logger) {
  const wrapped = {
    getPageProps: ds.getPageProps.bind(ds),
    searchPages: ds.searchPages.bind(ds),
    async ensurePage(name) {
      logger.log("edit", "ensurePage", { page: name });
      return ds.ensurePage(name);
    },
    async setPropertyLinks(name, key, targets) {
      logger.log("edit", "setPropertyLinks", { page: name, key, targets });
      return ds.setPropertyLinks(name, key, targets);
    },
    async removePropertyKey(name, key) {
      logger.log("edit", "removePropertyKey", { page: name, key });
      return ds.removePropertyKey(name, key);
    }
  };
  if (ds.getBacklinks) {
    const orig = ds.getBacklinks.bind(ds);
    wrapped.getBacklinks = async (name) => {
      const r = await orig(name);
      logger.log("read", "getBacklinks", {
        page: name,
        found: r.map((p) => ({ n: p.name, keys: Object.keys(p.props) }))
      });
      return r;
    };
  }
  if (ds.getOutgoingRefs) {
    const orig = ds.getOutgoingRefs.bind(ds);
    wrapped.getOutgoingRefs = async (name) => {
      const r = await orig(name);
      logger.log("read", "getOutgoingRefs", { page: name, found: r.length });
      return r;
    };
  }
  if (ds.getIncomingRefs) {
    const orig = ds.getIncomingRefs.bind(ds);
    wrapped.getIncomingRefs = async (name) => {
      const r = await orig(name);
      logger.log("read", "getIncomingRefs", { page: name, found: r.length });
      return r;
    };
  }
  return wrapped;
}

// ../core/src/backend.ts
var HISTORY_SAVE_DEBOUNCE_MS = 300;
var SIZE_SAVE_DEBOUNCE_MS = 300;
var REFRESH_DEBOUNCE_MS = 500;
var HISTORY_KEY = "history.json";
var SIZE_KEY = "size";
var COLORS_KEY = "connectorColors";
var PINS_KEY = "pins.json";
function createCoreBackend(dataSource, services, logger = noopLogger) {
  const getOntology = () => services.getOntology();
  const mut = createMutations(dataSource, getOntology);
  async function reconcile(name) {
    const ont = getOntology();
    const [own, back] = await Promise.all([
      dataSource.getPageProps(name),
      dataSource.getBacklinks ? dataSource.getBacklinks(name) : Promise.resolve([])
    ]);
    return reconcileNoteAdjacency(name, own, back, ont);
  }
  async function buildGraph(name) {
    const adj = await reconcile(name);
    const parentsAdj = {};
    await Promise.all(adj.parents.map(async (p) => {
      parentsAdj[p.toLowerCase()] = await reconcile(p);
    }));
    const graph = assembleGraph(name, adj, parentsAdj);
    const cfg = services.getRawLinks?.() ?? { outgoing: "off", incoming: "off" };
    if (cfg.outgoing === "off" && cfg.incoming === "off") return graph;
    const [outgoing, incoming] = await Promise.all([
      cfg.outgoing !== "off" && dataSource.getOutgoingRefs ? dataSource.getOutgoingRefs(name) : Promise.resolve([]),
      cfg.incoming !== "off" && dataSource.getIncomingRefs ? dataSource.getIncomingRefs(name) : Promise.resolve([])
    ]);
    return applyRawLinks(graph, { outgoing, incoming }, cfg);
  }
  async function nodeAdjacency(names) {
    const out = {};
    await Promise.all((names || []).map(async (n) => {
      out[n.toLowerCase()] = await reconcile(n);
    }));
    return out;
  }
  let saveTimer;
  const history = createHistory((state) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      services.persistence.save(HISTORY_KEY, serialize(state)).catch((e) => log.warn("history save failed", e));
    }, HISTORY_SAVE_DEBOUNCE_MS);
  });
  async function seedHistory(reset = false) {
    try {
      const raw = await services.persistence.load(HISTORY_KEY);
      const loaded = raw ? deserialize(raw) : null;
      if (loaded) history.load(loaded);
      else if (reset) history.load({ stack: [], idx: -1 });
    } catch (e) {
      log.warn("history load failed", e);
    }
  }
  let pinsSaveTimer;
  const pins = createPins((list) => {
    if (pinsSaveTimer) clearTimeout(pinsSaveTimer);
    pinsSaveTimer = setTimeout(() => {
      services.persistence.save(PINS_KEY, serializePins(list)).catch((e) => log.warn("pins save failed", e));
    }, HISTORY_SAVE_DEBOUNCE_MS);
  });
  async function seedPins(reset = false) {
    try {
      const raw = await services.persistence.load(PINS_KEY);
      const loaded = raw ? deserializePins(raw) : null;
      if (loaded) pins.load(loaded);
      else if (reset) pins.load([]);
    } catch (e) {
      log.warn("pins load failed", e);
    }
  }
  const ready = Promise.all([seedHistory(false), seedPins(false)]).then(() => void 0);
  const listeners = {
    recenter: /* @__PURE__ */ new Set(),
    theme: /* @__PURE__ */ new Set(),
    refresh: /* @__PURE__ */ new Set(),
    uimode: /* @__PURE__ */ new Set()
  };
  function emit(evt, payload) {
    for (const fn of listeners[evt]) fn(payload);
  }
  let sizeTimer;
  services.persistence.onScopeChange?.(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = void 0;
    if (sizeTimer) clearTimeout(sizeTimer);
    sizeTimer = void 0;
    if (pinsSaveTimer) clearTimeout(pinsSaveTimer);
    pinsSaveTimer = void 0;
    void Promise.all([seedHistory(true), seedPins(true)]).then(() => emit("refresh", void 0));
  });
  let refreshTimer;
  const emitRefreshDebounced = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = void 0;
      emit("refresh", void 0);
    }, REFRESH_DEBOUNCE_MS);
  };
  services.onGraphChange(() => {
    logger.log("editor", "graphChange");
    emitRefreshDebounced();
  });
  services.onActivePageChange((name) => {
    if (name) {
      logger.log("editor", "activePage", { page: name });
      emit("recenter", { page: name });
    }
  });
  services.onThemeChange((p) => {
    logger.log("editor", "theme", { mode: p.mode });
    emit("theme", p);
  });
  services.onUiModeChange(() => {
    logger.log("editor", "uimode");
    emit("uimode", void 0);
  });
  services.onOntologyChange(() => {
    logger.log("editor", "ontology");
    emitRefreshDebounced();
  });
  return {
    getActivePage: async () => services.getActivePageName(),
    getTheme: async () => services.getTheme(),
    getUiMode: async () => services.getUiMode(),
    isPanelExpanded: () => Promise.resolve(services.panelHeight ? services.panelHeight.isExpanded() : null),
    togglePanel: () => Promise.resolve(services.panelHeight ? services.panelHeight.toggle() : null),
    buildGraph,
    nodeAdjacency,
    histState: async () => {
      await ready;
      return history.state();
    },
    histPush: async (name) => {
      await ready;
      return history.push(name);
    },
    histJump: async (i) => {
      await ready;
      return history.jump(i);
    },
    histRemove: async (name) => {
      await ready;
      return history.remove(name);
    },
    navigate: async (name) => {
      await services.navigateTo(name);
      return true;
    },
    createChild: mut.createChild,
    createParent: mut.createParent,
    createJump: mut.createJump,
    linkExisting: mut.linkExisting,
    removeLink: mut.removeLink,
    searchPages: (q) => dataSource.searchPages(q),
    getSize: async () => {
      try {
        const raw = await services.persistence.load(SIZE_KEY);
        if (raw == null || raw === "") return null;
        const n = Number(raw);
        return Number.isInteger(n) && n >= 0 ? n : null;
      } catch (e) {
        log.warn("size load failed", e);
        return null;
      }
    },
    // level === null resets to the default size; an integer level is debounced like
    // history. Clearing is immediate so a reset can't be clobbered by a stale save.
    setSize: async (level) => {
      if (sizeTimer) clearTimeout(sizeTimer);
      if (level == null) {
        services.persistence.save(SIZE_KEY, "").catch((e) => log.warn("size clear failed", e));
        return;
      }
      sizeTimer = setTimeout(() => {
        services.persistence.save(SIZE_KEY, String(level)).catch((e) => log.warn("size save failed", e));
      }, SIZE_SAVE_DEBOUNCE_MS);
    },
    getConnectorColors: async () => {
      try {
        const raw = await services.persistence.load(COLORS_KEY);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return obj && typeof obj === "object" ? obj : {};
      } catch (e) {
        log.warn("connector colors load failed", e);
        return {};
      }
    },
    // Persisted immediately (not debounced) — color edits are deliberate, infrequent
    // clicks, and a reset must not be clobbered by a stale debounced save.
    setConnectorColors: async (colors) => {
      try {
        await services.persistence.save(COLORS_KEY, JSON.stringify(colors || {}));
      } catch (e) {
        log.warn("connector colors save failed", e);
      }
    },
    pinsState: async () => {
      await ready;
      return pins.state();
    },
    pinAdd: async (name) => {
      await ready;
      return pins.add(name);
    },
    pinRemove: async (name) => {
      await ready;
      return pins.remove(name);
    },
    on: (event, handler) => {
      listeners[event].add(handler);
      return () => listeners[event].delete(handler);
    }
  };
}

// ../core/src/app-logic.ts
function sameName(a, b) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
function graphKey(g) {
  const arr = (a) => (a || []).map((x) => x.toLowerCase()).sort();
  const siblingParent = Object.entries(g.siblingParent || {}).map(([k, v]) => [k.toLowerCase(), (v || "").toLowerCase()]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return JSON.stringify([
    g.focus.toLowerCase(),
    arr(g.parents),
    arr(g.children),
    arr(g.jumps),
    arr(g.siblings),
    siblingParent,
    !!g.siblingsTruncated,
    arr(g.raw ?? [])
  ]);
}
function stickyExpired(until, now) {
  return until === 0 || now >= until;
}
function recordOutboundNav(list, name, now, ttlMs) {
  const pruned = list.filter((e) => now - e.at < ttlMs);
  pruned.push({ name, at: now });
  return pruned;
}
function isRecentOutboundNav(list, name, now, ttlMs) {
  return list.some((e) => sameName(e.name, name) && now - e.at < ttlMs);
}

// ../core/src/view/color.ts
var MIN_OPACITY = 0.5;
function fmtAlpha(a) {
  return String(Number(a.toFixed(4)));
}
function alphaToHex(a) {
  return Math.round(a * 255).toString(16).padStart(2, "0");
}
function clampColorAlpha(color, minOpacity = MIN_OPACITY) {
  if (!color) return color;
  const c = color.trim();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 6) return c;
    if (h.length === 4) {
      const rgb = h.slice(0, 3).split("").map((n) => n + n).join("");
      const alpha2 = parseInt(h[3] + h[3], 16) / 255;
      return alpha2 >= minOpacity ? c : "#" + rgb + alphaToHex(minOpacity);
    }
    const alpha = parseInt(h.slice(6, 8), 16) / 255;
    return alpha >= minOpacity ? c : "#" + h.slice(0, 6) + alphaToHex(minOpacity);
  }
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/i.exec(c);
  if (fn) {
    const name = fn[1];
    const body = fn[2];
    const parseAlpha = (raw) => {
      const t = raw.trim();
      return t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
    };
    if (body.includes("/")) {
      const slash = body.indexOf("/");
      const alpha2 = parseAlpha(body.slice(slash + 1));
      if (isNaN(alpha2) || alpha2 >= minOpacity) return c;
      return `${name}(${body.slice(0, slash).trim()} / ${fmtAlpha(minOpacity)})`;
    }
    const parts = body.split(",");
    if (parts.length < 4) return c;
    const alpha = parseAlpha(parts[3]);
    if (isNaN(alpha) || alpha >= minOpacity) return c;
    return `${name}(${parts.slice(0, 3).map((p) => p.trim()).join(", ")}, ${fmtAlpha(minOpacity)})`;
  }
  return c;
}
function parseColorToRgb(color) {
  if (!color) return null;
  let c = color.trim();
  const direct = tryParseColorToRgb(c);
  if (direct) return direct;
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.style.color = c;
    div.style.position = "fixed";
    div.style.visibility = "hidden";
    document.body.appendChild(div);
    const computed = getComputedStyle(div).color;
    document.body.removeChild(div);
    if (computed && computed !== c && computed !== "rgba(0, 0, 0, 0)") {
      return tryParseColorToRgb(computed);
    }
  }
  return null;
}
function tryParseColorToRgb(c) {
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((n) => n + n).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const fn = /^rgba?\(([^)]*)\)$/i.exec(c);
  if (fn) {
    const body = fn[1];
    const slash = body.indexOf("/");
    let comps;
    let alphaRaw;
    if (slash >= 0) {
      comps = body.slice(0, slash).trim().split(/[\s,]+/);
      alphaRaw = body.slice(slash + 1).trim();
    } else {
      const parts = body.split(",").map((p) => p.trim());
      comps = parts.slice(0, 3);
      alphaRaw = parts[3];
    }
    const chan = (raw) => {
      const t = (raw || "").trim();
      return t.endsWith("%") ? parseFloat(t) / 100 * 255 : parseFloat(t);
    };
    const r = Math.round(chan(comps[0]));
    const g = Math.round(chan(comps[1]));
    const b = Math.round(chan(comps[2]));
    if ([r, g, b].some((n) => isNaN(n))) return null;
    const a = alphaRaw == null || alphaRaw === "" ? 1 : alphaRaw.endsWith("%") ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
    return { r, g, b, a: isNaN(a) ? 1 : a };
  }
  return null;
}
function rgbToHex(color) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return void 0;
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + h(rgb.r) + h(rgb.g) + h(rgb.b);
}
function mixColors(c1, c2, t) {
  const a = parseColorToRgb(c1);
  const b = parseColorToRgb(c2);
  if (!a && !b) return c1 ?? c2;
  if (!a) return c2;
  if (!b) return c1;
  const k = Math.min(1, Math.max(0, t));
  const mix = (x, y) => Math.round(x + (y - x) * k);
  return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
}
function clampAlpha(a) {
  return Number(Math.max(0, Math.min(1, a)).toFixed(4));
}
function fadeAlpha(color, factor) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampAlpha(rgb.a * factor)})`;
}
function withAlpha(color, alpha) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampAlpha(alpha)})`;
}

// ../core/src/view/colors.ts
var openOverlay = null;
function onKeyDown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeColorsPopover();
  }
}
function closeColorsPopover() {
  if (!openOverlay) return;
  openOverlay.remove();
  openOverlay = null;
  document.removeEventListener("keydown", onKeyDown, true);
}
function openColorsPopover(opts) {
  closeColorsPopover();
  const overlay = document.createElement("div");
  overlay.className = "synapses-colors-overlay";
  const box = document.createElement("div");
  box.className = "synapses-colors";
  const head = document.createElement("div");
  head.className = "synapses-colors-head";
  head.textContent = opts.title;
  box.appendChild(head);
  for (const row of opts.rows) {
    const r = document.createElement("div");
    r.className = "synapses-colors-row";
    const label = document.createElement("span");
    label.className = "synapses-colors-label";
    label.textContent = row.label;
    const input = document.createElement("input");
    input.type = "color";
    input.className = "synapses-colors-swatch";
    const setSwatch = (override) => {
      input.value = rgbToHex(override) || rgbToHex(row.fallback) || "#888888";
    };
    setSwatch(row.value);
    const reset = document.createElement("button");
    reset.className = "synapses-colors-reset";
    reset.textContent = "\xD7";
    reset.setAttribute("aria-label", "Reset to auto");
    reset.dataset.tip = "Reset to auto";
    reset.disabled = !row.value;
    input.addEventListener("change", () => {
      row.value = input.value;
      reset.disabled = false;
      void row.onChange(input.value);
    });
    reset.addEventListener("click", () => {
      row.value = void 0;
      setSwatch(void 0);
      reset.disabled = true;
      void row.onChange(null);
    });
    r.append(label, input, reset);
    box.appendChild(r);
  }
  overlay.appendChild(box);
  opts.root.appendChild(overlay);
  const orect = overlay.getBoundingClientRect();
  const brect = box.getBoundingClientRect();
  const vw = orect.width || window.innerWidth;
  const vh = orect.height || window.innerHeight;
  box.style.left = Math.max(0, Math.min(opts.at.x - orect.left, vw - (brect.width || 240))) + "px";
  box.style.top = Math.max(0, Math.min(opts.at.y - orect.top, vh - (brect.height || 120))) + "px";
  openOverlay = overlay;
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeColorsPopover();
  });
  document.addEventListener("keydown", onKeyDown, true);
}

// ../core/src/view/context-menu.ts
function clampMenuPosition(at, box, viewport) {
  const left = Math.max(0, Math.min(at.x, viewport.w - box.w));
  const top = Math.max(0, Math.min(at.y, viewport.h - box.h));
  return { left, top };
}
var openOverlay2 = null;
function onKeyDown2(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeContextMenu();
  }
}
function closeContextMenu() {
  if (!openOverlay2) return;
  openOverlay2.remove();
  openOverlay2 = null;
  document.removeEventListener("keydown", onKeyDown2, true);
}
function openContextMenu(opts) {
  closeContextMenu();
  const overlay = document.createElement("div");
  overlay.className = "synapses-context-overlay";
  const menu = document.createElement("div");
  menu.className = "synapses-context-menu";
  for (const it of opts.items) {
    const row = document.createElement("div");
    row.className = "synapses-context-menu-item";
    row.textContent = it.label;
    row.addEventListener("click", () => {
      closeContextMenu();
      it.onSelect();
    });
    menu.appendChild(row);
  }
  overlay.appendChild(menu);
  opts.root.appendChild(overlay);
  const orect = overlay.getBoundingClientRect();
  const mrect = menu.getBoundingClientRect();
  const p = clampMenuPosition(
    { x: opts.at.x - orect.left, y: opts.at.y - orect.top },
    { w: mrect.width || 180, h: mrect.height || 40 },
    { w: orect.width || window.innerWidth, h: orect.height || window.innerHeight }
  );
  menu.style.left = p.left + "px";
  menu.style.top = p.top + "px";
  openOverlay2 = overlay;
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeContextMenu();
  });
  document.addEventListener("keydown", onKeyDown2, true);
}

// ../core/src/view/dialog.ts
function div(cls) {
  const d = document.createElement("div");
  d.className = cls;
  return d;
}
function nextHighlight(current, len, delta) {
  if (len <= 0) return -1;
  const next = current + delta;
  if (next < 0) return 0;
  if (next > len - 1) return len - 1;
  return next;
}
function clampDialogPosition(at, box, viewport) {
  const left = Math.max(0, Math.min(at.x - box.w / 2, viewport.w - box.w));
  const top = Math.max(0, Math.min(at.y, viewport.h - box.h));
  return { left, top };
}
function openCreateDialog({
  root,
  role,
  sourcePage,
  backend,
  at,
  onWriteStart,
  onWriteFail,
  onOpen
}) {
  return new Promise((resolve) => {
    const overlay = div("synapses-dialog-overlay");
    const box = div("synapses-dialog");
    const title = div("synapses-dialog-title");
    title.textContent = `Add ${role} of "${sourcePage}"`;
    const input = document.createElement("input");
    input.className = "synapses-dialog-input";
    input.placeholder = "Type a note name\u2026";
    const results = div("synapses-dialog-results");
    const hint = div("synapses-dialog-hint");
    hint.textContent = "\u2191\u2193 move \xB7 Enter select \xB7 Esc cancel";
    box.append(title, input, results, hint);
    overlay.appendChild(box);
    root.appendChild(overlay);
    if (at) {
      const orect = overlay.getBoundingClientRect();
      const brect = box.getBoundingClientRect();
      const maxResults = parseFloat(getComputedStyle(results).maxHeight) || 180;
      const p = clampDialogPosition(
        { x: at.x - orect.left, y: at.y - orect.top },
        { w: brect.width || 420, h: (brect.height || 200) + maxResults },
        { w: orect.width || window.innerWidth, h: orect.height || window.innerHeight }
      );
      overlay.classList.add("is-anchored");
      box.classList.add("is-anchored");
      box.style.left = p.left + "px";
      box.style.top = p.top + "px";
    }
    input.focus();
    let token = 0;
    let highlight = 0;
    let rows = [];
    let busy = false;
    function setBusy(v) {
      busy = v;
      results.style.pointerEvents = v ? "none" : "";
    }
    function paint() {
      for (let i = 0; i < rows.length; i++) rows[i].el.classList.toggle("is-active", i === highlight);
      if (rows[highlight]) rows[highlight].el.scrollIntoView({ block: "nearest" });
    }
    function setHighlight(i) {
      highlight = i;
      paint();
    }
    function render(matches) {
      results.innerHTML = "";
      rows = [];
      const q = input.value.trim();
      if (q && q.toLowerCase() !== sourcePage.toLowerCase()) {
        const createRow = div("synapses-dialog-result");
        createRow.textContent = `\u271B Create "${q}"`;
        const act = () => {
          void finish(q, false);
        };
        createRow.addEventListener("click", act);
        createRow.addEventListener("mousemove", () => setHighlight(0));
        results.appendChild(createRow);
        rows.push({ el: createRow, act });
      }
      for (const m of matches) {
        if (m.toLowerCase() === sourcePage.toLowerCase()) continue;
        const idx = rows.length;
        const r = div("synapses-dialog-result");
        r.textContent = m;
        const act = () => {
          void finish(m, true);
        };
        r.addEventListener("click", act);
        r.addEventListener("mousemove", () => setHighlight(idx));
        results.appendChild(r);
        rows.push({ el: r, act });
      }
      if (highlight > rows.length - 1) highlight = rows.length - 1;
      if (highlight < 0) highlight = rows.length ? 0 : -1;
      paint();
    }
    async function search() {
      const mine = ++token;
      const q = input.value.trim();
      if (!q) {
        render([]);
        return;
      }
      let matches = [];
      try {
        matches = await backend.searchPages(q);
      } catch {
      }
      if (mine !== token) return;
      highlight = 0;
      render(matches || []);
    }
    async function finish(name, existing) {
      if (busy) return;
      setBusy(true);
      onWriteStart?.();
      try {
        if (existing) {
          await backend.linkExisting(sourcePage, name, role);
        } else if (role === "parent") {
          await backend.createParent(sourcePage, name);
        } else if (role === "jump") {
          await backend.createJump(sourcePage, name);
        } else {
          await backend.createChild(sourcePage, name);
        }
        close(true);
      } catch (e) {
        onWriteFail?.();
        hint.textContent = "Failed: " + errText(e);
        hint.classList.add("err");
        setBusy(false);
      }
    }
    function close(changed) {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
      resolve(changed);
    }
    onOpen?.(() => close(false));
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
        return;
      }
      const ctrl = e.ctrlKey && !e.metaKey;
      const down = e.key === "ArrowDown" || e.key === "Tab" && !e.shiftKey || ctrl && (e.key === "j" || e.key === "n");
      const up = e.key === "ArrowUp" || e.key === "Tab" && e.shiftKey || ctrl && (e.key === "k" || e.key === "p");
      if (down) {
        e.preventDefault();
        setHighlight(nextHighlight(highlight, rows.length, 1));
        return;
      }
      if (up) {
        e.preventDefault();
        setHighlight(nextHighlight(highlight, rows.length, -1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[highlight];
        if (row) row.act();
      }
    }
    input.addEventListener("input", () => void search());
    document.addEventListener("keydown", onKey, true);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
  });
}

// ../core/src/view/theme.ts
var FALLBACK_BASE = "rgb(127, 127, 127)";
var JUMP_FACTOR = 0.5;
var DEFAULT_ALPHA = 0.75;
function connectorColors(palette) {
  const grayBase = palette && (mixColors(palette.bg, palette.text, 0.55) || clampColorAlpha(palette.border)) || FALLBACK_BASE;
  const edge = withAlpha(grayBase, DEFAULT_ALPHA);
  const highlightBase = palette && (palette.primaryEdge || palette.accent) || grayBase;
  return {
    edge,
    jumpEdge: fadeAlpha(edge, JUMP_FACTOR),
    highlight: withAlpha(highlightBase, 1)
  };
}
function applyTheme(root, palette) {
  if (!palette) return connectorColors(palette);
  const map = {
    "--synapses-bg": clampColorAlpha(palette.bg),
    "--synapses-bg2": clampColorAlpha(palette.bg2),
    "--synapses-text": clampColorAlpha(palette.text),
    "--synapses-text2": clampColorAlpha(palette.text2),
    "--synapses-border": withAlpha(palette.border, 0.75),
    "--synapses-accent": clampColorAlpha(palette.accent)
  };
  for (const k in map) {
    if (map[k]) root.style.setProperty(k, map[k]);
  }
  root.classList.toggle("synapses-dark", palette.mode === "dark");
  const primary = clampColorAlpha(palette.primaryEdge);
  if (primary) root.style.setProperty("--synapses-primary", primary);
  else root.style.removeProperty("--synapses-primary");
  return connectorColors(palette);
}

// ../core/src/view/curve.ts
function bezierControls(a, b, zone) {
  if (zone === "parent" || zone === "child") {
    const midY = (a.y + b.y) / 2;
    return { c1: { x: a.x, y: midY }, c2: { x: b.x, y: midY } };
  }
  const midX = (a.x + b.x) / 2;
  return { c1: { x: midX, y: a.y }, c2: { x: midX, y: b.y } };
}

// ../core/src/view/edge-hit.ts
function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}
function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
  };
}
function sampleEdge(a, b, zone, n = 16) {
  const { c1, c2 } = bezierControls(a, b, zone);
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(cubic(a, c1, c2, b, i / n));
  return pts;
}
function distToEdge(p, edge) {
  const pts = sampleEdge(edge.a, edge.b, edge.zone);
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(p, pts[i], pts[i + 1]);
    if (d < min) min = d;
  }
  return min;
}
function pointAtDistanceFromEnd(edge, dist) {
  const pts = sampleEdge(edge.a, edge.b, edge.zone, 32);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let remaining = Math.min(dist, total / 2);
  for (let i = pts.length - 1; i > 0; i--) {
    const p = pts[i];
    const q = pts[i - 1];
    const seg = Math.hypot(p.x - q.x, p.y - q.y);
    if (seg >= remaining) {
      const f = seg ? remaining / seg : 0;
      return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
    }
    remaining -= seg;
  }
  return pts[0];
}
function hitTest(p, edges, threshold) {
  let best = null;
  let bestD = threshold;
  for (const e of edges || []) {
    if (!e.remove) continue;
    const d = distToEdge(p, e);
    if (d <= bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

// ../core/src/view/layout.ts
var NODE = { W: 208, H: 28 };
var DEF_BAND_Y = 240;
var DEF_BAND_X = 380;
var DEF_STEP = 80;
var DEF_CHILD_GAP = 120;
var ROW_GAP = 40;
var PAD_X = 24;
var GAP = 48;
var MAX_BAND_X = 620;
var V_GAP = 12;
var SECTION_GAP = 48;
var MIN_CHILD_GAP = 80;
var MAX_CHILD_GAP = 240;
var CHILD_GAP_FACTOR = 0.16;
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function childGapFor(viewportW) {
  return clamp(viewportW * CHILD_GAP_FACTOR, MIN_CHILD_GAP, MAX_CHILD_GAP);
}
function maxCardWidthFor(viewportW) {
  return (viewportW - 2 * PAD_X - childGapFor(viewportW)) / 2;
}
function widthOf(widths, name) {
  const w = widths?.[name.toLowerCase()];
  return typeof w === "number" && w > 0 ? w : NODE.W;
}
function computeSpacing(graph, widths, opts) {
  const cardH = opts?.cardH ?? NODE.H;
  const vp = opts?.viewport;
  if (!vp)
    return {
      bandYTop: DEF_BAND_Y,
      bandYBottom: DEF_BAND_Y,
      bandXLeft: DEF_BAND_X,
      bandXRight: DEF_BAND_X,
      colStep: DEF_STEP,
      childStep: DEF_STEP,
      childGap: DEF_CHILD_GAP
    };
  const colW = (names) => names && names.length ? Math.max(...names.map((n) => widthOf(widths, n))) : NODE.W;
  const focusHalf = widthOf(widths, graph.focus) / 2;
  const parents = graph.parents || [];
  const parentRowHalf = parents.length ? (parents.reduce((a, n) => a + widthOf(widths, n), 0) + ROW_GAP * (parents.length - 1)) / 2 : 0;
  const minBandX = NODE.W / 2 + GAP + Math.max(focusHalf, parentRowHalf);
  const bandXFor = (names) => clamp(vp.w / 2 - PAD_X - colW(names) + NODE.W / 2, minBandX, MAX_BAND_X);
  const colStep = cardH + V_GAP;
  const childStep = cardH + V_GAP;
  const colSlots = Math.max(graph.jumps?.length || 0, graph.siblings?.length || 0);
  const colHalf = colSlots > 1 ? (colSlots - 1) / 2 * colStep : 0;
  const bandY = colHalf + cardH + SECTION_GAP;
  const bandYTop = bandY;
  const bandYBottom = bandY;
  const childGap = childGapFor(vp.w);
  return {
    bandYTop,
    bandYBottom,
    bandXLeft: bandXFor(graph.jumps),
    bandXRight: bandXFor(graph.siblings),
    colStep,
    childStep,
    childGap
  };
}
function rowPositions(names, y, widths) {
  const ws = names.map((n) => widthOf(widths, n));
  const total = ws.reduce((a, b) => a + b, 0) + ROW_GAP * Math.max(0, names.length - 1);
  let cursor = -total / 2;
  return names.map((name, i) => {
    const w = ws[i];
    const x = cursor + w / 2;
    cursor += w + ROW_GAP;
    return { name, x, y, w };
  });
}
function colPositions(names, sign, widths, bandX, step) {
  const n = names.length;
  return names.map((name, i) => {
    const w = widthOf(widths, name);
    const x = sign * (bandX + (w - NODE.W) / 2);
    const y = (i - (n - 1) / 2) * step;
    return { name, x, y, w };
  });
}
function childPositions(names, y0, widths, step, childGap) {
  const cols = [[], []];
  names.forEach((name, i) => cols[i % 2].push(name));
  const colWidth = (c) => c.length ? Math.max(...c.map((n) => widthOf(widths, n))) : NODE.W;
  const leftCenter = -(childGap / 2 + colWidth(cols[0]) / 2);
  const rightCenter = childGap / 2 + colWidth(cols[1]) / 2;
  return names.map((name, i) => {
    const x = i % 2 === 0 ? leftCenter : rightCenter;
    const y = y0 + Math.floor(i / 2) * step;
    return { name, x, y, w: widthOf(widths, name) };
  });
}
function computeLayout(graph, widths, opts) {
  const sp = computeSpacing(graph, widths, opts);
  const cardH = opts?.cardH ?? NODE.H;
  const raw = [{ name: graph.focus, x: 0, y: 0, w: widthOf(widths, graph.focus), zone: "focus" }];
  for (const p of rowPositions(graph.parents || [], -sp.bandYTop, widths)) raw.push({ ...p, zone: "parent" });
  for (const c of childPositions(graph.children || [], sp.bandYBottom, widths, sp.childStep, sp.childGap)) {
    raw.push({ ...c, zone: "child" });
  }
  for (const j of colPositions(graph.jumps || [], -1, widths, sp.bandXLeft, sp.colStep)) raw.push({ ...j, zone: "jump" });
  const siblingParent = graph.siblingParent || {};
  for (const s of colPositions(graph.siblings || [], 1, widths, sp.bandXRight, sp.colStep)) {
    raw.push({ ...s, zone: "sibling", via: siblingParent[s.name] });
  }
  const seen = /* @__PURE__ */ new Set();
  const nodes = [];
  for (const nd of raw) {
    const k = nd.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    nodes.push(nd);
  }
  return { focus: graph.focus, nodes, bbox: computeBBox(nodes, cardH) };
}
function computeBBox(nodes, cardH) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.w / 2);
    maxX = Math.max(maxX, n.x + n.w / 2);
    minY = Math.min(minY, n.y - cardH / 2);
    maxY = Math.max(maxY, n.y + cardH / 2);
  }
  if (!isFinite(minX)) return { minX: -NODE.W / 2, minY: -cardH / 2, maxX: NODE.W / 2, maxY: cardH / 2 };
  return { minX, minY, maxX, maxY };
}

// ../core/src/view/edges.ts
var GATES = {
  parent: { focus: "top", node: "bottom" },
  child: { focus: "bottom", node: "top" },
  jump: { focus: "left", node: "right" },
  sibling: { focus: "right", node: "left" }
};
function gatePoint(node, side) {
  const hw = (node.w ?? NODE.W) / 2;
  const hh = (node.h ?? NODE.H) / 2;
  switch (side) {
    case "top":
      return { x: node.x, y: node.y - hh };
    case "bottom":
      return { x: node.x, y: node.y + hh };
    case "left":
      return { x: node.x - hw, y: node.y };
    case "right":
      return { x: node.x + hw, y: node.y };
    default:
      return { x: node.x, y: node.y };
  }
}
function edgeKey(e) {
  return e ? e.role + ":" + String(e.neighbor || "").toLowerCase() : null;
}
function siblingEdge(focus, n, layout) {
  const parentName = n.via ? String(n.via) : null;
  const via = parentName && layout.nodes.find(
    (m) => m.zone === "parent" && m.name.toLowerCase() === parentName.toLowerCase()
  );
  const remove = parentName ? { from: parentName, to: n.name, role: "child" } : null;
  return via ? { a: gatePoint(via, "bottom"), b: gatePoint(n, "top"), neighbor: n.name, role: "sibling", zone: "child", via: true, remove } : { a: gatePoint(focus, "right"), b: gatePoint(n, "left"), neighbor: n.name, role: "sibling", zone: "sibling", via: false, remove };
}
function computeEdges(layout, raw) {
  if (!layout) return [];
  const focus = layout.nodes.find((n) => n.zone === "focus");
  if (!focus) return [];
  const edges = [];
  for (const n of layout.nodes) {
    if (n.zone === "focus") continue;
    if (n.zone === "sibling") {
      edges.push(siblingEdge(focus, n, layout));
      continue;
    }
    const g = GATES[n.zone];
    if (!g) continue;
    const isRaw = raw?.has(n.name.toLowerCase());
    edges.push({ a: gatePoint(focus, g.focus), b: gatePoint(n, g.node), neighbor: n.name, role: n.zone, zone: n.zone, via: false, remove: isRaw ? null : { from: focus.name, to: n.name, role: n.zone } });
  }
  return edges;
}
function pairKey(a, b) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? x + "|" + y : y + "|" + x;
}
function secondaryEdge(a, b, jump) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let aSide;
  let bSide;
  let zone;
  if (Math.abs(dx) >= Math.abs(dy)) {
    zone = "jump";
    aSide = dx >= 0 ? "right" : "left";
    bSide = dx >= 0 ? "left" : "right";
  } else {
    zone = "child";
    aSide = dy >= 0 ? "bottom" : "top";
    bSide = dy >= 0 ? "top" : "bottom";
  }
  return {
    a: gatePoint(a, aSide),
    b: gatePoint(b, bSide),
    neighbor: b.name,
    role: jump ? "jump" : "child",
    zone,
    via: false,
    remove: null
  };
}
function computeSecondaryEdges(layout, adjacency, primaryEdges) {
  if (!layout || !adjacency) return [];
  const focus = layout.nodes.find((n) => n.zone === "focus");
  const byName = /* @__PURE__ */ new Map();
  for (const n of layout.nodes) byName.set(n.name.toLowerCase(), n);
  const drawn = /* @__PURE__ */ new Set();
  for (const e of primaryEdges || []) {
    if (e.remove) drawn.add(pairKey(e.remove.from, e.remove.to));
    else if (focus) drawn.add(pairKey(focus.name, e.neighbor));
  }
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const a of layout.nodes) {
    if (a.zone === "focus") continue;
    const adj = adjacency[a.name.toLowerCase()];
    if (!adj) continue;
    const links = [
      ...adj.parents.map((t) => ({ to: t, jump: false })),
      ...adj.children.map((t) => ({ to: t, jump: false })),
      ...adj.jumps.map((t) => ({ to: t, jump: true }))
    ];
    for (const { to, jump } of links) {
      const b = byName.get(to.toLowerCase());
      if (!b || b.zone === "focus") continue;
      const key = pairKey(a.name, to);
      if (drawn.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(secondaryEdge(a, b, jump));
    }
  }
  return out;
}
function curve(ctx, a, b, zone) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  const { c1, c2 } = bezierControls(a, b, zone);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
  ctx.stroke();
}
var SECONDARY_ALPHA = 0.4;
function drawEdges(ctx, edges, transform, theme, dpr, pending, highlightKey, secondary) {
  const canvas = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { s, tx, ty } = transform;
  ctx.setTransform(s * dpr, 0, 0, s * dpr, tx * dpr, ty * dpr);
  if (secondary && secondary.length) {
    ctx.save();
    ctx.globalAlpha = SECONDARY_ALPHA;
    ctx.lineWidth = 1.5;
    for (const e of secondary) {
      ctx.strokeStyle = e.role === "jump" || e.role === "sibling" ? theme.jumpEdge : theme.edge;
      curve(ctx, e.a, e.b, e.zone);
    }
    ctx.restore();
  }
  for (const e of edges || []) {
    const hot = highlightKey && edgeKey(e) === highlightKey;
    ctx.lineWidth = hot ? 3 : 1.5;
    ctx.strokeStyle = hot ? theme.highlight : e.role === "jump" || e.role === "sibling" ? theme.jumpEdge : theme.edge;
    curve(ctx, e.a, e.b, e.zone);
  }
  if (pending) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.edge;
    ctx.setLineDash([6, 4]);
    curve(ctx, pending.a, pending.b, pending.zone || "jump");
    ctx.restore();
  }
}

// ../core/src/view/handles.ts
function classifyHandle(total, shown) {
  if (total === 0) return "empty";
  if (shown >= total) return "shown";
  return "more";
}
function computeShownCount(neighbors, renderedSet) {
  let n = 0;
  for (const name of neighbors || []) if (renderedSet.has(String(name).toLowerCase())) n++;
  return n;
}
var DIRS = [
  ["parent", "parents"],
  ["child", "children"],
  ["jump", "jumps"]
];
function nodeHandleStates(entry, renderedSet) {
  const out = {};
  for (const [dir, key] of DIRS) {
    const arr = entry && entry[key] || [];
    out[dir] = classifyHandle(arr.length, computeShownCount(arr, renderedSet));
  }
  return out;
}

// ../core/src/view/panzoom.ts
function worldToScreen(t, x, y) {
  return { x: x * t.s + t.tx, y: y * t.s + t.ty };
}
function screenToWorld(t, x, y) {
  return { x: (x - t.tx) / t.s, y: (y - t.ty) / t.s };
}
function attachPanzoom(stage, onChange) {
  let s = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const apply = () => onChange({ s, tx, ty });
  stage.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".synapses-node")) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
    }
    stage.classList.add("grabbing");
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (e.buttons === 0) {
      end();
      return;
    }
    tx += e.clientX - lastX;
    ty += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    apply();
  });
  const end = () => {
    dragging = false;
    stage.classList.remove("grabbing");
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  function set(ns, ntx, nty) {
    s = ns;
    tx = ntx;
    ty = nty;
    apply();
  }
  function center(viewport) {
    set(1, viewport.w / 2, viewport.h / 2);
  }
  return {
    getTransform: () => ({ s, tx, ty }),
    set,
    center
  };
}

// ../core/src/view/view.ts
var TRANSITION_MS = 840;
var UNLINK_GAP = 52;
function defaultTheme() {
  return { edge: "rgba(127,127,127,0.55)", jumpEdge: "rgba(127,127,127,0.32)", highlight: "rgba(206,170,92,0.9)" };
}
var DRAG_THRESHOLD = 6;
function createView({
  root,
  world,
  canvas,
  stage,
  onNavigate,
  onOpenMain,
  onRemoveLink,
  onLinkExisting,
  onCreateAt,
  onContextMenu,
  initialSize,
  onSizeChange
}) {
  const ctx = canvas.getContext("2d");
  const SIZE_FACTORS = [0.8, 0.9, 1, 1.15, 1.3];
  const MOBILE_MIN_H = 35;
  let mobile = false;
  const BASE_FONT_PX = 15;
  const BASE_MAXW = 240;
  const MIN_MAXW = 64;
  const clampLevel = (l) => Math.max(0, Math.min(SIZE_FACTORS.length - 1, Math.round(l)));
  let sizeLevel = initialSize == null ? SIZE_FACTORS.indexOf(1) : clampLevel(initialSize);
  const sizeFactor = () => SIZE_FACTORS[sizeLevel];
  const cardHpx = () => {
    const base = Math.round(NODE.H * sizeFactor());
    return mobile ? Math.max(MOBILE_MIN_H, base) : base;
  };
  function applySizeVars() {
    const f = sizeFactor();
    root.style.setProperty("--synapses-node-h", cardHpx() + "px");
    root.style.setProperty("--synapses-node-font", Math.round(BASE_FONT_PX * f) + "px");
    const base = Math.round(BASE_MAXW * f);
    const vpW = viewport().w;
    const cap = vpW > 0 ? Math.min(base, Math.floor(maxCardWidthFor(vpW))) : base;
    root.style.setProperty("--synapses-node-maxw", Math.max(MIN_MAXW, cap) + "px");
  }
  applySizeVars();
  const elements = /* @__PURE__ */ new Map();
  let lastGraph = null;
  let layout = null;
  let theme = defaultTheme();
  let dpr = window.devicePixelRatio || 1;
  let raf = 0;
  let animUntil = 0;
  let lastEdges = [];
  let adjacency = {};
  let rawSet = /* @__PURE__ */ new Set();
  let pending = null;
  let hoveredKey = null;
  const panzoom = attachPanzoom(stage, (t) => {
    applyTransform(t);
    scheduleDraw();
  });
  function applyTransform(t) {
    world.style.transform = `translate(${t.tx}px, ${t.ty}px) scale(${t.s})`;
  }
  function viewport() {
    const r = stage.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    const vp = viewport();
    canvas.width = Math.max(1, Math.round(vp.w * dpr));
    canvas.height = Math.max(1, Math.round(vp.h * dpr));
    canvas.style.width = vp.w + "px";
    canvas.style.height = vp.h + "px";
    if (lastGraph) relayout(false);
    else scheduleDraw();
  }
  const ro = new ResizeObserver(resizeCanvas);
  ro.observe(stage);
  function setTheme(t) {
    theme = { ...defaultTheme(), ...t };
    scheduleDraw();
  }
  function measureWidths() {
    const widths = {};
    for (const [key, el] of elements) {
      widths[key] = el.offsetWidth || NODE.W;
      el._clamped = el._label.scrollWidth > el._label.clientWidth + 1;
      el.title = el._clamped ? "" : hintFor(el);
    }
    return widths;
  }
  function setGraph(graph) {
    hideRemove();
    hideTooltip();
    lastGraph = graph;
    rawSet = new Set(graph.raw ?? []);
    const prevFocus = layout ? layout.focus : null;
    const ids = computeLayout(graph);
    const present = /* @__PURE__ */ new Set();
    const created = /* @__PURE__ */ new Set();
    for (const node of ids.nodes) {
      const key = node.name.toLowerCase();
      present.add(key);
      let el = elements.get(key);
      if (!el) {
        el = makeNode();
        world.appendChild(el);
        elements.set(key, el);
        created.add(key);
      }
      updateNode(el, node);
    }
    layout = computeLayout(graph, measureWidths(), { viewport: viewport(), cardH: cardHpx() });
    const activatingEl = elements.get(String(graph.focus).toLowerCase());
    const enterFrom = activatingEl ? liveCenterOf(activatingEl) : { x: 0, y: 0 };
    let exitInto = { x: 0, y: 0 };
    if (prevFocus) {
      const moved = layout.nodes.find((n) => n.name.toLowerCase() === prevFocus.toLowerCase());
      if (moved) exitInto = { x: moved.x, y: moved.y };
    }
    for (const node of layout.nodes) {
      const key = node.name.toLowerCase();
      const el = elements.get(key);
      if (!created.has(key)) {
        positionEl(el, node);
        continue;
      }
      el.classList.add("appearing");
      positionEl(el, enterFrom);
      void el.offsetWidth;
      el.classList.remove("appearing");
      positionEl(el, node);
    }
    for (const [key, el] of elements) {
      if (present.has(key)) continue;
      const dead = el;
      dead.classList.add("leaving");
      positionEl(dead, exitInto);
      setTimeout(() => dead.remove(), TRANSITION_MS);
      elements.delete(key);
    }
    panzoom.center(viewport());
    applyTransform(panzoom.getTransform());
    animateFor(TRANSITION_MS + 40);
  }
  function relayout(animate) {
    if (!lastGraph) return;
    applySizeVars();
    layout = computeLayout(lastGraph, measureWidths(), { viewport: viewport(), cardH: cardHpx() });
    if (!animate) world.classList.add("synapses-static");
    for (const node of layout.nodes) {
      const el = elements.get(node.name.toLowerCase());
      if (el) positionEl(el, node);
    }
    panzoom.center(viewport());
    applyTransform(panzoom.getTransform());
    if (!animate) {
      void world.offsetWidth;
      world.classList.remove("synapses-static");
    }
    if (animate) animateFor(TRANSITION_MS + 40);
    else scheduleDraw();
  }
  function stepSize(delta) {
    const next = clampLevel(sizeLevel + delta);
    if (next === sizeLevel) return;
    sizeLevel = next;
    relayout(true);
    onSizeChange?.(sizeLevel);
  }
  function setMobile(v) {
    if (v === mobile) return;
    mobile = v;
    root.classList.toggle("synapses-mobile", mobile);
    applySizeVars();
    if (lastGraph) relayout(false);
    else scheduleDraw();
  }
  const DIR_SIDE = { parent: "top", child: "bottom", jump: "left" };
  const jumpSide = (zone) => zone === "jump" ? "right" : "left";
  function liveCenterFromTransform(el, w, h, fallback) {
    const t = getComputedStyle(el).transform;
    if (t && t !== "none") {
      try {
        const m = new DOMMatrixReadOnly(t);
        return { x: m.m41 + w / 2, y: m.m42 + h / 2 };
      } catch {
      }
    }
    return fallback;
  }
  function liveCenterOf(el) {
    const w = el.offsetWidth || NODE.W;
    const h = el.offsetHeight || cardHpx();
    const { x, y } = liveCenterFromTransform(el, w, h, { x: 0, y: 0 });
    return { x, y, w };
  }
  let handleDrag = null;
  function attachHandleDrag(h, el) {
    h.addEventListener("click", (e) => e.stopPropagation());
    h.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      try {
        h.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      const center = liveCenterOf(el);
      const anchorWorld = gatePoint(center, h._side || DIR_SIDE[h._dir]);
      handleDrag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        fromNode: el._name,
        dir: h._dir,
        anchorWorld,
        moved: false
      };
    });
  }
  function onHandleDragMove(e) {
    if (!handleDrag || e.pointerId !== handleDrag.pointerId) return;
    const dx = e.clientX - handleDrag.startX;
    const dy = e.clientY - handleDrag.startY;
    if (!handleDrag.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
    handleDrag.moved = true;
    const rect = stage.getBoundingClientRect();
    const worldB = screenToWorld(panzoom.getTransform(), e.clientX - rect.left, e.clientY - rect.top);
    pending = { a: handleDrag.anchorWorld, b: worldB, zone: handleDrag.dir };
    scheduleDraw();
  }
  function onHandleDragUp(e) {
    if (!handleDrag || e.pointerId !== handleDrag.pointerId) return;
    const { moved: wasMoved, fromNode, dir } = handleDrag;
    handleDrag = null;
    pending = null;
    scheduleDraw();
    if (!wasMoved) {
      if (onCreateAt) onCreateAt(fromNode, dir, null);
      return;
    }
    const tgt = document.elementFromPoint(e.clientX, e.clientY);
    const nodeEl = tgt && tgt.closest(".synapses-node");
    const toName = nodeEl && nodeEl._name;
    if (toName && toName !== fromNode) {
      if (onLinkExisting) onLinkExisting(fromNode, toName, dir);
    } else {
      if (onCreateAt) onCreateAt(fromNode, dir, { x: e.clientX, y: e.clientY });
    }
  }
  function onHandleDragCancel(e) {
    if (!handleDrag || e.pointerId !== handleDrag.pointerId) return;
    handleDrag = null;
    pending = null;
    scheduleDraw();
  }
  window.addEventListener("pointermove", onHandleDragMove, true);
  window.addEventListener("pointerup", onHandleDragUp, true);
  window.addEventListener("pointercancel", onHandleDragCancel, true);
  const TOOLTIP_DELAY_MS = 500;
  const tooltip = document.createElement("div");
  tooltip.className = "synapses-tooltip";
  root.appendChild(tooltip);
  let tooltipTimer;
  function hideTooltip() {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = void 0;
    }
    tooltip.classList.remove("shown");
  }
  function showTooltipFor(el) {
    tooltip.textContent = el._name;
    tooltip.classList.add("shown");
    const rootRect = root.getBoundingClientRect();
    const cardRect = el.getBoundingClientRect();
    const cx = cardRect.left - rootRect.left + cardRect.width / 2;
    let top = cardRect.top - rootRect.top - tooltip.offsetHeight - 8;
    if (top < 4) top = cardRect.bottom - rootRect.top + 8;
    tooltip.style.left = Math.round(cx) + "px";
    tooltip.style.top = Math.round(top) + "px";
  }
  function scheduleTooltip(el) {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => showTooltipFor(el), TOOLTIP_DELAY_MS);
  }
  function makeNode() {
    const el = document.createElement("div");
    el.className = "synapses-node";
    const label = document.createElement("span");
    label.className = "synapses-node-label";
    el.appendChild(label);
    el._label = label;
    el._clamped = false;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (el._zone === "focus") onOpenMain(el._name);
      else onNavigate(el._name);
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(el._name, { x: e.clientX, y: e.clientY });
    });
    el.addEventListener("pointerenter", () => {
      if (el._clamped) scheduleTooltip(el);
    });
    el.addEventListener("pointerleave", hideTooltip);
    el._handles = {};
    for (const [dir, side] of [["parent", "top"], ["child", "bottom"], ["jump", "left"]]) {
      const h = document.createElement("div");
      h.className = "synapses-handle handle-" + side + " handle-empty";
      h._dir = dir;
      h._side = side;
      el.appendChild(h);
      el._handles[dir] = h;
      attachHandleDrag(h, el);
    }
    el._handleStates = { parent: "empty", child: "empty", jump: "empty" };
    return el;
  }
  function hintFor(el) {
    return el._zone === "focus" ? `Open "${el._name}" in the main pane` : `Recenter on "${el._name}"`;
  }
  function updateNode(el, node) {
    el._name = node.name;
    el._zone = node.zone;
    el._label.textContent = node.name;
    el.title = hintFor(el);
    el.className = "synapses-node zone-" + node.zone;
    const jh = el._handles && el._handles.jump;
    const side = jumpSide(node.zone);
    if (jh && jh._side !== side) {
      jh.classList.remove("handle-" + jh._side);
      jh.classList.add("handle-" + side);
      jh._side = side;
    }
  }
  function positionEl(el, p) {
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  }
  function getRenderedNames() {
    return new Set(elements.keys());
  }
  function setHandles(adj, renderedNames) {
    adjacency = adj || {};
    scheduleDraw();
    for (const [key, el] of elements) {
      if (!el._handles) continue;
      const states = nodeHandleStates(adjacency[key], renderedNames);
      if (el._handleStates && states.parent === el._handleStates.parent && states.child === el._handleStates.child && states.jump === el._handleStates.jump) continue;
      el._handleStates = states;
      for (const dir of ["parent", "child", "jump"]) {
        const h = el._handles[dir];
        h.classList.remove("handle-empty", "handle-shown", "handle-more");
        h.classList.add("handle-" + states[dir]);
      }
    }
  }
  function liveLayout() {
    if (!layout) return null;
    const nodes = layout.nodes.map((n) => {
      let x = n.x;
      let y = n.y;
      let w = n.w;
      let h = cardHpx();
      const el = elements.get(n.name.toLowerCase());
      if (el) {
        w = el.offsetWidth || n.w;
        h = el.offsetHeight || h;
        ({ x, y } = liveCenterFromTransform(el, w, h, { x, y }));
      }
      return { name: n.name, zone: n.zone, x, y, w, h, via: n.via };
    });
    return { focus: layout.focus, nodes };
  }
  function draw() {
    const live = liveLayout();
    lastEdges = computeEdges(live, rawSet);
    const secondary = computeSecondaryEdges(live, adjacency, lastEdges);
    drawEdges(ctx, lastEdges, panzoom.getTransform(), theme, dpr, pending, hoveredKey, secondary);
  }
  function scheduleDraw() {
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop() {
    raf = 0;
    draw();
    if (performance.now() < animUntil) scheduleDraw();
  }
  function animateFor(ms) {
    animUntil = performance.now() + ms;
    scheduleDraw();
  }
  resizeCanvas();
  const removeActions = document.createElement("div");
  removeActions.className = "synapses-edge-actions";
  const removeBtn = document.createElement("button");
  removeBtn.className = "synapses-edge-remove";
  removeBtn.textContent = "\xD7";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "synapses-edge-cancel";
  cancelBtn.textContent = "Cancel";
  removeActions.append(removeBtn, cancelBtn);
  removeActions.addEventListener("pointerdown", (e) => e.stopPropagation());
  stage.appendChild(removeActions);
  let hoveredEdge = null;
  function hideRemove() {
    removeActions.classList.remove("is-shown");
    removeActions.classList.remove("confirm");
    removeBtn.textContent = "\xD7";
    hoveredEdge = null;
    if (hoveredKey) {
      hoveredKey = null;
      scheduleDraw();
    }
  }
  function showRemoveAt(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const t = panzoom.getTransform();
    const worldPt = screenToWorld(t, clientX - rect.left, clientY - rect.top);
    const edge = hitTest(worldPt, lastEdges, 10);
    if (!edge) return false;
    hoveredEdge = edge;
    const key = edgeKey(edge);
    if (key !== hoveredKey) {
      hoveredKey = key;
      scheduleDraw();
    }
    const at = pointAtDistanceFromEnd(edge, UNLINK_GAP / t.s);
    const atScreen = worldToScreen(t, at.x, at.y);
    removeActions.style.left = atScreen.x + "px";
    removeActions.style.top = atScreen.y + "px";
    removeActions.classList.add("is-shown");
    return true;
  }
  const onStageMove = (e) => {
    if (mobile) return;
    if (pending) {
      hideRemove();
      return;
    }
    if (removeActions.classList.contains("confirm")) return;
    const tgt = e.target;
    if (tgt?.closest(".synapses-node")) {
      if (hoveredEdge) hideRemove();
      return;
    }
    if (!showRemoveAt(e.clientX, e.clientY)) {
      if (hoveredEdge) hideRemove();
    }
  };
  stage.addEventListener("mousemove", onStageMove);
  let tapStartX = 0;
  let tapStartY = 0;
  let tapMoved = false;
  const onStageTapDown = (e) => {
    tapStartX = e.clientX;
    tapStartY = e.clientY;
    tapMoved = false;
  };
  const onStageTapMove = (e) => {
    if (tapMoved) return;
    const dx = e.clientX - tapStartX;
    const dy = e.clientY - tapStartY;
    if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) tapMoved = true;
  };
  const onStageTap = (e) => {
    if (!mobile || tapMoved) return;
    const tgt = e.target;
    if (tgt?.closest(".synapses-node")) return;
    if (!showRemoveAt(e.clientX, e.clientY)) hideRemove();
  };
  stage.addEventListener("pointerdown", onStageTapDown);
  stage.addEventListener("pointermove", onStageTapMove);
  stage.addEventListener("click", onStageTap);
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!hoveredEdge) return;
    if (!removeActions.classList.contains("confirm")) {
      removeActions.classList.add("confirm");
      removeBtn.textContent = "Remove?";
      return;
    }
    const edge = hoveredEdge;
    hideRemove();
    if (onRemoveLink && edge.remove) onRemoveLink(edge.remove);
  });
  cancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideRemove();
  });
  stage.addEventListener("mouseleave", hideRemove);
  const onStageTooltipHide = () => hideTooltip();
  stage.addEventListener("pointerdown", onStageTooltipHide);
  stage.addEventListener("wheel", onStageTooltipHide, { passive: true });
  function sizeInfo() {
    return { level: sizeLevel, count: SIZE_FACTORS.length };
  }
  return {
    setGraph,
    setTheme,
    setHandles,
    setMobile,
    getRenderedNames,
    redraw: scheduleDraw,
    stepSize,
    sizeInfo,
    getEdges: () => lastEdges,
    destroy() {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      hideTooltip();
      window.removeEventListener("pointermove", onHandleDragMove, true);
      window.removeEventListener("pointerup", onHandleDragUp, true);
      window.removeEventListener("pointercancel", onHandleDragCancel, true);
      stage.removeEventListener("mousemove", onStageMove);
      stage.removeEventListener("mouseleave", hideRemove);
      stage.removeEventListener("pointerdown", onStageTooltipHide);
      stage.removeEventListener("wheel", onStageTooltipHide);
      stage.removeEventListener("pointerdown", onStageTapDown);
      stage.removeEventListener("pointermove", onStageTapMove);
      stage.removeEventListener("click", onStageTap);
    }
  };
}

// ../core/src/app.ts
function mountSynapses(container, backend, logger = noopLogger) {
  container.classList.add("synapses-root");
  container.innerHTML = `
    <div id="synapses-app">
      <div id="synapses-spinner" class="synapses-spinner" aria-hidden="true"></div>
      <div id="synapses-toolbar"></div>
      <div id="synapses-pins"></div>
      <div id="synapses-stage">
        <canvas id="synapses-canvas"></canvas>
        <div id="synapses-world"></div>
        <div id="synapses-flash" class="synapses-flash"></div>
      </div>
      <div id="synapses-breadcrumb"></div>
    </div>
    <div id="synapses-dialog-root"></div>`;
  const els = {
    toolbar: container.querySelector("#synapses-toolbar"),
    pins: container.querySelector("#synapses-pins"),
    stage: container.querySelector("#synapses-stage"),
    world: container.querySelector("#synapses-world"),
    canvas: container.querySelector("#synapses-canvas"),
    flash: container.querySelector("#synapses-flash"),
    spinner: container.querySelector("#synapses-spinner"),
    breadcrumb: container.querySelector("#synapses-breadcrumb"),
    dialogRoot: container.querySelector("#synapses-dialog-root")
  };
  let lastHist = { list: [], index: -1 };
  let lastPins = [];
  let focus = null;
  let mobile = false;
  let focusOnActiveClick = false;
  let panelExpanded = null;
  let navToken = 0;
  let lastRenderKey = null;
  const NAV_ECHO_TTL_MS = 3e3;
  let recentNavs = [];
  let closeActiveDialog = null;
  let view;
  async function restore() {
    try {
      const st = await backend.histState();
      if (st && st.list && st.list.length) {
        lastHist = st;
        void goto(st.list[st.index], { noHistory: true, fromLogseq: true });
        return;
      }
    } catch {
    }
    try {
      const active = await backend.getActivePage();
      if (active) void goto(active, { fromLogseq: true });
      else flash("Open a page in Logseq to see its links.");
    } catch (e) {
      flashError(e);
    }
  }
  async function goto(name, opts = {}) {
    if (!name) return false;
    const mine = ++navToken;
    focus = name;
    logger.log("user", "activate", { name, fromEditor: !!opts.fromLogseq, noHistory: !!opts.noHistory });
    try {
      lastHist = opts.noHistory ? await backend.histState() : await backend.histPush(name);
    } catch {
    }
    renderToolbar();
    renderBreadcrumb();
    renderPins();
    let graph;
    try {
      graph = await backend.buildGraph(name);
    } catch (e) {
      flashError(e);
      return false;
    }
    if (mine !== navToken) return false;
    hideFlash();
    const key = graphKey(graph);
    const changed = key !== lastRenderKey;
    if (!(opts.ifChanged && !changed)) {
      logger.log("ui", "render", { focus: name, p: graph.parents.length, c: graph.children.length, j: graph.jumps.length, s: graph.siblings.length });
      view.setGraph(graph);
      lastRenderKey = key;
    } else {
      logger.log("ui", "render", { focus: name, skipped: true });
    }
    const names = view.getRenderedNames();
    backend.nodeAdjacency([...names]).then((adj) => {
      if (mine === navToken) view.setHandles(adj || {}, names);
    }).catch(() => {
    });
    if (!opts.fromLogseq && !mobile && !focusOnActiveClick) {
      recentNavs = recordOutboundNav(recentNavs, name, Date.now(), NAV_ECHO_TTL_MS);
      backend.navigate(name).catch(() => {
      });
    }
    return changed;
  }
  async function removeFromHistory(name) {
    const wasActive = sameName(name, focus);
    try {
      lastHist = await backend.histRemove(name);
    } catch {
      return;
    }
    renderToolbar();
    renderBreadcrumb();
    if (!wasActive) return;
    if (lastHist.list.length) {
      void goto(lastHist.list[lastHist.index], { noHistory: true });
      return;
    }
    try {
      const active = await backend.getActivePage();
      if (active) {
        void goto(active, { fromLogseq: true });
        return;
      }
    } catch {
    }
    flash("Open a note to see its links.");
  }
  const isPinned = (name) => lastPins.some((p) => sameName(p, name));
  async function pin(name) {
    logger.log("user", "pin", { name });
    try {
      lastPins = await backend.pinAdd(name);
    } catch (e) {
      flashError(e);
      return;
    }
    renderPins();
  }
  async function unpin(name) {
    logger.log("user", "unpin", { name });
    try {
      lastPins = await backend.pinRemove(name);
    } catch (e) {
      flashError(e);
      return;
    }
    renderPins();
  }
  async function refreshPins() {
    try {
      lastPins = await backend.pinsState();
    } catch {
    }
    renderPins();
  }
  function hardRefresh() {
    logger.log("user", "refresh");
    clearWait();
    lastRenderKey = null;
    if (focus) {
      hideFlash(true);
      void goto(focus, { noHistory: true, fromLogseq: true });
    } else {
      void restore();
    }
  }
  async function create(role) {
    logger.log("user", "create", { role });
    const src = focus;
    if (!src) return;
    await openCreateDialog({
      root: els.dialogRoot,
      role,
      sourcePage: src,
      backend,
      onWriteStart: beginWait,
      onWriteFail: decWait,
      onOpen: (close) => {
        closeActiveDialog = close;
      }
    });
    closeActiveDialog = null;
  }
  async function createAt(fromNode, role, at) {
    logger.log("user", "createAt", { from: fromNode, role });
    await openCreateDialog({
      root: els.dialogRoot,
      role,
      sourcePage: fromNode,
      backend,
      at,
      onWriteStart: beginWait,
      onWriteFail: decWait,
      onOpen: (close) => {
        closeActiveDialog = close;
      }
    });
    closeActiveDialog = null;
  }
  function renderToolbar() {
    els.toolbar.innerHTML = "";
    const refresh = btn("\u21BB", "Refresh from editor", () => {
      hardRefresh();
    });
    refresh.classList.add("synapses-btn-refresh");
    const add = document.createElement("div");
    add.className = "synapses-add-group";
    add.append(
      btn("\uFF0Bchild", "Add child", () => {
        void create("child");
      }),
      btn("\uFF0Bparent", "Add parent", () => {
        void create("parent");
      }),
      btn("\uFF0Bjump", "Add jump", () => {
        void create("jump");
      })
    );
    const { level, count } = view.sizeInfo();
    const minus = btn("\u2212", "Smaller cards & text", () => {
      view.stepSize(-1);
      renderToolbar();
    });
    minus.disabled = level <= 0;
    const plus = btn("+", "Larger cards & text", () => {
      view.stepSize(1);
      renderToolbar();
    });
    plus.disabled = level >= count - 1;
    const colors = btn("\u25D1", "Highlight color", () => {
      void openColors(colors);
    });
    const follow = btn("\u2316", "Activate the note open in the editor", () => {
      void backend.getActivePage().then((active) => {
        if (active) void goto(active, { fromLogseq: true });
        else flash("No note is open in the editor.");
      }).catch((e) => {
        flashError(e);
      });
    });
    const heightBtns = panelExpanded == null ? [] : [btn(
      panelExpanded ? "\u2921" : "\u2922",
      panelExpanded ? "Panel expanded \u2014 click to collapse" : "Panel collapsed \u2014 click to expand",
      () => {
        void backend.togglePanel().then((e) => {
          if (e != null) {
            panelExpanded = e;
            renderToolbar();
          }
        }).catch(() => {
        });
      }
    )];
    els.toolbar.append(refresh, follow, ...mobile ? [add] : [], minus, plus, colors, ...heightBtns);
  }
  function renderBreadcrumb() {
    els.breadcrumb.innerHTML = "";
    lastHist.list.forEach((name, i) => {
      const c = document.createElement("button");
      c.className = "synapses-crumb" + (i === lastHist.index ? " current" : "");
      c.textContent = name;
      c.title = name;
      c.addEventListener("click", () => {
        void goto(name);
      });
      c.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openContextMenu({
          root: els.dialogRoot,
          at: { x: e.clientX, y: e.clientY },
          items: [{ label: "Remove from history", onSelect: () => {
            void removeFromHistory(name);
          } }]
        });
      });
      els.breadcrumb.appendChild(c);
    });
    els.breadcrumb.scrollLeft = els.breadcrumb.scrollWidth;
  }
  function renderPins() {
    els.pins.innerHTML = "";
    for (const name of lastPins) {
      const c = document.createElement("button");
      c.className = "synapses-crumb synapses-pin" + (focus && sameName(name, focus) ? " current" : "");
      c.textContent = name;
      c.title = name;
      c.addEventListener("click", () => {
        void goto(name);
      });
      c.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openContextMenu({
          root: els.dialogRoot,
          at: { x: e.clientX, y: e.clientY },
          items: [{ label: "Unpin", onSelect: () => {
            void unpin(name);
          } }]
        });
      });
      els.pins.appendChild(c);
    }
  }
  async function applyThemeWithOverrides(p) {
    try {
      const o = await backend.getConnectorColors();
      p.primaryEdge = (p.mode === "dark" ? o.primaryDark : o.primaryLight) ?? void 0;
    } catch {
    }
    view.setTheme(applyTheme(container, p));
  }
  async function loadTheme() {
    try {
      await applyThemeWithOverrides(await backend.getTheme());
    } catch {
    }
  }
  async function openColors(anchor) {
    let palette;
    let overrides;
    try {
      palette = await backend.getTheme();
      overrides = await backend.getConnectorColors();
    } catch {
      return;
    }
    const dark = palette.mode === "dark";
    const field = dark ? "primaryDark" : "primaryLight";
    const derived = connectorColors({ ...palette, primaryEdge: void 0 });
    const rect = anchor.getBoundingClientRect();
    openColorsPopover({
      root: els.dialogRoot,
      at: { x: rect.left, y: rect.bottom + 4 },
      title: `Highlight color \xB7 ${dark ? "Dark" : "Light"}`,
      rows: [
        {
          label: "Color",
          value: overrides[field],
          fallback: derived.highlight,
          onChange: async (value) => {
            const cur = await backend.getConnectorColors();
            if (value == null) delete cur[field];
            else cur[field] = value;
            await backend.setConnectorColors(cur);
            await loadTheme();
          }
        }
      ]
    });
  }
  function btn(label, title, onClick) {
    const b = document.createElement("button");
    b.className = "synapses-btn";
    b.textContent = label;
    b.setAttribute("aria-label", title);
    b.dataset.tip = title;
    b.addEventListener("click", onClick);
    return b;
  }
  const STICKY_FLASH_MS = 5e3;
  let stickyUntil = 0;
  function flash(msg, opts = {}) {
    els.flash.textContent = msg;
    els.flash.classList.add("is-shown");
    stickyUntil = opts.stickyMs ? Date.now() + opts.stickyMs : 0;
  }
  function flashError(e, opts = {}) {
    flash("\u26A0 " + errText(e), opts);
  }
  function hideFlash(force = false) {
    if (!force && !stickyExpired(stickyUntil, Date.now())) return;
    stickyUntil = 0;
    els.flash.classList.remove("is-shown");
  }
  const WATCHDOG_MS = 2e3;
  let pending = 0;
  let watchdog;
  function showSpinner(on) {
    els.spinner.classList.toggle("is-shown", on);
  }
  function armWatchdog() {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(onWatchdog, WATCHDOG_MS);
  }
  function beginWait() {
    pending++;
    showSpinner(true);
    armWatchdog();
  }
  function decWait() {
    if (pending > 0) pending--;
    if (pending > 0) armWatchdog();
    else clearWait();
  }
  function clearWait() {
    pending = 0;
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = void 0;
    }
    showSpinner(false);
  }
  function onWatchdog() {
    logger.log("ui", "watchdog");
    clearWait();
    void recoverFromWatchdog();
  }
  async function recoverFromWatchdog() {
    if (focus) {
      lastRenderKey = null;
      await goto(focus, { noHistory: true, fromLogseq: true });
    }
    flash("\u26A0 The editor didn't report the change. Showing the latest state.", { stickyMs: STICKY_FLASH_MS });
  }
  function failWait(e) {
    decWait();
    flashError(e, { stickyMs: STICKY_FLASH_MS });
  }
  const unsubs = [];
  let disposed = false;
  async function init() {
    await loadTheme();
    await refreshPins();
    await restore();
  }
  async function boot() {
    let initialSize = null;
    try {
      initialSize = await backend.getSize();
    } catch {
    }
    if (disposed) return;
    view = createView({
      root: container,
      world: els.world,
      canvas: els.canvas,
      stage: els.stage,
      onNavigate: (name) => {
        void goto(name);
      },
      onOpenMain: (name) => {
        void backend.navigate(name).catch(() => {
        });
      },
      // No optimistic re-render: write, then wait for the editor's 'refresh' to render
      // confirmed state (the spinner shows meanwhile; the watchdog covers a silent failure).
      onRemoveLink: ({ from, to, role }) => {
        logger.log("user", "unlink", { from, to, role });
        beginWait();
        void backend.removeLink(from, to, role).catch(failWait);
      },
      onLinkExisting: (fromNode, toNode, role) => {
        logger.log("user", "link", { from: fromNode, to: toNode, role });
        beginWait();
        void backend.linkExisting(fromNode, toNode, role).catch(failWait);
      },
      onCreateAt: (fromNode, dir, at) => {
        void createAt(fromNode, dir, at);
      },
      onContextMenu: (name, at) => {
        openContextMenu({
          root: els.dialogRoot,
          at,
          items: isPinned(name) ? [{ label: "Unpin", onSelect: () => {
            void unpin(name);
          } }] : [{ label: "Pin", onSelect: () => {
            void pin(name);
          } }]
        });
      },
      initialSize,
      onSizeChange: (level) => {
        backend.setSize(level).catch(() => {
        });
      }
    });
    try {
      const m = await backend.getUiMode();
      mobile = !!m.mobile;
      focusOnActiveClick = !!m.focusOnActiveClick;
    } catch {
    }
    try {
      panelExpanded = await backend.isPanelExpanded();
    } catch {
    }
    if (disposed) return;
    view.setMobile(mobile);
    unsubs.push(
      backend.on("recenter", (payload) => {
        if (payload.page) {
          const p = payload.page;
          if (!sameName(p, focus) && !isRecentOutboundNav(recentNavs, p, Date.now(), NAV_ECHO_TTL_MS)) {
            void goto(p, { fromLogseq: true });
          }
        }
      }),
      backend.on("theme", (payload) => {
        void applyThemeWithOverrides(payload);
      }),
      backend.on("refresh", () => {
        void refreshPins();
        if (!focus) return;
        const wasWaiting = pending > 0;
        void goto(focus, { noHistory: true, fromLogseq: true, ifChanged: !wasWaiting }).then((changed) => {
          if (wasWaiting && changed) decWait();
        }).catch(() => {
        });
      }),
      backend.on("uimode", () => {
        void (async () => {
          if (disposed) return;
          try {
            const m = await backend.getUiMode();
            mobile = !!m.mobile;
            focusOnActiveClick = !!m.focusOnActiveClick;
          } catch {
          }
          if (disposed) return;
          view.setMobile(mobile);
          renderToolbar();
        })();
      })
    );
    if (disposed) return;
    await init();
  }
  void boot();
  return () => {
    disposed = true;
    if (watchdog) clearTimeout(watchdog);
    closeActiveDialog?.();
    closeContextMenu();
    closeColorsPopover();
    for (const u of unsubs) u();
    if (view) view.destroy();
    container.innerHTML = "";
    container.classList.remove("synapses-root");
  };
}

// src/main.ts
var import_obsidian5 = require("obsidian");

// src/datasource.ts
var import_obsidian = require("obsidian");

// src/dataview.ts
function getDataviewApi(app) {
  return app.plugins?.plugins?.dataview?.api;
}
function isDataviewEnabled(app) {
  return !!app.plugins?.plugins?.dataview;
}
function onDataviewIndexReady(app, callback) {
  return app.metadataCache.on("dataview:index-ready", callback);
}

// src/dataview-map.ts
function linkPathToBasename(path) {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.md$/i, "");
}

// src/inline-fields.ts
var MARKER_PREFIX = "[ \\t]*(?:[-*+>][ \\t]*)*";
var FENCE_MARKER = /^[ \t]{0,3}(`{3,}|~{3,})/;
function esc(key) {
  return key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function fieldRegex(key) {
  return new RegExp(`^(${MARKER_PREFIX})${esc(key)}::[ \\t]*.*$`, "i");
}
var GENERIC_FIELD = new RegExp(`^(${MARKER_PREFIX})([A-Za-z0-9_-]+)::[ \\t]*(.*)$`);
function format(targets) {
  return targets.map((t) => `[[${t}]]`).join(", ");
}
function stripCR(line) {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}
function codeFenceStates(lines) {
  const states = [];
  let openChar = null;
  let openLen = 0;
  for (const raw of lines) {
    const m = FENCE_MARKER.exec(stripCR(raw));
    if (openChar) {
      states.push(true);
      if (m && m[1][0] === openChar && m[1].length >= openLen) {
        openChar = null;
        openLen = 0;
      }
    } else if (m) {
      states.push(true);
      openChar = m[1][0];
      openLen = m[1].length;
    } else {
      states.push(false);
    }
  }
  return states;
}
function frontmatterEndLine(lines) {
  if (lines.length === 0 || stripCR(lines[0]) !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    const l = stripCR(lines[i]);
    if (l === "---" || l === "...") return i;
  }
  return null;
}
function frontmatterBody(text) {
  const lines = text.split("\n");
  const end = frontmatterEndLine(lines);
  return end == null ? null : lines.slice(1, end).join("\n");
}
function frontmatterFence(text) {
  const lines = text.split("\n");
  const end = frontmatterEndLine(lines);
  if (end == null) return null;
  const upToDelim = lines.slice(0, end + 1).join("\n");
  return end + 1 < lines.length ? upToDelim + "\n" : upToDelim;
}
function hasInlineField(text, key) {
  const re = fieldRegex(key);
  const lines = text.split("\n");
  const fenced = codeFenceStates(lines);
  return lines.some((raw, i) => !fenced[i] && re.test(stripCR(raw)));
}
function upsertInlineField(text, key, targets) {
  const line = `${key}:: ${format(targets)}`;
  const re = fieldRegex(key);
  const lines = text.split("\n");
  const fenced = codeFenceStates(lines);
  let replaced = false;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!fenced[i]) {
      const m = re.exec(stripCR(raw));
      if (m) {
        if (!replaced) {
          replaced = true;
          out.push(m[1] + line);
        }
        continue;
      }
    }
    out.push(raw);
  }
  if (replaced) return out.join("\n");
  const fence = frontmatterFence(text);
  if (fence) {
    const sep = fence.endsWith("\n") ? "" : "\n";
    return text.slice(0, fence.length) + sep + line + "\n" + text.slice(fence.length);
  }
  return text ? `${line}
${text}` : `${line}
`;
}
function removeInlineField(text, key) {
  const re = fieldRegex(key);
  const lines = text.split("\n");
  const fenced = codeFenceStates(lines);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!fenced[i] && re.test(stripCR(raw))) continue;
    out.push(raw);
  }
  return out.join("\n");
}
function scanInlineFields(text) {
  const lines = text.split("\n");
  const fenced = codeFenceStates(lines);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) continue;
    const m = GENERIC_FIELD.exec(stripCR(lines[i]));
    if (m) out.push({ key: m[2], value: m[3] });
  }
  return out;
}

// src/paths.ts
function newNotePath(parentPath, name) {
  const parent = parentPath === "/" ? "" : parentPath;
  return parent ? `${parent}/${name}.md` : `${name}.md`;
}

// src/write-target.ts
function chooseWriteTarget(opts) {
  if (opts.hasFrontmatterKey) return "frontmatter";
  if (opts.hasInlineKey) return "inline";
  return "default";
}

// src/datasource.ts
function createObsidianDataSource(app) {
  const dv = () => getDataviewApi(app);
  const userIgnoreFilters = () => {
    try {
      const cfg = app.vault.getConfig("userIgnoreFilters");
      return Array.isArray(cfg) ? cfg : [];
    } catch {
      return [];
    }
  };
  const isIgnoredPath = (path) => isInLogseqFolder(path) || matchesIgnoreFilters(path, userIgnoreFilters());
  function resolveFile(name) {
    const byLink = app.metadataCache.getFirstLinkpathDest(name, "");
    if (byLink) return byLink;
    const path = name.endsWith(".md") ? name : `${name}.md`;
    const byPath = app.vault.getAbstractFileByPath(path);
    return byPath instanceof import_obsidian.TFile ? byPath : null;
  }
  function createPathFor(name) {
    const parent = app.fileManager.getNewFileParent("");
    return newNotePath(parent?.path ?? "", name);
  }
  function asRecord(v) {
    return v && typeof v === "object" ? v : null;
  }
  function frontmatterKeyCasing(fm, key) {
    const rec = asRecord(fm);
    if (!rec) return null;
    const lower = key.toLowerCase();
    for (const k of Object.keys(rec)) if (k.toLowerCase() === lower) return k;
    return null;
  }
  function propsFromFrontmatter(fm) {
    const rec = asRecord(fm);
    const out = {};
    if (!rec) return out;
    for (const key of Object.keys(rec)) {
      const names = toNames(rec[key]);
      if (names.length) out[key] = names;
    }
    return out;
  }
  function propsFromInline(text) {
    const out = {};
    const casingByLower = /* @__PURE__ */ new Map();
    for (const { key, value } of scanInlineFields(text)) {
      const names = toNames(value);
      if (!names.length) continue;
      const lower = key.toLowerCase();
      const displayKey = casingByLower.get(lower) ?? key;
      casingByLower.set(lower, displayKey);
      out[displayKey] = out[displayKey] ? [...out[displayKey], ...names] : names;
    }
    return out;
  }
  function mergeProps(a, b) {
    const out = { ...a };
    for (const [key, names] of Object.entries(b)) out[key] = out[key] ? [...out[key], ...names] : names;
    return out;
  }
  function propsFromText(text) {
    const yaml = frontmatterBody(text);
    const fm = yaml != null ? (0, import_obsidian.parseYaml)(yaml) : null;
    return mergeProps(propsFromFrontmatter(fm), propsFromInline(text));
  }
  async function readPropsForFile(file) {
    return propsFromText(await app.vault.read(file));
  }
  async function readProps(name) {
    const file = resolveFile(name);
    return file ? readPropsForFile(file) : {};
  }
  function walkInlinks(name) {
    const api = dv();
    if (!api) return [];
    const file = resolveFile(name);
    const page = file ? api.page(file.path) : api.page(name);
    const inlinks = page?.file?.inlinks;
    if (!inlinks) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const link of inlinks) {
      const path = link?.path;
      if (typeof path !== "string" || isIgnoredPath(path)) continue;
      const linkedFile = app.vault.getAbstractFileByPath(path);
      if (!(linkedFile instanceof import_obsidian.TFile)) continue;
      const base = linkPathToBasename(path);
      const lower = base.toLowerCase();
      if (lower === name.toLowerCase() || seen.has(lower)) continue;
      seen.add(lower);
      out.push({ file: linkedFile, base });
    }
    return out;
  }
  return {
    getPageProps: (name) => readProps(name),
    async ensurePage(name) {
      if (resolveFile(name)) return;
      await app.vault.create(createPathFor(name), "");
    },
    async setPropertyLinks(name, key, targets) {
      let file = resolveFile(name);
      if (!file) {
        try {
          file = await app.vault.create(createPathFor(name), "");
        } catch {
          file = resolveFile(name);
        }
      }
      if (!file) return;
      const text = await app.vault.read(file);
      const yaml = frontmatterBody(text);
      const fm = yaml != null ? (0, import_obsidian.parseYaml)(yaml) : null;
      const existingKey = frontmatterKeyCasing(fm, key);
      const target = chooseWriteTarget({
        hasFrontmatterKey: existingKey !== null,
        hasInlineKey: hasInlineField(text, key)
      });
      if (target === "frontmatter") {
        const writeKey = existingKey ?? key;
        await app.fileManager.processFrontMatter(file, (fmObj) => {
          fmObj[writeKey] = targets.map((t) => `[[${t}]]`);
        });
        await app.vault.process(file, (data) => removeInlineField(data, key));
      } else {
        await app.vault.process(file, (data) => upsertInlineField(data, key, targets));
      }
    },
    async removePropertyKey(name, key) {
      const file = resolveFile(name);
      if (!file) return;
      const text = await app.vault.read(file);
      const yaml = frontmatterBody(text);
      const fm = yaml != null ? (0, import_obsidian.parseYaml)(yaml) : null;
      if (frontmatterKeyCasing(fm, key) !== null) {
        await app.fileManager.processFrontMatter(file, (fmObj) => {
          const existing = Object.keys(fmObj).find((k) => k.toLowerCase() === key.toLowerCase());
          if (existing) delete fmObj[existing];
        });
      }
      await app.vault.process(file, (data) => removeInlineField(data, key));
    },
    async searchPages(q) {
      const query = String(q || "").toLowerCase().trim();
      if (!query) return [];
      const out = [];
      for (const f of app.vault.getMarkdownFiles()) {
        if (isIgnoredPath(f.path)) continue;
        if (f.basename.toLowerCase().includes(query)) out.push(f.basename);
        if (out.length >= 20) break;
      }
      return out;
    },
    async getBacklinks(name) {
      const out = [];
      for (const { file, base } of walkInlinks(name)) out.push({ name: base, props: await readPropsForFile(file) });
      return out;
    },
    getOutgoingRefs(name) {
      const file = resolveFile(name);
      if (!file) return Promise.resolve([]);
      const out = [];
      const seen = /* @__PURE__ */ new Set();
      const addName = (n) => {
        const lower = n.toLowerCase();
        if (lower === name.toLowerCase() || seen.has(lower)) return;
        seen.add(lower);
        out.push(n);
      };
      const resolved = app.metadataCache.resolvedLinks[file.path] ?? {};
      for (const path of Object.keys(resolved)) {
        if (isIgnoredPath(path)) continue;
        addName(linkPathToBasename(path));
      }
      const unresolved = app.metadataCache.unresolvedLinks[file.path] ?? {};
      for (const linkText of Object.keys(unresolved)) addName(linkText);
      return Promise.resolve(out);
    },
    getIncomingRefs(name) {
      return Promise.resolve(walkInlinks(name).map(({ base }) => base));
    }
  };
}

// src/services.ts
var import_obsidian2 = require("obsidian");
var VARS = {
  bg: "--background-primary",
  bg2: "--background-secondary",
  text: "--text-normal",
  text2: "--text-muted",
  border: "--background-modifier-border",
  accent: "--interactive-accent"
};
function readPalette() {
  const mode = document.body.classList.contains("theme-dark") ? "dark" : "light";
  const out = { mode };
  try {
    const cs = getComputedStyle(document.body);
    for (const k of Object.keys(VARS)) {
      const v = cs.getPropertyValue(VARS[k]).trim();
      if (v) out[k] = v;
    }
  } catch {
  }
  return out;
}
function createObsidianServices(app, plugin) {
  const persistence = {
    async load(key) {
      const d = await plugin.loadData() ?? {};
      return d.persist?.[key] ?? null;
    },
    // Funnel through the plugin's serialized writer so saves never clobber settings.
    save(key, value) {
      return plugin.persistData((d) => {
        d.persist = { ...d.persist ?? {}, [key]: value };
      });
    }
  };
  return {
    getActivePageName() {
      return app.workspace.getActiveFile()?.basename ?? null;
    },
    onActivePageChange(cb) {
      const fire = () => cb(app.workspace.getActiveFile()?.basename ?? null);
      plugin.registerEvent(app.workspace.on("active-leaf-change", fire));
      plugin.registerEvent(app.workspace.on("file-open", fire));
    },
    async navigateTo(name) {
      await app.workspace.openLinkText(name, "", false);
    },
    getTheme() {
      return readPalette();
    },
    onThemeChange(cb) {
      plugin.registerEvent(app.workspace.on("css-change", () => cb(readPalette())));
    },
    getUiMode() {
      return { mobile: import_obsidian2.Platform.isMobile || !!plugin.settings.mobileMode, focusOnActiveClick: !!plugin.settings.focusOnActiveClick };
    },
    onUiModeChange(cb) {
      plugin.onSettingsChanged(cb);
    },
    // RAW forward — the REFRESH_DEBOUNCE_MS trailing debounce lives in createCoreBackend.
    onGraphChange(cb) {
      plugin.registerEvent(app.metadataCache.on("changed", () => cb()));
      const dvEvents = app.metadataCache;
      plugin.registerEvent(dvEvents.on("dataview:index-ready", () => cb()));
      plugin.registerEvent(dvEvents.on("dataview:metadata-change", () => cb()));
    },
    getOntology() {
      const s = plugin.settings;
      return buildOntology({ parent: s.parentFields, child: s.childFields, jump: s.jumpFields });
    },
    onOntologyChange(cb) {
      plugin.onSettingsChanged(cb);
    },
    getRawLinks() {
      const s = plugin.settings;
      return { outgoing: s.showOutgoingLinks, incoming: s.showIncomingLinks };
    },
    persistence
  };
}

// src/settings.ts
var import_obsidian3 = require("obsidian");
var DEFAULT_SETTINGS = {
  parentFields: "parent, parents, up",
  childFields: "child, children, down",
  jumpFields: "jump, jumps, friend, friends",
  mobileMode: false,
  focusOnActiveClick: false,
  fileLogging: false,
  showOutgoingLinks: "off",
  showIncomingLinks: "off"
};
var RAW_LINK_MODES = ["off", "jump", "child"];
function asRawLinkMode(v) {
  return RAW_LINK_MODES.includes(v) ? v : "off";
}
function debounce(fn, ms) {
  let timer;
  return () => {
    if (timer !== void 0) window.clearTimeout(timer);
    timer = window.setTimeout(fn, ms);
  };
}
var SynapsesSettingTab = class extends import_obsidian3.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const field = (name, desc, key) => {
      const debouncedSave = debounce(() => {
        void this.plugin.saveSettings();
      }, 500);
      return new import_obsidian3.Setting(containerEl).setName(name).setDesc(desc).addText(
        (t) => t.setValue(this.plugin.settings[key]).onChange((v) => {
          this.plugin.settings[key] = v;
          debouncedSave();
        })
      );
    };
    field("Parent property names", 'Comma-separated fields treated as "parent".', "parentFields");
    field("Child property names", 'Comma-separated fields treated as "child".', "childFields");
    field("Jump property names", 'Comma-separated fields treated as "jump".', "jumpFields");
    new import_obsidian3.Setting(containerEl).setName("Show outgoing links in plugin view").setDesc("Show notes this note links to anywhere in its content, even when the link is not an ontology property.").addDropdown((d) => d.addOption("off", "No").addOption("jump", "As jumps").addOption("child", "As children").setValue(this.plugin.settings.showOutgoingLinks).onChange(async (v) => {
      this.plugin.settings.showOutgoingLinks = asRawLinkMode(v);
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Show incoming links in plugin view").setDesc("Show notes that link to this note, even when the link is not an ontology property.").addDropdown((d) => d.addOption("off", "No").addOption("jump", "As jumps").addOption("child", "As children").setValue(this.plugin.settings.showIncomingLinks).onChange(async (v) => {
      this.plugin.settings.showIncomingLinks = asRawLinkMode(v);
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Mobile mode").setDesc("Force the mobile layout & interactions even on desktop.").addToggle((t) => t.setValue(this.plugin.settings.mobileMode).onChange(async (v) => {
      this.plugin.settings.mobileMode = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Focus in editor only on active-note click").setDesc("Activating a card only recenters the view; click the already-centered (active) card to open the note in the editor.").addToggle((t) => t.setValue(this.plugin.settings.focusOnActiveClick).onChange(async (v) => {
      this.plugin.settings.focusOnActiveClick = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Debug file logging").setDesc("Write a JSONL interaction log for troubleshooting communication problems. The log file path is printed to the developer console.").addToggle((t) => t.setValue(this.plugin.settings.fileLogging).onChange(async (v) => {
      this.plugin.settings.fileLogging = v;
      await this.plugin.saveSettings();
    }));
  }
};

// src/view.ts
var import_obsidian4 = require("obsidian");
var VIEW_TYPE_SYNAPSES = "synapses-view";
var SynapsesView = class extends import_obsidian4.ItemView {
  plugin;
  teardown = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_SYNAPSES;
  }
  getDisplayText() {
    return "Synapses";
  }
  getIcon() {
    return "brain";
  }
  async onOpen() {
    this.teardown?.();
    this.teardown = null;
    const backend = this.plugin.getBackend();
    if (!backend) {
      this.contentEl.empty();
      this.contentEl.createEl("div", {
        text: "Synapses requires the Dataview plugin to be installed and enabled.",
        attr: { style: "padding:12px" }
      });
      this.registerEvent(onDataviewIndexReady(this.app, () => {
        void this.onOpen();
      }));
      return;
    }
    this.teardown = mountSynapses(this.contentEl, backend, this.plugin.logger ?? void 0);
  }
  async onClose() {
    this.teardown?.();
    this.teardown = null;
  }
};

// src/main.ts
var SynapsesPlugin = class extends import_obsidian5.Plugin {
  settings = DEFAULT_SETTINGS;
  backend = null;
  logger = null;
  logSink = null;
  logPath = "";
  settingsListeners = [];
  // Every data.json write funnels through this chain so concurrent read-modify-writes
  // (settings + the persistence saves below) can't clobber each other: each waits for
  // the previous, then re-reads the freshest data, mutates, and writes.
  writeQueue = Promise.resolve();
  async onload() {
    await this.loadSettings();
    const dir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    this.logPath = `${dir}/synapses-log.jsonl`;
    this.logSink = createBufferedSink({
      load: () => this.app.vault.adapter.read(this.logPath).then((t) => t).catch(() => null),
      persist: (t) => this.app.vault.adapter.write(this.logPath, t)
    });
    const sink = this.logSink;
    this.logger = createLogger((line) => sink.write(line), { ctx: "main", enabled: this.settings.fileLogging, mirror: (s) => console.log("[synapses]", s) });
    if (this.settings.fileLogging) {
      this.logSink.clear();
      this.announceLogPath();
      new import_obsidian5.Notice("Synapses: debug recording is running");
    }
    this.addSettingTab(new SynapsesSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_SYNAPSES, (leaf) => new SynapsesView(leaf, this));
    this.addRibbonIcon("brain", "Open Synapses", () => void this.activateView());
    this.addCommand({ id: "open-in-sidebar", name: "Open in sidebar", callback: () => void this.activateView() });
  }
  onunload() {
    this.logSink?.dispose();
  }
  // Durable backend, built once, gated on Dataview. Persists across view open/close.
  getBackend() {
    if (this.backend) return this.backend;
    if (!isDataviewEnabled(this.app)) {
      new import_obsidian5.Notice("Synapses requires the Dataview plugin to be installed and enabled.");
      return null;
    }
    const logger = this.logger ?? createLogger(() => {
    }, { ctx: "main", enabled: false });
    this.backend = wrapBackendWithLogging(
      createCoreBackend(wrapDataSource(createObsidianDataSource(this.app), logger), createObsidianServices(this.app, this), logger),
      logger
    );
    return this.backend;
  }
  onSettingsChanged(cb) {
    this.settingsListeners.push(cb);
  }
  // Serialized read-modify-write of data.json; shared by settings + EditorServices persistence.
  persistData(mutate) {
    const run = this.writeQueue.then(async () => {
      const data = await this.loadData() ?? {};
      mutate(data);
      await this.saveData(data);
    });
    this.writeQueue = run.catch(() => {
    });
    return run;
  }
  async loadSettings() {
    const data = await this.loadData() ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings ?? {});
  }
  async saveSettings() {
    const wasOn = this.logger?.enabled() ?? false;
    await this.persistData((data) => {
      data.settings = this.settings;
    });
    this.logger?.setEnabled(this.settings.fileLogging);
    if (this.settings.fileLogging && !wasOn) {
      this.logSink?.clear();
      this.announceLogPath();
      new import_obsidian5.Notice("Synapses: debug recording is running");
    }
    this.settingsListeners.forEach((cb) => cb());
  }
  announceLogPath() {
    const adapter = this.app.vault.adapter;
    const abs = adapter instanceof import_obsidian5.FileSystemAdapter ? adapter.getFullPath(this.logPath) : this.logPath;
    log.info(`debug file logging on \u2192 ${abs}`);
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_SYNAPSES)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_SYNAPSES, active: true });
    }
    if (leaf) await workspace.revealLeaf(leaf);
  }
};

/* nosourcemap */