import AppKit
import SwiftUI

/// Integration snapshots render the real SwiftUI tree in AppKit, with isolated preferences.
/// This is a development-only CLI path; the shipping UI remains a menu-bar popover.
@MainActor
enum CalendarSnapshotTest {
    static func run(at directory: String) throws {
        let url = URL(fileURLWithPath: directory, isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        let suite = "local.shiri.calendar.snapshot-tests"
        let preferences = UserDefaults(suiteName: suite)!
        preferences.removePersistentDomain(forName: suite)
        defer { preferences.removePersistentDomain(forName: suite) }
        let model = try CalendarModel(preferences: preferences, now: ISO8601DateFormatter().date(from: "2026-11-11T04:00:00Z")!, loadCache: false)
        model.appearance = "light"
        let lightModel = try CalendarModel(preferences: preferences, now: ISO8601DateFormatter().date(from: "2026-11-11T04:00:00Z")!, loadCache: false)
        try capture(lightModel, to: url.appendingPathComponent("calendar-light.png"))
        let holidayModel = try CalendarModel(preferences: preferences, now: ISO8601DateFormatter().date(from: "2026-11-11T04:00:00Z")!, loadCache: false)
        holidayModel.selectDate("2026-02-14")
        precondition(holidayModel.selected?.schedule.kind == .makeupWorkday)
        try capture(holidayModel, to: url.appendingPathComponent("calendar-holidays.png"))
        model.selectDate("2026-02-14")
        model.shiftMonth(1)
        precondition(model.monthNumber == 3 && model.selected?.month == 3)
        model.goToday()
        precondition(model.selected?.date == "2026-11-11" && model.monthNumber == 11)
        model.weekStartsOn = 7
        precondition(model.month?.cells.compactMap { $0 }.first?.date == "2026-11-01")
        model.weekStartsOn = 1
        // Each capture owns its model: mutating a model observed by a previously
        // closed NSHostingView can leave stale offscreen display-list fragments.
        let darkModel = try CalendarModel(preferences: preferences, now: ISO8601DateFormatter().date(from: "2026-11-11T04:00:00Z")!, loadCache: false)
        darkModel.appearance = "dark"
        try capture(darkModel, to: url.appendingPathComponent("calendar-dark.png"))
        let settingsModel = try CalendarModel(preferences: preferences, now: ISO8601DateFormatter().date(from: "2026-11-11T04:00:00Z")!, loadCache: false)
        settingsModel.appearance = "light"
        settingsModel.showingSettings = true
        try capture(settingsModel, to: url.appendingPathComponent("settings.png"))
        let missingModel = try CalendarModel(preferences: preferences, now: ISO8601DateFormatter().date(from: "2026-11-11T04:00:00Z")!, loadCache: false)
        missingModel.selectDate("2028-01-01")
        precondition(missingModel.month?.coverage == .unavailable)
        try capture(missingModel, to: url.appendingPathComponent("calendar-missing-data.png"))
        print("PASS: native SwiftUI snapshots; date selection, month navigation, today, week-start setting, dark mode and missing-data state")
    }

    private static func capture(_ model: CalendarModel, to url: URL) throws {
        let hosting = NSHostingView(rootView: CalendarView(model: model, close: {}))
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 392, height: 620), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = hosting
        hosting.frame = NSRect(x: 0, y: 0, width: 392, height: 620)
        window.appearance = NSAppearance(named: model.appearance == "dark" ? .darkAqua : .aqua)
        window.orderFrontRegardless()
        hosting.layoutSubtreeIfNeeded()
        RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        hosting.layoutSubtreeIfNeeded()
        hosting.displayIfNeeded()
        guard let bitmap = hosting.bitmapImageRepForCachingDisplay(in: hosting.bounds) else { throw NSError(domain: "Snapshot", code: 1) }
        hosting.cacheDisplay(in: hosting.bounds, to: bitmap)
        guard let png = bitmap.representation(using: .png, properties: [:]) else { throw NSError(domain: "Snapshot", code: 2) }
        try png.write(to: url)
        window.close()
    }
}
