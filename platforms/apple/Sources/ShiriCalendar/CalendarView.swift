import SwiftUI
import AppKit
import ShiriCalendarKit

// THESIS: 月历直接回答今天农历几号、哪天放假和补班。
// OWN-WORLD: 原生白/深色表面、松绿选中态、清晰公农历双行与休班小标记。
// STORY: 点开菜单栏 → 浏览月份 → 点选日期 → 查看农历与下一节气/假期。
// FIRST VIEWPORT: 392pt 月历优先弹层；顶部切月、中部六周网格、底部日期摘要与两行后续日子。
// FORM: 用户选择的 A 月历优先；direction seed 49ec89c9。
// FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

enum CalendarColors {
    static let jade = Color(red: 0.08, green: 0.43, blue: 0.37)
    static let darkJade = Color(red: 0.42, green: 0.81, blue: 0.71)
    static let holiday = Color(red: 0.69, green: 0.15, blue: 0.20)
    static let makeup = Color(red: 0.62, green: 0.33, blue: 0.07)
    static let darkMakeup = Color(red: 0.96, green: 0.68, blue: 0.37)
    static let darkHoliday = Color(red: 1, green: 0.55, blue: 0.56)
}

@MainActor
struct CalendarView: View {
    @ObservedObject var model: CalendarModel
    let close: () -> Void
    @Environment(\.colorScheme) private var scheme
    private var accent: Color { scheme == .dark ? CalendarColors.darkJade : CalendarColors.jade }
    private var tintSurface: Color { accent.opacity(scheme == .dark ? 0.13 : 0.07) }
    private var weekendColor: Color { scheme == .dark ? CalendarColors.darkHoliday : CalendarColors.holiday }
    private var makeupColor: Color { scheme == .dark ? CalendarColors.darkMakeup : CalendarColors.makeup }

    var body: some View {
        Group {
            if model.showingSettings { settings }
            else { calendar }
        }
        .padding(20)
        .frame(width: 392, height: 620, alignment: .top)
        .background(Color(nsColor: .textBackgroundColor))
        .tint(accent)
        .preferredColorScheme(model.appearance == "dark" ? .dark : model.appearance == "light" ? .light : nil)
        .environment(\.locale, Locale(identifier: "zh_CN"))
        .onExitCommand(perform: close)
    }

    private var calendar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 7) {
                Image(systemName: "calendar").font(.system(size: 16, weight: .medium)).foregroundStyle(accent)
                Text("拾日历").font(.system(size: 14, weight: .semibold))
                Spacer()
                Button { model.showingSettings = true } label: {
                    Image(systemName: "gearshape").font(.system(size: 15)).frame(width: 28, height: 28)
                }.buttonStyle(.plain).foregroundStyle(.secondary).help("设置与调休数据")
                    .accessibilityLabel("设置与调休数据")
            }
            .padding(.bottom, 14)

            HStack(spacing: 7) {
                Menu {
                    Menu("年份") {
                        ForEach(1901...2100, id: \.self) { year in
                            Button("\(String(year))年") { model.jump(year: year) }
                        }
                    }
                    Menu("月份") {
                        ForEach(1...12, id: \.self) { month in
                            Button("\(month)月") { model.jump(month: month) }
                        }
                    }
                } label: {
                    Text("\(String(model.year))年 \(model.monthNumber)月")
                        .font(.system(size: 21, weight: .semibold)).foregroundStyle(.primary)
                }.menuStyle(.borderlessButton).fixedSize().help("选择年份和月份")
                Spacer(minLength: 0)
                toolbarButton("chevron.left", label: "上个月", disabled: !model.canGoBack) { model.shiftMonth(-1) }
                    .keyboardShortcut(.leftArrow, modifiers: [])
                Button("今天") { model.goToday() }
                    .font(.system(size: 12, weight: .medium)).buttonStyle(.plain)
                    .padding(.horizontal, 10).frame(height: 28).background(tintSurface, in: RoundedRectangle(cornerRadius: 7))
                    .keyboardShortcut("t", modifiers: []).help("回到今天（T）")
                toolbarButton("chevron.right", label: "下个月", disabled: !model.canGoForward) { model.shiftMonth(1) }
                    .keyboardShortcut(.rightArrow, modifiers: [])
            }
            .padding(.bottom, 10)

            HStack(spacing: 2) {
                ForEach(Array(model.weekdays.enumerated()), id: \.offset) { _, weekday in
                    Text(weekday).font(.system(size: 11, weight: .medium))
                        .foregroundStyle(weekday == "六" || weekday == "日" ? weekendColor : Color.secondary)
                        .frame(maxWidth: .infinity)
                }
            }.padding(.bottom, 7)

            VStack(spacing: 3) {
                ForEach(0..<6, id: \.self) { row in
                    HStack(spacing: 2) {
                        ForEach(0..<7, id: \.self) { column in
                            if let day = gridDays[row * 7 + column] {
                                DayCell(day: day, isSelected: model.selected?.date == day.date, isToday: model.today == day.date, isInMonth: day.month == model.monthNumber, accent: accent) {
                                    model.selectDate(day.date)
                                }
                            } else { Color.clear.frame(width: 340.0 / 7, height: 40) }
                        }
                    }
                }
            }
            .accessibilityElement(children: .contain).accessibilityLabel("月历")
            .padding(.bottom, 8)

            HStack(spacing: 14) {
                legend("休", "放假", color: accent)
                legend("班", "补班", color: makeupColor)
                Spacer()
                if model.month?.coverage == .unavailable {
                    Text("本年调休未收录").font(.system(size: 11)).foregroundStyle(.secondary)
                }
            }.padding(.bottom, 10)

            if let day = model.selected {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(day.month)月\(day.day)日  周\(weekdayName(day.weekday))")
                            .font(.system(size: 13, weight: .semibold))
                        Text("农历\(day.lunar.monthName)\(day.lunar.dayName) · \(day.lunar.yearGanZhi)\(day.lunar.zodiac)年")
                            .font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer(minLength: 2)
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(scheduleText(day)).font(.system(size: 11, weight: .medium)).foregroundStyle(accent)
                        if let festival = day.festivals.first {
                            Text(festival).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                        } else if let term = day.solarTerm {
                            Text(term).font(.system(size: 10)).foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.horizontal, 11).padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading).background(tintSurface, in: RoundedRectangle(cornerRadius: 9))
                .contextMenu {
                    Button("复制日期与农历") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString("\(day.date) 农历\(day.lunar.monthName)\(day.lunar.dayName)", forType: .string)
                    }
                    if let source = day.schedule.sources.first, let url = URL(string: source) {
                        Button("查看放假安排来源") { NSWorkspace.shared.open(url) }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    Text("接下来的日子").font(.system(size: 12, weight: .semibold))
                    Spacer()
                    Text("从今天起").font(.system(size: 10)).foregroundStyle(.secondary)
                }.padding(.top, 12)
                if let term = model.events.first(where: { $0.kind == "solar-term" }) {
                    upcomingRow(date: term.date, title: term.name, days: term.daysUntil)
                }
                if let vacation = model.vacation {
                    Divider()
                    upcomingRow(date: vacation.start, title: "\(vacation.name) · 放假\(vacation.days)天", days: vacation.daysUntil)
                } else if let festival = model.events.first(where: { $0.kind == "festival" }) {
                    Divider()
                    upcomingRow(date: festival.date, title: festival.name, days: festival.daysUntil)
                }
            }
            Spacer(minLength: 8)
            Divider().padding(.bottom, 8)
            Button { model.showingSettings = true } label: {
                HStack(spacing: 5) {
                    Circle().fill(model.month?.coverage == .unavailable ? Color.orange : accent.opacity(0.55)).frame(width: 5, height: 5)
                    Text("中国大陆 · \(model.dataSummary)")
                        .font(.system(size: 11)).foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 8)).foregroundStyle(.secondary)
                }
            }.buttonStyle(.plain).help("查看数据来源和更新")
        }
    }

    private var gridDays: [CalendarDay?] { model.month?.cells ?? Array(repeating: nil, count: 42) }

    private var settings: some View {
        ScrollView {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button { model.showingSettings = false } label: { Label("返回日历", systemImage: "chevron.left").font(.system(size: 12)) }.buttonStyle(.plain)
                Spacer()
                Text("设置").font(.system(size: 14, weight: .semibold))
            }.padding(.bottom, 26)

            Text("日历显示").font(.system(size: 12, weight: .semibold)).padding(.bottom, 15)
            Picker("每周开始于", selection: $model.weekStartsOn) { Text("周一").tag(1); Text("周日").tag(7) }
                .pickerStyle(.segmented).padding(.bottom, 14)
            Picker("外观", selection: $model.appearance) {
                Text("跟随系统").tag("system"); Text("浅色").tag("light"); Text("深色").tag("dark")
            }.pickerStyle(.segmented)
            Divider().padding(.vertical, 23)

            Text("放假与调休").font(.system(size: 12, weight: .semibold)).padding(.bottom, 10)
            Text("已收录：\(model.availableYears.map(String.init).joined(separator: "、"))年")
                .font(.system(size: 11)).foregroundStyle(.secondary).padding(.bottom, 8)
            Text("农历、节气和已收录的调休均可离线查询。放假安排根据全国统一通知整理，不包含个人排班及地方假期。")
                .font(.system(size: 11)).foregroundStyle(.secondary).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 16)

            HStack(spacing: 10) {
                Button { Task { await model.checkUpdates() } } label: {
                    if model.updating { HStack(spacing: 5) { ProgressView().controlSize(.mini); Text("正在检查") } }
                    else { Text("检查调休更新") }
                }.disabled(model.updating)
                Button("导入 JSON…") { model.importFile() }.disabled(model.updating)
            }.controlSize(.regular)
            if let message = model.dataMessage {
                Text(message).font(.system(size: 11)).foregroundStyle(accent).padding(.top, 10).fixedSize(horizontal: false, vertical: true)
            }
            if let error = model.error {
                Text(error).font(.system(size: 11)).foregroundStyle(.red).padding(.top, 10).fixedSize(horizontal: false, vertical: true)
            }
            Divider().padding(.vertical, 22)
            Text("数据来源").font(.system(size: 12, weight: .semibold)).padding(.bottom, 10)
            Link("国务院节假日通知 · holiday-cn", destination: URL(string: "https://github.com/NateScarlet/holiday-cn")!)
                .font(.system(size: 11)).padding(.bottom, 8)
            Link("农历与节气计算 · lunar-typescript", destination: URL(string: "https://github.com/6tail/lunar-typescript")!)
                .font(.system(size: 11))
            Text("日期按北京时间计算 · 支持1901—2100年")
                .font(.system(size: 10)).foregroundStyle(.secondary).padding(.top, 12)
            Spacer(minLength: 16)
            HStack {
                Text("拾日历 0.1.0 · 免费无广告").font(.system(size: 10)).foregroundStyle(.secondary)
                Spacer()
                Button("退出") { NSApplication.shared.terminate(nil) }.buttonStyle(.plain).font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }.frame(minHeight: 580, alignment: .top)
        }.scrollIndicators(.hidden)
    }

    private func toolbarButton(_ symbol: String, label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: symbol).font(.system(size: 11, weight: .medium)).frame(width: 27, height: 28) }
            .buttonStyle(.plain).background(tintSurface, in: RoundedRectangle(cornerRadius: 7))
            .disabled(disabled).opacity(disabled ? 0.35 : 1).help(label).accessibilityLabel(label)
    }

    private func legend(_ mark: String, _ text: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Text(mark).font(.system(size: 11, weight: .semibold)).frame(width: 17, height: 17).foregroundStyle(color).background(color.opacity(0.09), in: RoundedRectangle(cornerRadius: 4))
            Text(text).font(.system(size: 11)).foregroundStyle(.secondary)
        }
    }

    private func upcomingRow(date: String, title: String, days: Int) -> some View {
        Button { model.selectDate(date) } label: {
            HStack(spacing: 10) {
                Text((date.prefix(4) != model.today.prefix(4) || model.year != Int(model.today.prefix(4))) ? date.replacingOccurrences(of: "-", with: "/") : date.dropFirst(5).replacingOccurrences(of: "-", with: "/"))
                    .font(.system(size: 11, weight: .semibold, design: .rounded)).monospacedDigit()
                    .foregroundStyle(accent).frame(width: 74, alignment: .leading)
                Text(title).font(.system(size: 12)).lineLimit(1)
                Spacer(minLength: 0)
                Text(days == 0 ? "今天" : "\(days)天后").font(.system(size: 11)).foregroundStyle(.secondary)
            }.frame(height: 25).contentShape(Rectangle())
        }.buttonStyle(.plain).help("查看\(date)的日期信息")
    }

    private func weekdayName(_ weekday: Int) -> String { ["一", "二", "三", "四", "五", "六", "日"][weekday - 1] }

    private func scheduleText(_ day: CalendarDay) -> String {
        if day.schedule.coverage == .unavailable { return "调休未收录" }
        switch day.schedule.kind {
        case .holiday: return "放假"
        case .makeupWorkday: return "补班日"
        case .weekend: return "周末"
        case .weekday: return "工作日"
        }
    }
}

private struct DayCell: View {
    let day: CalendarDay
    let isSelected: Bool
    let isToday: Bool
    let isInMonth: Bool
    let accent: Color
    let action: () -> Void
    @State private var hovering = false
    @Environment(\.colorScheme) private var scheme

    private var subtitle: String { day.festivals.first ?? day.solarTerm ?? (day.lunar.day == 1 ? day.lunar.monthName : day.lunar.dayName) }
    private var resting: Bool { day.schedule.kind == .holiday || (day.weekday >= 6 && day.schedule.kind != .makeupWorkday) }
    private var foreground: Color {
        if isSelected { return .white }
        if !isInMonth { return .secondary }
        if resting { return scheme == .dark ? CalendarColors.darkHoliday : CalendarColors.holiday }
        return .primary
    }

    var body: some View {
        Button(action: action) {
            // A fixed two-baseline layout prevents label-dependent intrinsic widths
            // from shifting the seven calendar columns. The button keeps semantic AX.
            Canvas { context, size in
                let number = Text(String(day.day))
                    .font(.system(size: 16, weight: isToday || isSelected ? .semibold : .medium))
                    .monospacedDigit().foregroundColor(foreground)
                let subtitleColor: Color = isSelected ? .white : !isInMonth ? .secondary : day.solarTerm != nil || !day.festivals.isEmpty ? accent : .secondary
                let lunar = Text(subtitle).font(.system(size: 11)).foregroundColor(subtitleColor)
                context.draw(number, at: CGPoint(x: size.width / 2, y: 11), anchor: .center)
                context.draw(lunar, at: CGPoint(x: size.width / 2, y: 31), anchor: .center)
                if day.schedule.kind == .holiday || day.schedule.kind == .makeupWorkday {
                    let color: Color = isSelected ? .white : day.schedule.kind == .holiday ? accent : scheme == .dark ? CalendarColors.darkMakeup : CalendarColors.makeup
                    let mark = Text(day.schedule.kind == .holiday ? "休" : "班").font(.system(size: 11, weight: .semibold)).foregroundColor(color)
                    context.draw(mark, at: CGPoint(x: size.width - 1, y: 0), anchor: .topTrailing)
                }
            }
            .frame(width: 340.0 / 7, height: 40)
            .background(isSelected ? CalendarColors.jade : hovering ? accent.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 7))
            .overlay { if isToday && !isSelected { RoundedRectangle(cornerRadius: 7).strokeBorder(accent, lineWidth: 1) } }
            .contentShape(RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain).onHover { hovering = $0 }
        .help("\(day.date) 农历\(day.lunar.monthName)\(day.lunar.dayName)\(day.schedule.kind == .makeupWorkday ? "，补班" : day.schedule.kind == .holiday ? "，放假" : "")")
        .accessibilityLabel("\(day.date)，农历\(day.lunar.monthName)\(day.lunar.dayName)，\(subtitle)\(day.schedule.kind == .makeupWorkday ? "，补班" : day.schedule.kind == .holiday ? "，放假" : day.schedule.coverage == .unavailable ? "，调休未收录" : "")")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
