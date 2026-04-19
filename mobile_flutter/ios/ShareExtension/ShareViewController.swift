import UIKit
import Social
import UniformTypeIdentifiers

// Writes shared items in the exact format the receive_sharing_intent
// Flutter plugin expects (array of SharedMediaFile-compatible dicts) and
// opens the host app via the ShareMedia-<bundle_id>:share URL scheme.
class ShareViewController: UIViewController {

    private let appGroupId = "group.com.saveit.saveit"
    private let hostBundleId = "com.jahopkins.saveit"
    private let shareKey = "ShareKey"

    override func viewDidLoad() {
        super.viewDidLoad()
        handleSharedItems()
    }

    private func handleSharedItems() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let providers = extensionItem.attachments, !providers.isEmpty else {
            completeRequest()
            return
        }

        let group = DispatchGroup()
        var sharedItems: [[String: Any]] = []

        for provider in providers {
            let urlType = "public.url"
            let textType = "public.plain-text"

            if provider.hasItemConformingToTypeIdentifier(urlType) {
                group.enter()
                provider.loadItem(forTypeIdentifier: urlType, options: nil) { item, _ in
                    if let url = item as? URL {
                        sharedItems.append(self.makeEntry(path: url.absoluteString, type: "url"))
                    } else if let str = item as? String, let url = URL(string: str) {
                        sharedItems.append(self.makeEntry(path: url.absoluteString, type: "url"))
                    }
                    group.leave()
                }
            } else if provider.hasItemConformingToTypeIdentifier(textType) {
                group.enter()
                provider.loadItem(forTypeIdentifier: textType, options: nil) { item, _ in
                    if let text = item as? String {
                        // If the text is actually a URL, classify as url; else as text
                        if let url = URL(string: text), url.scheme != nil {
                            sharedItems.append(self.makeEntry(path: url.absoluteString, type: "url"))
                        } else {
                            sharedItems.append(self.makeEntry(path: text, type: "text", mimeType: "text/plain"))
                        }
                    }
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            if !sharedItems.isEmpty,
               let jsonData = try? JSONSerialization.data(withJSONObject: sharedItems) {
                let defaults = UserDefaults(suiteName: self.appGroupId)
                defaults?.set(jsonData, forKey: self.shareKey)
                defaults?.synchronize()
            }
            self.openHostApp()
        }
    }

    private func makeEntry(path: String, type: String, mimeType: String? = nil) -> [String: Any] {
        // Fields match SharedMediaFile (Codable) in receive_sharing_intent.
        var dict: [String: Any] = [
            "path": path,
            "type": type,
        ]
        if let mimeType = mimeType {
            dict["mimeType"] = mimeType
        }
        return dict
    }

    private func openHostApp() {
        guard let url = URL(string: "ShareMedia-\(hostBundleId):share") else {
            completeRequest()
            return
        }
        var responder: UIResponder? = self
        if #available(iOS 18.0, *) {
            while responder != nil {
                if let app = responder as? UIApplication {
                    app.open(url, options: [:], completionHandler: nil)
                }
                responder = responder?.next
            }
        } else {
            let selector = sel_registerName("openURL:")
            while responder != nil {
                if responder?.responds(to: selector) == true {
                    _ = responder?.perform(selector, with: url)
                }
                responder = responder?.next
            }
        }
        completeRequest()
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}
