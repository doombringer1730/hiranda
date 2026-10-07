import Foundation
import Capacitor
import WidgetKit

// Lets the website hand the home-screen widget what it shows ("312 days of
// you two"). The data goes into the shared App Group, which the widget reads.
// If you change the bundle id, change the App Group here and in the widget.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.hiranda.app"

    @objc func update(_ call: CAPPluginCall) {
        guard let shared = UserDefaults(suiteName: Self.appGroup) else {
            call.resolve()
            return
        }
        shared.set(call.getString("since"), forKey: "since")
        shared.set(call.getString("partner"), forKey: "partner")
        shared.set(call.getString("me"), forKey: "me")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
