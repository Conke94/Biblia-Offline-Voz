import React, { useEffect } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { PairingDialog } from '@/components/PairingDialog';
import { CommunicationProvider } from '@/context/CommunicationContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  // edgeToEdgeEnabled=true faz o conteudo desenhar sob a barra de gestos do
  // Android. Reservar o inset aqui, uma vez, evita ter que lembrar disso em
  // cada tela nova - foi assim que index.tsx passou batido.
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: colors.background }}>
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
      <Stack.Screen name="transcribe" options={{ title: 'Conexão', presentation: 'card' }} />
      <Stack.Screen name="inbox" options={{ title: 'Conversas', presentation: 'card' }} />
      <Stack.Screen name="chat/[peerId]" options={{ title: 'Conversa', presentation: 'card' }} />
      <Stack.Screen name="profile" options={{ title: 'Seu nome', presentation: 'card' }} />
    </Stack>
    </View>
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
            {/* edgeToEdgeEnabled=true torna as barras translucidas. Sem estas flags
                a lib calcula a altura do teclado errado e ele cobre o input. */}
            <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
              <CommunicationProvider>
                <RootLayoutNav />
                <PairingDialog />
              </CommunicationProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
