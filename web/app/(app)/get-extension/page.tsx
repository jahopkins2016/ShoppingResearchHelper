import styles from "./page.module.css";

export default function GetExtensionPage() {
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        <h1 className={styles.heroTitle}>SaveIt Browser Extension</h1>
        <p className={styles.heroSubtitle}>
          Save any product from any website in one click — right from your browser.
        </p>
        <a
          href="https://chromewebstore.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.ctaBtn}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Add to Chrome — It&apos;s Free
        </a>
        <p className={styles.storeNote}>Also works in Edge, Brave, and Arc</p>
      </div>

      {/* Feature cards */}
      <div className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>⚡</div>
          <h3 className={styles.featureTitle}>One-Click Save</h3>
          <p className={styles.featureText}>
            Click the SaveIt icon on any product page. Title, image, and price
            are extracted instantly — no copy-pasting.
          </p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>💰</div>
          <h3 className={styles.featureTitle}>Auto Price Detection</h3>
          <p className={styles.featureText}>
            The extension reads the price from the page automatically, so you
            always know what you paid and when prices drop.
          </p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>📂</div>
          <h3 className={styles.featureTitle}>Pick Your Collection</h3>
          <p className={styles.featureText}>
            Choose which collection to save to, or create a new one on the spot
            without leaving the page you&apos;re on.
          </p>
        </div>
      </div>

      {/* Manual install instructions */}
      <div className={styles.manualSection}>
        <h2 className={styles.manualTitle}>Not on the Chrome Web Store yet?</h2>
        <p className={styles.manualSubtitle}>
          Install the extension manually in a few steps while we await store approval.
        </p>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <div>
              <strong>Download the extension</strong>
              <p>
                <a href="/SaveIt-extension.zip" download className={styles.downloadLink}>
                  Download SaveIt-extension.zip
                </a>
              </p>
            </div>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <div>
              <strong>Unzip the file</strong>
              <p>Extract the folder anywhere on your computer.</p>
            </div>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <div>
              <strong>Open Chrome Extensions</strong>
              <p>
                Go to{" "}
                <code className={styles.code}>chrome://extensions</code> and
                turn on <strong>Developer mode</strong> (top-right toggle).
              </p>
            </div>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>4</span>
            <div>
              <strong>Load the extension</strong>
              <p>
                Click <strong>Load unpacked</strong> and select the unzipped
                folder. SaveIt will appear in your toolbar.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
