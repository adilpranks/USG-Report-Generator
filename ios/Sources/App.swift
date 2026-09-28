// USG Reporter — native iOS shell (UIKit + WKWebView) around the offline report builder in www/.
// The web layer talks to native code through window.AndroidBridge (same API as the Android app),
// which is injected here and forwarded to WKScriptMessageHandler "bridge".
import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool { true }

    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let c = UISceneConfiguration(name: "Default", sessionRole: session.role)
        c.delegateClass = SceneDelegate.self
        return c
    }
}

// Scene life cycle is mandatory for apps built with current SDKs.
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: ws)
        w.rootViewController = WebViewController()
        w.makeKeyAndVisible()
        window = w
    }
}

final class WebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private var printer: WKWebView?   // off-screen view used for printing / PDF

    private static let bridgeJS = """
    window.AndroidBridge = {
      copy:  function (t)    { webkit.messageHandlers.bridge.postMessage({a: 'copy',  t: t}); },
      share: function (t, n) { webkit.messageHandlers.bridge.postMessage({a: 'share', t: t, n: n}); },
      print: function (h, n) { webkit.messageHandlers.bridge.postMessage({a: 'print', h: h, n: n}); },
      toast: function (m)    { webkit.messageHandlers.bridge.postMessage({a: 'toast', t: m}); }
    };
    """

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        // Persistent store so settings, drafts and saved reports survive app restarts.
        cfg.websiteDataStore = .default()
        cfg.userContentController.addUserScript(
            WKUserScript(source: Self.bridgeJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        cfg.userContentController.add(self, name: "bridge")
        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.scrollView.contentInsetAdjustmentBehavior = .never   // page handles safe areas via env()
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.953, green: 0.961, blue: 0.973, alpha: 1)
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let www = Bundle.main.url(forResource: "www", withExtension: nil) else { return }
        web.loadFileURL(www.appendingPathComponent("index.html"), allowingReadAccessTo: www)
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    // MARK: bridge
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let action = body["a"] as? String else { return }
        switch action {
        case "copy":
            UIPasteboard.general.string = body["t"] as? String ?? ""
            toast("Report copied")
        case "share":
            present(activity: [body["t"] as? String ?? ""])
        case "print":
            printHTML(body["h"] as? String ?? "", name: body["n"] as? String ?? "USG Report")
        case "toast":
            toast(body["t"] as? String ?? "")
        default: break
        }
    }

    private func present(activity items: [Any]) {
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let pop = vc.popoverPresentationController {            // iPad
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 60, width: 1, height: 1)
        }
        present(vc, animated: true)
    }

    /// Lays the report out in an off-screen web view, then opens the iOS print sheet
    /// (which also offers Save to Files / Share as PDF).
    private func printHTML(_ html: String, name: String) {
        let pv = WKWebView(frame: CGRect(x: 0, y: 0, width: 595, height: 842))
        pv.navigationDelegate = self
        printer = pv
        pv.accessibilityLabel = name
        pv.loadHTMLString(html, baseURL: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView === printer else { return }
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = webView.accessibilityLabel ?? "USG Report"
        let pc = UIPrintInteractionController.shared
        pc.printInfo = info
        let fmt = webView.viewPrintFormatter()
        fmt.perPageContentInsets = UIEdgeInsets(top: 36, left: 40, bottom: 36, right: 40)
        pc.printFormatter = fmt
        pc.present(animated: true) { [weak self] _, _, _ in self?.printer = nil }
    }

    // Native fallbacks for any JS alert/confirm (the app uses in-page dialogs, but be safe).
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    private func toast(_ text: String) {
        guard !text.isEmpty else { return }
        let l = PaddedLabel()
        l.text = text
        l.textColor = .white
        l.font = .systemFont(ofSize: 15, weight: .medium)
        l.backgroundColor = UIColor(white: 0.13, alpha: 0.92)
        l.layer.cornerRadius = 18
        l.clipsToBounds = true
        l.alpha = 0
        l.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(l)
        NSLayoutConstraint.activate([
            l.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            l.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -90),
        ])
        UIView.animate(withDuration: 0.2, animations: { l.alpha = 1 }) { _ in
            UIView.animate(withDuration: 0.3, delay: 1.5, options: [], animations: { l.alpha = 0 }) { _ in l.removeFromSuperview() }
        }
    }
}

private final class PaddedLabel: UILabel {
    override func drawText(in rect: CGRect) { super.drawText(in: rect.insetBy(dx: 16, dy: 9)) }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + 32, height: s.height + 18)
    }
}
