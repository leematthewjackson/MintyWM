# MintyWM

**Dynamic tiling for Cinnamon.**

Open a window and it tiles. Close one and the rest fill the space. The layout is one dwindle tree, like Hyprland: a wide window and a column is just how the splits landed, not two separate stacks.

Cinnamon stays in charge of panels, Alt+Tab and its own shortcuts. MintyWM only adds tiling, and an optional way to switch workspaces or send a window to one.

> [!WARNING]
> **Alpha software.** Things will break and settings may change. **Please [report bugs here](https://github.com/leematthewjackson/MintyWM/issues/new)**, with your distro, Cinnamon version and what happened.

By [Lee Matthew Jackson](https://leematthewjackson.com) · Mastodon: [@leematthewjackson@mastodon.social](https://mastodon.social/@leematthewjackson)

## Watch the demo

> [!NOTE]
> **This video is already out of date.** Shortcuts and behaviour have changed since it was recorded. Use this README, not the video.

[![MintyWM demo video on YouTube](https://img.youtube.com/vi/CHejYv80eo8/maxresdefault.jpg)](https://youtu.be/CHejYv80eo8)

▶️ **[Watch the MintyWM demo on YouTube](https://youtu.be/CHejYv80eo8)** for the general idea only.

<img width="3840" height="2160" alt="MintyWM on a desktop" src="https://github.com/user-attachments/assets/8a30becd-04ed-447c-8047-3a59e43ec3ae" />

<img width="3840" height="2160" alt="MintyWM with several tiled windows" src="https://github.com/user-attachments/assets/04513454-dafa-4be6-9dbd-bd9771e2c522" />

---

## What you install

| Folder | What it is |
|---|---|
| `mintywm@leematthewjackson/` | The extension. This is MintyWM. Version 1.1 RC. |
| `mintywm-status@leematthewjackson/` | Optional panel applet. It needs the extension. |

Needs **Cinnamon 6.0–6.8** on X11 (Linux Mint 22.x, or any recent Cinnamon).

### Install

From this repository:

```bash
git clone https://github.com/leematthewjackson/MintyWM.git mintywm
cd mintywm
mkdir -p ~/.local/share/cinnamon/extensions ~/.local/share/cinnamon/applets
cp -r mintywm@leematthewjackson ~/.local/share/cinnamon/extensions/
cp -r mintywm-status@leematthewjackson ~/.local/share/cinnamon/applets/
```

Or unzip the release zips into those same two folders. The folder names must stay exactly as they are.

Then:

1. **Alt+F2**, type `r`, press **Enter**.
2. **System Settings → Extensions → MintyWM** and enable it.
3. Optional: **Applets → MintyWM Status** and add it to the panel.

To update, copy the new files over the old ones and restart Cinnamon again. Your settings stay.

To remove it, disable the extension, take the applet off the panel, then delete those two folders under `~/.local/share/cinnamon/`.

---

## Keys

Close to Hyprland. Change any of them under **Extensions → MintyWM → Keyboard**. The cheat sheet (**Ctrl+Super+/**) shows the keys you actually have, including a second binding. Escape, or a click outside it, closes it. Super+1–9 only appear there when Workspace numbers is on.

| Keys | What it does |
|---|---|
| **Super+T** | Float or tile this window |
| **Super+Shift+T** | Always float this app, or stop |
| **Super+F** | Fullscreen |
| **Super+Alt+F** | Fill the work area, panels stay |
| **Super+Ctrl+F** | Monocle: one window, gaps kept |
| **Super+J** | Swap the split direction |
| **Super+Shift+P** | Pseudotile: smaller, still in the tile |
| **Super+Shift+O** | Pop out and pin above the tiles |
| **Super+W** | Close the window |
| **Ctrl+Super+arrows** | Focus the window in that direction |
| **Ctrl+Super+Shift+arrows** | Swap with it |
| **Super+= / -** | Wider / narrower |
| **Super+Shift+= / -** | Taller / shorter |
| **Ctrl+Super+=** | Even sizes on this workspace |
| **Super+Ctrl+T** | Pause or resume tiling everywhere |
| **Super+Alt+T** | Tiling on or off for this workspace |
| **Super+Shift+R** | Re-tile now |
| **Ctrl+Super+/** | Cheat sheet |

**Left to Cinnamon:** Super+arrows (snap), Super+O, Super+P, Super+D, Super+L, Alt+Tab, and Ctrl+Alt+arrows. MintyWM does not take those.

### Workspace numbers (off until you turn them on)

**Keyboard → Workspace numbers.**

| Keys | What it does |
|---|---|
| **Super+2** | Switch to workspace 2 |
| **Super+Shift+2** | Send the focused window to workspace 2. You stay here. |

Same for 1 through 9. A workspace that does not exist is not created. Press Super+2 when you want to follow a window you sent.

Grouped window list uses these keys, including with Shift. Turn that off first: **Applets → Grouped window list → General → Hot Keys**, then disable **Enable Super+number shortcut to switch/open apps**. Restart Cinnamon (**Alt+F2**, `r`). Do not give Cinnamon's own workspace shortcuts these same keys.

---

## How it behaves

**New windows** split the focused tile. Closing or minimising one refills the gap and keeps the other splits.

**If there is no room**, the newest window floats instead of becoming a tiny tile. It stays where you put it. It does not jump back when you close something else. **Super+T** tiles it again, which can float a different window if there is still no room. A magenta border marks floats.

**Drag a tile edge** to resize it, or use the resize keys. Sizes are remembered per workspace.

**Floating apps.** Super+Shift+T adds the focused app. Or edit **Floating apps** in settings. A rule matches the window class (`*` is a wildcard). Defaults already float Cinnamon's settings, FontForge, the font viewer and CopyQ. Find a class with `xprop WM_CLASS`, then click the window.

**Workspaces without tiling.** Super+Alt+T, or list numbers under **Tiling → Workspaces** (`4, 9` or `7-9`). On those workspaces MintyWM leaves windows alone.

**Notices** are on by default. A new one replaces the one on screen, so a quick run of keys does not queue up.

### The panel applet

| You see | Meaning |
|---|---|
| `3` | Tiling is on, 3 windows tiled |
| `3+1` | One more didn't fit and is floating |
| `off` | Tiling is paused everywhere |
| `ws` | Tiling is off on this workspace |
| `?` | The extension is not enabled |

Click opens controls and the key list. Middle-click toggles tiling for this workspace only.

---

## Settings

**System Settings → Extensions → MintyWM → Configure.** Changes apply straight away.

| What | Default |
|---|---|
| Inner and outer gaps | 8 px |
| Smallest tile | 200 × 120 px |
| Resize step | 5% |
| Floated window size | 60% of the screen |
| Floating windows stay on top | on |
| Focus border | mint, 2 px |
| Float border | magenta |
| Corner radius | 8 px, or each corner on its own |
| On-screen notices | on |

---

## If something looks wrong

**Nothing tiles.** Restart Cinnamon, then enable MintyWM under Extensions.

**One window will not tile.** It may be a floating app, or this workspace is excluded. Super+T tiles one window. Super+Alt+T toggles this workspace.

**A shortcut does nothing.** Something else owns it. Change it under Keyboard. Grouped window list owns Super+1–9 until you turn its shortcut off.

**A tiled window snaps back when you drag it.** That is the tile. Super+T floats it, then you can move it.

**The picture is in the wrong place** (common with Chromium). MintyWM nudges the window so the app redraws. Super+Shift+R lays the workspace out again.

**The applet shows `?`.** Enable the extension, not just the applet.

For a bug report, turn on **Tiling → Feedback → Log why windows are or aren't tiled**, or in Looking Glass (Alt+F2, `lg`) run `global.mintywm.dump()`.

Your own Cinnamon shortcuts:

```bash
dconf dump /org/cinnamon/desktop/keybindings/
```

---

## Licence

MintyWM is free software under the **GNU General Public License v3.0**. See [`LICENSE`](LICENSE).

Copyright (C) 2026 Lee Matthew Jackson

It is a hobby project with **no warranty**. You use it at your own risk. It moves and resizes windows, so save your work before trying it. If it misbehaves, disable it under **Extensions** and restart Cinnamon (Alt+F2, `r`).
