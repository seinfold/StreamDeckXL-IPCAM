# StreamDeckXL-IPCAM

Turn an Elgato Stream Deck XL into a tiny IP camera display, complete with
per-tile motion detection. The deck's 32 keys (8×4) become a 768×384 video
wall that streams an RTSP feed from any IP camera.

![Stream Deck XL showing a live backyard camera feed across all 32 buttons, with the camera's overlay timestamp readable across the top row.](docs/preview.webp)

Built and tested with a TP-Link TAPO C310, but the script just talks to
RTSP — anything that exposes an RTSP URL should work.

## Features

- RTSP → 32-tile video wall, ~10 FPS on modest hardware
- Per-tile motion detection with a red wash on tiles that move
- Crop / zoom controlled from the deck itself (corner buttons)
- Sensitivity adjustable on the fly (top row, keys 3 and 4)
- Crop and sensitivity persist across restarts
- Plays nicely with [streamdeck-linux-gui](https://github.com/streamdeck-linux-gui/streamdeck-linux-gui)
  — the script will stop the daemon while it runs and respawn it on exit

## Deck button layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ◤ZOOM │ RESET │ −SENS │ +SENS │       │       │       │ ZOOM◥ │
├─────────────────────────────────────────────────────────────────────────┤
│       │       │       │       │       │       │       │       │
├─────────────────────────────────────────────────────────────────────────┤
│       │       │       │       │       │       │       │       │
├─────────────────────────────────────────────────────────────────────────┤
│ ◣ZOOM │       │       │       │       │       │       │ ZOOM◢ │
└─────────────────────────────────────────────────────────────────────────┘
```

| Key | Action |
| --- | --- |
| 0 (top-left corner) | Zoom — drop top + left |
| 7 (top-right corner) | Zoom — drop top + right |
| 24 (bottom-left corner) | Zoom — drop bottom + left |
| 31 (bottom-right corner) | Zoom — drop bottom + right |
| 1 | Reset crop to full frame |
| 2 | Less motion sensitivity (raise threshold) |
| 3 | More motion sensitivity (lower threshold) |

The corner zoom shrinks the crop rectangle from the side(s) adjacent to
the pressed corner — e.g. pressing the bottom-right corner cuts the
bottom row and right column of the current crop.

## Requirements

- Stream Deck XL (the script bails out if it doesn't find one)
- Linux with `udev` rules for Stream Deck access — easiest is to install
  the [streamdeck-linux-gui](https://github.com/streamdeck-linux-gui/streamdeck-linux-gui)
  package, which ships them
- `ffmpeg` and `ffprobe`
- Python 3 with `numpy`, `Pillow`, `python-elgato-streamdeck`
- An RTSP source (most IP cameras have a hidden setting for this — on
  TAPO cameras it's *Advanced Settings → Camera Account*)

On Arch:

```sh
sudo pacman -S ffmpeg python-pillow python-numpy python-elgato-streamdeck streamdeck-ui
```

## Install

```sh
git clone https://github.com/seinfold/StreamDeckXL-IPCAM.git
cd StreamDeckXL-IPCAM
./install.sh
```

That puts the script in `~/.local/bin/`, drops the systemd unit files in
`~/.config/systemd/user/`, and copies `config.example.ini` to
`~/.config/streamdeck-camera/config.ini` if you don't already have one.

Edit `~/.config/streamdeck-camera/config.ini` with your camera's RTSP
URL (or host/user/pass), then:

```sh
systemctl --user start streamdeck-camera.service
```

To toggle back to the normal Stream Deck UI layout:

```sh
systemctl --user start streamdeck-ui.service
```

The two services declare `Conflicts=` against each other, so starting
one stops the other.

## Config

Minimal config (full RTSP URL):

```ini
[camera]
rtsp_url = rtsp://user:pass@192.168.1.10:554/stream2
```

Or piecemeal — handy if you don't want passwords URL-encoded:

```ini
[camera]
host = 192.168.1.10
user = camera_user
pass = sup3r-secret
port = 554
stream = stream2
```

The script auto-detects source resolution via `ffprobe` on startup. If
ffprobe can't reach the camera fast enough you can pin it explicitly:

```ini
[camera]
rtsp_url = rtsp://...
src_width = 640
src_height = 360
```

## CLI flags

```
--fps INT             frame rate cap (default: 10)
--mode {fit,stretch,crop}
                      how the cropped ROI fills the 768×384 canvas
                      (default: stretch)
--brightness INT      0-100 (default: 80)
--motion-threshold N  initial sensitivity, 1-60 (default: 10)
--motion-alpha N      red blend alpha for motion tiles, 0-1 (default: 0.40)
--bg-learn-rate N     EMA rate for background model (default: 0.05)
--no-motion           disable the red motion overlay
--no-daemon-mgmt      don't touch streamdeck-linux-gui's daemon
```

## How motion detection works

For each frame: compute a luminance image, maintain an EMA background
model, take the absolute difference between current luminance and the
background, then average that diff over each 96×96 tile. Tiles whose
mean diff exceeds the threshold get a red blend.

When you change the crop, the background model is invalidated and
rebuilt — otherwise the first frame after a zoom would falsely flag
half the tiles as "moving."

## Optional: AGS / Waybar / Hyprland integration

I've got a toggle button in my [AGS](https://github.com/Aylur/ags) bar
that flips between the camera service and the normal streamdeck-ui
layout. Snippet, if you want to crib it:

```ts
// AGS, GTK 3
function cameraToggle() {
    const btn = new Gtk.Button({ relief: Gtk.ReliefStyle.NONE })
    const lbl = new Gtk.Label({ label: "󰻞" })   // nf-md-cctv
    btn.add(lbl)

    const isOn = () => {
        const [, out] = GLib.spawn_command_line_sync(
            "systemctl --user is-active streamdeck-camera.service")
        return out && String(out).trim().startsWith("active")
    }

    btn.connect("clicked", () => {
        const cmd = isOn()
            ? "systemctl --user start streamdeck-ui.service"
            : "systemctl --user start streamdeck-camera.service"
        GLib.spawn_command_line_async(cmd)
    })
    return btn
}
```

For Hyprland autostart on login, add to `hyprland.conf`:

```
exec-once = systemctl --user start streamdeck-camera.service
```

## Troubleshooting

**`Stream Deck XL not found`**
streamdeck-linux-gui's daemon is probably still holding the device.
Either let the script manage it (default), or stop it manually:
`pkill -f 'streamdeck --no-ui'`.

**RTSP connects but no frames flow**
Some cameras only stream after you set up an explicit "camera account"
in their app. On TAPO it's *Advanced Settings → Camera Account*. The
default web UI password does not work for RTSP.

**Camera image looks stretched**
That's `--mode stretch`. The user-driven crop quickly produces aspect
ratios that don't match the deck's 2:1, so stretch is the most
predictable default. Use `--mode fit` for letterboxing or `--mode crop`
for fill-and-cut.

**Motion overlay is too jumpy / not jumpy enough**
Press key 2 (less sensitive) or key 3 (more sensitive) on the deck. The
threshold persists. Or tune `--bg-learn-rate` — slower learning means
slow movements register longer.

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)
— free for any noncommercial use (personal projects, hobbies, research,
nonprofits, education). Commercial use requires a separate license. See
LICENSE for the full text.
