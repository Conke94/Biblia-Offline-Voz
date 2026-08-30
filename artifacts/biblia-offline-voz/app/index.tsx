import React, { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { bibleBooks, BibleBook, lessons, ContentType } from '@/data/content';

type BibleLevel = 'books' | 'chapters';

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ContentType>('biblia');
  const [level, setLevel] = useState<BibleLevel>('books');
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);

  const paddingTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const selectTab = (tab: ContentType) => {
    setActiveTab(tab);
    if (tab === 'biblia') {
      setLevel('books');
      setSelectedBook(null);
    }
  };

  const goBackLevel = () => {
    if (level === 'chapters') {
      setLevel('books');
      setSelectedBook(null);
    }
  };

  const title =
    activeTab === 'aula'
      ? 'Aulas'
        : level === 'books'
          ? 'Livros'
          : selectedBook?.name;

  const renderBibleContent = () => {
    if (level === 'books') {
      return (
        <FlatList
          data={bibleBooks}
          keyExtractor={(book) => book.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ListCard
              title={item.name}
              subtitle={`${item.chapters.length} capítulos cadastrados`}
              icon="book"
              testID={`book-${item.id}`}
              onPress={() => {
                setSelectedBook(item);
                setLevel('chapters');
              }}
            />
          )}
        />
      );
    }

    if (level === 'chapters' && selectedBook) {
      return (
        <FlatList
          data={selectedBook.chapters}
          keyExtractor={(chapter) => String(chapter.number)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ListCard
              title={`Capítulo ${item.number}`}
              subtitle={`${item.verses.length} versículos cadastrados`}
              icon="bookmark"
              testID={`chapter-${item.number}`}
              onPress={() => router.push(`/listen/b-${selectedBook.id}-${item.number}`)}
            />
          )}
        />
      );
    }

    return null;
  };

  const ListCard = ({
    title: cardTitle,
    subtitle,
    icon,
    onPress,
    testID,
  }: {
    title: string;
    subtitle: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    onPress: () => void;
    testID: string;
  }) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.cardIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{cardTitle}</Text>
        <Text numberOfLines={2} style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.primary} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="library-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Biblioteca</Text>
        <View style={[styles.tabs, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
          {(['biblia', 'aula'] as ContentType[]).map((tab) => (
            <Pressable
              key={tab}
              testID={`tab-${tab}`}
              onPress={() => selectTab(tab)}
              style={[styles.tab, activeTab === tab && { backgroundColor: colors.primary, borderRadius: colors.radius - 3 }]}
            >
              <Text style={[styles.tabText, { color: colors.foreground }]}>
                {tab === 'biblia' ? 'Bíblia' : 'Aulas'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sectionHeader}>
          {activeTab === 'biblia' && level !== 'books' && (
            <Pressable testID="level-back" onPress={goBackLevel} style={styles.back}>
              <Feather name="arrow-left" size={22} color={colors.primary} />
            </Pressable>
          )}
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
            {activeTab === 'biblia' && (
              <Text style={[styles.breadcrumb, { color: colors.mutedForeground }]}>
                Livro → Capítulo
              </Text>
            )}
          </View>
        </View>
      </View>

      {activeTab === 'biblia' ? (
        renderBibleContent()
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ListCard
              title={item.title}
              subtitle={item.subtitle}
              icon="headphones"
              testID={`lesson-${item.id}`}
              onPress={() => router.push(`/listen/${item.id}`)}
            />
          )}
        />
      )}
      <Pressable
        testID="open-transcription"
        onPress={() => router.push('/transcribe')}
        style={[styles.transcribeButton, { backgroundColor: colors.primary }]}
      >
        <Feather name="mic" size={22} color={colors.primaryForeground} />
        <Text style={[styles.transcribeText, { color: colors.primaryForeground }]}>Transcrever voz</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', marginTop: 8, marginBottom: 20 },
  tabs: { flexDirection: 'row', padding: 4 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 84, gap: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 23, fontFamily: 'Inter_700Bold' },
  breadcrumb: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 3 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  card: { minHeight: 82, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, lineHeight: 19, fontFamily: 'Inter_400Regular' },
  transcribeButton: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 4,
  },
  transcribeText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});