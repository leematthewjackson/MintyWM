# MintyWM

Dynamic Tiling Window Management for Cinnamon.
By Lee Matthew Jackson - leematthewjackson.com - @leematthewjackson@mastodon.social

Hyprland-style dwindle auto-tiling for Cinnamon: new windows tile automatically, closing one
re-tiles the rest, any window can be floated, and a thin border shows focus and floating windows.

Install: copy this folder to `~/.local/share/cinnamon/extensions/`, enable **MintyWM** in
System Settings > Extensions, and use the gear button to configure it.
(Upgrading from "Simple Autotile"? Disable and remove `simple-autotile@local` first, or both will
fight over the same keys.)

Optional: the **MintyWM Status** applet adds a panel indicator. It is a separate download and
needs this extension.

| Keys | Action |
|---|---|
| Super+T | pause / resume tiling everywhere |
| Super+Alt+T | tiling on / off for the current workspace |
| Super+Shift+T | re-tile everything now |
| Super+F | float / tile the focused window |
| Super+J / Super+K | focus next / previous window |
| Super+Shift+J / K | swap with next / previous tile |
| Super+Shift+H | move to the first (left) slot |
| Super+Shift+F | always float this app (press again to undo) |
| Super+L / Super+H | make the focused tile bigger / smaller (or drag its edge) |
| Super+= | even tile sizes again on this workspace |

## Floating apps

Some windows should never be tiled. MintyWM ships with Cinnamon's own settings windows
(System Settings, and the applet / extension / desklet settings) set to open floating.
Manage the list in the settings, on the **Floating apps** page.

- Easiest: click a window and press **Super+Shift+F**. Press again to undo.
- Or find a window's class: run `xprop WM_CLASS` in a terminal, click the window, and use the
  first name in quotes.
- `*` matches anything, capitals are ignored. "Title contains" is optional.
- Untick a row to turn it off, or delete it. **Super+F** on one window tiles just that window.
- Floating windows are kept on top of the tiles so they don't get lost (switch in the settings).

## Workspaces

To keep some workspaces untiled, list their numbers in the settings (Tiling > Workspaces), for example
`4, 9` or `7-9`. **Super+Alt+T** flips the workspace you are on and keeps that list up to date.

## Something not tiling?

Open Looking Glass (Alt+F2, `lg`) and run `global.mintywm.dump()`. It lists every window and why it is
or isn't tiled. If a whole workspace never tiles, it is probably on the excluded list: press **Super+Alt+T**.
