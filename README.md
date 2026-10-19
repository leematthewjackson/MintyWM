# MintyWM

**Dynamic tiling window management for Cinnamon.**

A small, from-scratch auto-tiling extension for the Cinnamon desktop (Muffin / GJS), in the style of Hyprland's *dwindle* layout. Open a window and it tiles. Close one and everything refills the space. No plugins, no animations, nothing to learn beyond a handful of keys.

It does not try to replace Cinnamon features. Moving windows between workspaces, Alt+Tab, panels and the rest all stay as they are.

By [Lee Matthew Jackson](https://leematthewjackson.com) · Mastodon: [@leematthewjackson@mastodon.social](https://mastodon.social/@leematthewjackson)

---

## What's in this repo

| Folder | What it is | Version |
|---|---|---|
| `mintywm@leematthewjackson/` | **The extension.** This is MintyWM itself, with its own settings panel. | 0.8 |
| `mintywm-status@leematthewjackson/` | **Optional panel applet.** Shows tiling status and the window count. It is separate and not bundled. It **requires the extension** and does nothing without it. | 0.6 |

The applet is separate because Cinnamon extensions and applets are installed and enabled independently.

---

## Features

- **Dwindle auto-tiling.** Each new window splits the space left by the previous one, alternating direction.
- **Automatic refill.** Closing or minimising a window re-tiles the rest.
- **Float any window.** Pop a window out of the layout with one key and put it back later. It returns to its previous size and position.
- **Always-float apps.** Keep chosen apps floating by default, edited from the settings panel. Cinnamon's own settings windows are in the list by default.
- **Floating windows stay on top** (optional, on by default), so they don't get lost behind tiled windows.
- **Per-workspace switch.** Turn tiling off on specific workspaces (say 4 and 9) and keep it everywhere else.
- **Keyboard navigation.** Cycle focus, swap windows and promote a window to the first slot.
- **Focus and float borders.** A thin luminous border marks the focused window (mint) and floating windows (magenta). Colours, width and corner radius are configurable.
- **Gaps and minimum sizes.** Inner and outer gaps. When too many windows would make tiles smaller than the minimum, the extras float instead of becoming unusable slivers.
- **Settings panel built in.** Changes apply live, with no restart.
- **Status applet** (optional). Shows *on / off* and the number of tiled windows, and toggles tiling on click.

---

## Requirements

- **Cinnamon 6.0 – 6.8** (Linux Mint 22.x, or Ubuntu Cinnamon / any distro with a recent Cinnamon)
- X11 session (Cinnamon's standard session)

---

## Installation

### Quick install

If the two zip files are in `~/Downloads`:

```bash
mkdir -p ~/.local/share/cinnamon/extensions ~/.local/share/cinnamon/applets
unzip -oq ~/Downloads/mintywm-extension-0.8.zip -d ~/.local/share/cinnamon/extensions/
unzip -oq ~/Downloads/mintywm-status-applet-0.6.zip -d ~/.local/share/cinnamon/applets/
```

### From this repository

```bash
git clone https://github.com/leematthewjackson/MintyWM.git mintywm
cd mintywm
mkdir -p ~/.local/share/cinnamon/extensions ~/.local/share/cinnamon/applets
cp -r mintywm@leematthewjackson ~/.local/share/cinnamon/extensions/
cp -r mintywm-status@leematthewjackson ~/.local/share/cinnamon/applets/
```

The folder names must stay exactly as they are, because Cinnamon matches them to the `uuid` in `metadata.json`.

### Enable it

1. Restart Cinnamon: press **Alt+F2**, type `r`, press **Enter**.
2. Open **System Settings → Extensions**, select **MintyWM** and enable it with the **+** button.
3. *(Optional)* Open **System Settings → Applets** (or right-click the panel → *Applets*), find **MintyWM Status** and add it to your panel.

Tiling starts straight away.

### Updating

Unzip or copy the new version over the old one, then restart Cinnamon (**Alt+F2**, `r`). Your settings are kept.

### Uninstalling

Disable it in **Extensions** (and remove the applet from the panel), then:

```bash
rm -rf ~/.local/share/cinnamon/extensions/mintywm@leematthewjackson
rm -rf ~/.local/share/cinnamon/applets/mintywm-status@leematthewjackson
```

---

## Keyboard shortcuts

All shortcuts can be changed in the extension's settings under **Keyboard**.

| Keys | Action |
|---|---|
| **Super + T** | Pause or resume tiling everywhere |
| **Super + Alt + T** | Turn tiling on or off for the **current workspace** |
| **Super + Shift + T** | Re-tile everything now. This also turns tiling back on if it was off, here or everywhere, in one press. |
| **Super + F** | Float or tile the focused window |
| **Super + Shift + F** | Always float this app (or stop always floating it) |
| **Super + J** | Focus the next window |
| **Super + K** | Focus the previous window |
| **Super + Shift + J** | Swap the focused window with the next one |
| **Super + Shift + K** | Swap the focused window with the previous one |
| **Super + Shift + H** | Make the focused window the first (largest) tile |

Focus cycling goes round in a loop, and Cinnamon's own Alt+Tab is untouched.

---

## Using MintyWM

### Floating windows

- **Super + F** toggles a single window out of or back into the layout. It remembers where the window was and puts it back there.
- **Super + Shift + F** makes it permanent for that *app*: the app's window class is added to your *Floating apps* list and it floats from then on. Press it again to remove the rule.

### Floating apps list

Under **Floating apps** in the settings, each rule has:

| Column | Meaning |
|---|---|
| **Enabled** | Tick to apply the rule |
| **Window class** | Matches the window's class or instance name. Case-insensitive, `*` is a wildcard (e.g. `cinnamon-settings*`) |
| **Title** *(optional)* | Only match windows whose title matches (also wildcarded) |

Defaults: `cinnamon-settings*` and `xlet-settings*`, so Cinnamon's settings and extension/applet configuration windows float.

**Finding a window's class:** run this in a terminal, then click the window:

```bash
xprop WM_CLASS
```

The output looks like `WM_CLASS(STRING) = "instance", "ClassName"`. Either part works as a rule. Or just focus the window and press **Super + Shift + F**.

### Workspaces

To keep tiling off on some workspaces, list their numbers (as Cinnamon shows them, starting at 1) in **Tiling → Workspaces**:

```
4, 9        → workspaces 4 and 9
7-9         → workspaces 7, 8 and 9
2, 5-6      → 2, 5 and 6
```

Or just press **Super + Alt + T** on a workspace and it is added to or removed from the list for you.

On a workspace where tiling is off, MintyWM does not move, resize, border or pin anything. Windows stay as they are. Windows moved there keep their size.

### The status applet

| Panel shows | Meaning |
|---|---|
| A number (e.g. `3`) | Tiling is on for this workspace, with that many tiled windows |
| `off` (dimmed) | Tiling is off here, or paused everywhere |
| `?` | The MintyWM extension isn't enabled |

**Click it** to turn tiling on or off for the current workspace (or to resume tiling if it is paused everywhere). The tooltip says which state you're in and which workspace.

Applet settings: show or hide the count label, and choose a **symbolic** icon (matches your panel theme, the default) or the **full-colour** icon.

---

## Settings reference

Open **System Settings → Extensions → MintyWM → Configure** (the gear icon). Changes apply immediately.

| Page | Option | Default |
|---|---|---|
| **Tiling** | Inner gap (between windows) | 6 px |
| | Outer gap (screen edge) | 6 px |
| | Minimum tile width / height | 200 / 120 px |
| | Size of windows that float | 60 % of the screen |
| | Keep floating windows on top | on |
| | Workspaces where tiling is off | none |
| | Show on-screen notices | on |
| **Floating apps** | Apps that always float | `cinnamon-settings*`, `xlet-settings*` |
| **Borders** | Show borders | on |
| | Focused colour | `rgb(0,255,204)` (mint) |
| | Floating colour | `rgb(255,0,255)` (magenta) |
| | Border width | 2 px |
| | Corner radius | 8 px |
| **Keyboard** | All shortcuts above | see table |
| **About** | Credits and links | |

---

## Troubleshooting

**Nothing tiles after installing.** Make sure you restarted Cinnamon (Alt+F2, `r`) and enabled MintyWM under *Extensions*. If it still misbehaves, check the log with `journalctl --user -b | grep -i mintywm` or look in **Looking Glass** (Alt+F2, `lg`) under *Log*.

**One app won't tile.** It may be on the *Floating apps* list, or tiling may be off on that workspace. Try **Super + Shift + T**.

**A window refuses to be placed.** MintyWM retries a few times because some apps, such as terminals, resize in steps. If an app keeps ignoring it, add it to the Floating apps list.

**The applet shows `?`.** The extension isn't running. Enable MintyWM under *Extensions*.

**A shortcut clashes with something.** Change it under *Keyboard* in the settings.

**Windows look cramped or tiny.** Raise the minimum tile size or lower the gaps. Extra windows float once tiles would drop below the minimum.

---

## Design principles

- **Simple.** One layout (dwindle), a handful of keys, no animations, no plugin system.
- **Don't reinvent Cinnamon.** Workspaces, Alt+Tab, window rules and snapping stay where they belong.
- **Fast feedback.** Border changes appear instantly; layout updates are debounced so bursts of windows settle once.
- **Safe to leave on.** Stale timers, vanished windows and a broken settings system are all handled without errors.

---

## Repository layout

```
LICENSE                               GPL-3.0 full text
README.md                             This file
mintywm@leematthewjackson/            The extension
├── extension.js                      Tiling logic
├── settings-schema.json              Settings panel definition
├── metadata.json                     Name, version, UUID, supported Cinnamon versions
├── icon.png                          Icon for the Extensions list
└── README.md

mintywm-status@leematthewjackson/     The optional panel applet
├── applet.js
├── settings-schema.json
├── metadata.json
├── icon.png                          Full-colour icon
├── mintywm-symbolic.svg              Single-colour panel icon
└── README.md
```

---

## Licence

MintyWM is free software, released under the **GNU General Public License v3.0**. You can use, study, share and modify it, and if you distribute a modified version it must stay under the same licence. See the [`LICENSE`](LICENSE) file for the full text.

Copyright (C) 2026 Lee Matthew Jackson

## Disclaimer

MintyWM is a hobby project, written in my spare time and tested on my own machines. I've done my best, but it comes with **no warranty of any kind**, and you use it **at your own risk**. As set out in sections 15 and 16 of the GPL-3.0, I'm not liable for any damage, data loss or other problems that result from using it.

It moves and resizes windows, so it's worth saving your work before trying it. If something goes wrong, disable it under **System Settings → Extensions** and restart Cinnamon (Alt+F2, `r`). Bug reports and pull requests are welcome, but I can't promise support or fixes.

## Author

**Lee Matthew Jackson**
Web: [leematthewjackson.com](https://leematthewjackson.com)
Mastodon: [@leematthewjackson@mastodon.social](https://mastodon.social/@leematthewjackson)
