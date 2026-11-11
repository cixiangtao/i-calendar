import XCTest
@testable import ShiriCalendarKit

final class CalendarServiceTests: XCTestCase {
    @MainActor func testNativeBridgeMatchesCivilCalendar() async throws {
        let calendar = try CalendarService()
        let day = try calendar.getDay("2026-11-11")
        XCTAssertEqual(day.lunar.dayName, "初三")
        XCTAssertEqual(day.lunar.monthName, "十月")
        XCTAssertEqual(day.weekday, 3)
        XCTAssertEqual(try calendar.getMonth(year: 2026, month: 11).cells.count, 42)
        XCTAssertEqual(try calendar.getVacations(from: "2026-11-11", limit: 1).first?.daysUntil, 51)
        XCTAssertEqual(try calendar.getAvailableYears(), [2025, 2026, 2027])
    }

    @MainActor func testExceptionsCrossBridgeAndSubsequentQueriesRecover() async throws {
        let calendar = try CalendarService()
        XCTAssertThrowsError(try calendar.getDay("2026-02-30"))
        XCTAssertEqual(try calendar.getDay("2026-02-17").festivals, ["春节"])
        XCTAssertThrowsError(try calendar.importDataset(json: "{}"))
        XCTAssertEqual(try calendar.getDay("2026-02-14").schedule.kind, .makeupWorkday)
    }
}
