import AppKit
import Combine
import ShiriCalendarKit
import UniformTypeIdentifiers

@MainActor
final class CalendarModel: ObservableObject {
    @Published var month: MonthCalendar?
    @Published var selected: CalendarDay?
    @Published var events: [CalendarEvent] = []
    @Published var vacation: Vacation?
    @Published var today: String
    @Published var year: Int
    @Published var monthNumber: Int
    @Published var availableYears: [Int] = []
    @Published var error: String?
    @Published var dataMessage: String?
    @Published var updating = false
    @Published var showingSettings = false
    @Published var weekStartsOn: Int {
        didSet { preferences.set(weekStartsOn, forKey: "weekStartsOn"); refresh() }
    }
    @Published var appearance: String {
        didSet { preferences.set(appearance, forKey: "appearance") }
    }

    private let service: CalendarService
    private var selectedKey: String
    private let cacheURL: URL
    private let preferences: UserDefaults
    private var timer: AnyCancellable?

    static func beijingDate(_ instant: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "Asia/Shanghai")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: instant)
    }

    init(preferences: UserDefaults = .standard, now: Date = Date(), loadCache: Bool = true) throws {
        self.preferences = preferences
        service = try CalendarService()
        let current = Self.beijingDate(now)
        today = current
        selectedKey = current
        year = Int(current.prefix(4)) ?? 2026
        monthNumber = Int(current.dropFirst(5).prefix(2)) ?? 11
        weekStartsOn = preferences.integer(forKey: "weekStartsOn") == 7 ? 7 : 1
        appearance = preferences.string(forKey: "appearance") ?? "system"
        cacheURL = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("ShiriCalendar", isDirectory: true).appendingPathComponent("holidays.json")
        if loadCache && FileManager.default.fileExists(atPath: cacheURL.path) {
            do {
                let data = try Data(contentsOf: cacheURL)
                let years = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] ?? []
                for dataset in years {
                    let bytes = try JSONSerialization.data(withJSONObject: dataset)
                    if let json = String(data: bytes, encoding: .utf8) { try service.importDataset(json: json) }
                }
            } catch {
                self.error = "缓存读取失败，已使用内置调休数据。可在设置中重新导入。"
            }
        }
        refresh()
        timer = Timer.publish(every: 60, on: .main, in: .common).autoconnect().sink { [weak self] _ in
            Task { @MainActor [weak self] in self?.refreshToday() }
        }
    }

    var canGoBack: Bool { year > 1901 || monthNumber > 1 }
    var canGoForward: Bool { year < 2100 || monthNumber < 12 }
    var weekdays: [String] { weekStartsOn == 1 ? ["一", "二", "三", "四", "五", "六", "日"] : ["日", "一", "二", "三", "四", "五", "六"] }
    var dataSummary: String {
        if month?.coverage == .unavailable { return "\(year)年调休未收录" }
        return "调休已收录至\(String(availableYears.last ?? 2027))年"
    }

    func refresh() {
        do {
            month = try service.getMonth(year: year, month: monthNumber, weekStartsOn: weekStartsOn)
            selected = try service.getDay(selectedKey)
            availableYears = try service.getAvailableYears()
            events = try service.getUpcoming(from: today, days: 80, limit: 8)
            vacation = try service.getVacations(from: today, limit: 1).first
        } catch { self.error = error.localizedDescription }
    }

    func refreshToday() {
        let current = Self.beijingDate()
        guard current != today else { return }
        let followedToday = selectedKey == today
        today = current
        if followedToday { goToday() } else { refresh() }
    }

    func goToday() { selectDate(today) }

    func selectDate(_ date: String) {
        do {
            let next = try service.getDay(date)
            selectedKey = date
            selected = next
            if year != next.year || monthNumber != next.month {
                year = next.year; monthNumber = next.month
                month = try service.getMonth(year: year, month: monthNumber, weekStartsOn: weekStartsOn)
            }
        } catch { self.error = error.localizedDescription }
    }

    func shiftMonth(_ offset: Int) {
        let absolute = year * 12 + monthNumber - 1 + offset
        let nextYear = absolute / 12
        let nextMonth = absolute % 12 + 1
        guard (1901...2100).contains(nextYear) else { return }
        year = nextYear; monthNumber = nextMonth
        refresh()
        alignSelectionToMonth()
    }

    func jump(year: Int? = nil, month: Int? = nil) {
        if let year { self.year = year }
        if let month { monthNumber = month }
        refresh()
        alignSelectionToMonth()
    }

    private func alignSelectionToMonth() {
        let dates = month?.cells.compactMap { $0 }.filter { $0.month == monthNumber && $0.year == year } ?? []
        if let match = dates.first(where: { $0.day == selected?.day }) ?? dates.last { selectDate(match.date) }
    }

    private func persist() throws {
        try FileManager.default.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try service.exportDatasets().write(to: cacheURL, atomically: true, encoding: .utf8)
    }

    func importFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        panel.message = "导入一个完整年份的 holiday-cn JSON；请核对来源和放假安排。"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let values = try url.resourceValues(forKeys: [.fileSizeKey])
            guard (values.fileSize ?? 0) < 1_000_000 else { throw CalendarServiceError.runtime("文件过大，请选择年度调休 JSON") }
            let json = try String(contentsOf: url, encoding: .utf8)
            let importedYear = try service.importDataset(json: json)
            try persist()
            dataMessage = "已导入\(importedYear)年调休数据"
            error = nil
            refresh()
        } catch { self.error = "导入失败：\(error.localizedDescription)" }
    }

    func checkUpdates() async {
        guard !updating else { return }
        updating = true; dataMessage = nil; error = nil
        defer { updating = false; refresh() }
        let currentYear = Int(today.prefix(4)) ?? year
        var updated: [Int] = []
        var failures: [String] = []
        for target in [currentYear, currentYear + 1] where target <= 2100 {
            do {
                let url = URL(string: "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/\(target).json")!
                let configuration = URLSessionConfiguration.ephemeral
                configuration.timeoutIntervalForRequest = 12
                configuration.timeoutIntervalForResource = 15
                let session = URLSession(configuration: configuration)
                defer { session.invalidateAndCancel() }
                let (data, response) = try await session.data(from: url)
                guard let http = response as? HTTPURLResponse else { throw CalendarServiceError.runtime("服务器响应无效") }
                if http.statusCode == 404 { continue }
                guard http.statusCode == 200, data.count < 1_000_000, let json = String(data: data, encoding: .utf8) else { throw CalendarServiceError.runtime("下载失败，请稍后重试") }
                // Check the requested year before allowing the shared core to import it.
                let metadata = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                guard metadata?["year"] as? Int == target else { throw CalendarServiceError.runtime("数据年份不匹配") }
                try service.importDataset(json: json)
                updated.append(target)
            } catch { failures.append(String(target)) }
        }
        do { if !updated.isEmpty { try persist() } } catch { self.error = "调休已载入，但保存失败：\(error.localizedDescription)" }
        if !updated.isEmpty { dataMessage = "已同步" + updated.map(String.init).joined(separator: "、") + "年调休数据" }
        else if failures.isEmpty { dataMessage = "数据源尚未收录新的年度安排" }
        if !failures.isEmpty { error = failures.joined(separator: "、") + "年更新失败，仍可离线使用已有数据。也可导入 JSON。" }
    }
}
