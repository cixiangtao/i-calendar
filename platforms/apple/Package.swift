// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ShiriCalendarKit",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "ShiriCalendarKit", targets: ["ShiriCalendarKit"]),
        .executable(name: "ShiriCalendar", targets: ["ShiriCalendar"]),
        .executable(name: "CalendarSmoke", targets: ["CalendarSmoke"])
    ],
    targets: [
        .target(name: "ShiriCalendarKit", resources: [.copy("Resources/calendar-core.js")]),
        .executableTarget(name: "ShiriCalendar", dependencies: ["ShiriCalendarKit"], path: "Sources/ShiriCalendar"),
        .executableTarget(name: "CalendarSmoke", dependencies: ["ShiriCalendarKit"], path: "Sources/CalendarSmoke"),
        .testTarget(name: "ShiriCalendarKitTests", dependencies: ["ShiriCalendarKit"])
    ]
)
