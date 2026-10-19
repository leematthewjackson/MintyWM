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
// Click to turn tiling on/off for the current workspace (or to resume it if paused everywhere).
// It only reads global.mintywm, which the extension publishes while it is enabled.
// It checks once a second, but only touches the panel when something changed.
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;

class MintyWMStatus extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._timer = 0;
        this._shown = "";
        this.showLabel = true;   // default, in case the settings cannot be loaded
        this.iconStyle = "symbolic";
        this._path = metadata.path || "";
        this._iconShown = "";
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            this.settings.bind("showLabel", "showLabel", () => this._refresh());
            this.settings.bind("iconStyle", "iconStyle", () => this._applyIcon());
        } catch (e) {
            global.logError(e);
        }
        this._applyIcon();
        this._refresh();
        this._timer = Mainloop.timeout_add(1000, () => {
            this._refresh();
            return true;
        });
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

    _refresh() {
        try {
            const api = global.mintywm;
            let label, tip, opacity;
            if (!api) {
                label = "?";
                tip = "The MintyWM extension is not enabled";
                opacity = 90;
            } else if (api.on) {
                label = String(api.tiled);
                const where = api.workspace ? " on workspace " + api.workspace : "";
                tip = "MintyWM tiling: ON" + where + " (" + api.tiled + " tiled, " + api.floating + " floating). Click to turn off on this workspace.";
                opacity = 255;
            } else if (api.globalOn === false) {
                label = "off";
                tip = "MintyWM tiling is paused everywhere. Click to turn on.";
                opacity = 120;
            } else {
                label = "off";
                tip = "MintyWM tiling: OFF on workspace " + (api.workspace || "this") + ". Click to turn on here.";
                opacity = 120;
            }
            const show = this.showLabel !== false;
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
        try {
            const api = global.mintywm;
            if (api) api.toggle();
            this._refresh();
        } catch (e) {
            global.logError(e);
        }
    }

    on_applet_removed_from_panel() {
        if (this._timer) {
            Mainloop.source_remove(this._timer);
            this._timer = 0;
        }
        if (this.settings) {
            try { this.settings.finalize(); } catch (e) {}
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MintyWMStatus(metadata, orientation, panelHeight, instanceId);
}
