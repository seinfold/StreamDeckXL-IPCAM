// Drop-in AGS (Aylur's GTK Shell) button that toggles between
// streamdeck-camera.service and streamdeck-ui.service.
//
// Glyphs come from Nerd Fonts: 󰞮 = md-cctv, 󱡟 = md-cctv-off.

import Gtk from "gi://Gtk?version=3.0"
import GLib from "gi://GLib?version=2.0"

export function StreamdeckCameraButton() {
    const btn = new Gtk.Button({
        name: "streamdeck-camera-btn",
        tooltipText: "Stream Deck IP camera",
        relief: Gtk.ReliefStyle.NONE,
    })
    const lbl = new Gtk.Label({ label: "󰞮" })
    btn.add(lbl)

    const isOn = (): boolean => {
        try {
            const [ok, out] = GLib.spawn_command_line_sync(
                "systemctl --user is-active streamdeck-camera.service")
            if (!ok || !out) return false
            return new TextDecoder().decode(out as any).trim() === "active"
        } catch { return false }
    }

    const refresh = () => {
        const ctx = lbl.get_style_context()
        const on = isOn()
        lbl.set_label(on ? "󰞮" : "󱡟")
        if (on) { ctx.add_class("active");   ctx.remove_class("inactive") }
        else    { ctx.add_class("inactive"); ctx.remove_class("active")   }
    }

    refresh()

    btn.connect("clicked", () => {
        const cmd = isOn()
            ? "systemctl --user start streamdeck-ui.service"
            : "systemctl --user start streamdeck-camera.service"
        GLib.spawn_command_line_async(cmd)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
            refresh(); return GLib.SOURCE_REMOVE
        })
    })

    // Catch state changes that didn't come from the button (CLI toggles,
    // crashes, the service flipping itself off).
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
        refresh(); return GLib.SOURCE_CONTINUE
    })

    return btn
}
