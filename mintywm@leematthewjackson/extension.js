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
// Hyprland-style "dwindle" auto-tiling and nothing else:
//   - new windows are tiled automatically; closing/minimising a window re-tiles the rest
//   - Super+F  toggles the focused window between tiled and floating
//   - Super+T  turns tiling on/off (off = windows stay where they are)
//   - Super+Shift+T  re-tiles everything now (and switches tiling on if it was off)
//   - Super+J / Super+K  focus the next / previous window in layout order
//   - Super+Shift+J / K  swap the focused window with the next / previous tile
//   - Super+Shift+H  move the focused window to the first (left) slot
//   - Super+Alt+T  turns tiling on/off for the workspace you are on (the list is in the settings)
//   - Super+Shift+F  always float this app (press again to undo); the list is in the settings
//   - Floating windows are kept on top of the tiles (switch in the settings), so they don't get lost
//   - Apps in the "Floating apps" list (Cinnamon's own settings windows by default) open floating
//   - Thin keyline border drawn just outside the window (in the gap; never clickable):
//       mint  = this window has focus (tiled or floating)
//       pink  = this window is floating but not focused
//       none  = unfocused tiled window; and no borders at all while tiling is off
// Settings: System Settings > Extensions > MintyWM > the gear button. Changes apply live.
// The values in CONFIG below are the defaults (they must match settings-schema.json);
// they are overwritten by whatever is saved in the settings.

const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;

const UUID = "mintywm@leematthewjackson";

const CONFIG = {
    keyToggleTiling: "<Super>t",
    keyToggleFloat: "<Super>f",
    keyRetile: "<Super><Shift>t",  // turn tiling on (if off) and re-tile everything now
    keyFocusNext: "<Super>j",      // focus the next window in layout order
    keyFocusPrev: "<Super>k",      // focus the previous window in layout order
    keySwapNext: "<Super><Shift>j", // swap the focused window with the next tile
    keySwapPrev: "<Super><Shift>k", // swap the focused window with the previous tile
    keyMakeFirst: "<Super><Shift>h", // move the focused window to the first (big, left) slot
    keyAlwaysFloat: "<Super><Shift>f", // always float (or stop floating) the focused window's app
    keyToggleWorkspace: "<Super><Alt>t", // turn tiling on/off for the current workspace
    noTileWorkspaces: "",    // workspace numbers where tiling is off, e.g. "4, 9" or "7-9"
    innerGap: 6,     // pixels between windows
    outerGap: 6,     // pixels between windows and screen/panel edges
    minTileWidth: 200,   // never make a tile smaller than this; extra windows are left alone
    minTileHeight: 120,  // (set both to 0 to tile without limit)
    floatSizePercent: 60,    // size of a window you float when it has no sensible old size
    floatOnTop: true,        // keep floating windows above the tiled ones
    settleMs: 100,   // quiet time after the last event before re-tiling (trailing debounce)
    settleMaxMs: 400, // ...but never wait longer than this during a constant stream of events
    notify: true,    // show a notification when toggling
    // Apps that open floating. wmclass: the window class (case ignored; * matches anything).
    // title: optional; only windows whose title contains this text. enabled: false = ignored.
    floatRules: [
        { enabled: true, wmclass: "cinnamon-settings*", title: "" },   // Cinnamon Settings and its pages
        { enabled: true, wmclass: "xlet-settings*", title: "" },       // applet / extension / desklet settings
    ],
    // Borders. Sizes are in px and are multiplied by Cinnamon's UI scale.
    borders: true,
    focusColor: "rgb(0,255,204)",   // focused window
    floatColor: "rgb(255,0,255)",   // floating window
    borderWidth: 2,
    cornerRadius: 8,         // your theme's window corner radius (the border follows it)
};

const HK_TILING = "mintywm-toggle-tiling";
const HK_FLOAT = "mintywm-toggle-float";
const HK_RETILE = "mintywm-retile";
const HK_NEXT = "mintywm-focus-next";
const HK_PREV = "mintywm-focus-prev";
const HK_SWAPN = "mintywm-swap-next";
const HK_SWAPP = "mintywm-swap-prev";
const HK_FIRST = "mintywm-make-first";
const HK_RULE = "mintywm-always-float";
const HK_WS = "mintywm-toggle-workspace";

const NO_MARKS = { focus: false, float: false };

// ---------------------------------------------------------------------------
// Pure layout code (no GNOME/Muffin imports, so it can be tested with node).
// Windows are placed in order. Each window takes half of the remaining
// rectangle; the split runs side-by-side when the rectangle is at least as wide
// as it is tall, otherwise top-and-bottom. The last window gets what is left.
// ---------------------------------------------------------------------------
// --- layout:begin
function dwindle(area, count, innerGap, outerGap) {
    if (count <= 0) return [];
    const half = Math.floor(innerGap / 2);
    const inset = outerGap - half;
    let rest = {
        x: area.x + inset,
        y: area.y + inset,
        width: area.width - 2 * inset,
        height: area.height - 2 * inset,
    };
    const cells = [];
    for (let i = 0; i < count; i++) {
        let cell;
        if (i === count - 1) {
            cell = rest;
        } else if (rest.width >= rest.height) {
            const w = Math.floor(rest.width / 2);
            cell = { x: rest.x, y: rest.y, width: w, height: rest.height };
            rest = { x: rest.x + w, y: rest.y, width: rest.width - w, height: rest.height };
        } else {
            const h = Math.floor(rest.height / 2);
            cell = { x: rest.x, y: rest.y, width: rest.width, height: h };
            rest = { x: rest.x, y: rest.y + h, width: rest.width, height: rest.height - h };
        }
        cells.push({
            x: cell.x + half,
            y: cell.y + half,
            width: Math.max(1, cell.width - 2 * half),
            height: Math.max(1, cell.height - 2 * half),
        });
    }
    return cells;
}

// How many of `count` windows can be tiled before a tile gets smaller than the
// minimum? Always at least 1 (when there is at least one window).
function fitCount(area, count, innerGap, outerGap, minW, minH) {
    for (let n = count; n > 1; n--) {
        const cells = dwindle(area, n, innerGap, outerGap);
        if (cells.every((c) => c.width >= minW && c.height >= minH)) return n;
    }
    return count > 0 ? 1 : 0;
}


// Case-insensitive match where * stands for any text. An empty pattern matches nothing.
function globMatch(pattern, text) {
    const p = String(pattern || "").trim().toLowerCase();
    if (!p) return false;
    const re = new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
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
// --- layout:end

class MintyWM {
    constructor() {
        this._order = [];            // every window we know about, in arrival order
        this._floating = new Set();  // windows the user floated
        this._saved = new Map();     // window -> its geometry from before we first tiled it
        this._tilingOn = true;
        this._conns = [];            // [object, signalId] pairs to undo on disable
        this._winConns = new Map();  // window -> [signalId]
        this._timers = new Set();
        this._gen = 0;               // bumped on every layout pass; stale callbacks check it
        this._settleId = 0;
        this._settleSince = 0;
        this._borders = new Map();      // window -> { box, parent, sig, style, shown }
        this._borderPending = false;
        this._lastFocus = null;
        this._settings = null;
        this._ruled = new Set();        // windows floating because of a rule
        this._userTouched = new Set();  // windows the user floated/tiled by hand: rules leave them alone
        this._decided = new Set();      // windows whose rule check is done
        this._above = new Set();        // windows WE pinned on top (never touch ones the user pinned)
        this._noTile = new Set();       // workspace numbers (1-based) where tiling is off
    }

    enable() {
        this._bindSettings();
        this._noTile = parseWorkspaceList(CONFIG.noTileWorkspaces);
        this._connect(global.display, "window-created", (display, win) => {
            this._track(win);
            this._settle();
        });
        for (const sig of ["map", "minimize", "unminimize", "switch-workspace"]) {
            this._connect(global.window_manager, sig, () => this._settle());
        }
        this._connect(Main.layoutManager, "monitors-changed", () => this._settle());
        this._connect(global.display, "notify::focus-window", () => this._onFocus());

        // Read-only view for the status applet (it lives in the same process).
        const self = this;
        global.mintywm = {
            // on: is tiling active on the workspace you are looking at?
            get on() { return self._tilingHere(global.workspace_manager.get_active_workspace()); },
            get globalOn() { return self._tilingOn; },
            get workspace() { return global.workspace_manager.get_active_workspace().index() + 1; },
            get tiled() { return self._counts().tiled; },
            get floating() { return self._counts().floating; },
            // What a click on the panel indicator does: un-pause tiling if it is paused
            // everywhere, otherwise flip it for this workspace.
            toggle() { if (!self._tilingOn) self.toggleTiling(); else self.toggleWorkspace(); },
        };

        this._bindKeys();

        for (const actor of global.get_window_actors()) this._track(actor.meta_window);
        this._lastFocus = global.display.focus_window;
        this._retile();
    }

    disable() {
        this._gen++;   // anything still queued is now stale
        for (const hk of [HK_TILING, HK_FLOAT, HK_RETILE, HK_NEXT, HK_PREV, HK_SWAPN, HK_SWAPP, HK_FIRST, HK_RULE, HK_WS]) {
            try { Main.keybindingManager.removeHotKey(hk); } catch (e) {}
        }
        if (this._settings) {
            try { this._settings.finalize(); } catch (e) {}
            this._settings = null;
        }
        for (const [obj, id] of this._conns) {
            try { obj.disconnect(id); } catch (e) {}
        }
        for (const [win, ids] of this._winConns) {
            for (const id of ids) {
                try { win.disconnect(id); } catch (e) {}
            }
        }
        for (const id of this._timers) Mainloop.source_remove(id);
        for (const win of [...this._borders.keys()]) this._dropBorder(win);
        for (const win of [...this._above]) this._setAbove(win, false);
        this._above.clear();
        this._noTile = new Set();
        try { delete global.mintywm; } catch (e) { global.mintywm = undefined; }
        this._conns = [];
        this._winConns.clear();
        this._timers.clear();
        this._order = [];
        this._floating.clear();
        this._saved.clear();
        this._ruled.clear();
        this._userTouched.clear();
        this._decided.clear();
        this._settleId = 0;
        this._settleSince = 0;
        this._borderPending = false;
        this._lastFocus = null;
    }

    // ----- settings --------------------------------------------------------

    // Bind the saved settings straight onto CONFIG, so the rest of the code just reads
    // CONFIG. If the settings system is unavailable for any reason, the defaults stay.
    _bindSettings() {
        const KEYS = ["keyToggleTiling", "keyToggleFloat", "keyRetile", "keyFocusNext",
                      "keyFocusPrev", "keySwapNext", "keySwapPrev", "keyMakeFirst", "keyAlwaysFloat", "keyToggleWorkspace"];
        const LOOK = ["innerGap", "outerGap", "minTileWidth", "minTileHeight", "floatSizePercent", "floatOnTop",
                      "borders", "focusColor", "floatColor", "borderWidth", "cornerRadius"];
        try {
            this._settings = new Settings.ExtensionSettings(CONFIG, UUID);
            const dir = Settings.BindingDirection.IN;
            for (const k of KEYS) this._settings.bindProperty(dir, k, k, () => this._bindKeys(), null);
            for (const k of LOOK) this._settings.bindProperty(dir, k, k, () => this._onLookChanged(), null);
            this._settings.bindProperty(dir, "notify", "notify", null, null);
            this._settings.bindProperty(dir, "floatRules", "floatRules", () => this._reapplyRules(), null);
            this._settings.bindProperty(dir, "noTileWorkspaces", "noTileWorkspaces", () => this._onWorkspacesChanged(), null);
        } catch (e) {
            global.logError(e);
        }
    }

    // (Re)register every hotkey from CONFIG. Safe to call repeatedly.
    _bindKeys() {
        const table = [
            [HK_TILING, "keyToggleTiling", () => this.toggleTiling()],
            [HK_FLOAT, "keyToggleFloat", () => this.toggleFloat()],
            [HK_RETILE, "keyRetile", () => this.retile()],
            [HK_NEXT, "keyFocusNext", () => this.focusStep(1)],
            [HK_PREV, "keyFocusPrev", () => this.focusStep(-1)],
            [HK_SWAPN, "keySwapNext", () => this.swapStep(1)],
            [HK_SWAPP, "keySwapPrev", () => this.swapStep(-1)],
            [HK_FIRST, "keyMakeFirst", () => this.makeFirst()],
            [HK_RULE, "keyAlwaysFloat", () => this.alwaysFloat()],
            [HK_WS, "keyToggleWorkspace", () => this.toggleWorkspace()],
        ];
        for (const [name, key, fn] of table) {
            try { Main.keybindingManager.removeHotKey(name); } catch (e) {}
            const binding = CONFIG[key];
            if (!binding) continue;   // the user cleared it: leave that action unbound
            try {
                Main.keybindingManager.addHotKey(name, binding, fn);
            } catch (e) {
                global.logError(e);
            }
        }
    }

    // A gap, size or border setting changed: restyle the borders and re-tile now.
    _onLookChanged() {
        for (const e of this._borders.values()) {
            e.sig = "";
            e.style = "";
        }
        this._retile();
    }

    // ----- hotkeys ---------------------------------------------------------

    toggleTiling() {
        this._tilingOn = !this._tilingOn;
        this._say(this._tilingOn ? "Tiling on" : "Tiling off");
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
        this._retile();
        this._say("Re-tiled");
    }

    // Move focus to the next (+1) or previous (-1) window, wrapping round.
    // Order: by monitor, then arrival order (the same order the layout uses).
    // Floating windows are included; minimised ones and other workspaces are not.
    focusStep(dir) {
        const workspace = global.workspace_manager.get_active_workspace();
        const list = [];
        this._order.forEach((win, i) => {
            if (this._navigable(win, workspace)) list.push({ win, mon: win.get_monitor(), i });
        });
        if (list.length === 0) return;
        list.sort((a, b) => (a.mon - b.mon) || (a.i - b.i));
        const wins = list.map((e) => e.win);
        const cur = wins.indexOf(global.display.focus_window);
        const next = cur < 0
            ? (dir > 0 ? 0 : wins.length - 1)
            : (cur + dir + wins.length) % wins.length;
        try {
            wins[next].activate(global.get_current_time());
        } catch (e) {
            global.logError(e);
        }
    }

    // The tiled windows on the focused window's monitor, in layout order.
    _tiledWith(win) {
        const workspace = global.workspace_manager.get_active_workspace();
        const mon = win.get_monitor();
        return this._order.filter((w) => this._eligible(w, workspace) && w.get_monitor() === mon);
    }

    // Swap the focused tile with the next (+1) or previous (-1) one, wrapping round.
    swapStep(dir) {
        const win = global.display.focus_window;
        if (!win || !this._order.includes(win)) return;
        const tiled = this._tiledWith(win);
        const i = tiled.indexOf(win);
        if (i < 0 || tiled.length < 2) return;
        const other = tiled[(i + dir + tiled.length) % tiled.length];
        const a = this._order.indexOf(win);
        const b = this._order.indexOf(other);
        this._order[a] = other;
        this._order[b] = win;
        this._retile();
    }

    // Move the focused tile to the first slot; everything else shifts along.
    makeFirst() {
        const win = global.display.focus_window;
        if (!win || !this._order.includes(win)) return;
        const tiled = this._tiledWith(win);
        if (tiled.indexOf(win) <= 0) return;
        const at = this._order.indexOf(tiled[0]);
        this._order.splice(this._order.indexOf(win), 1);
        this._order.splice(at, 0, win);
        this._retile();
    }

    toggleFloat() {
        const win = global.display.focus_window;
        if (!win || !this._order.includes(win)) return;
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
        this._decided.clear();
        this._retile();
    }

    _saveRules(rules) {
        CONFIG.floatRules = rules;
        if (this._settings) {
            try { this._settings.setValue("floatRules", rules); } catch (e) { global.logError(e); }
        }
    }

    // Super+Shift+F: put the focused window's app on the floating list, or take it off again.
    alwaysFloat() {
        const win = global.display.focus_window;
        if (!win || !this._order.includes(win)) return;
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

    _track(win) {
        if (!win || this._order.includes(win)) return;
        this._order.push(win);
        const ids = [];
        const add = (sig, cb) => {
            try { ids.push(win.connect(sig, cb)); } catch (e) { global.logError(e); }
        };
        add("unmanaged", () => this._forget(win));
        add("workspace-changed", () => { this._bump(win); this._settle(); });
        add("notify::fullscreen", () => this._settle());
        add("notify::appears-focused", () => this._onFocus());   // a second, per-window focus signal
        add("position-changed", () => this._refreshBorder(win));
        add("size-changed", () => this._refreshBorder(win));
        this._winConns.set(win, ids);
    }

    _forget(win) {
        const i = this._order.indexOf(win);
        if (i >= 0) this._order.splice(i, 1);
        this._floating.delete(win);
        this._saved.delete(win);
        this._ruled.delete(win);
        this._userTouched.delete(win);
        this._decided.delete(win);
        this._above.delete(win);
        this._winConns.delete(win);  // window is being destroyed; nothing to disconnect
        this._dropBorder(win);
        if (this._lastFocus === win) this._lastFocus = null;
        this._settle();
    }

    _bump(win) {
        const i = this._order.indexOf(win);
        if (i >= 0) this._order.splice(i, 1);
        this._order.push(win);
    }

    // ----- tiling ----------------------------------------------------------

    _eligible(win, workspace) {
        try {
            return this._tilingHere(workspace) &&
                win.window_type === Meta.WindowType.NORMAL &&
                !win.minimized &&
                !win.is_override_redirect() &&
                !win.is_skip_taskbar() &&
                !win.is_on_all_workspaces() &&
                !win.is_fullscreen() &&
                !win.get_transient_for() &&
                win.located_on_workspace(workspace) &&
                win.allows_move() &&
                win.resizeable !== false &&
                !this._floating.has(win);
        } catch (e) {
            return false;  // window object already gone
        }
    }

    // Anything the user could reasonably want to focus (looser than _eligible).
    _navigable(win, workspace) {
        try {
            return win.window_type === Meta.WindowType.NORMAL &&
                !win.minimized &&
                !win.is_override_redirect() &&
                !win.is_skip_taskbar() &&
                !win.get_transient_for() &&
                (win.is_on_all_workspaces() || win.located_on_workspace(workspace));
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

    _counts() {
        const ws = global.workspace_manager.get_active_workspace();
        let tiled = 0, floating = 0;
        for (const win of this._order) {
            if (this._floating.has(win)) { if (this._navigable(win, ws)) floating++; }
            else if (this._eligible(win, ws)) tiled++;
        }
        return { tiled, floating };
    }

    _retile() {
        this._gen++;   // any position check still queued from an earlier pass is now stale
        for (const win of this._order) this._applyRule(win);
        this._syncAbove();
        const workspace = global.workspace_manager.get_active_workspace();
        if (!this._tilingHere(workspace)) {
            this._refreshBorders();   // nothing to tile here; this just clears the borders
            return;
        }
        const byMonitor = new Map();
        for (const win of this._order) {
            if (!this._eligible(win, workspace)) continue;
            const mon = win.get_monitor();
            if (!byMonitor.has(mon)) byMonitor.set(mon, []);
            byMonitor.get(mon).push(win);
        }
        for (const [mon, wins] of byMonitor) {
            let area;
            try { area = this._workArea(workspace, mon, wins[0]); } catch (e) { continue; }
            // Too many windows for the screen: tile the first n, leave the rest alone.
            const n = fitCount(area, wins.length, CONFIG.innerGap, CONFIG.outerGap,
                               CONFIG.minTileWidth, CONFIG.minTileHeight);
            const cells = dwindle(area, n, CONFIG.innerGap, CONFIG.outerGap);
            for (let i = 0; i < n; i++) this._place(wins[i], cells[i]);
        }
        this._refreshBorders();
        this._bordersSoon();   // again once the windows have really moved
    }

    _place(win, r) {
        try {
            if (win.get_maximized()) win.unmaximize(Meta.MaximizeFlags.BOTH);
            const f = win.get_frame_rect();
            if (!this._saved.has(win)) {
                this._saved.set(win, { x: f.x, y: f.y, width: f.width, height: f.height });
            }
            if (f.x === r.x && f.y === r.y && f.width === r.width && f.height === r.height) return;
            win.move_resize_frame(true, r.x, r.y, r.width, r.height);
            this._verify(win, r, 3, this._gen);
        } catch (e) {
            global.logError(e);
        }
    }

    // Some windows (terminals, in particular) take the resize but ignore the move
    // in a combined move+resize request. Check where the window really ended up
    // and, if it is in the wrong place, move it with a separate request.
    // `gen` ties the check to the layout pass that asked for it; once a newer pass
    // has run, this check is out of date and does nothing.
    _verify(win, r, attempts, gen) {
        if (attempts <= 0) return;
        this._later(60, () => {
            if (gen !== this._gen) return;
            try {
                if (!this._tilingOn || this._floating.has(win) || !this._order.includes(win)) return;
                const f = win.get_frame_rect();
                if (f.x === r.x && f.y === r.y) return;
                win.move_frame(true, r.x, r.y);
                this._verify(win, r, attempts - 1, gen);
            } catch (e) {
                // window went away; nothing to do
            }
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
        const floating = this._floating.has(win);
        const focused = win === global.display.focus_window;
        return { float: floating, focus: focused && (floating || this._eligible(win, ws)) };
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

    // Focused (tiled or floating): focus colour. Floating but not focused: float colour.
    _borderStyle(st, bw, sc) {
        const line = st.focus ? CONFIG.focusColor : CONFIG.floatColor;
        const radius = Math.round((CONFIG.cornerRadius + CONFIG.borderWidth) * sc);
        return "border: " + bw + "px solid " + line + "; border-radius: " + radius +
            "px; background-color: transparent;";
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

    _bordersSoon() {
        if (this._borderPending) return;
        this._borderPending = true;
        this._later(150, () => {
            this._borderPending = false;
            this._refreshBorders();
        });
    }

    _refreshBorder(win) {
        if (!this._order.includes(win)) return;
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

    // ----- plumbing --------------------------------------------------------

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

    _connect(obj, sig, cb) {
        try {
            this._conns.push([obj, obj.connect(sig, cb)]);
        } catch (e) {
            global.logError(e);
        }
    }

    _say(msg) {
        if (!CONFIG.notify) return;
        try { Main.notify("MintyWM", msg); } catch (e) {}
    }
}

let app = null;

function init(metadata) {}

function enable() {
    app = new MintyWM();
    app.enable();
}

function disable() {
    if (app) {
        app.disable();
        app = null;
    }
}
