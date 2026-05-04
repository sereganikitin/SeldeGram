import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';

interface Props {
  visible: boolean;
  title: string;
  text: string;
  loading: boolean;
  onClose: () => void;
}

export function AiOverlay({ visible, title, text, loading, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Sparkles size={16} color="#fff" />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#3d1a28" />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#ff7a99" />
                <Text style={styles.loadingText}>Думаем...</Text>
              </View>
            ) : (
              <Text style={styles.body}>{text}</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, width: '100%', maxWidth: 420 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ff7a99', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#3d1a28', flex: 1 },
  closeBtn: { padding: 4 },
  body: { fontSize: 14, color: '#3d1a28', lineHeight: 20 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loadingText: { color: '#8c6471' },
});
