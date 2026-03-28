import { View, Text, StyleSheet } from 'react-native';

export default function SharedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shared With Me</Text>
      <Text style={styles.subtitle}>Collections others have shared with you will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 32 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
});
