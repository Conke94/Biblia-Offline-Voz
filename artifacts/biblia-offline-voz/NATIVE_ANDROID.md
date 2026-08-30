# Como gerar e testar no Android

Este app precisa de uma compilação Android própria. O Expo Go não contém os
módulos nativos de voz e Nearby usados pelo projeto.

## O que já está implementado

- Reconhecimento de voz `pt-BR` no próprio aparelho, com resultados parciais e
  finais e limite rígido de 15 segundos.
- Aviso quando o pacote de reconhecimento offline não está instalado.
- Nearby Connections com `P2P_CLUSTER`: os aparelhos anunciam e procuram ao
  mesmo tempo, conectam automaticamente e enviam apenas texto UTF-8.
- Recepção do texto, leitura automática em voz alta via TTS e armazenamento na
  caixa de entrada.
- Caixa persistente com limite rígido de 10 mensagens. A 11ª é ignorada até
  que uma mensagem seja excluída.
- Leitura manual de cada mensagem recebida e exclusão individual.

## Pré-requisitos no computador

1. Instale Node.js 20 ou mais recente e pnpm.
2. Instale Android Studio com:
   - Android SDK Platform 36;
   - Android SDK Build-Tools 36;
   - Android SDK Command-line Tools;
   - JDK 17 (o JDK incluído no Android Studio pode ser usado).
3. Abra um terminal na raiz deste workspace e execute:

```sh
pnpm install
cd artifacts/biblia-offline-voz
pnpm exec expo prebuild --platform android --clean --no-install
```

O plugin local `plugins/withBibliaNative.js` recria todo o código Kotlin,
permissões e a dependência Google Play Services Nearby. Por isso, nunca edite
manualmente o diretório `android/`: ele é gerado novamente pelo comando acima.

## Gerar um APK independente

No macOS/Linux:

```sh
cd artifacts/biblia-offline-voz/android
./gradlew assembleRelease
```

No Windows:

```bat
cd artifacts\biblia-offline-voz\android
gradlew.bat assembleRelease
```

O APK será criado em:

```text
artifacts/biblia-offline-voz/android/app/build/outputs/apk/release/app-release.apk
```

Esta versão de teste é assinada com a chave de depuração gerada pelo Expo. Para
publicar na Play Store, crie uma chave de produção e altere a configuração de
assinatura.

## Preparar os dois celulares

Os dois aparelhos precisam ter Android 7 ou superior e Google Play Services.

Em cada celular:

1. Instale o pacote de voz offline em português do Brasil. O caminho varia por
   fabricante; procure nas Configurações por **Reconhecimento de fala offline**,
   **Digitação por voz do Google** ou **Idiomas de voz**, e baixe `Português
   (Brasil)`.
2. Confirme que a voz TTS em português está instalada em **Conversão de texto
   em voz**.
3. Ative Bluetooth e Wi-Fi. No Android 11 ou anterior, ative também a
   localização enquanto fizer o pareamento Nearby.
4. Instale o mesmo `app-release.apk` nos dois aparelhos. Por USB, com `adb`
   configurado:

```sh
adb install -r app-release.apk
```

Depois de instalar os pacotes de voz e o APK, o teste pode ser feito sem
internet e sem roteador. O Wi-Fi deve continuar ligado porque o Nearby pode
usá-lo diretamente entre os aparelhos.

## Teste completo em dois celulares

1. Coloque os celulares próximos e abra **Bíblia Offline Voz** nos dois.
2. Aceite as permissões de microfone, Bluetooth/dispositivos próximos e, em
   Android antigo, localização.
3. Em ambos, toque em **Comunicar** e depois em **Conectar**.
4. Aguarde aparecer `1 dispositivo conectado` nos dois aparelhos.
5. No celular A, mantenha o botão de microfone pressionado, fale por até 15
   segundos e solte.
6. Revise a transcrição. Toque em **Enviar mensagem**.
7. No celular B, confira:
   - a mensagem é falada automaticamente pelo TTS;
   - ela aparece em **Caixa de entrada**;
   - o botão de reprodução lê novamente a mensagem;
   - o botão de lixeira exclui apenas aquela mensagem.
8. Repita do celular B para o A.

## Testar o limite da caixa

1. Envie 10 mensagens para o mesmo aparelho.
2. Confirme `10 de 10` na caixa de entrada.
3. Envie uma 11ª mensagem: ela deve ser ignorada e o aparelho deve avisar que a
   caixa está cheia.
4. Exclua uma mensagem e envie novamente: a nova mensagem deve entrar.

## Diagnóstico rápido

- **Nearby não conecta:** confirme Google Play Services atualizado, Bluetooth e
  Wi-Fi ligados, permissões concedidas e os dois apps na tela **Comunicar**.
- **Voz offline indisponível:** baixe o pacote `Português (Brasil)` nas
  configurações de reconhecimento de fala do Android.
- **Transcrição tenta usar rede em Android antigo:** alguns aparelhos anteriores
  ao Android 12 não expõem uma API que garanta o motor totalmente local. Faça o
  teste em modo avião depois de baixar o pacote; se o fabricante não oferecer
  STT local, use um aparelho Android 12 ou mais recente.
- **A mensagem chega mas não fala:** instale/ative uma voz TTS `pt-BR`.

## Detalhes técnicos

O plugin local adiciona as permissões por versão do Android, a dependência
`com.google.android.gms:play-services-nearby:19.3.0`, gera os módulos Kotlin e
registra `BibliaNativePackage` no React Native. A prévia web continua segura:
ela mostra os estados indisponíveis sem tentar carregar código nativo.