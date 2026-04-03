import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://fvzcsnphxrewvpvuqamt.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2emNzbnBoeHJld3ZwdnVxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzQ4NDIsImV4cCI6MjA5MDI1MDg0Mn0.LzVpSrNIuzmwgsyzmuLOE4V-WX2GyKwJqxG1DCjheEs';

const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null);
      });
    }),
  setItem: (key: string, value: string): Promise<void> =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    }),
  removeItem: (key: string): Promise<void> =>
    new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    }),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
