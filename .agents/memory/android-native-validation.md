---
name: Validação Android nativa
description: Limites do ambiente para validar builds e recursos Android que dependem de aparelhos físicos.
---

O projeto Android pode ser regenerado e inspecionado neste workspace, mas a
compilação Gradle e o teste real de comunicação local devem ser feitos em um
computador com Android SDK e em dois celulares.

**Why:** O módulo Java disponível neste ambiente não inclui o Android SDK nem
uma variável `ANDROID_HOME` válida. Além disso, Nearby Connections e o
reconhecimento offline variam conforme Google Play Services, versão do Android
e pacotes de voz instalados pelo fabricante.

**How to apply:** Valide aqui o Expo prebuild, TypeScript, configuração gerada e
prévia web. Para aceite final dos recursos nativos, siga o guia do projeto para
gerar o APK e execute o fluxo offline completo em dois aparelhos reais.