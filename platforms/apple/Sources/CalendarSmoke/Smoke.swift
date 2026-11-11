import Foundation
import ShiriCalendarKit

@main struct CalendarSmoke {
    @MainActor static func main() throws {
        let calendar = try CalendarService()
        let day = try calendar.getDay("2026-11-11")
        precondition(day.lunar.dayName == "初三" && day.lunar.monthName == "十月" && day.weekday == 3)
        let month = try calendar.getMonth(year: 2026, month: 11)
        let vacations = try calendar.getVacations(from: "2026-11-11", limit: 1)
        let years = try calendar.getAvailableYears()
        precondition(month.cells.count == 42)
        precondition(vacations.first?.daysUntil == 51)
        precondition(years == [2025, 2026, 2027])
        do { _ = try calendar.getDay("2026-02-30"); fatalError("invalid date accepted") } catch {}
        do { _ = try calendar.importDataset(json: "{}"); fatalError("invalid schedule accepted") } catch {}
        let recovered = try calendar.getDay("2026-02-14")
        precondition(recovered.schedule.kind == .makeupWorkday)
        let unknown = try calendar.getDay("2028-01-01")
        precondition(unknown.schedule.coverage == .unavailable)
        print("PASS: native JavaScriptCore bridge, lunar conversion, month grid, cross-year vacations, missing coverage, invalid-input recovery")
    }
}
