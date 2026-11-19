import AppKit
import WebKit

final class Probe: NSObject, WKNavigationDelegate {
    let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 400, height: 660))
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 400, height: 660),
                          styleMask: [.borderless], backing: .buffered, defer: false)

    func run() {
        window.contentView = webView
        webView.navigationDelegate = self
        webView.loadHTMLString("""
        <style>
          :root { --panel-background: #fff; color-scheme: light; }
          .tw-bg-panel { background-color: var(--panel-background); }
          .calendar-app[data-theme-photo] { position: relative; isolation: isolate; }
          .theme-backdrop { position: absolute; z-index: -1; inset: 0; background: #444; }
        </style>
        <main class="calendar-app"><section class="month-panel tw-bg-panel">date</section></main>
        """, baseURL: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let script = """
        const panel = document.querySelector('.month-panel');
        const parent = panel.parentElement;
        const root = document.documentElement;
        const original = getComputedStyle(panel).backgroundColor;
        const backdrop = document.createElement('div');
        backdrop.className = 'theme-backdrop';
        parent.prepend(backdrop);
        parent.setAttribute('data-theme-photo', 'true');
        root.style.setProperty('--panel-background', 'rgba(255, 255, 255, 0)');
        const immediate = getComputedStyle(panel).backgroundColor;
        const inherited = getComputedStyle(panel).getPropertyValue('--panel-background');
        const inline = document.createElement('section');
        inline.style.backgroundColor = 'rgba(255, 255, 255, 0)';
        parent.append(inline);
        return {original, immediate, inherited, inline: getComputedStyle(inline).backgroundColor,
                hidden: document.hidden, contrast: matchMedia('(prefers-contrast: more)').matches,
                reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches,
                forcedColors: matchMedia('(forced-colors: active)').matches, ua: navigator.userAgent};
        """
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                print(value ?? "无结果")
                exit(0)
            case .failure(let error):
                print(error)
                exit(1)
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let probe = Probe()
probe.run()
DispatchQueue.main.asyncAfter(deadline: .now() + 12) { print("WebView 检查超时"); exit(1) }
app.run()
