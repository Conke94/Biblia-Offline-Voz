import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { getContentById } from '@/data/content';
import * as Speech from 'expo-speech';
import { Feather } from '@expo/vector-icons';

export default function ListenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const item = getContentById(id || '');

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(1.0);
  const [speechSupported, setSpeechSupported] = useState(true);

  // Stop speech when component unmounts
  useEffect(() => {
    // Check if we have voices on web
    if (Platform.OS === 'web') {
      if (!('speechSynthesis' in window)) {
        setSpeechSupported(false);
      }
    }

    return () => {
      Speech.stop();
    };
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!speechSupported) {
      if (Platform.OS === 'web') {
        alert('Seu navegador não suporta leitura em voz alta.');
      } else {
        Alert.alert('Erro', 'Seu dispositivo não suporta leitura em voz alta.');
      }
      return;
    }

    const currentlySpeaking = await Speech.isSpeakingAsync();

    if (currentlySpeaking) {
      if (isPaused) {
        Speech.resume();
        setIsPaused(false);
      } else {
        // Not all Android devices support pause/resume reliably, but we use it via expo-speech.
        // It's part of the expo-speech API for Android and iOS.
        Speech.pause();
        setIsPaused(true);
      }
    } else {
      // Start speaking
      setIsPlaying(true);
      setIsPaused(false);
      
      Speech.speak(item?.text || '', {
        language: 'pt-BR',
        rate: rate,
        onDone: () => {
          setIsPlaying(false);
          setIsPaused(false);
        },
        onStopped: () => {
          setIsPlaying(false);
          setIsPaused(false);
        },
        onError: (error) => {
          console.warn('Speech error:', error);
          setIsPlaying(false);
          setIsPaused(false);
        }
      });
    }
  }, [item?.text, rate, isPaused, speechSupported]);

  const handleStop = useCallback(async () => {
    await Speech.stop();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const handleChangeRate = useCallback(async (newRate: number) => {
    setRate(newRate);
    const currentlySpeaking = await Speech.isSpeakingAsync();
    if (currentlySpeaking) {
      await Speech.stop();
      // Restart with new rate
      setIsPlaying(true);
      setIsPaused(false);
      Speech.speak(item?.text || '', {
        language: 'pt-BR',
        rate: newRate,
        onDone: () => {
          setIsPlaying(false);
          setIsPaused(false);
        },
        onStopped: () => {
          setIsPlaying(false);
          setIsPaused(false);
        },
      });
    }
  }, [item?.text]);

  if (!item) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>Conteúdo não encontrado.</Text>
        <Pressable 
          style={[styles.backButton, { backgroundColor: colors.secondary }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: colors.secondaryForeground, fontFamily: 'Inter_500Medium' }}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="listen-screen">
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.subtitle, { color: colors.primary }]}>{item.subtitle}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        </View>

        {!speechSupported && (
          <View style={[styles.fallbackWarning, { backgroundColor: colors.destructive + '20', borderColor: colors.destructive }]} testID="speech-fallback">
            <Feather name="alert-triangle" size={20} color={colors.destructive} />
            <Text style={[styles.fallbackText, { color: colors.destructiveForeground }]}>
              O recurso de voz não está disponível neste dispositivo. Você ainda pode ler o texto abaixo.
            </Text>
          </View>
        )}

        <View style={[styles.textContainer, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
          <Text style={[styles.contentBody, { color: colors.cardForeground }]}>
            {item.text}
          </Text>
        </View>
      </ScrollView>

      {/* Floating Audio Controls */}
      <View 
        style={[
          styles.controlsContainer, 
          { 
            backgroundColor: colors.background, 
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'web' ? Math.max(insets.bottom, 34) : Math.max(insets.bottom, 16)
          }
        ]}
      >
        {isPlaying && (
          <View style={styles.nowPlayingRow}>
            <View style={[styles.playingIndicator, { backgroundColor: isPaused ? colors.muted : colors.primary }]} />
            <Text style={[styles.playingText, { color: colors.mutedForeground }]}>
              {isPaused ? 'Pausado' : 'Reproduzindo...'}
            </Text>
          </View>
        )}

        <View style={styles.mainControlsRow}>
          {/* Rate Selector */}
          <View style={styles.rateSelector}>
            {[0.75, 1.0, 1.25].map(r => (
              <Pressable
                key={r}
                testID={`rate-${r}`}
                onPress={() => handleChangeRate(r)}
                style={[
                  styles.rateButton,
                  { 
                    backgroundColor: rate === r ? colors.primary : colors.secondary,
                    borderRadius: colors.radius - 8,
                  }
                ]}
              >
                <Text 
                  style={[
                    styles.rateText, 
                    { color: rate === r ? colors.primaryForeground : colors.secondaryForeground }
                  ]}
                >
                  {r}x
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.playbackButtons}>
            {isPlaying && (
              <Pressable
                testID="btn-stop"
                onPress={handleStop}
                style={[styles.circleButton, { backgroundColor: colors.secondary }]}
              >
                <Feather name="square" size={20} color={colors.secondaryForeground} />
              </Pressable>
            )}
            
            <Pressable
              testID="btn-play-pause"
              onPress={handlePlayPause}
              style={[styles.mainPlayButton, { backgroundColor: colors.primary }]}
            >
              <Feather 
                name={isPlaying && !isPaused ? "pause" : "play"} 
                size={28} 
                color={colors.primaryForeground} 
                style={{ marginLeft: isPlaying && !isPaused ? 0 : 4 }}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    lineHeight: 38,
  },
  fallbackWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  fallbackText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  textContainer: {
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contentBody: {
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    lineHeight: 28,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  nowPlayingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  playingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playingText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  mainControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  rateButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rateText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  playbackButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});
