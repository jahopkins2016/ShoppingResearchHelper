import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, Share } from 'react-native';
import { supabase } from '../../lib/supabase';

type Profile = {
  display_name?: string | null;
  avatar_url?: string | null;
  referral_code?: string | null;
  email?: string;
};

export default function SettingsScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, referral_code')
      .eq('id', user.id)
      .single();
    setProfile({ ...data, email: user.email });
  }

  async function handleInvite() {
    const code = profile?.referral_code;
    if (!code) return;
    await Share.share({
      message: `I've been saving products and tracking prices with SaveIt. Join me! https://saveit.app/join?ref=${code}`,
    });
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  }

  const menuItems = [
    { section: 'APP PREFERENCES', items: [
      { icon: '🔔', label: 'Notifications' },
      { icon: '🎨', label: 'Appearance' },
      { icon: '☁️', label: 'Storage & Sync' },
    ]},
    { section: 'SECURITY', items: [
      { icon: '🔒', label: 'Privacy & Security' },
      { icon: '❓', label: 'Help & Support' },
    ]},
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>
      <Text style={styles.pageSubtitle}>Manage your gallery and account</Text>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatarWrap}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
              <Text style={styles.profileAvatarText}>
                {(profile?.display_name || profile?.email || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>✎</Text>
          </View>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile?.display_name || 'User'}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
        </View>
      </View>

      {/* Menu groups */}
      {menuItems.map((group) => (
        <View key={group.section} style={styles.menuGroup}>
          <Text style={styles.menuGroupLabel}>{group.section}</Text>
          <View style={styles.menuCard}>
            {group.items.map((item, i) => (
              <TouchableOpacity key={item.label} style={styles.menuItem} activeOpacity={0.7}>
                <View style={styles.menuItemLeft}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Invite a Friend */}
      <View style={styles.menuGroup}>
        <Text style={styles.menuGroupLabel}>SHARE</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={handleInvite} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuIcon}>🎁</Text>
              <Text style={styles.menuLabel}>Invite a Friend</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.9}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>SaveIt Version 1.6.0{'\n'}© 2026 SaveIt</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingHorizontal: 24, paddingBottom: 60 },

  pageTitle: { fontSize: 28, fontWeight: '800', color: '#191c1d', textAlign: 'center', marginTop: 8, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: '#434655', textAlign: 'center', marginTop: 4, marginBottom: 24, fontWeight: '500' },

  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  profileAvatarWrap: { position: 'relative' },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(0,74,198,0.1)',
  },
  profileAvatarPlaceholder: {
    backgroundColor: '#edeeef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 24, fontWeight: '700', color: '#434655' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#004ac6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  editBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  profileInfo: {},
  profileName: { fontSize: 17, fontWeight: '700', color: '#191c1d' },
  profileEmail: { fontSize: 13, color: '#434655', marginTop: 2 },

  menuGroup: { marginBottom: 24 },
  menuGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#9ca3af',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { fontSize: 18 },
  menuLabel: { fontSize: 15, fontWeight: '500', color: '#191c1d' },
  menuChevron: { fontSize: 20, color: '#c3c6d7' },

  signOutButton: {
    backgroundColor: '#ffdad6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  signOutText: { color: '#93000a', fontWeight: '700', fontSize: 16 },

  version: {
    fontSize: 11,
    color: '#737686',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
