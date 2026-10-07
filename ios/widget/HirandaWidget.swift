import WidgetKit
import SwiftUI

// Hiranda's home-screen widget: "312 days of you two".
// Lives in the HirandaWidget extension target (see APPSTORE.md for the
// one-time Xcode setup). The app writes the data via WidgetBridgePlugin into
// the shared App Group below — keep the two group names identical.
private let appGroup = "group.com.hiranda.app"

struct DaysEntry: TimelineEntry {
    let date: Date
    let days: Int?
    let partner: String?
}

struct DaysProvider: TimelineProvider {
    func placeholder(in context: Context) -> DaysEntry {
        DaysEntry(date: .now, days: 312, partner: "Riley")
    }

    func getSnapshot(in context: Context, completion: @escaping (DaysEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : load())
    }

    // Refresh just after midnight, when the count goes up.
    func getTimeline(in context: Context, completion: @escaping (Timeline<DaysEntry>) -> Void) {
        let tomorrow = Calendar.current.startOfDay(for: .now.addingTimeInterval(86_400)).addingTimeInterval(60)
        completion(Timeline(entries: [load()], policy: .after(tomorrow)))
    }

    private func load() -> DaysEntry {
        let shared = UserDefaults(suiteName: appGroup)
        var days: Int? = nil
        // Same count as the website: whole days since the date, at UTC midnight.
        if let since = shared?.string(forKey: "since") {
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            f.timeZone = TimeZone(identifier: "UTC")
            if let start = f.date(from: String(since.prefix(10))) {
                days = max(0, Int(Date.now.timeIntervalSince(start) / 86_400))
            }
        }
        return DaysEntry(date: .now, days: days, partner: shared?.string(forKey: "partner"))
    }
}

private let widgetBackground = Color(red: 0.071, green: 0.047, blue: 0.031) // #120c08
private let accent = Color(red: 0.75, green: 0.54, blue: 0.29)

struct DaysView: View {
    let entry: DaysEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Hiranda.")
                .font(.system(.caption, design: .serif))
                .foregroundStyle(accent)
            Spacer(minLength: 0)
            if let days = entry.days {
                Text("\(days)")
                    .font(.system(size: 44, weight: .regular, design: .serif))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                Text(entry.partner.map { "days of you & \($0)" } ?? "days of you two")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(2)
            } else {
                Text("Open Hiranda to start your count")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .modifier(WidgetBackground())
    }
}

// iOS 17 wants the background declared; older versions just paint it.
private struct WidgetBackground: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(widgetBackground, for: .widget)
        } else {
            content.padding().background(widgetBackground)
        }
    }
}

@main
struct HirandaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HirandaDays", provider: DaysProvider()) { entry in
            DaysView(entry: entry)
        }
        .configurationDisplayName("Days together")
        .description("How long it's been, you two.")
        .supportedFamilies([.systemSmall])
    }
}
