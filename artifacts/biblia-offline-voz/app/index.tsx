import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { contentData, ContentType } from '@/data/content';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ContentType>('biblia');

  const filteredContent = contentData.filter(item => item.type === activeTab);

  const paddingTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="library-screen">
      <StatusBar style="auto" />
      <View style={[styles.header, { paddingTop }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Biblioteca</Text>
        
        <View style={[styles.tabContainer, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
          <Pressable
            testID="tab-biblia"
            onPress={() => setActiveTab('biblia')}
            style={[
              styles.tab,
              activeTab === 'biblia' && { backgroundColor: colors.background, borderRadius: colors.radius - 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'biblia' ? colors.primary : colors.secondaryForeground },
                activeTab === 'biblia' && styles.tabTextActive
              ]}
            >
              Bíblia
            </Text>
          </Pressable>
          <Pressable
            testID="tab-aulas"
            onPress={() => setActiveTab('aula')}
            style={[
              styles.tab,
              activeTab === 'aula' && { backgroundColor: colors.background, borderRadius: colors.radius - 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'aula' ? colors.primary : colors.secondaryForeground },
                activeTab === 'aula' && styles.tabTextActive
              ]}
            >
              Aulas
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredContent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            testID={`item-${item.id}`}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              }
            ]}
            onPress={() => router.push(`/listen/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                {item.type === 'biblia' ? (
                  <Feather name="book" size={24} color={colors.primary} />
                ) : (
                  <Feather name="headphones" size={24} color={colors.primary} />
                )}
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, { color: colors.cardForeground }]}>
                  {item.title}
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
                  {item.subtitle}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    marginBottom: 24,
    marginTop: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  tabTextActive: {
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconContainer: {
    marginRight: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(140, 90, 70, 0.1)', // Subdued tint for the icon background
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
