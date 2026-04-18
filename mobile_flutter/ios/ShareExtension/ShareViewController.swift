import UIKit
import Social
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

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
        var sharedItems: [[String: String]] = []

        for provider in providers {
            let urlType = "public.url"
            let textType = "public.plain-text"

            if provider.hasItemConformingToTypeIdentifier(urlType) {
                group.enter()
                provider.loadItem(forTypeIdentifier: urlType, options: nil) { item, _ in
                    if let url = item as? URL {
                        sharedItems.append(["value": url.absoluteString, "type": "url"])
                    } else if let str = item as? String, let url = URL(string: str) {
                        sharedItems.append(["value": url.absoluteString, "type": "url"])
                    }
                    group.leave()
                }
            } else if provider.hasItemConformingToTypeIdentifier(textType) {
                group.enter()
                provider.loadItem(forTypeIdentifier: textType, options: nil) { item, _ in
                    if let text = item as? String {
                        sharedItems.append(["value": text, "type": "url"])
                    }
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            if !sharedItems.isEmpty,
               let jsonData = try? JSONSerialization.data(withJSONObject: sharedItems),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                // Write in the exact format receive_sharing_intent's Flutter plugin reads
                let defaults = UserDefaults(suiteName: "group.com.saveit.saveit")
                defaults?.set(jsonString, forKey: "ShareKey")
                defaults?.synchronize()
            }
            self?.openMainApp()
        }
    }

    private func openMainApp() {
        // Open the host app via URL scheme so Flutter can read the shared item
        let url = URL(string: "saveit://share")!
        var responder: UIResponder? = self
        while let r = responder {
            if let app = r as? UIApplication {
                app.open(url)
                break
            }
            responder = r.next
        }
        completeRequest()
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}
