# StreamDeckXL-IPCAM

![preview](docs/preview.webp)

The script pulls an RTSP feed, slices each frame into 32 tiles, runs cheap
per-tile motion detection, and pushes JPEGs to the deck at ~10 FPS. Tiles with
motion get a red wash. Cropping and motion sensitivity are controlled from
the deck itself. Five buttons do everything; the rest is config.

## On-deck controls

| key | what it does |
| --- | --- |
| corners (0, 7, 24, 31) | zoom in — the corner you press is the corner that gets cropped away |
| 1 (top row, 2nd) | reset crop to the full frame |
| 2 (top row, 3rd) | less motion sensitivity |
| 3 (top row, 4th) | more motion sensitivity |

Press the bottom-right corner and the bottom row + right column of the current
crop disappear; what's left scales up to fill the deck. Press a corner again
to zoom further. Crop and threshold persist in
`~/.cache/streamdeck-camera/state.json` — survives reboots.

## Setup

You need RTSP streaming IP camera, Stream Deck XL, `ffmpeg`, Python with `numpy` / `Pillow` /
`python-elgato-streamdeck`. Linux Streamdeck GUI 
[streamdeck-linux-gui](https://github.com/streamdeck-linux-gui/streamdeck-linux-gui)

On Arch:

```sh
sudo pacman -S ffmpeg python-pillow python-numpy python-elgato-streamdeck streamdeck-ui
```

Then:

```sh
git clone https://github.com/seinfold/StreamDeckXL-IPCAM.git
cd StreamDeckXL-IPCAM
./install.sh
```

The installer drops the script in `~/.local/bin/`, two systemd user units in
`~/.config/systemd/user/`, and seeds `~/.config/streamdeck-camera/config.ini`
from the example. Fill in your camera details and:

```sh
systemctl --user start streamdeck-camera.service   # camera mode
systemctl --user start streamdeck-ui.service       # back to your normal layout
```

The two units have `Conflicts=` set on each other, so starting one stops
the other.

> **Tapo cameras**: RTSP is off by default. Open the Tapo app → Advanced
> Settings → Camera Account, set a username and password there. Use those
> in the config — not your Tapo account credentials.

## Config

Either give it a full RTSP URL:

```ini
[camera]
rtsp_url = rtsp://user:pass@192.168.1.10:554/stream2
```

Or split it out (easier if your password has URL-special characters):

```ini
[camera]
host = 192.168.1.10
user = camera_user
pass = sup3r-secret
port = 554
stream = stream2
```

Source resolution is auto-detected via ffprobe at startup. If your camera is
slow to respond, pin it manually with `src_width` and `src_height`.

## Flags

```
--fps INT             default: 10
--mode {fit,stretch,crop}
                      how the cropped ROI fills the 768×384 canvas (default: stretch)
--brightness INT      0–100 (default: 80)
--motion-threshold N  initial sensitivity, 1–60 (default: 10)
--motion-alpha N      red blend alpha, 0–1 (default: 0.40)
--bg-learn-rate N     EMA rate for the background model (default: 0.05)
--no-motion           disable the red overlay
--no-daemon-mgmt      don't touch streamdeck-linux-gui's daemon
```

## How motion detection works

Per frame: convert to luminance, maintain an EMA "background" of luminance,
take the absolute diff between current and background, average that diff
over each 96×96 tile. Tiles whose average exceeds the threshold get the red
blend. The background is invalidated whenever the crop changes — otherwise
the first few frames after a zoom would falsely flag everything.

Coarse, but for outdoor scenes you can usually find a threshold (with
keys 2 and 3) where leaves and clouds stay below the line and people /
animals trip it.

## AGS bar toggle (optional)

I run [AGS](https://github.com/Aylur/ags) on Hyprland and added a button
to the top bar that flips between camera mode and the normal layout.
The widget is included in this repo:

- [`integrations/ags/streamdeck-camera-button.ts`](integrations/ags/streamdeck-camera-button.ts) — the button widget
- [`integrations/ags/style.css`](integrations/ags/style.css) — matching CSS

Drop the `.ts` into your AGS widgets directory, import `StreamdeckCameraButton`,
add it to your bar's box, and append the CSS to your `style.css`. The button
shows 󰞮 (md-cctv) when the service is running and 󱡟 (md-cctv-off) when it
isn't — JetBrainsMono Nerd Font has both, and so do most current Nerd Fonts.

For Hyprland autostart on login:

```
exec-once = systemctl --user start streamdeck-camera.service
```

For Waybar / Eww the same idea is a one-line custom module wrapping
`systemctl --user is-active streamdeck-camera.service`.

## Notes

- "Stream Deck XL not found" almost always means streamdeck-linux-gui's
  daemon is still holding the device. Default behaviour is to stop it on
  entry and respawn on exit; pass `--no-daemon-mgmt` to skip.
- If RTSP connects but no frames flow, the credentials are wrong. The web
  UI password rarely works for RTSP — most cameras hide a separate "camera
  account" setting.
- `--mode stretch` (the default) distorts the image when you crop. That's
  intentional: cropping rarely lands on a 2:1 aspect ratio anyway, and the
  alternatives (letterbox or fill-and-cut) are less useful for actually
  watching the feed. `--mode fit` and `--mode crop` are there if you want
  them.
- About 30% of one core for the full 10 FPS pipeline. The bottleneck is
  encoding 32 small JPEGs and pushing them over USB, not RTSP decoding.
- Tested and developed for environment that has Linux Arch running Hyprland and AGS with single camera.

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).
Free for personal, hobby, research, nonprofit, and educational use.
Commercial use requires a separate license.
