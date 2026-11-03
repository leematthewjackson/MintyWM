"use strict";

var ML = require("./mintyLayout.js").MintyLayout;
var failed = 0;

function assert(cond, msg) {
    if (!cond) {
        failed++;
        console.error("FAIL: " + msg);
    }
}

function overlaps(a, b) {
    return a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5 &&
        a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5;
}

function inside(cell, area) {
    return cell.x >= area.x - 0.5 && cell.y >= area.y - 0.5 &&
        cell.x + cell.width <= area.x + area.width + 0.5 &&
        cell.y + cell.height <= area.y + area.height + 0.5 &&
        cell.width >= 1 && cell.height >= 1;
}

function audit(label, area, ids, inner, outer) {
    var tree = ML.reconcile(null, ids, { area: area, inner: inner, outer: outer });
    var solved = ML.solve(tree, area, inner, outer, 200, 120, null, ids);
    solved.cells.forEach(function (c, i) {
        assert(inside(c.rect, area), label + " cell " + i + " outside " + JSON.stringify(c.rect));
    });
    for (var i = 0; i < solved.cells.length; i++) {
        for (var j = i + 1; j < solved.cells.length; j++) {
            assert(!overlaps(solved.cells[i].rect, solved.cells[j].rect), label + " overlap " + i + " " + j);
        }
    }
    return { tree: tree, solved: solved };
}

var hd = { x: 0, y: 0, width: 1920, height: 1040 };
[1, 2, 3, 4, 6, 8, 12].forEach(function (n) {
    var ids = [];
    for (var i = 0; i < n; i++) ids.push("w" + i);
    audit("1080 n" + n, hd, ids, 8, 8);
});

var panels = { x: 0, y: 28, width: 1920, height: 1080 - 28 - 48 };
audit("1080 panels", panels, ["a", "b", "c", "d", "e"], 30, 30);
audit("gaps 64", hd, ["a", "b", "c", "d"], 64, 64);
audit("tiny", { x: 10, y: 10, width: 400, height: 80 }, ["a", "b", "c"], 30, 30);

// Toggle split sticks, and does not depend on aspect.
var tree = ML.reconcile(null, ["a", "b"], { area: hd, inner: 8, outer: 8 });
var before = tree.horizontal;
var flipped = ML.toggleSplit(tree, "b");
assert(flipped.horizontal !== before, "toggle split flips parent");
var laid = ML.layoutTree(flipped, hd, 8, 8);
assert(laid.length === 2, "two cells after flip");
var again = ML.layoutTree(flipped, { x: 0, y: 0, width: 800, height: 2000 }, 8, 8);
assert(again.length === 2, "flip survives a tall area");
assert(ML.toggleSplit(flipped, "b").horizontal === before, "toggle split is reversible");

// Resize width does not move a vertical-only tree's height ratio blindly.
var wide = ML.resizeAlong(tree, "a", "h", 0.1);
if (tree.horizontal) {
    assert(wide && wide.ratio > tree.ratio, "grow width increases root ratio when split is horizontal");
} else {
    assert(wide === null || wide.ratio === tree.ratio, "no horizontal ancestor means no width change at root");
}

// Closing the first leaf keeps the sibling subtree.
var three = ML.reconcile(null, ["a", "b", "c"], { area: hd, inner: 8, outer: 8 });
var rest = ML.removeId(three, "a");
assert(ML.inOrder(rest).indexOf("a") === -1, "removed a");
assert(ML.inOrder(rest).length === 2, "two leaves remain");

// Directional focus.
var cells = ML.layoutTree(three, hd, 8, 8);
var from = cells[0].rect;
var cands = cells.map(function (c) { return { id: c.id, rect: c.rect }; });
var right = ML.focusDirection(from, cands, "right");
assert(right && right !== cells[0].id, "focus right leaves the origin window");

// Clamp a frame that hangs off a 1080p work area.
var clamped = ML.clampOrigin({ x: 1800, y: 900, width: 400, height: 300 }, hd);
assert(clamped.x + clamped.width <= hd.width + 0.5, "clamped right edge");
assert(clamped.y + clamped.height <= hd.height + 0.5, "clamped bottom edge");
var pinned = ML.clampOrigin({ x: 100, y: 100, width: 2000, height: 1200 }, hd);
assert(pinned.x === 0 && pinned.y === 0, "oversized frame pins to the origin");

// Overflow parking stays on screen.
for (var k = 0; k < 6; k++) {
    var park = ML.cascadeRect(hd, k, 60);
    assert(inside(park, hd), "cascade " + k);
}

// Minimum sizes drop extras instead of drawing slivers, and gaps shrink first.
var many = [];
for (var m = 0; m < 10; m++) many.push("m" + m);
var bigTree = ML.reconcile(null, many, { area: hd, inner: 48, outer: 48 });
var solved = ML.solve(bigTree, hd, 48, 48, 400, 300, null, many);
assert(solved.cells.length >= 1, "at least one cell");
solved.cells.forEach(function (c) { assert(inside(c.rect, hd), "min-size cell inside"); });
assert(solved.overflow.length + solved.cells.length === 10, "everyone is placed or parked");

assert(ML.DEFAULT_KEYS.keyToggleFloat === "<Super>t", "float is Super+T");
assert(ML.DEFAULT_KEYS.keyFullscreen === "<Super>f", "fullscreen is Super+F");
assert(ML.DEFAULT_KEYS.keyToggleSplit === "<Super>j", "toggle split is Super+J");
assert(ML.DEFAULT_KEYS.keyPseudo === "<Super><Shift>p", "pseudotile leaves Super+P to Cinnamon");
assert(ML.DEFAULT_KEYS.keyPop === "<Super><Shift>o", "pop-out leaves Super+O to Cinnamon");
assert(ML.DEFAULT_KEYS.keyResetSizes === "<Super><Control>equal", "even sizes leaves the magnifier chord");
assert(ML.DEFAULT_KEYS.keyCheatSheet === "<Super><Control>slash", "cheat sheet is Ctrl+Super+/");
assert(ML.DEFAULT_KEYS.keyFocusLeft === "<Super><Control>Left", "focus leaves Super+arrows to Cinnamon");
assert(!ML.DEFAULT_KEYS.keyFocusNext, "there is no focus-next binding");
assert(!ML.PRESETS, "there is one key set, not a classic preset");

// Serialize round-trip keeps orientation.
var dumped = ML.serialize(flipped);
var restored = ML.assignLeaves(dumped, ML.inOrder(flipped));
assert(restored.horizontal === flipped.horizontal, "round trip keeps split direction");
assert(ML.inOrder(restored).join() === ML.inOrder(flipped).join(), "round trip keeps order");

if (failed) {
    console.error(failed + " failed");
    process.exit(1);
}
console.log("ok");
