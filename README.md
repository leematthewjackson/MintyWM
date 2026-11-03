# MintyWM

**Dynamic tiling window management for Cinnamon.**

A small, from-scratch auto-tiling extension for the Cinnamon desktop (Muffin / GJS), in the style of Hyprland's *dwindle* layout. Open a window and it tiles. Close one and everything refills the space. No plugins, no animations, nothing to learn beyond a handful of keys.

It does not try to replace Cinnamon features. Moving windows between workspaces, Alt+Tab, panels and the rest all stay as they are.

> [!WARNING]
> **Alpha software.** MintyWM is brand new, so don't expect miracles. Things will break and settings may change. **Please [report bugs here](https://github.com/leematthewjackson/MintyWM/issues/new)**, with your distro, Cinnamon version and what happened. Thank you!

By [Lee Matthew Jackson](https://leematthewjackson.com) · Mastodon: [@leematthewjackson@mastodon.social](https://mastodon.social/@leematthewjackson)

## Watch the demo

> [!NOTE]
> **This video is already out of date.** The extension has been changing quickly since it was recorded, so shortcuts and behaviour in the clip will not match the current release. Use this README (1.1 RC), not the video.

[![MintyWM demo video on YouTube](https://img.youtube.com/vi/CHejYv80eo8/maxresdefault.jpg)](https://youtu.be/CHejYv80eo8)

▶️ **[Watch the MintyWM demo on YouTube](https://youtu.be/CHejYv80eo8)** for the general idea: auto-tiling, floating windows, and per-workspace switching. The keys on screen are from an earlier build.

Look at my "rice" :D

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/8a30becd-04ed-447c-8047-3a59e43ec3ae" />

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/04513454-dafa-4be6-9dbd-bd9771e2c522" />

---

## What's in this repo

| Folder | What it is | Version |
|---|---|---|
| `mintywm@leematthewjackson/` | **The extension.** This is MintyWM itself, with its own settings panel. | 1.1 RC |
| `mintywm-status@leematthewjackson/` | **Optional panel applet.** Shows tiling status and the window count. It is separate and not bundled. It **requires the extension** and does nothing without it. | 1.1 RC |

The applet is separate because Cinnamon extensions and applets are installed and enabled independently.

---

## Features

- **Dwindle auto-tiling.** Each new window splits the focused tile. The split direction is remembered, so it does not flip just because a rectangle goes square.
- **Automatic refill.** Closing or minimising a window re-tiles the rest and keeps the other splits.
- **Directional focus.** Ctrl+Super+arrows moves to the window in that direction. Ctrl+Super+Shift+arrows swaps with it. Super+arrows stays with Cinnamon's own snapping.
- **One key set.** The letter keys follow Hyprland and Omarchy (Super+T floats, Super+F is fullscreen, Super+J toggles the split). Pseudotile and pop-out keep the Omarchy letters but add Shift, because Cinnamon already uses Super+P and Super+O. The cheat sheet is Ctrl+Super+/. Change any of them under Keyboard.
- **Kept on screen.** Windows that cannot shrink small enough are parked on the work area instead of being left past the edge. Handy on a 1080p display. New installs use 8px gaps; if you already saved 30px gaps, set them back yourself.
- **Float any window.** Pop a window out of the layout with one key and put it back later. It returns to its previous size and position.
- **Always-float apps.** Keep chosen apps floating by default, edited from the settings panel. Cinnamon's own settings windows are in the list by default.
- **Floating windows stay on top** (optional, on by default), so they don't get lost behind tiled windows.
- **Per-workspace switch.** Turn tiling off on specific workspaces (say 4 and 9) and keep it everywhere else.
- **Keyboard navigation.** Ctrl+Super+arrows move by direction. Ctrl+Super+Shift+arrows swap.
- **Resizable tiles.** Grow or shrink a tile on one axis, or drag an edge. A diagonal drag keeps both edges. Sizes are kept per workspace.
- **Fullscreen, fill, and monocle.** Real fullscreen, fill the work area with the panels still visible, or show one window and keep the gaps.
- **Pseudotile and pop-out.** Super+Shift+P keeps a smaller size inside the tile. Super+Shift+O floats the window and pins it above the tiles. Bare Super+P and Super+O stay with Cinnamon.
- **Focus and float borders.** A thin luminous border marks the focused window (mint) and floating windows (magenta). Colours, width and corner radius are configurable, with each corner settable separately.
- **Gaps and minimum sizes.** Inner and outer gaps. Gaps shrink before a window is refused. Extras are parked on screen (magenta border) instead of being left wherever they last were. Apps that refuse to shrink below their own minimum size get a bigger tile.
- **Settings panel built in.** Changes apply live, with no restart.
- **Status applet** (optional). Three icons: tiling, paused everywhere, or off on this workspace. The count is how many windows are tiled, and `3+1` means one was parked. Click opens controls and the live key list. Middle-click still toggles this workspace.

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
unzip -oq ~/Downloads/mintywm-extension-1.1-rc.zip -d ~/.local/share/cinnamon/extensions/
unzip -oq ~/Downloads/mintywm-status-applet-1.1-rc.zip -d ~/.local/share/cinnamon/applets/
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

One set, close to Hyprland and Omarchy. Every shortcut can be changed under **Keyboard**. If Cinnamon already owns a shortcut, that one binding is skipped and a warning is written to the Cinnamon log.

Ctrl+Super+arrows move focus. Ctrl+Super+Shift+arrows swap. Super+arrows is left for Cinnamon's window snapping.

Omarchy's pseudotile and pop-out are Super+P and Super+O. Cinnamon already binds those (switch monitors, and orientation lock), so MintyWM uses the same letters with Shift. Even sizes is Ctrl+Super+=, because Super+Alt+= is the magnifier.

| Keys | Action |
|---|---|
| **Super + T** | Float or tile |
| **Super + Shift + T** | Always float this app, or stop |
| **Super + F** | Fullscreen |
| **Super + Alt + F** | Fill the work area |
| **Super + Ctrl + F** | Monocle |
| **Super + J** | Toggle split direction |
| **Super + Shift + P** | Pseudotile |
| **Super + Shift + O** | Pop out and pin |
| **Super + W** | Close the window |
| **Ctrl + Super + /** | Cheat sheet |
| **Super + = / -** | Wider / narrower |
| **Super + Shift + = / -** | Taller / shorter |
| **Ctrl + Super + =** | Even sizes on this workspace |
| **Ctrl + Super + arrows** | Focus |
| **Ctrl + Super + Shift + arrows** | Swap |
| **Super + Ctrl + T** | Pause or resume tiling everywhere |
| **Super + Alt + T** | This workspace only |
| **Super + Shift + R** | Re-tile now |

Left with Cinnamon, on a stock install: Super+O (orientation lock), Super+P (switch monitors), Super+Alt+= and Super+Alt+- (magnifier), Super+arrows (snap), Super+Shift+arrows (another monitor), Super+D (show desktop), Super+E (home), Super+L (Looking Glass), Super+S (desklets), Super+Space (keyboard layout), Super+C and Super+N (calendar and notifications), Ctrl+Alt+arrows (workspaces), and Alt+Tab. Super+1 through Super+9, and Super+Shift+1 through Super+9, belong to the grouped window list until you turn on Workspace numbers below.

**Workspace numbers (optional, off).** Under **Keyboard → Workspace numbers**, Super+1 through Super+9 switch to that workspace. Super+Shift+1 through Super+9 send the focused window to that workspace and leave you where you are. From workspace 1, Super+Shift+2 sends the focused window to workspace 2. Press Super+2 when you want to follow it. A workspace that does not exist is not created. Grouped window list uses those keys, including with Shift, to focus or open panel buttons. Turn that off first: **Applets → Grouped window list → General → Hot Keys**, then disable **Enable Super+number shortcut to switch/open apps**. Restart Cinnamon (Alt+F2, `r`). Do not also assign Cinnamon’s own workspace shortcuts to these keys.

**Resizing.** Drag a tile's edge, or use the resize keys. The other tiles make room. Sizes are remembered per workspace. The status applet's menu, and *Tiling → Window sizes*, can reset them.

**When a window does not fit.** The screen is one split tree, not two stacks. A wide window on the left and a column on the right is just how those splits landed. If another tile would be smaller than the minimum, or smaller than the app itself allows, the newest window floats. It stays floating where you leave it until you press Super+T to tile it again. Closing another window does not pull it back in. Super+T can float a different window if there is still no room.

---

## Using MintyWM

### Floating windows

- **Super + T** toggles a single window out of or back into the layout. It remembers where the window was and puts it back there.
- **Super + Shift + T** makes it permanent for that *app*: the app's window class is added to your *Floating apps* list and it floats from then on. Press it again to remove the rule.

### Floating apps list

Under **Floating apps** in the settings, each rule has:

| Column | Meaning |
|---|---|
| **Enabled** | Tick to apply the rule |
| **Window class** | Matches the window's class or instance name. Case-insensitive, `*` is a wildcard (e.g. `cinnamon-settings*`) |
| **Title** *(optional)* | Only match windows whose title matches (also wildcarded) |

Defaults: `cinnamon-settings*` and `xlet-settings*`, so Cinnamon's settings and extension/applet configuration windows float, plus `fontforge*`, `gnome-font-viewer*` and `copyq*` (FontForge, the font viewer and the CopyQ clipboard manager).

**Finding a window's class:** run this in a terminal, then click the window:

```bash
xprop WM_CLASS
```

The output looks like `WM_CLASS(STRING) = "instance", "ClassName"`. Either part works as a rule. Or just focus the window and press **Super + Shift + T**.

<img width="1079" height="1003" alt="image" src="https://github.com/user-attachments/assets/f6e57040-0e68-4cdf-b6ac-2af0baa88754" />


### Workspaces

To keep tiling off on some workspaces, list their numbers (as Cinnamon shows them, starting at 1) in **Tiling → Workspaces**:

```
4, 9        → workspaces 4 and 9
7-9         → workspaces 7, 8 and 9
2, 5-6      → 2, 5 and 6
```
<img width="875" height="811" alt="image" src="https://github.com/user-attachments/assets/1158b375-8398-488d-8bc7-7c9978f12814" />

Or just press **Super + Alt + T** on a workspace and it is added to or removed from the list for you.

On a workspace where tiling is off, MintyWM does not move, resize, border or pin anything. Windows stay as they are. Windows moved there keep their size.

### The status applet

| Panel shows | Meaning |
|---|---|
| A number (e.g. `3`) | Tiling is on for this workspace, with that many tiled windows |
| `off` (dimmed) | Tiling is off here, or paused everywhere |
| `?` | The MintyWM extension isn't enabled |

**Click it** to pause or resume tiling everywhere. **Middle-click** turns tiling on or off for the current workspace only. The right-click menu has both, plus **Re-tile now**. The tooltip says which state you're in, which workspace, and whether that workspace is on the excluded list.

Applet settings: show or hide the count label, and choose a **symbolic** icon (matches your panel theme, the default) or the **full-colour** icon.

---

## Settings reference

Open **System Settings → Extensions → MintyWM → Configure** (the gear icon). Changes apply immediately.

<img width="825" height="907" alt="image" src="https://github.com/user-attachments/assets/0d52e981-bb5b-48ab-8368-9130f8f798bd" />


| Page | Option | Default |
|---|---|---|
| **Tiling** | Inner gap (between windows) | 8 px |
| | Outer gap (screen edge) | 8 px |
| | Minimum tile width / height | 200 / 120 px |
| | Resize step (one press of Super+= / Super+-) | 5 % |
| | Reset tile sizes on every workspace | button |
| | Size of windows that float | 60 % of the screen |
| | Keep floating windows on top | on |
| | Workspaces where tiling is off | none |
| | Show on-screen notices | on |
| | Log why windows are or aren't tiled | off |
| **Floating apps** | Apps that always float | `cinnamon-settings*`, `xlet-settings*`, `fontforge*`, `gnome-font-viewer*`, `copyq*` |
| **Borders** | Show borders | on |
| | Focused colour | `rgb(0,255,204)` (mint) |
| | Floating colour | `rgb(255,0,255)` (magenta) |
| | Border width | 2 px |
| | Corner radius (all corners, when not set separately) | 8 px |
| | Set each corner separately (top-left, top-right, bottom-left, bottom-right) | on: 11, 11, 0, 0 px |
| **Keyboard** | All shortcuts above, including *Tile sizes* | see table |
| **About** | Credits and links | |

---

## Troubleshooting

**Nothing tiles after installing.** Make sure you restarted Cinnamon (Alt+F2, `r`) and enabled MintyWM under *Extensions*. If it still misbehaves, check the log with `journalctl --user -b | grep -i mintywm` or look in **Looking Glass** (Alt+F2, `lg`) under *Log*.

**One app won't tile.** It may be on the *Floating apps* list, or tiling may be off on that workspace. Try **Super + Shift + T**.

**Nothing tiles, even after Super + T.** That workspace is probably on the excluded list (Super + T then says so). Press **Super + Alt + T** or **Super + Shift + T**, or clear it under *Tiling → Workspaces*.

**Why isn't this window tiled?** Open **Looking Glass** (Alt+F2, `lg`) and run `global.mintywm.dump()`. It lists every window and why it is or isn't tiled (minimised, floating, invisible, didn't fit, and so on). For a bug report, turn on *Log why windows are or aren't tiled* under *Tiling → Feedback* and include the log.

**A window refuses to be placed.** MintyWM retries a few times because some apps, such as terminals, resize in steps. If an app keeps ignoring it, add it to the Floating apps list.

**The applet shows `?`.** The extension isn't running. Enable MintyWM under *Extensions*.

**A shortcut clashes with something.** Change it under *Keyboard* in the settings. An install that still has the old Super+O, Super+P or Super+Alt+= binding is moved to the 1.1 default on the next start, unless you had already changed that shortcut yourself.

To see shortcuts you have changed from the defaults:

```bash
dconf dump /org/cinnamon/desktop/keybindings/
```

To list the bindings Cinnamon is actually using (defaults plus your changes):

```bash
for s in org.cinnamon.desktop.keybindings org.cinnamon.desktop.keybindings.wm org.cinnamon.desktop.keybindings.media-keys; do
  gsettings list-recursively "$s"
done
```

**Windows look cramped or tiny.** Raise the minimum tile size or lower the gaps. Extra windows are left out of the layout (pink border) once tiles would drop below the minimum.

**A window is drawn in the wrong place** (an empty tile, or an app's content showing in another tile). Some apps, mostly Chromium and Electron ones, sometimes don't redraw after being moved, so their picture stays where it was. MintyWM checks for this after every layout change and fixes it on its own. **Super + Shift + T** forces every window to redraw. `global.mintywm.dump()` marks such windows with `PICTURE STUCK`.

**A window I drag snaps back.** Tiled windows return to their tile when you let go. Float it first (**Super + T**) to move it freely.

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
