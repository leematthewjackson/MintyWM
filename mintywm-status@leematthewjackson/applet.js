// MintyWM Status 1.1 RC — panel indicator for the MintyWM extension.
// By Lee Matthew Jackson - leematthewjackson.com
//
// Copyright (C) 2026 Lee Matthew Jackson
// SPDX-License-Identifier: GPL-3.0-or-later
//
// REQUIRES the MintyWM extension (mintywm@leematthewjackson).
// Left-click opens the status menu (state, overflow, actions, live keys).
// Middle-click toggles tiling for this workspace only.
// The icon changes: tiles = on, pause bars = paused everywhere, a dash = off on this workspace.
// A count like 3+1 means three tiled windows and one that did not fit (parked on screen).
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;

function isListenerSet(s) {
    return !!s && typeof s.add === "function" && typeof s.delete === "function" && typeof s[Symbol.iterator] === "function";
}

class MintyWMStatus extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._timer = 0;
        this._shown = "";
        this.showCount = true;
        this.iconStyle = "symbolic";
        this._path = metadata.path || "";
        this._iconShown = "";
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            this.settings.bind("showLabel", "showCount", () => this._refresh());
            this.settings.bind("iconStyle", "iconStyle", () => { this._iconShown = ""; this._refresh(); });
        } catch (e) {
            global.logError(e);
        }
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._buildContextMenu();
        if (!isListenerSet(global.mintywmListeners)) global.mintywmListeners = new Set();
        this._listener = () => this._refresh();
        global.mintywmListeners.add(this._listener);
        this._refresh();
    }

    _buildContextMenu() {
        try {
            const add = (label, fn) => {
                const item = new PopupMenu.PopupMenuItem(label);
                item.connect("activate", () => this._call(fn));
                this._applet_context_menu.addMenuItem(item);
            };
            add("Pause or resume tiling everywhere", (api) => api.toggleTiling());
            add("Tiling on or off for this workspace", (api) => api.toggleWorkspace());
            add("Re-tile now", (api) => api.retile());
            add("Reset tile sizes on this workspace", (api) => { if (api.resetSizes) api.resetSizes(); });
            add("Show key cheat sheet", (api) => { if (api.showCheat) api.showCheat(); });
            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        } catch (e) {
            global.logError(e);
        }
    }

    _call(fn) {
        try {
            const api = global.mintywm;
            if (api && typeof api.toggleTiling === "function") fn(api);
            else if (api && typeof api.toggle === "function") api.toggle();
            this._refresh();
        } catch (e) {
            global.logError(e);
        }
    }

    _readState(api) {
        if (typeof api.state === "function") return api.state();
        return {
            on: api.on, globalOn: api.globalOn, workspace: api.workspace,
            excluded: false, tiled: api.tiled, floating: api.floating, overflow: 0,
            mode: "tile",
        };
    }

    _setPolling(want) {
        if (want && !this._timer) {
            this._timer = Mainloop.timeout_add(1000, () => {
                this._refresh();
                return true;
            });
        } else if (!want && this._timer) {
            Mainloop.source_remove(this._timer);
            this._timer = 0;
        }
    }

    _applyIcon(kind) {
        const colour = this.iconStyle === "colour" && kind === "on";
        const file = colour ? "/icon.png"
            : kind === "paused" ? "/minty-paused-symbolic.svg"
            : kind === "wsoff" ? "/minty-wsoff-symbolic.svg"
            : "/mintywm-symbolic.svg";
        const sig = (colour ? "colour" : "symbolic") + file;
        if (sig === this._iconShown) return;
        this._iconShown = sig;
        try {
            const path = this._path + file;
            if (this._path && imports.gi.Gio.File.new_for_path(path).query_exists(null)) {
                if (colour) this.set_applet_icon_path(path);
                else this.set_applet_icon_symbolic_path(path);
                return;
            }
        } catch (e) {
            global.logError(e);
        }
        this.set_applet_icon_symbolic_name("view-grid-symbolic");
    }

    _refresh() {
        try {
            const api = global.mintywm;
            this._setPolling(!!api && typeof api.state !== "function");
            let label, tip, kind;
            if (!api) {
                label = "?";
                tip = "The MintyWM extension is not enabled";
                kind = "paused";
            } else {
                const s = this._readState(api);
                const ws = s.workspace || "this";
                const mode = s.mode && s.mode !== "tile" ? " Layout: " + s.mode + "." : "";
                if (s.on) {
                    label = String(s.tiled) + (s.overflow ? "+" + s.overflow : "");
                    tip = "MintyWM: ON on workspace " + ws + " (" + s.tiled + " tiled, " +
                        s.floating + " floating" + (s.overflow ? ", " + s.overflow + (s.overflow === 1 ? " didn't fit and is floating" : " didn't fit and are floating") : "") + ")." + mode;
                    kind = "on";
                } else if (s.globalOn === false) {
                    label = "off";
                    tip = "MintyWM: paused everywhere.";
                    kind = "paused";
                } else {
                    label = "ws";
                    tip = "MintyWM: OFF on workspace " + ws + (s.excluded ? " (it is on the excluded list)." : ".") + mode;
                    kind = "wsoff";
                }
                tip += "\nClick for controls and keys. Middle-click: this workspace only.";
            }
            this._applyIcon(kind);
            const show = this.showCount !== false;
            const key = label + "|" + tip + "|" + show + "|" + kind;
            if (key === this._shown) return;
            this._shown = key;
            this.set_applet_label(label);
            this.hide_applet_label(!show);
            this.set_applet_tooltip(tip);
            this.actor.opacity = 255;
        } catch (e) {
            global.logError(e);
        }
    }

    _rebuildMenu() {
        this.menu.removeAll();
        const api = global.mintywm;
        const add = (label, fn, sensitive) => {
            const item = new PopupMenu.PopupMenuItem(label);
            if (sensitive === false) item.setSensitive(false);
            else item.connect("activate", () => this._call(fn));
            this.menu.addMenuItem(item);
            return item;
        };
        if (!api) {
            add("The MintyWM extension is not enabled", null, false);
            return;
        }
        const s = this._readState(api);
        const ws = s.workspace || "?";
        if (s.on) {
            add("Tiling on · workspace " + ws + " · " + s.tiled + " tiled, " + s.floating + " floating", null, false);
        } else if (s.globalOn === false) {
            add("Tiling is paused everywhere", null, false);
        } else {
            add("Tiling is off on workspace " + ws, null, false);
        }
        if (s.overflow) {
            add(s.overflow + (s.overflow === 1 ? " window didn't fit, so it is floating" : " windows didn't fit, so they are floating"), null, false);
        }
        if (s.mode && s.mode !== "tile") add("Layout: " + s.mode, null, false);
        try {
            const everywhere = new PopupMenu.PopupSwitchMenuItem("Tiling everywhere", s.globalOn !== false);
            everywhere.connect("toggled", () => this._call((a) => a.toggleTiling()));
            this.menu.addMenuItem(everywhere);
            const here = new PopupMenu.PopupSwitchMenuItem("Tiling on workspace " + ws, !!s.on);
            here.connect("toggled", () => this._call((a) => a.toggleWorkspace()));
            this.menu.addMenuItem(here);
        } catch (e) {
            add(s.globalOn === false ? "Resume tiling everywhere" : "Pause tiling everywhere", (a) => a.toggleTiling());
            add("Tiling on or off for this workspace", (a) => a.toggleWorkspace());
        }
        add("Re-tile now", (a) => a.retile());
        add("Reset tile sizes on this workspace", (a) => { if (a.resetSizes) a.resetSizes(); });
        if (typeof api.showCheat === "function") add("Show key cheat sheet", (a) => a.showCheat());
        const rows = typeof api.keys === "function" ? api.keys() : [];
        if (rows.length) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            add("Keys", null, false);
            for (let i = 0; i < rows.length && i < 18; i++) {
                add(rows[i].keys + "   " + rows[i].action, null, false);
            }
        }
    }

    on_applet_clicked() {
        this._rebuildMenu();
        this.menu.toggle();
    }

    on_applet_middle_clicked() {
        this._call((api) => api.toggleWorkspace());
    }

    on_applet_removed_from_panel() {
        this._setPolling(false);
        if (isListenerSet(global.mintywmListeners)) global.mintywmListeners.delete(this._listener);
        if (this.settings) {
            try { this.settings.finalize(); } catch (e) {}
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MintyWMStatus(metadata, orientation, panelHeight, instanceId);
}
