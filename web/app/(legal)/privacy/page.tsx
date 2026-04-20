import type { Metadata } from "next";

// NOTE: This policy is a reasonable-defaults template for an indie SaaS
// product, not legal advice. Review with counsel before relying on it,
// and fill in the bracketed placeholders (legal-entity name, contact
// email, jurisdiction) before publishing.

export const metadata: Metadata = {
  title: "Privacy Policy — SaveIt",
  description: "How SaveIt collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: April 20, 2026</p>

      <p>
        This Privacy Policy explains how SaveIt (&ldquo;SaveIt,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, shares, and
        protects information about you when you use our mobile apps, browser
        extension, and website at saveit.website (together, the
        &ldquo;Service&rdquo;). By using the Service, you agree to this
        Policy.
      </p>

      <h2>1. Information we collect</h2>

      <h3>Information you provide</h3>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in with Google,
          we receive your email address, name, and profile picture from Google.
          We do not receive or store your Google password.
        </li>
        <li>
          <strong>Content you save.</strong> Products and links you bookmark,
          notes, tags, collection names, images you upload, and any text you
          enter into the Service.
        </li>
        <li>
          <strong>Sharing and collaboration.</strong> Email addresses of people
          you invite to collections, and any messages you exchange in the
          Service.
        </li>
        <li>
          <strong>Support communications.</strong> If you contact us, we keep
          the content of your messages so we can respond.
        </li>
      </ul>

      <h3>Information collected automatically</h3>
      <ul>
        <li>
          <strong>Usage and device information.</strong> Approximate device
          type, operating system, app version, and basic crash and performance
          diagnostics.
        </li>
        <li>
          <strong>Session cookies and tokens.</strong> We use secure cookies
          and auth tokens to keep you signed in and to protect against abuse.
        </li>
      </ul>

      <h3>Information from third parties</h3>
      <ul>
        <li>
          <strong>Page metadata.</strong> When you save a link, our servers
          fetch the page to extract public metadata (title, description,
          image, price). We store this metadata with your saved item; we do
          not store the full page contents.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>
          To operate the Service — store your saved items, sync them across
          your devices, and share collections with people you invite.
        </li>
        <li>
          To send you transactional messages such as sign-in emails, invite
          notifications, and important account or security updates.
        </li>
        <li>
          To maintain security, detect fraud and abuse, and enforce our Terms
          of Service.
        </li>
        <li>
          To improve the Service — diagnose bugs, understand which features
          are used, and plan improvements.
        </li>
        <li>
          To comply with legal obligations and respond to lawful requests.
        </li>
      </ul>

      <h2>3. How we share information</h2>
      <p>We do not sell your personal information. We share it only:</p>
      <ul>
        <li>
          <strong>With people you choose.</strong> When you share a collection
          or invite someone, the items in that collection and your display
          name become visible to them.
        </li>
        <li>
          <strong>With service providers</strong> that help us run the
          Service, under contractual confidentiality and data-protection
          obligations. These currently include:
          <ul>
            <li>Supabase (authentication, database, storage)</li>
            <li>Google (sign-in)</li>
            <li>Vercel (web hosting)</li>
            <li>Apple and Google (mobile app distribution and push)</li>
          </ul>
        </li>
        <li>
          <strong>For legal reasons</strong> — to comply with law, respond to
          valid legal process, or protect the rights, property, and safety of
          SaveIt, our users, or the public.
        </li>
        <li>
          <strong>In a corporate transaction</strong> — if SaveIt is acquired
          or merges with another company, your information may be transferred
          as part of that transaction, subject to this Policy.
        </li>
      </ul>

      <h2>4. Data retention</h2>
      <p>
        We keep your information for as long as your account is active. If you
        delete your account, we delete or anonymize your personal data within
        a reasonable period, except where we need to retain it to comply with
        legal obligations, resolve disputes, or enforce our agreements.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access,
        correct, delete, export, or restrict processing of your personal data,
        and to withdraw consent or object to certain uses. To exercise any of
        these rights, email us at{" "}
        <a href="mailto:support@saveit.website">support@saveit.website</a>.
        You can also delete your account from the Settings screen in the app
        at any time.
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard safeguards — encryption in transit, access
        controls, and trusted infrastructure providers — to protect your
        information. No system is perfectly secure; if we ever learn of a
        breach affecting your information, we will notify you as required by
        law.
      </p>

      <h2>7. Children</h2>
      <p>
        The Service is not directed to children under 13, and we do not
        knowingly collect personal information from them. If you believe a
        child has provided us information, please contact us and we will
        delete it.
      </p>

      <h2>8. International transfers</h2>
      <p>
        SaveIt is operated from [INSERT COUNTRY] and uses service providers
        that may store and process data in other countries, including the
        United States. By using the Service, you consent to these transfers.
      </p>

      <h2>9. Third-party links</h2>
      <p>
        The Service lets you save links to external websites. We don&rsquo;t
        control those sites, and this Policy doesn&rsquo;t cover their
        practices. Review each site&rsquo;s own privacy policy before
        interacting with it.
      </p>

      <h2>10. Cookies</h2>
      <p>
        On the website we use only essential cookies — to keep you signed in
        and to protect against cross-site request forgery. We do not use
        advertising or cross-site tracking cookies.
      </p>

      <h2>11. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. When we do, we&rsquo;ll
        change the &ldquo;Last updated&rdquo; date above, and for material
        changes we&rsquo;ll notify you by email or in-app notice before the
        change takes effect.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions or requests? Email{" "}
        <a href="mailto:support@saveit.website">support@saveit.website</a>.
      </p>
    </>
  );
}
