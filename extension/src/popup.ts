import { supabase, SUPABASE_URL } from './lib/supabase';

interface Metadata {
  title: string;
  description: string;
  image_url: string;
  site_name: string;
  site_favicon_url: string;
  price: string;
  currency: string;
}

interface Collection {
  id: string;
  name: string;
  is_default: boolean;
}

const EXTENSION_VERSION = '1.8.0';

const app = document.getElementById('app')!;

let currentUser: { id: string } | null = null;
let metadata: Metadata | null = null;
let tabUrl = '';
let tabTitle = '';
let collections: Collection[] = [];

// ── Helpers ──────────────────────────────────────────────────

function escapeHtml(str: string): string {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showStatus(message: string, type: 'success' | 'error') {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.textContent = message;
  el.className = `status-message ${type}`;
}

function openWebsite() {
  chrome.tabs.create({ url: 'https://web-weld-two-36.vercel.app/' });
}

// ── Metadata extraction (runs in page context) ──────────────

async function extractPageMetadata(tabId: number): Promise<Metadata> {
  const blank: Metadata = {
    title: '',
    description: '',
    image_url: '',
    site_name: '',
    site_favicon_url: '',
    price: '',
    currency: '',
  };

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        function getMeta(attr: string, value: string): string | null {
          const el = document.querySelector(`meta[${attr}="${value}"]`);
          return el ? el.getAttribute('content') : null;
        }

        const title =
          getMeta('property', 'og:title') ||
          getMeta('name', 'title') ||
          document.title ||
          '';
        const description =
          getMeta('property', 'og:description') ||
          getMeta('name', 'description') ||
          '';
        const image_url = getMeta('property', 'og:image') || '';
        const site_name =
          getMeta('property', 'og:site_name') || location.hostname;

        const faviconLink = document.querySelector(
          'link[rel~="icon"]'
        ) as HTMLLinkElement | null;
        const site_favicon_url =
          faviconLink?.href || `${location.origin}/favicon.ico`;

        let price = '';
        let currency = '';

        // Try JSON-LD for product pricing
        const ldScripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );
        for (const script of ldScripts) {
          try {
            const raw = JSON.parse(script.textContent || '');
            const nodes = Array.isArray(raw) ? raw : [raw];

            const findProduct = (items: any[]): boolean => {
              for (const item of items) {
                if (item['@type'] === 'Product' && item.offers) {
                  const offers = Array.isArray(item.offers)
                    ? item.offers
                    : [item.offers];
                  for (const offer of offers) {
                    if (offer.price || offer.lowPrice) {
                      price = String(offer.price ?? offer.lowPrice ?? '');
                      currency = offer.priceCurrency || '';
                      return true;
                    }
                  }
                }
                if (item['@graph'] && Array.isArray(item['@graph'])) {
                  if (findProduct(item['@graph'])) return true;
                }
              }
              return false;
            };

            if (findProduct(nodes)) break;
          } catch {
            /* skip invalid JSON-LD */
          }
        }

        // Fallback to meta tags for price
        if (!price) {
          price =
            getMeta('property', 'product:price:amount') ||
            getMeta('property', 'og:price:amount') ||
            '';
        }
        if (!currency) {
          currency =
            getMeta('property', 'product:price:currency') ||
            getMeta('property', 'og:price:currency') ||
            '';
        }

        return {
          title,
          description,
          image_url,
          site_name,
          site_favicon_url,
          price,
          currency,
        };
      },
    });

    return results[0]?.result ?? blank;
  } catch {
    return blank;
  }
}

// ── Login ────────────────────────────────────────────────────

function renderLogin() {
  app.innerHTML = `
    <div class="header">
      <div class="logo-wrap"><img class="logo-icon" src="saveit-icon.svg" alt="SaveIt" /><h1 class="logo">SaveIt</h1></div>
      <button id="website-btn" class="btn-link btn-website" title="Open SaveIt website">↗ Website</button>
    </div>
    <div class="login-form">
      <h2>Sign in</h2>
      <div id="login-error" class="error hidden"></div>
      <button id="google-btn" class="btn-google">
        <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
      <div class="login-divider"><span>or</span></div>
      <input type="email" id="email" placeholder="Email" autocomplete="email" />
      <input type="password" id="password" placeholder="Password" autocomplete="current-password" />
      <button id="login-btn" class="btn-primary">Sign In</button>
    </div>
    <div id="redirect-url" class="redirect-url" title="Click to copy">${escapeHtml(chrome.identity.getRedirectURL())}</div>
    <div class="version-badge">v${EXTENSION_VERSION}</div>
  `;

  document.getElementById('website-btn')!.addEventListener('click', openWebsite);
  document.getElementById('google-btn')!.addEventListener('click', handleGoogleLogin);
  document.getElementById('login-btn')!.addEventListener('click', handleLogin);
  document.getElementById('redirect-url')!.addEventListener('click', async () => {
    const el = document.getElementById('redirect-url')!;
    await navigator.clipboard.writeText(chrome.identity.getRedirectURL());
    el.textContent = 'Copied!';
    setTimeout(() => { el.textContent = chrome.identity.getRedirectURL(); }, 1500);
  });
  document.getElementById('password')!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

async function handleGoogleLogin() {
  const errorEl = document.getElementById('login-error')!;
  const btn = document.getElementById('google-btn') as HTMLButtonElement;

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  errorEl.classList.add('hidden');

  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl =
      `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
      `&redirect_to=${encodeURIComponent(redirectUrl)}`;

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    if (!responseUrl) {
      throw new Error('No response from Google sign-in.');
    }

    // Supabase redirects with tokens in the URL fragment
    const hashParams = new URLSearchParams(
      responseUrl.includes('#') ? responseUrl.split('#')[1] : ''
    );
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      throw new Error('Sign-in failed — no tokens received.');
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;

    init();
  } catch (err: any) {
    const message =
      err?.message === 'The user did not approve access.'
        ? 'Sign-in was cancelled.'
        : err?.message || 'Google sign-in failed.';
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = `
      <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google`;
  }
}

async function handleLogin() {
  const emailEl = document.getElementById('email') as HTMLInputElement;
  const passwordEl = document.getElementById('password') as HTMLInputElement;
  const errorEl = document.getElementById('login-error')!;
  const btn = document.getElementById('login-btn') as HTMLButtonElement;

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in\u2026';
  errorEl.classList.add('hidden');

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign In';
    return;
  }

  init();
}

// ── Save UI ──────────────────────────────────────────────────

async function loadSaveUI() {
  app.innerHTML = `
    <div class="header">
      <div class="logo-wrap"><img class="logo-icon" src="saveit-icon.svg" alt="SaveIt" /><h1 class="logo">SaveIt</h1></div>
      <div class="header-actions">
        <button id="website-btn" class="btn-link btn-website" title="Open SaveIt website">↗ Website</button>
        <button id="signout-btn" class="btn-link">Sign out</button>
      </div>
    </div>
    <div class="loading"><div class="spinner"></div><p>Loading…</p></div>
    <div class="version-badge">v${EXTENSION_VERSION}</div>
  `;
  document
    .getElementById('website-btn')!
    .addEventListener('click', openWebsite);
  document
    .getElementById('signout-btn')!
    .addEventListener('click', handleSignOut);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabUrl = tab?.url || '';
  tabTitle = tab?.title || '';

  const [metaResult, collectionsResult] = await Promise.all([
    tab?.id ? extractPageMetadata(tab.id) : Promise.resolve(null),
    supabase
      .from('collections')
      .select('id, name, is_default')
      .eq('user_id', currentUser!.id)
      .order('sort_order'),
  ]);

  metadata = metaResult;
  collections = collectionsResult.data || [];

  renderSaveForm();
}

function renderSaveForm() {
  const title = metadata?.title || tabTitle || 'Untitled';
  const displayUrl =
    tabUrl.length > 60 ? tabUrl.substring(0, 60) + '\u2026' : tabUrl;
  const faviconSrc = metadata?.site_favicon_url || '';
  const imageSrc = metadata?.image_url || '';

  const defaultCollection = collections.find((c) => c.is_default);
  const defaultId =
    defaultCollection?.id || (collections.length > 0 ? collections[0].id : '');

  app.innerHTML = `
    <div class="header">
      <div class="logo-wrap"><img class="logo-icon" src="saveit-icon.svg" alt="SaveIt" /><h1 class="logo">SaveIt</h1></div>
      <div class="header-actions">
        <button id="website-btn" class="btn-link btn-website" title="Open SaveIt website">↗ Website</button>
        <button id="signout-btn" class="btn-link">Sign out</button>
      </div>
    </div>

    <div class="page-preview">
      ${imageSrc ? `<img class="preview-image" src="${escapeAttr(imageSrc)}" alt="" />` : ''}
      <div class="preview-info">
        <div class="preview-label">Product Detected</div>
        <span class="preview-title">${escapeHtml(title)}</span>
        ${metadata?.price ? `<span class="preview-price">${escapeHtml(metadata.currency || '$')}${escapeHtml(metadata.price)}</span>` : ''}
        <div class="preview-url">
          ${faviconSrc ? `<img class="preview-favicon" src="${escapeAttr(faviconSrc)}" alt="" />` : ''}
          <span>${escapeHtml(displayUrl)}</span>
        </div>
      </div>
    </div>

    <div class="form-section">
      <label for="collection-select">Save to Collection</label>
      <select id="collection-select">
        ${collections.map((c) => `<option value="${escapeAttr(c.id)}"${c.id === defaultId ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <button id="new-collection-btn" class="btn-secondary">+ New Collection</button>
      <div id="new-collection-form" class="hidden">
        <input type="text" id="new-collection-name" placeholder="Collection name" />
        <div class="inline-actions">
          <button id="create-collection-btn" class="btn-small btn-primary">Create</button>
          <button id="cancel-collection-btn" class="btn-small btn-secondary">Cancel</button>
        </div>
      </div>
    </div>

    <div id="status-message" class="hidden"></div>
    <button id="save-btn" class="btn-primary btn-save">Save to Collection</button>
    <div class="version-badge">v${EXTENSION_VERSION}</div>
  `;

  document
    .getElementById('signout-btn')!
    .addEventListener('click', handleSignOut);
  document
    .getElementById('website-btn')!
    .addEventListener('click', openWebsite);
  document
    .getElementById('new-collection-btn')!
    .addEventListener('click', showNewCollectionForm);
  document
    .getElementById('save-btn')!
    .addEventListener('click', handleSave);
}

// ── New collection ───────────────────────────────────────────

function showNewCollectionForm() {
  document.getElementById('new-collection-form')!.classList.remove('hidden');
  document.getElementById('new-collection-btn')!.classList.add('hidden');
  const nameInput = document.getElementById(
    'new-collection-name'
  ) as HTMLInputElement;
  nameInput.focus();

  document
    .getElementById('create-collection-btn')!
    .addEventListener('click', handleCreateCollection);
  document
    .getElementById('cancel-collection-btn')!
    .addEventListener('click', () => {
      document.getElementById('new-collection-form')!.classList.add('hidden');
      document.getElementById('new-collection-btn')!.classList.remove('hidden');
    });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCreateCollection();
  });
}

async function handleCreateCollection() {
  const nameInput = document.getElementById(
    'new-collection-name'
  ) as HTMLInputElement;
  const name = nameInput.value.trim();
  if (!name) return;

  const btn = document.getElementById(
    'create-collection-btn'
  ) as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Creating\u2026';

  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: currentUser!.id, name })
    .select('id, name, is_default')
    .single();

  if (error) {
    showStatus('Failed to create collection: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Create';
    return;
  }

  collections.push(data);
  const select = document.getElementById(
    'collection-select'
  ) as HTMLSelectElement;
  const option = document.createElement('option');
  option.value = data.id;
  option.textContent = data.name;
  option.selected = true;
  select.appendChild(option);

  document.getElementById('new-collection-form')!.classList.add('hidden');
  document.getElementById('new-collection-btn')!.classList.remove('hidden');
  nameInput.value = '';
  btn.disabled = false;
  btn.textContent = 'Create';
}

// ── Save item ────────────────────────────────────────────────

async function handleSave() {
  const select = document.getElementById(
    'collection-select'
  ) as HTMLSelectElement;
  const collectionId = select.value;
  const btn = document.getElementById('save-btn') as HTMLButtonElement;

  if (!collectionId) {
    showStatus('Please select or create a collection first.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving\u2026';

  const { error } = await supabase.from('items').insert({
    user_id: currentUser!.id,
    collection_id: collectionId,
    url: tabUrl,
    title: metadata?.title || tabTitle || null,
    description: metadata?.description || null,
    image_url: metadata?.image_url || null,
    price: metadata?.price || null,
    currency: metadata?.currency || null,
    site_name: metadata?.site_name || null,
    site_favicon_url: metadata?.site_favicon_url || null,
    enrichment_status: 'completed' as const,
  });

  if (error) {
    showStatus('Failed to save: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Save to Collection';
    return;
  }

  showStatus('Saved! \u2713', 'success');
  btn.textContent = 'Saved!';
  setTimeout(() => window.close(), 1500);
}

// ── Sign out ─────────────────────────────────────────────────

async function handleSignOut() {
  await supabase.auth.signOut();
  currentUser = null;
  renderLogin();
}

// ── Init ─────────────────────────────────────────────────────

async function init() {
  app.innerHTML = `
    <div class="header"><div class="logo-wrap"><img class="logo-icon" src="saveit-icon.svg" alt="SaveIt" /><h1 class="logo">SaveIt</h1></div></div>
    <div class="loading"><div class="spinner"></div><p>Loading…</p></div>
  `;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    renderLogin();
    return;
  }

  currentUser = { id: session.user.id };
  await loadSaveUI();
}

document.addEventListener('DOMContentLoaded', init);
