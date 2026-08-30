import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColors } from '@/hooks/useColors';
import { CommunicationProvider } from '@/context/CommunicationContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  
  return (
    <Stack 
      screenOptions={{ 
        headerBackTitle: 'Voltar',
        headerTintColor: colors.primary,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Início' }} />
      <Stack.Screen name="listen/[id]" options={{ title: 'Ouvir', presentation: 'card' }} />
      <Stack.Screen name="transcribe" options={{ title: 'Transcrever voz', presentation: 'card' }} />
      <Stack.Screen name="inbox" options={{ title: 'Caixa de entrada', presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <CommunicationProvider>
                <RootLayoutNav />
              </CommunicationProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
