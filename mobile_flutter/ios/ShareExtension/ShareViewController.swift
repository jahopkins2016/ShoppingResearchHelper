import UIKit
import Social
import UniformTypeIdentifiers

// Auto-submitting share extension.
// Subclasses SLComposeServiceViewController (the canonical share-extension
// base class) and immediately triggers save + redirect without showing the
// compose UI. Writes items in the format receive_sharing_intent expects and
// launches the host app via ShareMedia-<bundleId>:share.
@objc(ShareViewController)
class ShareViewController: SLComposeServiceViewController {

    private let appGroupId = "group.com.saveit.saveit"
    private let hostBundleId = "com.jahopkins.saveit"
    private let shareKey = "ShareKey"

    override func isContentValid() -> Bool {
        return true
    }

    override func configurationItems() -> [Any]! {
        return []
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Hide the compose sheet so the user only sees a brief flash.
        view.isHidden = true
        handleSharedItems()
    }

    override func didSelectPost() {
        // Not reachable in our auto-submit flow, but required by the base.
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func handleSharedItems() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let providers = extensionItem.attachments, !providers.isEmpty else {
            completeAndRedirect(saved: false)
            return
        }

        let group = DispatchGroup()
        var sharedItems: [[String: Any]] = []
        let itemsLock = NSLock()

        func append(_ entry: [String: Any]) {
            itemsLock.lock()
            sharedItems.append(entry)
            itemsLock.unlock()
        }

        for provider in providers {
            let urlType = "public.url"
            let textType = "public.plain-text"

            if provider.hasItemConformingToTypeIdentifier(urlType) {
                group.enter()
                provider.loadItem(forTypeIdentifier: urlType, options: nil) { item, _ in
                    defer { group.leave() }
                    if let url = item as? URL {
                        append(self.makeEntry(path: url.absoluteString, type: "url"))
                    } else if let str = item as? String, let url = URL(string: str) {
                        append(self.makeEntry(path: url.absoluteString, type: "url"))
                    }
                }
            } else if provider.hasItemConformingToTypeIdentifier(textType) {
                group.enter()
                provider.loadItem(forTypeIdentifier: textType, options: nil) { item, _ in
                    defer { group.leave() }
                    if let text = item as? String {
                        if let url = URL(string: text), url.scheme != nil {
                            append(self.makeEntry(path: url.absoluteString, type: "url"))
                        } else {
                            append(self.makeEntry(path: text, type: "text", mimeType: "text/plain"))
                        }
                    }
                }
            }
        }

        // Safety timeout so we never hang the share sheet forever.
        let timeout = DispatchTime.now() + .seconds(5)
        DispatchQueue.global().async {
            let result = group.wait(timeout: timeout)
            DispatchQueue.main.async {
                if !sharedItems.isEmpty,
                   let jsonData = try? JSONSerialization.data(withJSONObject: sharedItems) {
                    let defaults = UserDefaults(suiteName: self.appGroupId)
                    defaults?.set(jsonData, forKey: self.shareKey)
                    defaults?.synchronize()
                }
                self.completeAndRedirect(saved: result == .success && !sharedItems.isEmpty)
            }
        }
    }

    private func makeEntry(path: String, type: String, mimeType: String? = nil) -> [String: Any] {
        var dict: [String: Any] = [
            "path": path,
            "type": type,
        ]
        if let mimeType = mimeType {
            dict["mimeType"] = mimeType
        }
        return dict
    }

    private func completeAndRedirect(saved: Bool) {
        if saved, let url = URL(string: "ShareMedia-\(hostBundleId):share") {
            openURL(url)
        }
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    // Walks the responder chain looking for a UIApplication we can call
    // open(_:) on. This is the long-standing workaround share extensions use
    // to launch their host app. Works on both iOS <18 and iOS 18+.
    @discardableResult
    private func openURL(_ url: URL) -> Bool {
        var responder: UIResponder? = self
        while responder != nil {
            if let app = responder as? UIApplication {
                if #available(iOS 18.0, *) {
                    app.open(url, options: [:], completionHandler: nil)
                    return true
                } else {
                    let selector = sel_registerName("openURL:")
                    if app.responds(to: selector) {
                        _ = app.perform(selector, with: url)
                        return true
                    }
                }
            }
            responder = responder?.next
        }
        // Fallback: try the selector trick on any responder (pre-iOS 18).
        let selector = sel_registerName("openURL:")
        responder = self
        while responder != nil {
            if responder?.responds(to: selector) == true {
                _ = responder?.perform(selector, with: url)
                return true
            }
            responder = responder?.next
        }
        return false
    }
}
