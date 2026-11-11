import AppKit
import SwiftUI

@main struct ShiriCalendarApplication {
    @MainActor static func main() {
        let app = NSApplication.shared
        if let index = CommandLine.arguments.firstIndex(of: "--snapshot-test"), CommandLine.arguments.count > index + 1 {
            app.setActivationPolicy(.accessory)
            app.finishLaunching()
            do { try CalendarSnapshotTest.run(at: CommandLine.arguments[index + 1]) }
            catch { FileHandle.standardError.write(Data("Snapshot test failed: \(error)\n".utf8)); exit(1) }
            return
        }
        let delegate = CalendarAppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        if CommandLine.arguments.contains("--diagnostics") { FileHandle.standardError.write(Data("[拾日历] starting application run loop\n".utf8)) }
        withExtendedLifetime(delegate) { app.run() }
    }
}

@MainActor
final class CalendarAppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private let popover = NSPopover()
    private var model: CalendarModel?

    func applicationDidFinishLaunching(_ notification: Notification) {
        if CommandLine.arguments.contains("--diagnostics") { FileHandle.standardError.write(Data("[拾日历] applicationDidFinishLaunching\n".utf8)) }
        do {
            let model = try CalendarModel()
            self.model = model
            let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
            statusItem = item
            if let button = item.button {
                button.image = NSImage(systemSymbolName: "calendar", accessibilityDescription: "拾日历")
                button.image?.isTemplate = true
                button.target = self
                button.action = #selector(toggleCalendar)
                button.sendAction(on: [.leftMouseUp, .rightMouseUp])
                button.toolTip = "拾日历 · 点击查看农历、节气与放假调休"
                button.setAccessibilityIdentifier("shiri-status-item")
            }
            popover.behavior = .transient
            popover.animates = !CommandLine.arguments.contains("--lifecycle-test")
            popover.contentSize = NSSize(width: 392, height: 620)
            popover.contentViewController = NSHostingController(rootView: CalendarView(model: model) { [weak self] in self?.popover.performClose(nil) })

            // First launch opens the small popover so the menu-bar-only app is discoverable.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
                guard let self else { return }
                self.showCalendar()
                if CommandLine.arguments.contains("--lifecycle-test") {
                    precondition(self.popover.isShown, "Popover did not open")
                    self.popover.performClose(nil)
                    precondition(!self.popover.isShown, "Popover did not close")
                    self.showCalendar()
                    precondition(self.popover.isShown, "Popover did not reopen")
                    FileHandle.standardError.write(Data("PASS: actual menu-bar popover opens, closes and reopens\n".utf8))
                    NSApp.terminate(nil)
                }
            }
        } catch {
            let alert = NSAlert()
            alert.messageText = "拾日历启动失败"
            alert.informativeText = error.localizedDescription
            alert.runModal()
            NSApp.terminate(nil)
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showCalendar()
        return false
    }

    @objc private func toggleCalendar() {
        if NSApp.currentEvent?.type == .rightMouseUp { showContextMenu(); return }
        if popover.isShown { popover.performClose(nil) }
        else { showCalendar() }
    }

    @objc private func showCalendar() {
        if CommandLine.arguments.contains("--diagnostics") { FileHandle.standardError.write(Data("[拾日历] showing calendar popover\n".utf8)) }
        guard let button = statusItem?.button else { return }
        model?.refreshToday()
        NSApp.activate(ignoringOtherApps: true)
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        popover.contentViewController?.view.window?.makeKey()
    }

    @objc private func showSettings() { model?.showingSettings = true; showCalendar() }
    @objc private func quit() { NSApp.terminate(nil) }

    private func showContextMenu() {
        let menu = NSMenu()
        let open = NSMenuItem(title: "打开拾日历", action: #selector(showCalendar), keyEquivalent: "")
        open.target = self; menu.addItem(open)
        let settings = NSMenuItem(title: "设置与调休数据…", action: #selector(showSettings), keyEquivalent: ",")
        settings.target = self; menu.addItem(settings)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "退出拾日历", action: #selector(quit), keyEquivalent: "q")
        quit.target = self; menu.addItem(quit)
        if let button = statusItem?.button { menu.popUp(positioning: nil, at: NSPoint(x: 0, y: button.bounds.minY), in: button) }
    }
}
