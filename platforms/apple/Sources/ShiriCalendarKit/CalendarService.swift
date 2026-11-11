import Foundation
import JavaScriptCore

/// ISO civil date. The core, rather than host timezone parsing, validates its meaning.
public struct CalendarDay: Decodable, Sendable {
    public let date: String
    public let year: Int
    public let month: Int
    public let day: Int
    public let weekday: Int
    public let lunar: LunarDate
    public let festivals: [String]
    public let solarTerm: String?
    public let schedule: DaySchedule
}

public struct LunarDate: Decodable, Sendable {
    public let year: Int
    public let month: Int
    public let day: Int
    public let isLeapMonth: Bool
    public let monthName: String
    public let dayName: String
    public let yearGanZhi: String
    public let zodiac: String
}

public struct DaySchedule: Decodable, Sendable {
    public enum Kind: String, Decodable, Sendable {
        case holiday, makeupWorkday = "makeup-workday", weekend, weekday
    }
    public enum Coverage: String, Decodable, Sendable { case published, unavailable }
    public let kind: Kind
    public let coverage: Coverage
    public let holidayName: String?
    public let sources: [String]
}

public struct MonthCalendar: Decodable, Sendable {
    public let year: Int
    public let month: Int
    public let weekStartsOn: Int
    public let coverage: DaySchedule.Coverage
    public let cells: [CalendarDay?]
}

public struct CalendarEvent: Decodable, Sendable {
    public let date: String
    public let name: String
    public let kind: String
    public let daysUntil: Int
}

public struct Vacation: Decodable, Sendable {
    public let name: String
    public let start: String
    public let end: String
    public let days: Int
    public let daysUntil: Int
}

public enum CalendarServiceError: LocalizedError {
    case runtime(String)
    public var errorDescription: String? {
        switch self { case .runtime(let message): return message }
    }
}

/// Native adapter over the same offline JavaScript engine used on the web.
/// Actor isolation prevents concurrent access to the JavaScriptCore context.
@MainActor
public final class CalendarService {
    private let context: JSContext
    private let bridge: JSValue
    private let decoder = JSONDecoder()

    public init() throws {
        guard let context = JSContext(),
              let url = Bundle.main.url(forResource: "calendar-core", withExtension: "js") ?? Bundle.module.url(forResource: "calendar-core", withExtension: "js") else {
            throw CalendarServiceError.runtime("日历核心资源缺失")
        }
        context.evaluateScript(try String(contentsOf: url, encoding: .utf8))
        if let error = context.exception { throw CalendarServiceError.runtime(error.toString()) }
        let result = context.objectForKeyedSubscript("ShiriCalendar")?.invokeMethod("createBridge", withArguments: [])
        if let error = context.exception { throw CalendarServiceError.runtime(error.toString()) }
        guard let bridge = result, !bridge.isUndefined else {
            throw CalendarServiceError.runtime("无法初始化日历核心")
        }
        self.context = context
        self.bridge = bridge
    }

    public func getDay(_ date: String) throws -> CalendarDay {
        try query("getDay", [date])
    }

    public func getMonth(year: Int, month: Int, weekStartsOn: Int = 1) throws -> MonthCalendar {
        try query("getMonth", [year, month, weekStartsOn])
    }

    public func getUpcoming(from date: String, days: Int = 100, limit: Int = 8) throws -> [CalendarEvent] {
        try query("getUpcoming", [date, days, limit])
    }

    public func getVacations(from date: String, limit: Int = 4) throws -> [Vacation] {
        try query("getVacations", [date, limit])
    }

    public func getAvailableYears() throws -> [Int] { try query("getYears", []) }

    /// Imports a complete annual schedule. The caller owns provenance review and persistence.
    @discardableResult
    public func importDataset(json: String) throws -> Int {
        let value = try invoke("importDataset", [json])
        guard value.isNumber else { throw CalendarServiceError.runtime("调休导入未返回年份") }
        return Int(value.toInt32())
    }

    /// Returns all installed datasets as JSON for a platform storage adapter.
    public func exportDatasets() throws -> String {
        guard let json = try invoke("exportDatasets", []).toString() else { throw CalendarServiceError.runtime("调休导出失败") }
        return json
    }

    private func invoke(_ method: String, _ arguments: [Any]) throws -> JSValue {
        context.exception = nil
        let result = bridge.invokeMethod(method, withArguments: arguments)
        if let error = context.exception { throw CalendarServiceError.runtime(error.toString()) }
        guard let result, !result.isUndefined else { throw CalendarServiceError.runtime("日历查询没有返回结果") }
        return result
    }

    private func query<T: Decodable>(_ method: String, _ arguments: [Any]) throws -> T {
        guard let json = try invoke(method, arguments).toString(), let data = json.data(using: .utf8) else {
            throw CalendarServiceError.runtime("日历结果格式无效")
        }
        return try decoder.decode(T.self, from: data)
    }
}
