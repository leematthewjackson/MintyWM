// MintyWM - Dynamic Tiling Window Management for Cinnamon
// By Lee Matthew Jackson - leematthewjackson.com - @leematthewjackson@mastodon.social
//
// Copyright (C) 2026 Lee Matthew Jackson
// SPDX-License-Identifier: GPL-3.0-or-later
//
// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later version.
// It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
// PURPOSE. See the GNU General Public License (the LICENSE file) for details.
//
//
// Hyprland-style dwindle auto-tiling:
//   - each workspace keeps a real split tree (orientation + ratio stick)
//   - one key set, Hyprland / Omarchy shaped. Remap any of them in the settings
//   - Ctrl+Super+arrows move focus, Ctrl+Super+Shift+arrows swap
//     (Super+arrows stays with Cinnamon's own snapping)
//   - Super+T float, Super+F fullscreen, Super+J togglesplit, Ctrl+Super+/ cheat sheet
//   - Windows that do not fit are parked on screen, never left past the edge
//   - Super+Shift+P pseudotile, Super+Shift+O pop-out (bare Super+P / Super+O
//     belong to Cinnamon: monitors and orientation lock)
// Settings: System Settings > Extensions > MintyWM > the gear button. Changes apply live.
// The values in CONFIG below are the defaults (they must match settings-schema.json);
// they are overwritten by whatever is saved in the settings.
// Something not tiling? In Looking Glass (Alt+F2, lg) run  global.mintywm.dump()  to see why.

const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;

const UUID = "mintywm@leematthewjackson";
let ML = null;

function loadLayout(path) {
    if (ML) return ML;
    imports.searchPath.unshift(path);
    ML = imports.mintyLayout.MintyLayout;
    return ML;
}

const CONFIG = {
    keyToggleTiling: "<Super><Control>t",
    keyToggleFloat: "<Super>t",
    keyRetile: "<Super><Shift>r",
    keyAlwaysFloat: "<Super><Shift>t",
    keyToggleWorkspace: "<Super><Alt>t",
    keyResetSizes: "<Super><Control>equal",
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
    keyCheatSheet: "<Super><Control>slash",
    resizeStep: 5,     // % of the space a grow/shrink key press moves a divider
    // Legacy positional ratios, kept so an upgrade can seed the split tree once.
    splitRatios: {},
    // Split trees, per workspace and monitor. Leaves carry no window id; they are
    // zipped back onto the current windows when the counts still match.
    layoutTrees: {},
    noTileWorkspaces: "",    // workspace numbers where tiling is off, e.g. "4, 9" or "7-9"
    // Optional. Off so Grouped window list keeps Super+1..9 unless you ask.
    superNumWorkspaces: false,
    innerGap: 8,     // pixels between windows
    outerGap: 8,     // pixels between windows and screen/panel edges
    minTileWidth: 200,   // never make a tile smaller than this; extra windows are left alone
    minTileHeight: 120,  // (set both to 0 to tile without limit)
    floatSizePercent: 60,    // size of a window you float when it has no sensible old size
    floatOnTop: true,        // keep floating windows above the tiled ones
    settleMs: 100,   // quiet time after the last event before re-tiling (trailing debounce)
    settleMaxMs: 400, // ...but never wait longer than this during a constant stream of events
    notify: true,    // show a notification when toggling
    debug: false,    // log why each window is (not) tiled after every layout pass
    // Apps that open floating. wmclass: the window class (case ignored; * matches anything).
    // title: optional; only windows whose title contains this text. enabled: false = ignored.
    floatRules: [
        { enabled: true, wmclass: "cinnamon-settings*", title: "" },   // Cinnamon Settings and its pages
        { enabled: true, wmclass: "xlet-settings*", title: "" },       // applet / extension / desklet settings
        { enabled: true, wmclass: "fontforge*", title: "" },           // font editor: many small tool windows
        { enabled: true, wmclass: "gnome-font-viewer*", title: "" },   // font preview
        { enabled: true, wmclass: "copyq*", title: "" },               // clipboard manager
    ],
    // Borders. Sizes are in px and are multiplied by Cinnamon's UI scale.
    borders: true,
    focusColor: "rgb(0,255,204)",   // focused window
    floatColor: "rgb(255,0,255)",   // floating window
    borderWidth: 2,
    cornerRadius: 8,         // your theme's window corner radius (the border follows it)
    cornerEach: true,        // true = use the four values below instead of cornerRadius
    radiusTopLeft: 11,       // rounded top corners, square bottom ones: how most themes draw windows
    radiusTopRight: 11,
    radiusBottomLeft: 0,
    radiusBottomRight: 0,
};

const HK_TILING = "mintywm-toggle-tiling";
const HK_FLOAT = "mintywm-toggle-float";
const HK_RETILE = "mintywm-retile";
const HK_RULE = "mintywm-always-float";
const HK_WS = "mintywm-toggle-workspace";
const HK_RESET = "mintywm-reset-sizes";

const KEY_IDS = [
    "keyToggleTiling", "keyToggleFloat", "keyRetile", "keyAlwaysFloat", "keyToggleWorkspace",
    "keyResetSizes", "keyPop", "keyFullscreen", "keyMaximize",
    "keyMonocle", "keyToggleSplit", "keyPseudo", "keyClose", "keyFocusLeft", "keyFocusRight",
    "keyFocusUp", "keyFocusDown", "keySwapLeft", "keySwapRight", "keySwapUp", "keySwapDown",
    "keyGrowWidth", "keyShrinkWidth", "keyGrowHeight", "keyShrinkHeight", "keyCheatSheet",
];

// Removed from the settings. Still cleared so a reload does not leave the old hotkey.
const RETIRED_KEYS = [
    "keyFocusNext", "keyFocusPrev", "keySwapNext", "keySwapPrev",
    "keyMakeFirst", "keyGrow", "keyShrink",
];

const NO_MARKS = { focus: false, float: false };

// The applet and the extension share a set of change callbacks on `global`.
function isListenerSet(s) {
    return !!s && typeof s.add === "function" && typeof s.delete === "function" && typeof s[Symbol.iterator] === "function";
}

// Geometry lives in mintyLayout.js (node-tested). What stays here is the
// window-matching and the workspace-list parsing, which talk to settings text.


// Case-insensitive match where * stands for any text. An empty pattern matches nothing.
// Compiled patterns are cached; call clearGlobCache() when the rules change.
const GLOB_CACHE = new Map();

function clearGlobCache() {
    GLOB_CACHE.clear();
}

function globMatch(pattern, text) {
    const p = String(pattern || "").trim().toLowerCase();
    if (!p) return false;
    let re = GLOB_CACHE.get(p);
    if (!re) {
        if (GLOB_CACHE.size > 200) GLOB_CACHE.clear();
        re = new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
        GLOB_CACHE.set(p, re);
    }
    return re.test(String(text || "").toLowerCase());
}

// Should a window with this class / instance / title open floating?
//   true  = an enabled rule matches        false = nothing matches
//   null  = can't tell yet (no class known yet, or a rule is waiting for the title)
function floatRuleDecision(rules, cls, inst, title) {
    if (!cls && !inst) return null;
    let waiting = false;
    for (const r of (rules || [])) {
        if (!r || r.enabled === false) continue;
        if (!(globMatch(r.wmclass, cls) || globMatch(r.wmclass, inst))) continue;
        const want = String(r.title || "").trim().toLowerCase();
        if (!want) return true;
        if (!title) { waiting = true; continue; }
        if (String(title).toLowerCase().includes(want)) return true;
    }
    return waiting ? null : false;
}

// "4, 9" or "7-9" or "2 4-6" -> Set of workspace numbers (1-based). Garbage is ignored.
function parseWorkspaceList(text) {
    const out = new Set();
    const clean = String(text || "").replace(/\s*-\s*/g, "-");
    for (const part of clean.split(/[\s,;]+/)) {
        const m = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(part);
        if (!m) continue;
        let a = parseInt(m[1], 10);
        let b = m[2] === undefined ? a : parseInt(m[2], 10);
        if (a > b) { const t = a; a = b; b = t; }
        for (let i = Math.max(a, 1); i <= Math.min(b, 99); i++) out.add(i);
    }
    return out;
}

// The reverse: a tidy string, with runs of three or more collapsed ("7-9").
function formatWorkspaceList(set) {
    const nums = [...set].filter((n) => n >= 1).sort((x, y) => x - y);
    const parts = [];
    let i = 0;
    while (i < nums.length) {
        let j = i;
        while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
        if (j - i >= 2) parts.push(nums[i] + "-" + nums[j]);
        else for (let k = i; k <= j; k++) parts.push(String(nums[k]));
        i = j + 1;
    }
    return parts.join(", ");
}

// Workspace number `removed` (1-based) was deleted and `count` workspaces are left.
// The ones after it move down by one, so the list follows them. Numbers for
// workspaces that never existed are kept as they are. Returns null when nothing
// changes (the last workspace was removed, i.e. the workspace count was lowered).
function shiftWorkspaceList(set, removed, count) {
    if (removed > count) return null;
    const out = new Set();
    for (const k of set) {
        if (k === removed) continue;
        out.add(k > removed && k <= count + 1 ? k - 1 : k);
    }
    return out;
}

// "<Super><Alt>t" -> "Super+Alt+T" (only the first binding, if there are several).
function keyLabel(binding) {
    const first = String(binding || "").split("::")[0];
    if (!first) return "";
    const key = first.replace(/<[^>]*>/g, "");
    const mods = (first.match(/<([^>]*)>/g) || []).map((m) => m.slice(1, -1));
    return mods.concat(key.length === 1 ? key.toUpperCase() : key).join("+");
}
// --- layout:end

class MintyWM {
    constructor() {
        this._order = [];            // every window we know about, in arrival order
        this._known = new Set();     // the same windows, for quick lookups
        this._watching = new Map();  // non-normal windows we watch in case they become normal -> [signalId]
        this._floating = new Set();  // windows the user floated
        this._saved = new Map();     // window -> its geometry from before we first tiled it
        this._tilingOn = true;
        this._conns = [];            // [object, signalId] pairs to undo on disable
        this._winConns = new Map();  // window -> [signalId]
        this._timers = new Set();
        this._settleId = 0;
        this._settleSince = 0;
        this._afterId = 0;           // the check that runs once the windows have really moved
        this._lookId = 0;
        this._stuckId = 0;           // the check for window pictures drawn in the wrong place
        this._targets = new Map();   // window -> { x, y, tries }: where the last pass put it
        this._minSize = new Map();   // window -> { w, h }: it refused to be made smaller than this
        this._overflow = new Set();  // eligible windows that did not fit, parked back on screen
        this._trees = {};            // "workspace:monitor" -> split tree
        this._treeSaveId = 0;
        this._usedSave = {};         // saved tree applied at most once per key per session
        this._reinsert = new Set();  // windows that should rejoin the tree as the newest leaf
        this._modes = {};            // "workspace:monitor" -> "monocle" | "max" | absent
        this._wids = new Map();      // window -> stable id for this session
        this._widNext = 1;
        this._cells = new Map();     // window -> { key, area, rect, chain, id }
        this._hidden = new Set();    // actors hidden by monocle / maximize
        this._cheat = null;
        this._cheatKey = 0;
        this._writingKeys = false;
        this._borders = new Map();      // window -> { box, parent, sig, style, shown }
        this._lastFocus = null;
        this._settings = null;
        this._ruled = new Set();        // windows floating because of a rule
        this._userTouched = new Set();  // windows the user floated/tiled by hand: rules leave them alone
        this._decided = new Set();      // windows whose rule check is done
        this._above = new Set();        // windows WE pinned on top (never touch ones the user pinned)
        this._noTile = new Set();       // workspace numbers (1-based) where tiling is off
        this._lastDump = "";
        this._wayland = false;
        this._wsKeyWarned = false;   // one notice if Super+1..9 are still taken
    }

    enable() {
        try {
            this._wayland = typeof Meta.is_wayland_compositor === "function" && Meta.is_wayland_compositor();
        } catch (e) {}
        this._bindSettings();
        this._noTile = parseWorkspaceList(CONFIG.noTileWorkspaces);
        this._connect(global.display, "window-created", (display, win) => {
            if (this._consider(win)) this._settle();
        });
        // Only our own windows matter: menus, tooltips and popups map and unmap all the time.
        for (const sig of ["map", "minimize", "unminimize"]) {
            this._connect(global.window_manager, sig, (wm, actor) => {
                let win = null;
                try { win = actor ? actor.meta_window : null; } catch (e) {}
                if (win && this._known.has(win)) this._settle();
            });
        }
        this._connect(global.window_manager, "switch-workspace", () => this._settle());
        this._connect(Main.layoutManager, "monitors-changed", () => {
            this._minSize.clear();   // a minimum learned on another screen does not apply here
            this._settle();
            // Panels and work areas can take a moment to settle after a monitor change
            // or a resume, so lay out once more a little later.
            this._later(1000, () => this._settle());
        });
        this._connect(global.display, "workareas-changed", () => {
            this._minSize.clear();
            this._settle();
        }, true);
        this._connect(global.display, "grab-op-begin", () => this._targets.clear(), true);
        this._connect(global.display, "grab-op-end", (...args) => this._onGrabEnd(args), true);
        this._connect(global.workspace_manager, "workspace-removed",
            (wm, index) => this._onWorkspaceRemoved(index), true);
        this._connect(global.display, "notify::focus-window", () => this._onFocus());

        // Read-only view for the status applet (it lives in the same process).
        const self = this;
        global.mintywm = {
            // on: is tiling active on the workspace you are looking at?
            get on() { return self._tilingHere(global.workspace_manager.get_active_workspace()); },
            get globalOn() { return self._tilingOn; },
            get workspace() { return self._workspaceNumber(); },
            get tiled() { return self._counts().tiled; },
            get floating() { return self._counts().floating; },
            // Everything above in one go (one pass over the windows).
            state() { return self._state(); },
            keys() { return self._keyRows(); },
            showCheat() { self._toggleCheat(); },
            toggleTiling() { self.toggleTiling(); },
            toggleWorkspace() { self.toggleWorkspace(); },
            retile() { self.retile(); },
            resetSizes() { self.resetSizes(); },
            // Older applets: un-pause tiling if it is paused everywhere, otherwise flip it
            // for this workspace.
            toggle() { if (!self._tilingOn) self.toggleTiling(); else self.toggleWorkspace(); },
            // Why is each window tiled or not? Written to the log and returned as text.
            dump() { const text = self._dump(); global.log(text); return text; },
        };
        // The applet adds a callback here and we call it whenever something changes.
        // The set outlives the extension, so the applet can be loaded before or after us.
        if (!isListenerSet(global.mintywmListeners)) global.mintywmListeners = new Set();

        this._bindKeys();

        for (const actor of global.get_window_actors()) this._consider(actor.meta_window);
        this._lastFocus = global.display.focus_window;
        this._migrateSavedKeys();
        this._retile();
    }

    disable() {
        for (const id of KEY_IDS.concat(RETIRED_KEYS)) {
            try { Main.keybindingManager.removeHotKey("mintywm-" + id); } catch (e) {}
        }
        this._unbindWorkspaceKeys();
        this._hideCheat();
        this._unhideAll();
        if (this._settings) {
            try { this._settings.finalize(); } catch (e) {}
            this._settings = null;
        }
        for (const [obj, id] of this._conns) {
            try { obj.disconnect(id); } catch (e) {}
        }
        for (const map of [this._winConns, this._watching]) {
            for (const [win, ids] of map) {
                for (const id of ids) {
                    try { win.disconnect(id); } catch (e) {}
                }
            }
        }
        for (const id of this._timers) {
            try { Mainloop.source_remove(id); } catch (e) {}
        }
        for (const win of [...this._borders.keys()]) this._dropBorder(win);
        for (const win of [...this._above]) this._setAbove(win, false);
        this._above.clear();
        this._noTile = new Set();
        try { delete global.mintywm; } catch (e) { global.mintywm = undefined; }
        this._conns = [];
        this._winConns.clear();
        this._watching.clear();
        this._timers.clear();
        this._order = [];
        this._known.clear();
        this._floating.clear();
        this._saved.clear();
        this._ruled.clear();
        this._userTouched.clear();
        this._decided.clear();
        this._targets.clear();
        this._minSize.clear();
        this._overflow.clear();
        this._cells.clear();
        if (this._treeSaveId) this._saveTreesNow();
        this._trees = {};
        this._treeSaveId = 0;
        this._modes = {};
        this._hidden.clear();
        this._settleId = 0;
        this._settleSince = 0;
        this._afterId = 0;
        this._lookId = 0;
        this._stuckId = 0;
        this._lastFocus = null;
        this._changed();   // the applet now shows that the extension is off
    }

    // ----- settings --------------------------------------------------------

    // Bind the saved settings straight onto CONFIG, so the rest of the code just reads
    // CONFIG. If the settings system is unavailable for any reason, the defaults stay.
    _bindSettings() {
        const KEYS = KEY_IDS;
        const LOOK = ["innerGap", "outerGap", "minTileWidth", "minTileHeight", "floatSizePercent", "floatOnTop",
                      "borders", "focusColor", "floatColor", "borderWidth", "cornerRadius",
                      "cornerEach", "radiusTopLeft", "radiusTopRight", "radiusBottomLeft", "radiusBottomRight"];
        try {
            this._settings = new Settings.ExtensionSettings(CONFIG, UUID);
            const dir = Settings.BindingDirection.IN;
            for (const k of KEYS) this._settings.bindProperty(dir, k, k, () => this._onKeyChanged(), null);
            for (const k of LOOK) this._settings.bindProperty(dir, k, k, () => this._onLookChanged(), null);
            this._settings.bindProperty(dir, "notify", "notify", null, null);
            this._settings.bindProperty(dir, "resizeStep", "resizeStep", null, null);
            this._settings.bindProperty(dir, "splitRatios", "splitRatios", null, null);
            this._settings.bindProperty(dir, "layoutTrees", "layoutTrees", () => this._settle(), null);
            this._settings.bindProperty(dir, "debug", "debug", () => { this._lastDump = ""; this._debugLog(); }, null);
            this._settings.bindProperty(dir, "floatRules", "floatRules", () => this._reapplyRules(), null);
            this._settings.bindProperty(dir, "noTileWorkspaces", "noTileWorkspaces", () => this._onWorkspacesChanged(), null);
            this._settings.bindProperty(dir, "superNumWorkspaces", "superNumWorkspaces", () => this._onKeyChanged(), null);
        } catch (e) {
            global.logError(e);
        }
    }

    _onKeyChanged() {
        if (this._writingKeys) return;
        this._bindKeys();
    }

    // Earlier test builds used Super+arrows, then a separate Classic set.
    // If a saved binding is still exactly one of those, move it to the current default.
    // A binding you changed yourself is left alone.
    _migrateSavedKeys() {
        const legacy = {
            keyToggleTiling: "<Super>t",
            keyToggleFloat: "<Super>f",
            keyAlwaysFloat: "<Super><Shift>f",
            keyFullscreen: "<Super><Control>f",
            keyMonocle: "<Super><Control><Alt>f",
            keyToggleSplit: "<Super><Control>j",
            keyGrowWidth: "<Super><Control>l",
            keyShrinkWidth: "<Super><Control>h",
            keyGrowHeight: "<Super><Control><Shift>l",
            keyShrinkHeight: "<Super><Control><Shift>h",
            keyResetSizes: "<Super>equal",
            keyRetile: "<Super><Shift>t",
            keyCheatSheet: "<Super>slash",
            keyFocusLeft: "<Super>Left",
            keyFocusRight: "<Super>Right",
            keyFocusUp: "<Super>Up",
            keyFocusDown: "<Super>Down",
            keySwapLeft: "<Super><Shift>Left",
            keySwapRight: "<Super><Shift>Right",
            keySwapUp: "<Super><Shift>Up",
            keySwapDown: "<Super><Shift>Down",
        };
        const want = ML && ML.DEFAULT_KEYS;
        if (!this._settings || !want) return;
        const oldCheat = { "<Super>k": true, "<Super>slash": true, "<Super>question": true };
        // 0.10 shipped these. Cinnamon already owns them, so an untouched copy
        // moves to the 1.1 default. A binding you chose yourself is left alone.
        const clashes = {
            keyPop: "<Super>o",                 // orientation lock
            keyPseudo: "<Super>p",              // switch monitor configurations
            keyResetSizes: "<Super><Alt>equal", // magnifier zoom in
        };
        let changed = false;
        this._writingKeys = true;
        try {
            for (const key of KEY_IDS) {
                if (key === "keyCheatSheet") {
                    if (!oldCheat[CONFIG.keyCheatSheet] || CONFIG.keyCheatSheet === want.keyCheatSheet) continue;
                } else if (!Object.prototype.hasOwnProperty.call(legacy, key) || CONFIG[key] !== legacy[key] || legacy[key] === want[key]) {
                    continue;
                }
                this._settings.setValue(key, want[key]);
                CONFIG[key] = want[key];
                changed = true;
            }
            for (const key of Object.keys(clashes)) {
                if (CONFIG[key] !== clashes[key] || clashes[key] === want[key]) continue;
                this._settings.setValue(key, want[key]);
                CONFIG[key] = want[key];
                changed = true;
            }
        } catch (e) {
            global.logError(e);
        }
        this._writingKeys = false;
        if (changed) this._bindKeys();
    }

    // (Re)register every hotkey from CONFIG. Safe to call repeatedly.
    _bindKeys() {
        const fns = {
            keyToggleTiling: () => this.toggleTiling(),
            keyToggleFloat: () => this.toggleFloat(),
            keyRetile: () => this.retile(),
            keyAlwaysFloat: () => this.alwaysFloat(),
            keyToggleWorkspace: () => this.toggleWorkspace(),
            keyResetSizes: () => this.resetSizes(),
            keyPop: () => this.popWindow(),
            keyFullscreen: () => this.toggleFullscreen(),
            keyMaximize: () => this.toggleMode("max"),
            keyMonocle: () => this.toggleMode("monocle"),
            keyToggleSplit: () => this.toggleSplit(),
            keyPseudo: () => this.togglePseudo(),
            keyClose: () => this.closeWindow(),
            keyFocusLeft: () => this.focusDir("left"),
            keyFocusRight: () => this.focusDir("right"),
            keyFocusUp: () => this.focusDir("up"),
            keyFocusDown: () => this.focusDir("down"),
            keySwapLeft: () => this.swapDir("left"),
            keySwapRight: () => this.swapDir("right"),
            keySwapUp: () => this.swapDir("up"),
            keySwapDown: () => this.swapDir("down"),
            keyGrowWidth: () => this.resizeAxis("h", 1),
            keyShrinkWidth: () => this.resizeAxis("h", -1),
            keyGrowHeight: () => this.resizeAxis("v", 1),
            keyShrinkHeight: () => this.resizeAxis("v", -1),
            keyCheatSheet: () => this._toggleCheat(),
        };
        for (const old of RETIRED_KEYS) {
            try { Main.keybindingManager.removeHotKey("mintywm-" + old); } catch (e) {}
        }
        for (const key of KEY_IDS) {
            const name = "mintywm-" + key;
            try { Main.keybindingManager.removeHotKey(name); } catch (e) {}
            const binding = CONFIG[key];
            const fn = fns[key];
            if (!binding || !fn) continue;   // cleared, or not an action: leave it unbound
            try {
                if (Main.keybindingManager.addHotKey(name, binding, fn) === false) {
                    global.logWarning("MintyWM: could not bind " + binding + " (" + key + "); is it used by something else?");
                }
            } catch (e) {
                global.logError(e);
            }
        }
        this._bindWorkspaceKeys();
    }

    _unbindWorkspaceKeys() {
        for (let n = 1; n <= 9; n++) {
            try { Main.keybindingManager.removeHotKey("mintywm-ws-" + n); } catch (e) {}
        }
    }

    // Super+1..9, only while the switch is on. Grouped window list owns them
    // by default, so a refused bind is reported once instead of on every key.
    _bindWorkspaceKeys() {
        this._unbindWorkspaceKeys();
        if (!CONFIG.superNumWorkspaces) {
            this._wsKeyWarned = false;
            return;
        }
        let refused = 0;
        for (let n = 1; n <= 9; n++) {
            const number = n;
            try {
                const ok = Main.keybindingManager.addHotKey("mintywm-ws-" + number, "<Super>" + number, () => this._goWorkspace(number));
                if (ok === false) refused++;
            } catch (e) {
                refused++;
                global.logError(e);
            }
        }
        if (!refused) {
            this._wsKeyWarned = false;
            return;
        }
        global.logWarning("MintyWM: could not bind Super+1-9 (" + refused + " refused). Grouped window list may still own them.");
        if (this._wsKeyWarned) return;
        this._wsKeyWarned = true;
        this._say("Super+1-9 are still used by Grouped window list. Turn off its Super+number shortcut, then restart Cinnamon (Alt+F2, r).");
    }

    // Switch to workspace n as Cinnamon numbers them. Do not create one.
    _goWorkspace(n) {
        let count = 0;
        try { count = global.workspace_manager.get_n_workspaces(); } catch (e) { return; }
        if (n < 1 || n > count) {
            this._say("No workspace " + n + (count ? ". You have " + count + "." : "."));
            return;
        }
        try {
            const ws = global.workspace_manager.get_workspace_by_index(n - 1);
            if (!ws) {
                this._say("No workspace " + n + ".");
                return;
            }
            ws.activate(global.get_current_time());
        } catch (e) {
            global.logError(e);
        }
    }

    // A gap, size or border setting changed: rebuild the borders and re-tile.
    // Several settings can arrive at once, so wait a moment and do it once. The border
    // actors are thrown away and made again, so no old style can survive the change.
    _onLookChanged() {
        if (this._lookId) this._cancel(this._lookId);
        this._lookId = this._later(30, () => {
            this._lookId = 0;
            for (const win of [...this._borders.keys()]) this._dropBorder(win);
            this._retile();
        });
    }

    // ----- hotkeys ---------------------------------------------------------

    toggleTiling() {
        this._tilingOn = !this._tilingOn;
        if (!this._tilingOn) {
            this._say("Tiling paused everywhere");
        } else {
            const n = this._workspaceNumber();
            if (this._noTile.has(n)) {
                const key = keyLabel(CONFIG.keyToggleWorkspace);
                this._say("Tiling on, but not on workspace " + n + ": it is on the excluded list." +
                    (key ? " Press " + key + " to tile it." : ""));
            } else {
                this._say("Tiling on");
            }
        }
        this._retile();   // when tiling is off this just clears the markers
    }

    // ----- per-workspace switch --------------------------------------------

    _workspaceNumber() {
        return global.workspace_manager.get_active_workspace().index() + 1;
    }

    // Is tiling active on this workspace? (on globally, and the workspace is not in the list)
    _tilingHere(workspace) {
        if (!this._tilingOn) return false;
        try {
            return !(workspace && this._noTile.has(workspace.index() + 1));
        } catch (e) {
            return true;
        }
    }

    // Same question for a window (windows on every workspace follow the global switch only).
    _tilingForWindow(win) {
        if (!this._tilingOn) return false;
        try {
            const ws = typeof win.get_workspace === "function" ? win.get_workspace() : null;
            return !(ws && this._noTile.has(ws.index() + 1));
        } catch (e) {
            return true;
        }
    }

    _saveNoTile(set) {
        this._noTile = set;
        CONFIG.noTileWorkspaces = formatWorkspaceList(set);
        if (this._settings) {
            try { this._settings.setValue("noTileWorkspaces", CONFIG.noTileWorkspaces); } catch (e) { global.logError(e); }
        }
    }

    // The list was edited in the settings.
    _onWorkspacesChanged() {
        this._noTile = parseWorkspaceList(CONFIG.noTileWorkspaces);
        this._retile();
    }

    // A workspace was deleted: the ones after it are renumbered, so the list follows them.
    _onWorkspaceRemoved(index) {
        if (typeof index !== "number") return;
        const count = global.workspace_manager.get_n_workspaces();
        let changed = false;
        if (this._noTile.size) {
            const next = shiftWorkspaceList(this._noTile, index + 1, count);
            if (next) { this._saveNoTile(next); changed = true; }
        }
        if (Object.keys(this._trees).length) {
            const next = ML.shiftKeyMap(this._trees, index + 1, count);
            if (next) { this._trees = next; this._saveTreesNow(); changed = true; }
        }
        if (Object.keys(this._modes).length) {
            const next = ML.shiftKeyMap(this._modes, index + 1, count);
            if (next) { this._modes = next; changed = true; }
        }
        if (changed) this._settle();
    }

    // Super+Alt+T: tiling on/off for the workspace you are on. The list in the settings follows.
    toggleWorkspace() {
        const n = this._workspaceNumber();
        const set = new Set(this._noTile);
        if (!this._tilingOn) {
            // paused everywhere: this key means "I want tiling here"
            this._tilingOn = true;
            set.delete(n);
            this._say("Tiling on (workspace " + n + ")");
        } else if (set.has(n)) {
            set.delete(n);
            this._say("Tiling on for workspace " + n);
        } else {
            set.add(n);
            this._say("Tiling off on workspace " + n);
        }
        this._saveNoTile(set);
        this._retile();
    }

    retile() {
        this._tilingOn = true;   // also switches tiling back on if it was off
        const n = this._workspaceNumber();
        if (this._noTile.has(n)) {   // ...and on for this workspace
            const set = new Set(this._noTile);
            set.delete(n);
            this._saveNoTile(set);
        }
        this._minSize.clear();   // measure every window's smallest size again
        this._retile();
        // Re-send every window's size, even ones already in place: this is what un-sticks
        // a window whose picture is drawn somewhere else (see _pictureOff).
        // Terminals snap to a character cell, so a 1px nudge can grow them off the screen.
        for (const win of this._visibleHere()) {
            if (!this._isTerminal(win)) this._nudge(win);
        }
        this._stuckCheck(1);
        this._say("Re-tiled");
    }

    toggleFloat() {
        const win = global.display.focus_window;
        if (!win || !this._known.has(win)) return;
        this._userTouched.add(win);    // from now on this window ignores the floating-apps list
        this._ruled.delete(win);
        if (this._floating.has(win)) {
            this._floating.delete(win);
            this._bump(win);           // rejoins the layout as the newest window
            this._say("Tiled");
        } else {
            this._floating.add(win);
            this._restoreFloat(win);   // give it back a sensible size and place
            this._say("Floating");
        }
        this._retile();
    }

    // When a window is floated, put it back where it was before we tiled it.
    // If that was (nearly) full screen, or unknown, use a centred window instead.
    _restoreFloat(win) {
        try {
            const workspace = global.workspace_manager.get_active_workspace();
            const area = this._workArea(workspace, win.get_monitor(), win);
            const saved = this._saved.get(win);
            this._saved.delete(win);   // re-captured the next time it is tiled
            const big = !saved || (saved.width > 0.8 * area.width && saved.height > 0.8 * area.height);
            let x, y, w, h;
            if (big) {
                w = Math.round(area.width * (CONFIG.floatSizePercent / 100));
                h = Math.round(area.height * (CONFIG.floatSizePercent / 100));
                x = area.x + Math.round((area.width - w) / 2);
                y = area.y + Math.round((area.height - h) / 2);
            } else {
                w = Math.min(saved.width, area.width);
                h = Math.min(saved.height, area.height);
                x = Math.max(area.x, Math.min(saved.x, area.x + area.width - w));
                y = Math.max(area.y, Math.min(saved.y, area.y + area.height - h));
            }
            win.move_resize_frame(true, x, y, w, h);
        } catch (e) {
            global.logError(e);
        }
    }

    // ----- split tree -------------------------------------------------------

    _wid(win) {
        let id = this._wids.get(win);
        if (!id) {
            id = "w" + this._widNext++;
            this._wids.set(win, id);
        }
        return id;
    }

    _keyFor(win) {
        const ws = global.workspace_manager.get_active_workspace();
        return (ws.index() + 1) + ":" + win.get_monitor();
    }

    _placedIds(win) {
        if (!win || !ML || !this._known.has(win) || this._floating.has(win)) return null;
        const info = this._cells.get(win);
        const key = info ? info.key : this._keyFor(win);
        const tree = this._trees[key];
        if (!tree) return null;
        return { key, tree, id: this._wid(win), ids: ML.inOrder(tree), area: info ? info.area : null };
    }

    _saveTreesSoon() {
        if (this._treeSaveId) this._cancel(this._treeSaveId);
        this._treeSaveId = this._later(500, () => this._saveTreesNow());
    }

    _saveTreesNow() {
        if (this._treeSaveId) this._cancel(this._treeSaveId);
        this._treeSaveId = 0;
        const out = {};
        for (const key of Object.keys(this._trees)) {
            const dumped = ML.serialize(this._trees[key]);
            if (dumped) out[key] = dumped;
        }
        CONFIG.layoutTrees = out;
        if (this._settings) {
            try { this._settings.setValue("layoutTrees", out); } catch (e) { global.logError(e); }
        }
    }

    _treeFits(tree, area) {
        if (!tree || !area || !ML) return true;
        const mins = {};
        for (const [win, size] of this._minSize) mins[this._wid(win)] = size;
        return ML.layoutTree(tree, area, CONFIG.innerGap, CONFIG.outerGap).every((c) => {
            const own = mins[c.id];
            const w = Math.max(CONFIG.minTileWidth, own && own.w ? own.w : 0);
            const h = Math.max(CONFIG.minTileHeight, own && own.h ? own.h : 0);
            return c.rect.width + 0.5 >= w && c.rect.height + 0.5 >= h;
        });
    }

    _step() {
        return Math.max(1, Math.min(25, Number(CONFIG.resizeStep) || 5)) / 100;
    }

    // Super+= / Super+- : one axis, whichever split actually controls it.
    resizeAxis(axis, dir) {
        const win = global.display.focus_window;
        const placed = this._placedIds(win);
        if (!placed || placed.ids.length < 2) return;
        const next = ML.resizeAlong(placed.tree, placed.id, axis, dir * this._step());
        if (!next || (placed.area && !this._treeFits(next, placed.area))) return;
        this._trees[placed.key] = next;
        this._saveTreesSoon();
        this._retile();
    }

    resetSizes() {
        const prefix = this._workspaceNumber() + ":";
        let any = false;
        for (const key of Object.keys(this._trees)) {
            if (!key.startsWith(prefix)) continue;
            this._trees[key] = ML.evenSplits(this._trees[key]);
            any = true;
        }
        if (any) this._saveTreesNow();
        this._retile();
        this._say("Window sizes reset on workspace " + this._workspaceNumber());
    }

    resetAllSizes() {
        for (const key of Object.keys(this._trees)) this._trees[key] = ML.evenSplits(this._trees[key]);
        this._saveTreesNow();
        this._retile();
        this._say("Window sizes reset on every workspace");
    }

    _onGrabEnd(args) {
        let win = null;
        for (const a of args) {
            if (a && typeof a.get_frame_rect === "function" && typeof a.get_wm_class === "function") { win = a; break; }
        }
        if (!win) win = global.display.focus_window;
        if (win) this._learnResize(win);
        this._settle();
    }

    // A drag that changes both axes keeps both, when each edge is a real divider.
    _learnResize(win) {
        const p = this._cells.get(win);
        if (!p || !p.chain || !p.chain.length || this._floating.has(win) || !this._trees[p.key]) return;
        let f;
        try { f = win.get_frame_rect(); } catch (e) { return; }
        const c = p.rect;
        if (Math.abs(f.width - c.width) <= 2 && Math.abs(f.height - c.height) <= 2) return;
        const half = Math.floor(CONFIG.innerGap / 2);
        const edges = [
            { horizontal: true, edge: "end", moved: (f.x + f.width) - (c.x + c.width), pos: f.x + f.width + half },
            { horizontal: false, edge: "end", moved: (f.y + f.height) - (c.y + c.height), pos: f.y + f.height + half },
            { horizontal: true, edge: "start", moved: f.x - c.x, pos: f.x - half },
            { horizontal: false, edge: "start", moved: f.y - c.y, pos: f.y - half },
        ].filter((e) => Math.abs(e.moved) > 2)
         .sort((a, b) => Math.abs(b.moved) - Math.abs(a.moved));
        let tree = this._trees[p.key];
        let any = false;
        for (const e of edges.slice(0, 2)) {
            const anc = p.chain.find((a) => a.horizontal === e.horizontal &&
                ((a.side === "a" && e.edge === "end") || (a.side === "b" && e.edge === "start")));
            if (!anc) continue;
            const ratio = ML.ratioAt(anc.rect, e.horizontal, e.pos);
            const next = ML.setRatioAt(tree, anc.path, ratio);
            if (!this._treeFits(next, p.area)) continue;
            tree = next;
            any = true;
        }
        if (!any) return;
        this._trees[p.key] = tree;
        this._saveTreesSoon();
    }

    // ----- directional focus, modes, cheat sheet ---------------------------

    _focusCandidates(win) {
        const workspace = global.workspace_manager.get_active_workspace();
        const mon = win.get_monitor();
        const list = [];
        const seen = new Set();
        for (const [other, info] of this._cells) {
            if (other === win || !this._navigable(other, workspace)) continue;
            try { if (other.get_monitor() !== mon) continue; } catch (e) { continue; }
            if (!info.rect) continue;
            list.push({ id: other, rect: info.rect });
            seen.add(other);
        }
        for (const other of this._order) {
            if (seen.has(other) || other === win || !this._floating.has(other)) continue;
            if (!this._navigable(other, workspace)) continue;
            try {
                if (other.get_monitor() !== mon) continue;
                const f = other.get_frame_rect();
                list.push({ id: other, rect: { x: f.x, y: f.y, width: f.width, height: f.height } });
            } catch (e) {}
        }
        return list;
    }

    focusDir(dir) {
        const win = global.display.focus_window;
        if (!win || !ML) return;
        let from;
        try { from = win.get_frame_rect(); } catch (e) { return; }
        const target = ML.focusDirection(from, this._focusCandidates(win), dir);
        if (!target) return;
        try { target.activate(global.get_current_time()); } catch (e) { global.logError(e); }
    }

    swapDir(dir) {
        const win = global.display.focus_window;
        const placed = this._placedIds(win);
        if (!placed || !ML) return;
        let from;
        try { from = win.get_frame_rect(); } catch (e) { return; }
        const target = ML.focusDirection(from, this._focusCandidates(win), dir);
        if (!target || target === win || this._floating.has(target)) return;
        const other = this._wid(target);
        if (placed.ids.indexOf(other) < 0) return;
        this._trees[placed.key] = ML.swapLeaves(placed.tree, placed.id, other);
        this._saveTreesSoon();
        this._retile();
    }

    toggleSplit() {
        const placed = this._placedIds(global.display.focus_window);
        if (!placed) return;
        this._trees[placed.key] = ML.toggleSplit(placed.tree, placed.id);
        this._saveTreesSoon();
        this._retile();
    }

    togglePseudo() {
        const placed = this._placedIds(global.display.focus_window);
        if (!placed) return;
        this._trees[placed.key] = ML.togglePseudo(placed.tree, placed.id);
        this._saveTreesSoon();
        this._retile();
        this._say("Pseudotile");
    }

    toggleMode(mode) {
        const win = global.display.focus_window;
        if (!win) return;
        const key = this._keyFor(win);
        if (this._modes[key] === mode) delete this._modes[key];
        else this._modes[key] = mode;
        const now = this._modes[key];
        this._say(now === "monocle" ? "Monocle" : now === "max" ? "Filled the work area" : "Tiled");
        this._retile();
    }

    toggleFullscreen() {
        const win = global.display.focus_window;
        if (!win) return;
        try {
            if (win.is_fullscreen()) {
                if (typeof win.unmake_fullscreen === "function") win.unmake_fullscreen();
                else win.fullscreen = false;
            } else if (typeof win.make_fullscreen === "function") {
                win.make_fullscreen();
            } else {
                win.fullscreen = true;
            }
        } catch (e) {
            global.logError(e);
        }
    }

    popWindow() {
        const win = global.display.focus_window;
        if (!win || !this._known.has(win)) return;
        this._userTouched.add(win);
        this._ruled.delete(win);
        if (this._floating.has(win)) {
            this._floating.delete(win);
            this._bump(win);
            this._say("Tiled");
        } else {
            this._floating.add(win);
            this._restoreFloat(win);
            this._setAbove(win, true);
            this._say("Popped out");
        }
        this._retile();
    }

    closeWindow() {
        const win = global.display.focus_window;
        if (!win) return;
        try { win.delete(global.get_current_time()); } catch (e) { global.logError(e); }
    }

    _keyRows() {
        const rows = [];
        const labels = ML ? ML.KEY_LABELS : [];
        for (const pair of labels) {
            const accel = keyLabel(CONFIG[pair[0]]);
            if (!accel) continue;
            rows.push({ keys: accel, action: pair[1] });
            if (pair[0] === "keyToggleWorkspace" && CONFIG.superNumWorkspaces) {
                rows.push({ keys: "Super+1-9", action: "Switch to that workspace" });
            }
        }
        return rows;
    }

    _hideCheat() {
        if (this._cheatKey) {
            try { global.stage.disconnect(this._cheatKey); } catch (e) {}
            this._cheatKey = 0;
        }
        if (this._cheat) {
            try { this._cheat.destroy(); } catch (e) {}
            this._cheat = null;
        }
    }

    _toggleCheat() {
        if (this._cheat) { this._hideCheat(); return; }
        try {
            const monitor = Main.layoutManager.primaryMonitor || Main.layoutManager.monitors[0];
            if (!monitor) return;
            const layer = new St.Widget({ reactive: true, x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height });
            layer.set_style("background-color: rgba(0,0,0,0.35);");
            layer.connect("button-press-event", () => { this._hideCheat(); return Clutter.EVENT_STOP; });
            const box = new St.BoxLayout({ vertical: true, reactive: true });
            box.set_style("background-color: rgba(16,20,24,0.96); color: rgb(236,240,241); " +
                "padding: 18px 22px; border-radius: 14px; border: 2px solid rgb(0,255,204);");
            box.connect("button-press-event", () => Clutter.EVENT_STOP);
            const title = new St.Label({ text: "MintyWM" });
            title.set_style("font-weight: bold; font-size: 16px; padding-bottom: 8px;");
            box.add_child(title);
            const hint = new St.Label({ text: "Press the cheat-sheet key again, or Escape, to close." });
            hint.set_style("font-size: 12px; color: rgb(170,180,190); padding-bottom: 10px;");
            box.add_child(hint);
            const body = new St.Label({ text: this._keyRows().map((r) => r.keys + "    " + r.action).join("\n") });
            body.set_style("font-family: monospace; font-size: 13px;");
            box.add_child(body);
            layer.add_child(box);
            Main.uiGroup.add_child(layer);
            // Centre after the box knows its size. A second layout pass is enough.
            this._later(30, () => {
                try {
                    const w = box.get_width();
                    const h = box.get_height();
                    box.set_position(Math.round((monitor.width - w) / 2), Math.round((monitor.height - h) / 2));
                } catch (e) {}
            });
            this._cheat = layer;
            this._cheatKey = global.stage.connect("key-press-event", (actor, event) => {
                try {
                    if (event.get_key_symbol() === Clutter.KEY_Escape) {
                        this._hideCheat();
                        return Clutter.EVENT_STOP;
                    }
                } catch (e) {}
                return Clutter.EVENT_PROPAGATE;
            });
        } catch (e) {
            global.logError(e);
        }
    }

    // ----- floating windows on top -----------------------------------------

    // Pin a window on top (want = true) or let it go again. We only ever unpin a window
    // that we pinned ourselves, and we never claim one the user had already pinned.
    _setAbove(win, want) {
        try {
            if (typeof win.is_above !== "function" || typeof win.make_above !== "function") return;
            if (want) {
                if (win.is_above()) return;   // already on top (ours, or pinned by the user)
                win.make_above();
                this._above.add(win);
            } else if (this._above.has(win)) {
                this._above.delete(win);
                if (win.is_above()) win.unmake_above();
            }
        } catch (e) {
            global.logError(e);
        }
    }

    // Floating windows are on top while tiling is on; everything else is left alone.
    _syncAbove() {
        for (const win of this._order) {
            this._setAbove(win, !!CONFIG.floatOnTop && this._tilingForWindow(win) && this._floating.has(win));
        }
    }

    // ----- floating apps ---------------------------------------------------

    _winIdentity(win) {
        try {
            return {
                cls: win.get_wm_class() || "",
                inst: win.get_wm_class_instance() || "",
                title: win.get_title() || "",
            };
        } catch (e) {
            return null;
        }
    }

    // Decide, once the window's class is known, whether the floating-apps list makes it float.
    _applyRule(win, force) {
        if (this._userTouched.has(win)) return;
        if (!force && this._decided.has(win)) return;
        const id = this._winIdentity(win);
        if (!id) return;
        const d = floatRuleDecision(CONFIG.floatRules, id.cls, id.inst, id.title);
        if (d === null) return;   // not known yet; try again on the next pass
        this._decided.add(win);
        if (d && !this._floating.has(win)) {
            this._floating.add(win);
            this._ruled.add(win);
            if (this._saved.has(win)) this._restoreFloat(win);   // we had already tiled it
        } else if (!d && this._ruled.has(win)) {
            this._floating.delete(win);   // its rule was removed or switched off
            this._ruled.delete(win);
            this._bump(win);
        }
    }

    // The list changed: look at every window again.
    _reapplyRules() {
        clearGlobCache();
        this._decided.clear();
        this._retile();
    }

    _saveRules(rules) {
        CONFIG.floatRules = rules;
        if (this._settings) {
            try { this._settings.setValue("floatRules", rules); } catch (e) { global.logError(e); }
        }
    }

    // Super+Shift+T: put the focused window's app on the floating list, or take it off again.
    alwaysFloat() {
        const win = global.display.focus_window;
        if (!win || !this._known.has(win)) return;
        const id = this._winIdentity(win);
        const name = id && (id.cls || id.inst);
        if (!name) {
            this._say("This window has no class to match");
            return;
        }
        const rules = (CONFIG.floatRules || []).map((r) => Object.assign({}, r));
        const title = id.title.toLowerCase();
        const hits = rules.filter((r) => r.enabled !== false &&
            (globMatch(r.wmclass, id.cls) || globMatch(r.wmclass, id.inst)) &&
            (!String(r.title || "").trim() || title.includes(String(r.title).trim().toLowerCase())));
        let msg;
        if (hits.length) {
            for (const r of hits) r.enabled = false;
            msg = "No longer always floating: " + hits.map((r) => r.wmclass).join(", ");
        } else {
            const off = rules.find((r) => r.enabled === false && !String(r.title || "").trim() &&
                String(r.wmclass).toLowerCase() === name.toLowerCase());
            if (off) off.enabled = true;
            else rules.push({ enabled: true, wmclass: name, title: "" });
            msg = "Always floating: " + name;
        }
        this._saveRules(rules);
        this._userTouched.delete(win);   // let the list decide for this window again
        this._say(msg);
        this._reapplyRules();
    }

    // ----- tracking --------------------------------------------------------

    // A window appeared. Ordinary app windows are tracked. Menus, tooltips and popups
    // are ignored. Dialogs, toolbars and the like are only watched, in case the app
    // turns one into a normal window later. Returns true if the window is now tracked.
    _consider(win) {
        if (!win || this._known.has(win) || this._watching.has(win)) return false;
        let normal;
        try {
            if (win.is_override_redirect()) return false;
            normal = win.window_type === Meta.WindowType.NORMAL;
        } catch (e) {
            return false;
        }
        if (normal) {
            this._track(win);
            return true;
        }
        const ids = [];
        try {
            ids.push(win.connect("notify::window-type", () => {
                if (win.window_type !== Meta.WindowType.NORMAL) return;
                this._unwatch(win);
                this._track(win);
                this._settle();
            }));
            ids.push(win.connect("unmanaged", () => this._unwatch(win)));
        } catch (e) {
            global.logError(e);
        }
        this._watching.set(win, ids);
        return false;
    }

    _unwatch(win) {
        const ids = this._watching.get(win);
        if (!ids) return;
        for (const id of ids) {
            try { win.disconnect(id); } catch (e) {}
        }
        this._watching.delete(win);
    }

    _track(win) {
        if (!win || this._known.has(win)) return;
        this._order.push(win);
        this._known.add(win);
        const ids = [];
        const add = (sig, cb) => {
            try { ids.push(win.connect(sig, cb)); } catch (e) { global.logError(e); }
        };
        add("unmanaged", () => this._forget(win));
        add("workspace-changed", () => { this._bump(win); this._settle(); });
        add("notify::fullscreen", () => this._settle());
        add("notify::appears-focused", () => this._onFocus());   // a second, per-window focus signal
        // The border is a child of the window, so it moves with it for free: a move only
        // matters while we are checking that the window went where we put it.
        add("position-changed", () => this._checkTarget(win));
        add("size-changed", () => {
            this._checkTarget(win);
            if (this._mayHaveBorder(win)) this._refreshBorder(win);
        });
        this._winConns.set(win, ids);
    }

    _forget(win) {
        const i = this._order.indexOf(win);
        if (i >= 0) this._order.splice(i, 1);
        this._known.delete(win);
        this._floating.delete(win);
        this._saved.delete(win);
        this._ruled.delete(win);
        this._userTouched.delete(win);
        this._decided.delete(win);
        this._above.delete(win);
        this._targets.delete(win);
        this._minSize.delete(win);
        this._overflow.delete(win);
        this._cells.delete(win);
        this._reinsert.delete(win);
        this._wids.delete(win);
        this._hidden.delete(win);
        this._winConns.delete(win);  // window is being destroyed; nothing to disconnect
        this._dropBorder(win);
        if (this._lastFocus === win) this._lastFocus = null;
        this._settle();
    }

    _bump(win) {
        const i = this._order.indexOf(win);
        if (i >= 0) this._order.splice(i, 1);
        this._order.push(win);
        this._reinsert.add(win);
    }

    // ----- tiling ----------------------------------------------------------

    // Can this window actually be seen? Some apps keep a mapped "normal" window that is
    // 1x1 or parked off-screen; without this check it would take a tile and leave a hole.
    _onScreen(win) {
        const f = win.get_frame_rect();
        if (f.width < 8 || f.height < 8) return false;
        const m = global.display.get_monitor_geometry(win.get_monitor());
        return f.x < m.x + m.width && f.x + f.width > m.x &&
            f.y < m.y + m.height && f.y + f.height > m.y;
    }

    // Why is this window not tiled? null = it is eligible. Used for tiling and for dump().
    _skipReason(win, workspace) {
        try {
            if (!this._tilingHere(workspace)) return "tiling is off on this workspace";
            if (win.window_type !== Meta.WindowType.NORMAL) return "not a normal window";
            if (win.is_override_redirect()) return "popup";
            if (!win.located_on_workspace(workspace)) return "on another workspace";
            if (win.minimized) return "minimised";
            if (win.is_skip_taskbar()) return "not in the taskbar";
            if (win.is_on_all_workspaces()) return "on every workspace";
            if (win.is_fullscreen()) return "fullscreen";
            if (win.get_transient_for()) return "dialog of another window";
            if (!win.allows_move() || win.resizeable === false) return "cannot be moved or resized";
            if (this._floating.has(win)) return this._ruled.has(win) ? "floating (floating apps list)" : "floating";
            if (!this._onScreen(win)) return "invisible (tiny or off-screen)";
            return null;
        } catch (e) {
            return "gone";   // window object already gone
        }
    }

    _eligible(win, workspace) {
        return this._skipReason(win, workspace) === null;
    }

    // Anything the user could reasonably want to focus (looser than _eligible).
    _navigable(win, workspace) {
        try {
            return win.window_type === Meta.WindowType.NORMAL &&
                !win.minimized &&
                !win.is_override_redirect() &&
                !win.is_skip_taskbar() &&
                !win.get_transient_for() &&
                (win.is_on_all_workspaces() || win.located_on_workspace(workspace)) &&
                this._onScreen(win);
        } catch (e) {
            return false;
        }
    }

    _workArea(workspace, monitor, sample) {
        try {
            return workspace.get_work_area_for_monitor(monitor);
        } catch (e) {
            return sample.get_work_area_current_monitor();
        }
    }

    // tiled: in the layout. floating: floated windows you can see. overflow: did not fit.
    _counts() {
        const ws = global.workspace_manager.get_active_workspace();
        let tiled = 0, floating = 0, overflow = 0;
        for (const win of this._order) {
            if (this._floating.has(win)) { if (this._navigable(win, ws)) floating++; }
            else if (this._eligible(win, ws)) { if (this._overflow.has(win)) overflow++; else tiled++; }
        }
        return { tiled, floating, overflow };
    }

    _state() {
        const ws = global.workspace_manager.get_active_workspace();
        const n = ws.index() + 1;
        const c = this._counts();
        return {
            on: this._tilingHere(ws),
            globalOn: this._tilingOn,
            workspace: n,
            excluded: this._noTile.has(n),
            tiled: c.tiled,
            floating: c.floating,
            overflow: c.overflow,
            mode: this._modeHere(),
        };
    }

    _modeHere() {
        try {
            const ws = global.workspace_manager.get_active_workspace();
            const mon = global.display.get_current_monitor();
            return this._modes[(ws.index() + 1) + ":" + mon] || "tile";
        } catch (e) {
            return "tile";
        }
    }

    // Fullscreen windows stay in the tree so leaving fullscreen does not
    // throw them to the back, but they are not moved while fullscreen.
    _inTree(win, workspace) {
        try {
            if (this._floating.has(win)) return false;
            if (win.is_fullscreen() && !win.minimized &&
                win.window_type === Meta.WindowType.NORMAL &&
                !win.get_transient_for() &&
                (win.is_on_all_workspaces() || win.located_on_workspace(workspace))) return true;
        } catch (e) {
            return false;
        }
        return this._eligible(win, workspace);
    }

    _isTerminal(win) {
        const id = this._winIdentity(win);
        const c = ((id && (id.cls || id.inst)) || "").toLowerCase();
        return c.indexOf("terminal") >= 0 || c.indexOf("kitty") >= 0 || c.indexOf("alacritty") >= 0 ||
            c.indexOf("wezterm") >= 0 || c.indexOf("tilix") >= 0 || c.indexOf("konsole") >= 0 ||
            c.indexOf("xterm") >= 0 || c.indexOf("blackbox") >= 0 || c === "kgx" || c.indexOf("foot") >= 0;
    }

    _hideActor(win) {
        try {
            const actor = win.get_compositor_private();
            if (!actor) return;
            actor.hide();
            this._hidden.add(win);
        } catch (e) {}
    }

    _unhideAll() {
        for (const win of [...this._hidden]) {
            try {
                const actor = win.get_compositor_private();
                if (actor) actor.show();
            } catch (e) {}
        }
        this._hidden.clear();
    }

    _reconcileTree(key, wins, area) {
        const ids = wins.map((w) => this._wid(w));
        const reinsert = [];
        for (const w of wins) {
            if (this._reinsert.has(w)) {
                reinsert.push(this._wid(w));
                this._reinsert.delete(w);
            }
        }
        let tree = this._trees[key] || null;
        if (!tree && !this._usedSave[key]) {
            this._usedSave[key] = true;
            const saved = CONFIG.layoutTrees && CONFIG.layoutTrees[key];
            const assigned = saved ? ML.assignLeaves(saved, ids) : null;
            if (assigned) tree = assigned;
        }
        const fresh = !tree;
        const focus = global.display.focus_window;
        const focusId = focus && wins.indexOf(focus) >= 0 ? this._wid(focus) : null;
        tree = ML.reconcile(tree, ids, {
            area: area,
            inner: CONFIG.innerGap,
            outer: CONFIG.outerGap,
            focusId: focusId,
            reinsert: reinsert,
        });
        if (fresh) {
            const ratios = CONFIG.splitRatios && CONFIG.splitRatios[key];
            const hasTree = CONFIG.layoutTrees && CONFIG.layoutTrees[key];
            if (!hasTree && Array.isArray(ratios) && ratios.length) tree = ML.applyRatios(tree, ratios);
        }
        this._trees[key] = tree;
        return tree;
    }

    _retile() {
        if (!ML) {
            global.logWarning("MintyWM: layout engine failed to load");
            return;
        }
        this._targets.clear();   // checks still pending from an earlier pass are out of date
        this._overflow.clear();
        this._cells.clear();
        this._unhideAll();
        for (const win of this._order) this._applyRule(win);
        this._syncAbove();
        const workspace = global.workspace_manager.get_active_workspace();
        if (!this._tilingHere(workspace)) {
            this._refreshBorders();
            this._stuckCheck(0);
            this._changed();
            this._debugLog();
            return;
        }
        const byMonitor = new Map();
        for (const win of this._order) {
            if (!this._inTree(win, workspace)) continue;
            const mon = win.get_monitor();
            if (!byMonitor.has(mon)) byMonitor.set(mon, []);
            byMonitor.get(mon).push(win);
        }
        let grew = false;
        for (const [mon, wins] of byMonitor) {
            let area;
            try { area = this._workArea(workspace, mon, wins[0]); } catch (e) { continue; }
            const key = (workspace.index() + 1) + ":" + mon;
            const members = wins.filter((w) => {
                try { return !w.is_fullscreen(); } catch (e) { return true; }
            });
            const tree = this._reconcileTree(key, wins, area);
            const mode = this._modes[key];
            if ((mode === "monocle" || mode === "max") && members.length) {
                const focus = global.display.focus_window;
                const main = members.indexOf(focus) >= 0 ? focus : members[0];
                const rect = mode === "max"
                    ? { x: area.x, y: area.y, width: area.width, height: area.height }
                    : ML.soleRect(area, CONFIG.innerGap, CONFIG.outerGap);
                this._cells.set(main, { key: key, area: area, rect: rect, chain: [], id: this._wid(main) });
                if (this._place(main, rect, area)) grew = true;
                for (const w of members) if (w !== main) this._hideActor(w);
                continue;
            }
            const priority = members.map((w) => this._wid(w));
            const mins = {};
            for (const w of members) {
                const m = this._minSize.get(w);
                if (m) mins[this._wid(w)] = m;
            }
            let geometry = tree;
            for (const w of wins) {
                try {
                    if (w.is_fullscreen()) geometry = ML.removeId(geometry, this._wid(w));
                } catch (e) {}
            }
            if (!geometry) continue;
            const solved = ML.solve(geometry, area, CONFIG.innerGap, CONFIG.outerGap,
                CONFIG.minTileWidth, CONFIG.minTileHeight, mins, priority);
            const byId = new Map(members.map((w) => [this._wid(w), w]));
            for (const cell of solved.cells) {
                const win = byId.get(cell.id);
                if (!win) continue;
                let rect = cell.rect;
                if (cell.pseudo) rect = ML.pseudoRect(rect, CONFIG.floatSizePercent);
                this._cells.set(win, { key: key, area: area, rect: rect, chain: cell.chain || [], id: cell.id });
                if (this._place(win, rect, area)) grew = true;
            }
            solved.overflow.forEach((id, i) => {
                const win = byId.get(id);
                if (!win) return;
                this._overflow.add(win);
                const park = ML.cascadeRect(area, i, CONFIG.floatSizePercent);
                this._cells.set(win, { key: key, area: area, rect: park, chain: [], id: id });
                this._place(win, park, area);
            });
        }
        this._refreshBorders();
        this._afterPlace(0);
        if (grew) this._settle();   // a window refused to shrink: lay out again around its real size
        this._stuckCheck(0);
        this._changed();
        this._debugLog();
    }

    // If Cinnamon's own edge tiling or snapping holds the window, let go of it first,
    // or Muffin keeps pulling it back into its half or quarter of the screen.
    _untile(win) {
        try {
            let type;
            if (typeof win.get_tile_type === "function") type = win.get_tile_type();
            else type = win.tile_type;
            if (type === undefined || type === null) return;
            const none = (Meta.WindowTileType && Meta.WindowTileType.NONE !== undefined) ? Meta.WindowTileType.NONE : 0;
            if (type === none) return;
            if (typeof win.tile === "function" && Meta.TileMode) win.tile(Meta.TileMode.NONE, false);
        } catch (e) {
            // not supported by this Cinnamon version; nothing to do
        }
    }

    // Returns true when the window turned out to be bigger than its tile, i.e. it has
    // a minimum size we did not know about, so the layout should be worked out again.
    _place(win, r, area) {
        try {
            this._untile(win);
            if (win.get_maximized()) win.unmaximize(Meta.MaximizeFlags.BOTH);
            const f = win.get_frame_rect();
            if (!this._saved.has(win)) {
                this._saved.set(win, { x: f.x, y: f.y, width: f.width, height: f.height });
            }
            const rect = {
                x: Math.round(r.x),
                y: Math.round(r.y),
                width: Math.max(1, Math.round(r.width)),
                height: Math.max(1, Math.round(r.height)),
            };
            if (f.x === rect.x && f.y === rect.y && f.width === rect.width && f.height === rect.height) {
                this._targets.set(win, { x: rect.x, y: rect.y, tries: 3 });
                return false;
            }
            win.move_resize_frame(true, rect.x, rect.y, rect.width, rect.height);
            const grew = this._noteMinSize(win, f, rect);
            let tx = rect.x;
            let ty = rect.y;
            if (area && ML) {
                const now = win.get_frame_rect();
                const outside = now.x < area.x - 1 || now.y < area.y - 1 ||
                    now.x + now.width > area.x + area.width + 1 ||
                    now.y + now.height > area.y + area.height + 1;
                const clamped = ML.clampOrigin(now, area);
                if (clamped.x !== now.x || clamped.y !== now.y) {
                    try { win.move_frame(true, clamped.x, clamped.y); } catch (e) {}
                    tx = clamped.x;
                    ty = clamped.y;
                }
                if (outside && CONFIG.debug) {
                    const id = this._winIdentity(win);
                    global.log("MintyWM: clamped " + ((id && id.cls) || "window") +
                        " back inside the work area (" + now.width + "x" + now.height + ")");
                }
            }
            // Set after the request, so the window's own move signal during it is ignored.
            this._targets.set(win, { x: tx, y: ty, tries: 3 });
            return grew;
        } catch (e) {
            global.logError(e);
            return false;
        }
    }

    // On X11 Muffin applies a window's size limits straight away, so reading the frame
    // back tells us whether it refused to get as small as the tile.
    _noteMinSize(win, before, r) {
        if (this._wayland) return false;   // resizes are asynchronous there; can't tell yet
        const f = win.get_frame_rect();
        if (f.x === before.x && f.y === before.y && f.width === before.width && f.height === before.height) {
            return false;   // nothing happened (yet); don't guess
        }
        const w = f.width > r.width ? f.width : 0;
        const h = f.height > r.height ? f.height : 0;
        if (!w && !h) return false;
        const old = this._minSize.get(win) || { w: 0, h: 0 };
        const next = { w: Math.max(old.w, w), h: Math.max(old.h, h) };
        if (next.w === old.w && next.h === old.h) return false;
        this._minSize.set(win, next);
        return true;
    }

    // Some windows (terminals, in particular) take the resize but ignore the move in a
    // combined move+resize request, or move themselves back afterwards. This runs on
    // every move/resize of a window we just placed, and once more after a short wait,
    // and moves it back with a separate request (a few tries at most).
    // Returns true if it had to move the window again.
    _checkTarget(win) {
        const t = this._targets.get(win);
        if (!t || t.busy) return false;
        try {
            if (!this._tilingForWindow(win) || this._floating.has(win) || !this._known.has(win)) {
                this._targets.delete(win);
                return false;
            }
            const f = win.get_frame_rect();
            if (f.x === t.x && f.y === t.y) return false;
            if (t.tries <= 0) {
                this._targets.delete(win);
                return false;
            }
            t.tries--;
            t.busy = true;   // our own move below emits position-changed; don't recurse
            try { win.move_frame(true, t.x, t.y); } finally { t.busy = false; }
            return true;
        } catch (e) {
            this._targets.delete(win);   // window went away
            return false;
        }
    }

    // One timer per layout pass (not one per window): check every placed window and
    // the borders. If something still had to be moved, look again, up to three times.
    _afterPlace(round) {
        if (this._afterId) this._cancel(this._afterId);
        this._afterId = this._later(150, () => {
            this._afterId = 0;
            let again = false;
            for (const win of [...this._targets.keys()]) {
                if (this._checkTarget(win)) again = true;
            }
            this._refreshBorders();
            if (again && round < 2) this._afterPlace(round + 1);
            else this._targets.clear();   // done: from now on the user may move things freely
        });
    }

    // ----- borders ----------------------------------------------------------

    _scale() {
        const s = global.ui_scale;
        return (typeof s === "number" && s > 0) ? s : 1;
    }

    _borderState(win) {
        if (!CONFIG.borders) return NO_MARKS;
        const ws = global.workspace_manager.get_active_workspace();
        if (!this._tilingHere(ws)) return NO_MARKS;
        if (!this._navigable(win, ws) || win.is_fullscreen()) return NO_MARKS;
        const floating = this._floating.has(win) || this._overflow.has(win);
        const focused = win === global.display.focus_window;
        return { float: floating, focus: focused && (floating || this._eligible(win, ws)) };
    }

    // Cheap test before the full refresh: could this window show a border at all?
    _mayHaveBorder(win) {
        const e = this._borders.get(win);
        return (e && e.shown) || win === global.display.focus_window ||
            this._floating.has(win) || this._overflow.has(win);
    }

    _makeBorder(win, parent) {
        const box = new St.Widget({ reactive: false, can_focus: false, track_hover: false });
        box.hide();
        parent.add_child(box);
        const e = { box, parent, sig: "", style: "", shown: false };
        this._borders.set(win, e);
        return e;
    }

    _dropBorder(win) {
        const e = this._borders.get(win);
        if (!e) return;
        try { e.box.destroy(); } catch (err) {}
        this._borders.delete(win);
    }

    // Each corner of the border, in CSS order (top-left, top-right, bottom-right,
    // bottom-left). The border sits one border width outside the window, so its curve is
    // the window's corner plus that width. A 0 corner stays square.
    _cornerRadii(bw, sc) {
        const r = (v) => {
            const c = Math.max(0, Number(v) || 0);
            return c > 0 ? Math.round(c * sc) + bw : 0;
        };
        if (!CONFIG.cornerEach) {
            const all = r(CONFIG.cornerRadius);
            return [all, all, all, all];
        }
        return [r(CONFIG.radiusTopLeft), r(CONFIG.radiusTopRight),
                r(CONFIG.radiusBottomRight), r(CONFIG.radiusBottomLeft)];
    }

    // Focused (tiled or floating): focus colour. Floating but not focused: float colour.
    _borderStyle(st, bw, sc) {
        const line = st.focus ? CONFIG.focusColor : CONFIG.floatColor;
        const radius = this._cornerRadii(bw, sc).map((v) => v + "px").join(" ");
        return "border: " + bw + "px solid " + line + "; border-radius: " + radius +
            "; background-color: transparent;";
    }

    _onFocus() {
        const cur = global.display.focus_window;
        const prev = this._lastFocus;
        this._lastFocus = cur;
        if (prev && prev !== cur) this._refreshBorder(prev);
        if (cur) this._refreshBorder(cur);
    }

    _refreshBorders() {
        for (const win of this._order) this._refreshBorder(win);
    }

    _refreshBorder(win) {
        if (!this._known.has(win)) return;
        try {
            const st = this._borderState(win);
            let e = this._borders.get(win);
            if (!st.focus && !st.float) {
                if (e && e.shown) {
                    e.box.hide();
                    e.shown = false;
                    e.sig = "";
                }
                return;
            }
            const wa = win.get_compositor_private();
            if (!wa) return;
            if (e && e.parent !== wa) {
                this._dropBorder(win);
                e = null;
            }
            if (!e) e = this._makeBorder(win, wa);

            const f = win.get_frame_rect();
            let ox, oy;
            try {
                const b = win.get_buffer_rect();
                ox = f.x - b.x;
                oy = f.y - b.y;
            } catch (err) {
                ox = f.x - wa.x;
                oy = f.y - wa.y;
            }
            const sc = this._scale();
            const sig = [st.focus ? 1 : 0, st.float ? 1 : 0, f.width, f.height, ox, oy, sc].join(",");
            if (e.shown && e.sig === sig) return;   // nothing changed; leave the actor alone
            e.sig = sig;
            e.shown = true;

            const bw = Math.max(1, Math.round(CONFIG.borderWidth * sc));
            const style = this._borderStyle(st, bw, sc);
            if (style !== e.style) {
                e.style = style;
                e.box.set_style(style);
            }
            // The box is bigger than the window by one border width all round, so the
            // line sits outside the window and the window's own pixels stay untouched.
            e.box.set_size(f.width + 2 * bw, f.height + 2 * bw);
            e.box.set_position(ox - bw, oy - bw);
            e.box.show();
        } catch (e) {
            global.logError(e);
        }
    }

    // ----- stuck pictures ---------------------------------------------------

    // A window's picture (its actor) should sit exactly on the window. Muffin holds the
    // picture still while it waits for an app to say it has redrawn at the new size, and
    // now and then an app (Chromium and Electron apps, mostly) never says so. The window
    // is then in one place and its picture in another, until the app redraws or Cinnamon
    // restarts. Returns where the picture is when it is off, otherwise null.
    _pictureOff(win) {
        try {
            const wa = win.get_compositor_private();
            if (!wa || !wa.visible || win.minimized) return null;
            const b = win.get_buffer_rect();
            if (Math.abs(wa.x - b.x) <= 1 && Math.abs(wa.y - b.y) <= 1) return null;
            return { x: Math.round(wa.x), y: Math.round(wa.y), w: Math.round(wa.width), h: Math.round(wa.height) };
        } catch (e) {
            return null;
        }
    }

    // The windows we know about that are showing on the workspace you are looking at.
    _visibleHere() {
        const ws = global.workspace_manager.get_active_workspace();
        return this._order.filter((win) => {
            try {
                return !win.minimized && (win.is_on_all_workspaces() || win.located_on_workspace(ws));
            } catch (e) {
                return false;
            }
        });
    }

    // Make the app redraw: shrink it by a pixel and put it straight back. Each change is
    // a fresh request the app has to answer, which lets Muffin move the picture again.
    _nudge(win) {
        try {
            if (win.get_maximized() || win.is_fullscreen()) return;
            const f = win.get_frame_rect();
            win.move_resize_frame(true, f.x, f.y, Math.max(1, f.width - 1), f.height);
            win.move_resize_frame(true, f.x, f.y, f.width, f.height);
        } catch (e) {
            // window went away
        }
    }

    // Last resort: put the picture where the window really is. Muffin takes over again
    // the next time the app redraws.
    _snapPicture(win) {
        try {
            const wa = win.get_compositor_private();
            const b = win.get_buffer_rect();
            if (wa) wa.set_position(b.x, b.y);
        } catch (e) {
            // window went away
        }
    }

    // Round 0, shortly after a layout pass: look for pictures in the wrong place.
    // Round 1: still wrong? Nudge ordinary windows; snap terminals (a 1px nudge
    // grows them by a whole character cell and can push them off a 1080p screen).
    // Round 2: still wrong? Move the picture ourselves.
    _stuckCheck(round) {
        if (this._stuckId) this._cancel(this._stuckId);
        this._stuckId = this._later(round === 0 ? 250 : 300, () => {
            this._stuckId = 0;
            const off = this._visibleHere().filter((win) => this._pictureOff(win));
            if (!off.length) return;
            if (round === 0) {
                this._stuckCheck(1);
                return;
            }
            for (const win of off) {
                const id = this._winIdentity(win) || { cls: "?" };
                const snap = round >= 2 || this._isTerminal(win);
                global.log("MintyWM: picture of " + (id.cls || "?") + " is drawn away from the window; " +
                    (snap ? "moving the picture" : "asking it to redraw"));
                if (snap) this._snapPicture(win);
                else this._nudge(win);
            }
            if (round === 1) this._stuckCheck(2);
        });
    }

    // ----- diagnostics -----------------------------------------------------

    // One line per window saying whether it is tiled and, if not, why.
    _dump() {
        const ws = global.workspace_manager.get_active_workspace();
        const n = ws.index() + 1;
        const lines = ["MintyWM: tiling " + (this._tilingOn ? "on" : "paused everywhere") +
            "; workspace " + n + (this._noTile.has(n) ? " is excluded" : "") +
            "; excluded list: [" + formatWorkspaceList(this._noTile) + "]" +
            "; trees: " + JSON.stringify(Object.keys(this._trees).filter((k) => k.startsWith(n + ":"))) +
            "; mode: " + this._modeHere()];
        for (const win of this._order) {
            let line;
            try {
                const f = win.get_frame_rect();
                const id = this._winIdentity(win) || { cls: "?", title: "" };
                let why = this._skipReason(win, ws);
                if (!why) why = this._overflow.has(win) ? "did not fit (minimum tile size)" : "tiled";
                const min = this._minSize.get(win);
                line = "  " + (id.cls || id.inst || "?") + " \"" + id.title.slice(0, 40) + "\" " +
                    f.width + "x" + f.height + "+" + f.x + "+" + f.y + " monitor " + win.get_monitor() +
                    (min ? " (refuses below " + min.w + "x" + min.h + ")" : "") + ": " + why;
                const off = this._pictureOff(win);
                if (off) line += "  [PICTURE STUCK: drawn at " + off.x + "," + off.y + " " + off.w + "x" + off.h + "]";
            } catch (e) {
                line = "  (window gone)";
            }
            lines.push(line);
        }
        return lines.join("\n");
    }

    // With the debug setting on, log the dump after each pass (only when it changed).
    _debugLog() {
        if (!CONFIG.debug) return;
        const text = this._dump();
        if (text === this._lastDump) return;
        this._lastDump = text;
        global.log(text);
    }

    // ----- plumbing --------------------------------------------------------

    // Tell the panel applet (if any) that something changed.
    _changed() {
        const set = global.mintywmListeners;
        if (!isListenerSet(set)) return;
        for (const fn of [...set]) {
            try { fn(); } catch (e) { global.logError(e); }
        }
    }

    // Trailing debounce: every event restarts the wait, so a burst of events gives
    // one re-tile after things go quiet. A cap stops a constant stream starving it.
    _settle() {
        const now = Date.now();
        if (!this._settleSince) this._settleSince = now;
        if (this._settleId) this._cancel(this._settleId);
        const wait = (now - this._settleSince >= CONFIG.settleMaxMs) ? 1 : CONFIG.settleMs;
        this._settleId = this._later(wait, () => {
            this._settleId = 0;
            this._settleSince = 0;
            this._retile();
        });
    }

    _later(ms, fn) {
        const id = Mainloop.timeout_add(ms, () => {
            this._timers.delete(id);
            try {
                fn();
            } catch (e) {
                global.logError(e);
            }
            return false;
        });
        this._timers.add(id);
        return id;
    }

    _cancel(id) {
        try { Mainloop.source_remove(id); } catch (e) {}
        this._timers.delete(id);
    }

    // quiet: the signal may not exist on every Cinnamon version; don't log if it doesn't.
    _connect(obj, sig, cb, quiet) {
        try {
            this._conns.push([obj, obj.connect(sig, cb)]);
        } catch (e) {
            if (!quiet) global.logError(e);
        }
    }

    _say(msg) {
        if (!CONFIG.notify) return;
        try { Main.notify("MintyWM", msg); } catch (e) {}
    }
}

let app = null;

function init(metadata) {
    try {
        loadLayout(metadata.path);
    } catch (e) {
        global.logError("MintyWM: could not load mintyLayout.js");
        global.logError(e);
    }
}

function enable() {
    app = new MintyWM();
    app.enable();
}

// The "Reset all window sizes" button in the settings calls this.
function resetSizes() {
    if (app) app.resetAllSizes();
}
CONFIG.resetSizes = resetSizes;

function disable() {
    if (app) {
        app.disable();
        app = null;
    }
}
