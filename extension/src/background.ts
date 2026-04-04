// Service worker for the SaveIt extension.
chrome.runtime.onInstalled.addListener(() => {
  console.log('SaveIt extension installed.');
  console.log('OAuth redirect URL:', chrome.identity.getRedirectURL());
});
