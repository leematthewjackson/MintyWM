// MintyWM Status - panel indicator for the MintyWM extension.
// By Lee Matthew Jackson - leematthewjackson.com
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
// REQUIRES the MintyWM extension (mintywm@leematthewjackson) to be installed and enabled.
// Shows tiling on/off for the workspace you are on, and the window count.
// Click: pause or resume tiling everywhere. Middle-click: tiling on/off for this workspace.
// The right-click menu has both, plus "Re-tile now" and "Reset tile sizes".
// It only reads global.mintywm, which the extension publishes while it is enabled.
// The extension tells it when something changes (no polling). With an older extension
// that can't do that, it falls back to checking once a second.
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;

// The applet and the extension share a set of change callbacks on `global`.
function isListenerSet(s) {
    return !!s && typeof s.add === "function" && typeof s.delete === "function" && typeof s[Symbol.iterator] === "function";
}

class MintyWMStatus extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._timer = 0;
        this._shown = "";
        // Not "showLabel": that name is a method of the applet base class, and hiding it breaks
        // hide_applet_label(). The settings key is still "showLabel", so saved choices are kept.
        this.showCount = true;   // default, in case the settings cannot be loaded
        this.iconStyle = "symbolic";
        this._path = metadata.path || "";
        this._iconShown = "";
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            this.settings.bind("showLabel", "showCount", () => this._refresh());
            this.settings.bind("iconStyle", "iconStyle", () => this._applyIcon());
        } catch (e) {
            global.logError(e);
        }
        this._buildMenu();
        this._applyIcon();
        // The extension calls everything in this set when its state changes. The set is
        // shared, so it works whichever of the two is loaded first.
        if (!isListenerSet(global.mintywmListeners)) global.mintywmListeners = new Set();
        this._listener = () => this._refresh();
        global.mintywmListeners.add(this._listener);
        this._refresh();
    }

    _buildMenu() {
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
            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        } catch (e) {
            global.logError(e);
        }
    }

    // Run an action on the extension, if it is there and new enough to have it.
    _call(fn) {
        try {
            const api = global.mintywm;
            if (api && typeof api.toggleTiling === "function") fn(api);
            else if (api && typeof api.toggle === "function") api.toggle();   // older extension
            this._refresh();
        } catch (e) {
            global.logError(e);
        }
    }

    // Symbolic = a single-colour icon that follows the panel theme; colour = the full icon.
    // Anything missing falls back to a stock icon so the applet never ends up blank.
    _applyIcon() {
        const style = this.iconStyle === "colour" ? "colour" : "symbolic";
        if (style === this._iconShown) return;
        this._iconShown = style;
        try {
            const file = this._path + (style === "colour" ? "/icon.png" : "/mintywm-symbolic.svg");
            if (this._path && imports.gi.Gio.File.new_for_path(file).query_exists(null)) {
                if (style === "colour") this.set_applet_icon_path(file);
                else this.set_applet_icon_symbolic_path(file);
                return;
            }
        } catch (e) {
            global.logError(e);
        }
        this.set_applet_icon_symbolic_name("view-grid-symbolic");
    }

    // Everything the panel needs in one go. Older extensions have no state(), so ask
    // the individual properties instead.
    _readState(api) {
        if (typeof api.state === "function") return api.state();
        return {
            on: api.on, globalOn: api.globalOn, workspace: api.workspace,
            excluded: false, tiled: api.tiled, floating: api.floating, overflow: 0,
        };
    }

    // Poll only when the extension can't tell us about changes itself.
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

    _refresh() {
        try {
            const api = global.mintywm;
            this._setPolling(!!api && typeof api.state !== "function");
            let label, tip, opacity;
            if (!api) {
                label = "?";
                tip = "The MintyWM extension is not enabled";
                opacity = 90;
            } else {
                const s = this._readState(api);
                const ws = s.workspace || "this";
                if (s.on) {
                    label = String(s.tiled);
                    tip = "MintyWM tiling: ON on workspace " + ws + " (" + s.tiled + " tiled, " + s.floating + " floating" +
                        (s.overflow ? ", " + s.overflow + " didn't fit" : "") + ").";
                    opacity = 255;
                } else if (s.globalOn === false) {
                    label = "off";
                    tip = "MintyWM tiling is paused everywhere.";
                    opacity = 120;
                } else {
                    label = "off";
                    tip = "MintyWM tiling: OFF on workspace " + ws + (s.excluded ? " (it is on the excluded list)." : ".");
                    opacity = 120;
                }
                tip += "\nClick: pause or resume tiling everywhere. Middle-click: this workspace only.";
            }
            const show = this.showCount !== false;
            const key = label + "|" + tip + "|" + opacity + "|" + show;
            if (key === this._shown) return;   // identical to what is already on screen
            this._shown = key;
            this.set_applet_label(label);
            this.hide_applet_label(!show);
            this.set_applet_tooltip(tip);
            this.actor.opacity = opacity;
        } catch (e) {
            global.logError(e);
        }
    }

    on_applet_clicked() {
        this._call((api) => api.toggleTiling());
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
