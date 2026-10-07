import UIKit
import Capacitor

// The app's bridge view controller (Main.storyboard). Registers Hiranda's own
// native plugins, which live in this target rather than in node_modules.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
