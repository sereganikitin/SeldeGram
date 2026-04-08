import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ScrollView } from 'react-native';
import { api } from '../api';
import { Sticker, StickerPack } from '../types';
import { StickerImage } from './StickerImage';

interface Props {
  onPick: (stickerId: string) => void;
  onClose: () => void;
}

interface Tab {
  id: string;
  label: string;
  stickers: Sticker[];
}

export function StickerPicker({ onPick, onClose }: Props) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [recentResp, packsResp] = await Promise.all([
          api.get<Sticker[]>('/stickers/recent'),
          api.get<StickerPack[]>('/stickers/my'),
        ]);
        const t: Tab[] = [];
        if (recentResp.data.length > 0) {
          t.push({ id: 'recent', label: '🕒', stickers: recentResp.data });
        }
        for (const p of packsResp.data) {
          t.push({ id: p.id, label: p.name.substring(0, 2).toUpperCase(), stickers: p.stickers });
        }
        setTabs(t);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Загрузка...</Text>
      </View>
    );
  }

  if (tabs.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>У вас нет установленных стикерпаков</Text>
        <Text style={styles.emptyHint}>Откройте Чаты → Стикеры, чтобы добавить или создать пак</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Закрыть</Text>
        </Pressable>
      </View>
    );
  }

  const active = tabs[activeIdx];

  return (
    <View style={styles.container}>
      <FlatList
        key={active.id}
        data={active.stickers}
        keyExtractor={(s) => s.id}
        numColumns={4}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPick(item.id)} style={styles.cell}>
            <StickerImage mediaKey={item.mediaKey} size={70} />
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Нет стикеров</Text>}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar}>
        {tabs.map((t, i) => (
          <Pressable
            key={t.id}
            onPress={() => setActiveIdx(i)}
            style={[styles.tab, i === activeIdx && styles.tabActive]}
          >
            <Text style={styles.tabLabel}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 320, backgroundColor: '#f7f7f7', borderTopWidth: 1, borderTopColor: '#ddd' },
  cell: { flex: 1 / 4, alignItems: 'center', padding: 8 },
  empty: { textAlign: 'center', padding: 30, color: '#888' },
  emptyHint: { textAlign: 'center', color: '#aaa', fontSize: 12, paddingHorizontal: 20 },
  closeBtn: { alignSelf: 'center', marginTop: 16, padding: 10 },
  closeText: { color: '#0a84ff', fontSize: 16 },
  tabsBar: {
    flexGrow: 0,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  tab: { paddingVertical: 8, paddingHorizontal: 14 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0a84ff' },
  tabLabel: { fontSize: 16, fontWeight: '600' },
});
