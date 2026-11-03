// MintyWM layout engine. No GJS imports: node tests require() this file,
// and the extension loads it with imports.mintyLayout.MintyLayout.
//
// A workspace/monitor keeps an explicit binary tree. Leaves are windows.
// Splits remember their own orientation and ratio, so a resize or a
// togglesplit stays put instead of flipping whenever a rectangle goes square.

var RATIO_MIN = 0.15;
var RATIO_MAX = 0.85;

function clampRatio(r) {
    if (typeof r !== "number" || !(r > 0 && r < 1)) return 0.5;
    var c = Math.min(RATIO_MAX, Math.max(RATIO_MIN, r));
    return Math.round(c * 1000) / 1000;
}

function leaf(id, pseudo) {
    return { kind: "leaf", id: id, pseudo: !!pseudo };
}

function split(horizontal, ratio, a, b) {
    return { kind: "split", horizontal: !!horizontal, ratio: clampRatio(ratio), a: a, b: b };
}

function inOrder(node, out) {
    var list = out || [];
    if (!node) return list;
    if (node.kind === "leaf") {
        list.push(node.id);
        return list;
    }
    inOrder(node.a, list);
    inOrder(node.b, list);
    return list;
}

function findLeaf(node, id) {
    if (!node) return null;
    if (node.kind === "leaf") return node.id === id ? node : null;
    return findLeaf(node.a, id) || findLeaf(node.b, id);
}

function removeId(node, id) {
    if (!node) return null;
    if (node.kind === "leaf") return node.id === id ? null : node;
    var a = removeId(node.a, id);
    var b = removeId(node.b, id);
    if (a === node.a && b === node.b) return node;
    if (!a) return b;
    if (!b) return a;
    return split(node.horizontal, node.ratio, a, b);
}

function mapTree(node, fn) {
    if (!node) return null;
    if (node.kind === "leaf") return fn(node);
    var a = mapTree(node.a, fn);
    var b = mapTree(node.b, fn);
    var next = fn(split(node.horizontal, node.ratio, a, b));
    return next || split(node.horizontal, node.ratio, a, b);
}

// Replace the leaf `atId` with a split. The existing leaf stays on side A
// (it keeps its place); the new window is side B, which is the dwindle tail.
function insertAt(node, atId, id, horizontal) {
    if (!node) return leaf(id, false);
    if (node.kind === "leaf") {
        if (node.id !== atId) return node;
        return split(horizontal, 0.5, node, leaf(id, false));
    }
    return split(node.horizontal, node.ratio, insertAt(node.a, atId, id, horizontal), insertAt(node.b, atId, id, horizontal));
}

function parentOf(node, id, path) {
    if (!node || node.kind === "leaf") return null;
    var here = path || [];
    if (node.a && node.a.kind === "leaf" && node.a.id === id) return { node: node, side: "a", path: here };
    if (node.b && node.b.kind === "leaf" && node.b.id === id) return { node: node, side: "b", path: here };
    var left = parentOf(node.a, id, here.concat(["a"]));
    if (left) return left;
    return parentOf(node.b, id, here.concat(["b"]));
}

function ancestorChain(node, id, path, out) {
    var list = out || [];
    if (!node || node.kind === "leaf") return list;
    var here = path || [];
    if (containsId(node.a, id)) {
        list.push({ horizontal: node.horizontal, side: "a", path: here, ratio: node.ratio });
        ancestorChain(node.a, id, here.concat(["a"]), list);
    } else if (containsId(node.b, id)) {
        list.push({ horizontal: node.horizontal, side: "b", path: here, ratio: node.ratio });
        ancestorChain(node.b, id, here.concat(["b"]), list);
    }
    return list;
}

function containsId(node, id) {
    if (!node) return false;
    if (node.kind === "leaf") return node.id === id;
    return containsId(node.a, id) || containsId(node.b, id);
}

function setRatioAt(node, path, ratio) {
    if (!node || node.kind === "leaf") return node;
    if (!path || path.length === 0) return split(node.horizontal, ratio, node.a, node.b);
    if (path[0] === "a") return split(node.horizontal, node.ratio, setRatioAt(node.a, path.slice(1), ratio), node.b);
    return split(node.horizontal, node.ratio, node.a, setRatioAt(node.b, path.slice(1), ratio));
}

function setHorizontalAt(node, path, horizontal) {
    if (!node || node.kind === "leaf") return node;
    if (!path || path.length === 0) return split(horizontal, node.ratio, node.a, node.b);
    if (path[0] === "a") return split(node.horizontal, node.ratio, setHorizontalAt(node.a, path.slice(1), horizontal), node.b);
    return split(node.horizontal, node.ratio, node.a, setHorizontalAt(node.b, path.slice(1), horizontal));
}

function toggleSplit(node, id) {
    var parent = parentOf(node, id);
    if (!parent) return node;
    return setHorizontalAt(node, parent.path, !parent.node.horizontal);
}

function togglePseudo(node, id) {
    return mapTree(node, function (n) {
        if (n.kind === "leaf" && n.id === id) return leaf(n.id, !n.pseudo);
        return n;
    });
}

function swapLeaves(node, a, b) {
    if (a === b || !findLeaf(node, a) || !findLeaf(node, b)) return node;
    var la = findLeaf(node, a);
    var lb = findLeaf(node, b);
    return mapTree(node, function (n) {
        if (n.kind !== "leaf") return n;
        if (n.id === a) return leaf(b, lb.pseudo);
        if (n.id === b) return leaf(a, la.pseudo);
        return n;
    });
}

// Put this window on the left of a fresh root split, so it becomes the big slot.
function makeFirst(node, id) {
    var found = findLeaf(node, id);
    if (!found || !node || node.kind === "leaf") return node;
    var rest = removeId(node, id);
    if (!rest) return leaf(id, found.pseudo);
    return split(true, 0.5, leaf(id, found.pseudo), rest);
}

function nearestSplit(node, id, axis) {
    // axis "h" = a horizontal split (it controls width). "v" = vertical.
    var chain = ancestorChain(node, id);
    var i;
    for (i = chain.length - 1; i >= 0; i--) {
        var horizontal = axis === "h";
        if (!!chain[i].horizontal === horizontal) return chain[i];
    }
    return null;
}

function resizeAlong(node, id, axis, delta) {
    var hit = nearestSplit(node, id, axis);
    if (!hit) return null;
    var sign = hit.side === "a" ? 1 : -1;
    var next = clampRatio(hit.ratio + sign * delta);
    if (next === clampRatio(hit.ratio)) return null;
    return setRatioAt(node, hit.path, next);
}

// Classic grow/shrink: move the leaf's own parent divider, whichever way it runs.
function resizeParent(node, id, delta) {
    var parent = parentOf(node, id);
    if (!parent) return null;
    var sign = parent.side === "a" ? 1 : -1;
    var next = clampRatio(parent.node.ratio + sign * delta);
    if (next === clampRatio(parent.node.ratio)) return null;
    return setRatioAt(node, parent.path, next);
}

function insetSafe(rect, pad) {
    if (!(pad > 0)) {
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    var width = rect.width - 2 * pad;
    var height = rect.height - 2 * pad;
    if (width < 1 || height < 1) {
        return { x: rect.x, y: rect.y, width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    }
    return { x: rect.x + pad, y: rect.y + pad, width: width, height: height };
}

// Pull a rectangle back so it lies inside `area`. A rectangle bigger than the
// area is pinned to the area origin (titlebar stays reachable) and clipped
// to the area size — callers that must honour a WM minimum still see `clipped`.
function clampRectInside(rect, area) {
    var w = Math.max(1, rect.width);
    var h = Math.max(1, rect.height);
    var clipped = false;
    if (w > area.width) { w = Math.max(1, area.width); clipped = true; }
    if (h > area.height) { h = Math.max(1, area.height); clipped = true; }
    var x = rect.x;
    var y = rect.y;
    if (x < area.x) x = area.x;
    if (y < area.y) y = area.y;
    if (x + w > area.x + area.width) x = area.x + area.width - w;
    if (y + h > area.y + area.height) y = area.y + area.height - h;
    return { x: x, y: y, width: w, height: h, clipped: clipped };
}

// Shift an already-sized frame so it stays on the work area. Does not shrink
// it: a window that is larger than the screen keeps its size and is pinned
// to the top-left of the work area.
function clampOrigin(frame, area) {
    var w = frame.width;
    var h = frame.height;
    var x = frame.x;
    var y = frame.y;
    if (w >= area.width) x = area.x;
    else {
        if (x < area.x) x = area.x;
        if (x + w > area.x + area.width) x = area.x + area.width - w;
    }
    if (h >= area.height) y = area.y;
    else {
        if (y < area.y) y = area.y;
        if (y + h > area.y + area.height) y = area.y + area.height - h;
    }
    return { x: Math.round(x), y: Math.round(y), width: w, height: h };
}

function layoutTree(node, area, innerGap, outerGap) {
    var cells = [];
    if (!node || !area || area.width < 1 || area.height < 1) return cells;
    var half = Math.floor((innerGap || 0) / 2);
    var inset = (outerGap || 0) - half;
    if (inset < 0) inset = 0;
    var root = insetSafe(area, inset);
    function walk(n, rect, chain) {
        if (!n) return;
        if (n.kind === "leaf") {
            var inner = insetSafe(rect, half);
            var placed = clampRectInside(inner, area);
            cells.push({
                id: n.id,
                rect: { x: placed.x, y: placed.y, width: placed.width, height: placed.height },
                pseudo: !!n.pseudo,
                chain: chain,
            });
            return;
        }
        var ratio = clampRatio(n.ratio);
        var infoBase = { horizontal: !!n.horizontal, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
        if (n.horizontal) {
            var w = Math.max(1, Math.floor(rect.width * ratio));
            if (w >= rect.width) w = Math.max(1, rect.width - 1);
            walk(n.a, { x: rect.x, y: rect.y, width: w, height: rect.height },
                chain.concat([{ horizontal: true, side: "a", path: infoBase && chainPath(chain), rect: infoBase.rect }]));
            walk(n.b, { x: rect.x + w, y: rect.y, width: rect.width - w, height: rect.height },
                chain.concat([{ horizontal: true, side: "b", path: chainPath(chain), rect: infoBase.rect }]));
        } else {
            var h = Math.max(1, Math.floor(rect.height * ratio));
            if (h >= rect.height) h = Math.max(1, rect.height - 1);
            walk(n.a, { x: rect.x, y: rect.y, width: rect.width, height: h },
                chain.concat([{ horizontal: false, side: "a", path: chainPath(chain), rect: infoBase.rect }]));
            walk(n.b, { x: rect.x, y: rect.y + h, width: rect.width, height: rect.height - h },
                chain.concat([{ horizontal: false, side: "b", path: chainPath(chain), rect: infoBase.rect }]));
        }
    }
    function chainPath(chain) {
        var p = [];
        var i;
        for (i = 0; i < chain.length; i++) p.push(chain[i].side);
        return p;
    }
    walk(node, root, []);
    return cells;
}

function cellFits(rect, minW, minH, own) {
    var w = Math.max(minW || 0, own && own.w ? own.w : 0);
    var h = Math.max(minH || 0, own && own.h ? own.h : 0);
    return rect.width + 0.5 >= w && rect.height + 0.5 >= h;
}

function pack(tree, area, inner, outer, minW, minH, mins, rank) {
    var working = tree;
    var dropped = [];
    var guard = 0;
    while (working && guard++ < 64) {
        var cells = layoutTree(working, area, inner, outer);
        var ok = true;
        var i;
        for (i = 0; i < cells.length; i++) {
            var own = mins ? mins[cells[i].id] : null;
            if (!cellFits(cells[i].rect, minW, minH, own)) { ok = false; break; }
        }
        if (ok || inOrder(working).length <= 1) {
            return { cells: cells, overflow: dropped.slice(), inner: inner, outer: outer };
        }
        var ids = inOrder(working);
        var victim = ids[0];
        var victimRank = -1;
        for (i = 0; i < ids.length; i++) {
            var r = rank && rank[ids[i]] !== undefined ? rank[ids[i]] : 9999;
            if (r >= victimRank) { victimRank = r; victim = ids[i]; }
        }
        working = removeId(working, victim);
        dropped.push(victim);
    }
    return { cells: [], overflow: dropped, inner: inner, outer: outer };
}

// Shrink gaps before giving up on a window. Larger gaps win when the overflow
// count is the same, so a layout that already fits is not tightened.
function solve(tree, area, inner, outer, minW, minH, mins, priority) {
    var rank = {};
    var i;
    var order = priority || inOrder(tree);
    for (i = 0; i < order.length; i++) rank[order[i]] = i;
    var scales = [1, 0.5, 0];
    var best = null;
    for (i = 0; i < scales.length; i++) {
        var scale = scales[i];
        var ig = scale === 0 ? 0 : Math.round((inner || 0) * scale);
        var og = scale === 0 ? 0 : Math.round((outer || 0) * scale);
        var result = pack(tree, area, ig, og, minW, minH, mins, rank);
        if (!best || result.overflow.length < best.overflow.length) best = result;
        if (result.overflow.length === 0) break;
    }
    return best || { cells: [], overflow: order.slice(), inner: 0, outer: 0 };
}

function pseudoRect(rect, percent) {
    var p = Math.max(20, Math.min(90, percent || 60)) / 100;
    var w = Math.max(1, Math.round(rect.width * p));
    var h = Math.max(1, Math.round(rect.height * p));
    return clampRectInside({
        x: rect.x + Math.round((rect.width - w) / 2),
        y: rect.y + Math.round((rect.height - h) / 2),
        width: w,
        height: h,
    }, rect);
}

function soleRect(area, innerGap, outerGap) {
    var cells = layoutTree(leaf("only", false), area, innerGap, outerGap);
    return cells.length ? cells[0].rect : { x: area.x, y: area.y, width: area.width, height: area.height };
}

function cascadeRect(area, index, percent) {
    var p = Math.max(20, Math.min(90, percent || 60)) / 100;
    var w = Math.max(1, Math.min(area.width, Math.round(area.width * p)));
    var h = Math.max(1, Math.min(area.height, Math.round(area.height * p)));
    var step = 28;
    var maxX = Math.max(0, area.width - w);
    var maxY = Math.max(0, area.height - h);
    var off = Math.min((index || 0) * step, Math.max(maxX, maxY));
    return clampRectInside({
        x: area.x + Math.min(off, maxX),
        y: area.y + Math.min(off, maxY),
        width: w,
        height: h,
    }, area);
}

function ratioAt(splitRect, horizontal, pos) {
    var share = horizontal
        ? (pos - splitRect.x) / splitRect.width
        : (pos - splitRect.y) / splitRect.height;
    return clampRatio(share);
}

function focusDirection(from, candidates, dir) {
    if (!from) return null;
    var fcX = from.x + from.width / 2;
    var fcY = from.y + from.height / 2;
    var best = null;
    var bestScore = Infinity;
    var i;
    for (i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        if (!c || !c.rect || c.rect === from) continue;
        var r = c.rect;
        var dx = (r.x + r.width / 2) - fcX;
        var dy = (r.y + r.height / 2) - fcY;
        var primary = 0;
        var secondary = 0;
        var ok = false;
        if (dir === "left") { ok = dx < -4; primary = -dx; secondary = Math.abs(dy); }
        else if (dir === "right") { ok = dx > 4; primary = dx; secondary = Math.abs(dy); }
        else if (dir === "up") { ok = dy < -4; primary = -dy; secondary = Math.abs(dx); }
        else if (dir === "down") { ok = dy > 4; primary = dy; secondary = Math.abs(dx); }
        if (!ok) continue;
        if (secondary > primary * 2.2 && secondary > 80) continue;
        var score = primary + secondary * 0.4;
        if (score < bestScore) { bestScore = score; best = c.id; }
    }
    return best;
}

function layoutCells(node, area, inner, outer) {
    return layoutTree(node, area, inner, outer);
}

// ids: windows that should be in the tree, earliest first.
// opt.focusId: leaf to split for the first insertion (dwindle: the focused one).
// opt.reinsert: ids to pull out and put back as the newest tail.
// opt.area / inner / outer: used to pick the new split's orientation.
function reconcile(tree, ids, opt) {
    opt = opt || {};
    var want = {};
    var i;
    for (i = 0; i < ids.length; i++) want[ids[i]] = true;
    var t = tree;
    if (t) {
        var existing = inOrder(t);
        for (i = 0; i < existing.length; i++) {
            if (!want[existing[i]]) t = removeId(t, existing[i]);
        }
    }
    var again = opt.reinsert || [];
    var re = {};
    for (i = 0; i < again.length; i++) {
        re[again[i]] = true;
        if (t) t = removeId(t, again[i]);
    }
    var area = opt.area || { x: 0, y: 0, width: 800, height: 600 };
    var inner = opt.inner || 0;
    var outer = opt.outer || 0;
    function add(id, at) {
        if (!t) { t = leaf(id, false); return id; }
        var cells = layoutTree(t, area, inner, outer);
        var target = null;
        var c;
        for (c = 0; c < cells.length; c++) if (cells[c].id === at) target = cells[c];
        if (!target) target = cells[cells.length - 1];
        var horizontal = target.rect.width >= target.rect.height;
        t = insertAt(t, target.id, id, horizontal);
        return id;
    }
    var have = {};
    var got = t ? inOrder(t) : [];
    for (i = 0; i < got.length; i++) have[got[i]] = true;
    var at = opt.focusId;
    for (i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (have[id] || re[id]) continue;
        at = add(id, at);
        have[id] = true;
    }
    for (i = 0; i < ids.length; i++) {
        if (!re[ids[i]] || have[ids[i]]) continue;
        at = add(ids[i], at);
        have[ids[i]] = true;
    }
    return t;
}

function evenSplits(node) {
    if (!node || node.kind === "leaf") return node;
    return split(node.horizontal, 0.5, evenSplits(node.a), evenSplits(node.b));
}

function applyRatios(node, ratios) {
    var i = 0;
    function walk(n) {
        if (!n || n.kind === "leaf") return n;
        var ratio = ratios && typeof ratios[i] === "number" ? ratios[i] : n.ratio;
        i++;
        return split(n.horizontal, ratio, walk(n.a), walk(n.b));
    }
    return walk(node);
}

function serialize(node) {
    if (!node) return null;
    if (node.kind === "leaf") return { k: "l", p: node.pseudo ? 1 : 0 };
    return { k: "s", h: node.horizontal ? 1 : 0, r: node.ratio, a: serialize(node.a), b: serialize(node.b) };
}

function assignLeaves(skel, ids) {
    if (!skel) return null;
    var count = 0;
    function measure(n) {
        if (!n) return;
        if (n.k === "l" || n.kind === "leaf") { count++; return; }
        measure(n.a);
        measure(n.b);
    }
    measure(skel);
    if (count !== ids.length) return null;
    var i = 0;
    function clone(n) {
        if (!n) return null;
        if (n.k === "l" || n.kind === "leaf") {
            var id = ids[i++];
            var pseudo = n.p ? true : !!n.pseudo;
            return leaf(id, pseudo);
        }
        var horizontal = n.h !== undefined ? !!n.h : !!n.horizontal;
        var ratio = n.r !== undefined ? n.r : n.ratio;
        return split(horizontal, ratio, clone(n.a), clone(n.b));
    }
    return clone(skel);
}

function shiftKeyMap(obj, removed, count) {
    if (removed > count) return null;
    var out = {};
    var keys = [];
    var k;
    for (k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) keys.push(k);
    var changed = false;
    for (var i = 0; i < keys.length; i++) {
        var m = /^(\d+):(\d+)$/.exec(keys[i]);
        if (!m) continue;
        var ws = parseInt(m[1], 10);
        if (ws === removed) { changed = true; continue; }
        var next = ws > removed && ws <= count + 1 ? ws - 1 : ws;
        if (next !== ws) changed = true;
        out[next + ":" + m[2]] = obj[keys[i]];
    }
    return changed ? out : null;
}

// ---- default keys ----------------------------------------------------------
// One set, Hyprland / Omarchy shaped. Super+arrows stays with Cinnamon.
// Super+P and Super+O stay with Cinnamon too (monitors, orientation lock),
// so pseudotile and pop-out are Super+Shift+P and Super+Shift+O.
// The cheat sheet is Ctrl+Super+/, because Super+/ often never reaches an extension.

var KEY_LABELS = [
    ["keyToggleTiling", "Pause or resume tiling everywhere"],
    ["keyToggleWorkspace", "Tiling on or off for this workspace"],
    ["keyToggleFloat", "Float or tile the focused window"],
    ["keyAlwaysFloat", "Always float this app, or stop"],
    ["keyPop", "Pop the window out and pin it"],
    ["keyFullscreen", "Fullscreen"],
    ["keyMaximize", "Fill the work area"],
    ["keyMonocle", "Monocle (one window, gaps kept)"],
    ["keyToggleSplit", "Toggle split direction"],
    ["keyPseudo", "Pseudotile (float size inside the tile)"],
    ["keyClose", "Close the window"],
    ["keyFocusLeft", "Focus left"],
    ["keyFocusRight", "Focus right"],
    ["keyFocusUp", "Focus up"],
    ["keyFocusDown", "Focus down"],
    ["keySwapLeft", "Swap left"],
    ["keySwapRight", "Swap right"],
    ["keySwapUp", "Swap up"],
    ["keySwapDown", "Swap down"],
    ["keyGrowWidth", "Make the focused tile wider"],
    ["keyShrinkWidth", "Make the focused tile narrower"],
    ["keyGrowHeight", "Make the focused tile taller"],
    ["keyShrinkHeight", "Make the focused tile shorter"],
    ["keyResetSizes", "Even out tile sizes on this workspace"],
    ["keyRetile", "Re-tile now"],
    ["keyCheatSheet", "Show this cheat sheet"],
];

var DEFAULT_KEYS = {
    keyToggleTiling: "<Super><Control>t",
    keyToggleWorkspace: "<Super><Alt>t",
    keyToggleFloat: "<Super>t",
    keyAlwaysFloat: "<Super><Shift>t",
    keyPop: "<Super><Shift>o",
    keyFullscreen: "<Super>f",
    keyMaximize: "<Super><Alt>f",
    keyMonocle: "<Super><Control>f",
    keyToggleSplit: "<Super>j",
    keyPseudo: "<Super><Shift>p",
    keyClose: "<Super>w",
    keyFocusLeft: "<Super><Control>Left",
    keyFocusRight: "<Super><Control>Right",
    keyFocusUp: "<Super><Control>Up",
    keyFocusDown: "<Super><Control>Down",
    keySwapLeft: "<Super><Control><Shift>Left",
    keySwapRight: "<Super><Control><Shift>Right",
    keySwapUp: "<Super><Control><Shift>Up",
    keySwapDown: "<Super><Control><Shift>Down",
    keyGrowWidth: "<Super>equal",
    keyShrinkWidth: "<Super>minus",
    keyGrowHeight: "<Super><Shift>equal",
    keyShrinkHeight: "<Super><Shift>minus",
    keyResetSizes: "<Super><Control>equal",
    keyRetile: "<Super><Shift>r",
    keyCheatSheet: "<Super><Control>slash",
};

var MintyLayout = {
    clampRatio: clampRatio,
    leaf: leaf,
    inOrder: inOrder,
    removeId: removeId,
    insertAt: insertAt,
    toggleSplit: toggleSplit,
    togglePseudo: togglePseudo,
    swapLeaves: swapLeaves,
    makeFirst: makeFirst,
    resizeAlong: resizeAlong,
    resizeParent: resizeParent,
    setRatioAt: setRatioAt,
    layoutTree: layoutTree,
    solve: solve,
    pseudoRect: pseudoRect,
    soleRect: soleRect,
    cascadeRect: cascadeRect,
    clampOrigin: clampOrigin,
    clampRectInside: clampRectInside,
    ratioAt: ratioAt,
    focusDirection: focusDirection,
    reconcile: reconcile,
    applyRatios: applyRatios,
    evenSplits: evenSplits,
    serialize: serialize,
    assignLeaves: assignLeaves,
    shiftKeyMap: shiftKeyMap,
    KEY_LABELS: KEY_LABELS,
    DEFAULT_KEYS: DEFAULT_KEYS,
    ancestorChain: ancestorChain,
    parentOf: parentOf,
};

if (typeof module === "object" && module.exports) module.exports = { MintyLayout: MintyLayout };
