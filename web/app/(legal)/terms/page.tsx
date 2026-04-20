import type { Metadata } from "next";

// NOTE: These Terms are a reasonable-defaults template for an indie SaaS
// product, not legal advice. Review with counsel before relying on them,
// and fill in the bracketed placeholders (legal-entity name, governing
// law, dispute resolution) before publishing.

export const metadata: Metadata = {
  title: "Terms of Service — SaveIt",
  description: "The rules and agreements that govern your use of SaveIt.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="updated">Last updated: April 20, 2026</p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to
        and use of SaveIt&rsquo;s mobile apps, browser extension, and website
        at saveit.website (together, the &ldquo;Service&rdquo;). By using the
        Service you agree to these Terms. If you don&rsquo;t agree, please
        don&rsquo;t use the Service.
      </p>

      <h2>1. Who can use SaveIt</h2>
      <p>
        You must be at least 13 years old to use the Service. If you&rsquo;re
        under 18, you must have a parent or legal guardian&rsquo;s permission.
        You&rsquo;re responsible for making sure your use of the Service
        complies with all laws that apply to you.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>
          You sign in through a third-party provider (currently Google).
          Keep your provider credentials secure — you&rsquo;re responsible
          for activity on your account.
        </li>
        <li>
          Give us accurate information, and keep it up to date.
        </li>
        <li>
          One account per person. Don&rsquo;t share your account or let
          someone else use it.
        </li>
        <li>
          Tell us right away if you suspect unauthorized use of your account.
        </li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        <strong>You keep ownership</strong> of the collections, items, notes,
        images, and other content you put into the Service (&ldquo;Your
        Content&rdquo;).
      </p>
      <p>
        To run the Service, you grant SaveIt a worldwide, non-exclusive,
        royalty-free license to host, store, reproduce, modify (e.g.
        thumbnails and resized images), and display Your Content to you and
        the people you share it with. This license lasts while Your Content
        is in the Service and for a short period afterward to allow for
        backup cleanup. We don&rsquo;t use Your Content for advertising.
      </p>
      <p>
        <strong>You&rsquo;re responsible for Your Content.</strong> By
        submitting it, you represent that you have the rights to do so and
        that it doesn&rsquo;t violate these Terms, any law, or anyone
        else&rsquo;s rights.
      </p>

      <h2>4. Saving links and third-party content</h2>
      <p>
        The Service lets you bookmark links to third-party websites and
        extracts public metadata (title, image, price, description) to show
        a preview. You&rsquo;re responsible for respecting the terms and
        copyright of the sites you save from. SaveIt is not affiliated with
        those sites and doesn&rsquo;t endorse their products or services.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use the Service to store or share content that is illegal,
          infringing, defamatory, abusive, sexually explicit involving
          minors, or that violates anyone&rsquo;s rights or privacy.
        </li>
        <li>
          Use the Service for spam, mass unsolicited messaging, or to harass
          other users.
        </li>
        <li>
          Reverse engineer, decompile, or attempt to extract source code from
          the Service, except where that restriction is prohibited by law.
        </li>
        <li>
          Use automated tools, scrapers, or bots to access the Service in a
          way that degrades it for others, or probe or test the
          Service&rsquo;s vulnerability without our written consent.
        </li>
        <li>
          Attempt to bypass rate limits, access restrictions, or authentication.
        </li>
        <li>
          Resell, sublicense, or commercially exploit the Service or any
          portion of it without our written permission.
        </li>
      </ul>

      <h2>6. Sharing and collaborators</h2>
      <p>
        If you share a collection or invite collaborators, the content of
        that collection becomes visible to the people you&rsquo;ve invited,
        and public-link sharing makes it visible to anyone with the link.
        Review who has access regularly from the Settings of each collection.
      </p>

      <h2>7. Service availability and changes</h2>
      <p>
        We work hard to keep the Service running, but we don&rsquo;t
        guarantee it will always be available, error-free, or secure. We may
        add, change, suspend, or remove features at any time. We&rsquo;ll
        give reasonable notice for significant changes that affect how you
        use the Service, when we can.
      </p>

      <h2>8. Termination</h2>
      <p>
        <strong>You can stop using the Service at any time</strong> and delete
        your account from Settings in the app. We can suspend or terminate
        your access if you violate these Terms, if we&rsquo;re required to
        by law, or if your use poses a risk to other users or to the Service.
        Where practical, we&rsquo;ll give you notice before doing so.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as
        available,&rdquo;</strong> without warranties of any kind, express or
        implied, including warranties of merchantability, fitness for a
        particular purpose, non-infringement, and any warranties arising from
        course of dealing or usage of trade. We don&rsquo;t warrant that
        prices, availability, or product information fetched from third-party
        sites are accurate.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, SaveIt and its owners,
        employees, and service providers will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or any loss
        of profits, revenues, data, goodwill, or other intangible losses,
        arising out of or related to your use of the Service. Our total
        aggregate liability for any claim arising out of or relating to the
        Service is limited to the greater of US $50 or the amount you paid
        us in the twelve months before the claim.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless SaveIt and its owners from
        any claims, damages, liabilities, and expenses (including reasonable
        attorneys&rsquo; fees) arising out of your use of the Service, Your
        Content, or your violation of these Terms.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we&rsquo;ll
        change the &ldquo;Last updated&rdquo; date above, and for material
        changes we&rsquo;ll notify you by email or in-app notice before they
        take effect. Continuing to use the Service after a change means you
        accept the updated Terms.
      </p>

      <h2>13. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of [INSERT JURISDICTION], without
        regard to its conflict-of-laws rules. Any dispute arising out of or
        relating to these Terms or the Service will be resolved exclusively
        in the courts of [INSERT VENUE], and you and SaveIt consent to the
        personal jurisdiction of those courts.
      </p>

      <h2>14. Miscellaneous</h2>
      <ul>
        <li>
          These Terms, together with our{" "}
          <a href="/privacy">Privacy Policy</a>, are the entire agreement
          between you and SaveIt regarding the Service.
        </li>
        <li>
          If any provision of these Terms is found unenforceable, the rest
          remain in effect.
        </li>
        <li>
          Our failure to enforce a right under these Terms isn&rsquo;t a
          waiver of that right.
        </li>
        <li>
          You can&rsquo;t assign these Terms without our written consent; we
          may assign them as part of a merger, acquisition, or sale of
          assets.
        </li>
      </ul>

      <h2>15. Contact</h2>
      <p>
        Questions? Email{" "}
        <a href="mailto:support@saveit.website">support@saveit.website</a>.
      </p>
    </>
  );
}
