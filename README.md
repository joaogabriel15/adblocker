# Bloqueador de Anúncios (React Native, Android)

App que bloqueia anúncios e rastreadores **em todos os apps do celular**, sem root.

## Como funciona

O app cria uma **VPN local** (nada sai do seu celular por ela). Essa VPN só captura
as consultas de DNS, que é quando um app pergunta "qual o endereço de `ads.exemplo.com`?".

- Se o domínio está na lista de anúncios/rastreio, o app responde `0.0.0.0` e o anúncio não carrega.
- Se não está, a consulta é repassada normalmente ao DNS da Cloudflare (1.1.1.1) ou Google (8.8.8.8).

O resto do tráfego (vídeos, mensagens, etc.) **não passa** pela VPN, então não deixa a internet mais lenta
e quase não gasta bateria.

A lista vem embutida (StevenBlack hosts, ~77 mil domínios, licença MIT) e pode ser atualizada
pelo botão "Atualizar lista".

## Recursos

- Botão liga/desliga
- Contador de consultas e de bloqueios
- Lista dos últimos domínios bloqueados
- Toque num domínio bloqueado para **liberá-lo** (útil se algum app quebrar)
- Compatível com "VPN sempre ativa" do Android (Configurações > Rede > VPN > ⚙️ > Sempre ativa)

## Rodando

Pré-requisitos: Node 22+, JDK 17+, Android Studio com Android SDK, e um celular Android
com depuração USB ativa (ou um emulador).

```bash
npm install
npm start          # em um terminal (Metro)
npm run android    # em outro terminal, instala no celular
```

Para gerar um APK instalável sem o computador:

```bash
cd android
./gradlew assembleRelease
# APK em android/app/build/outputs/apk/release/app-release.apk
```

> O build de release usa a chave de debug por padrão (veja `android/app/build.gradle`).
> Para uso pessoal isso basta; para publicar na Play Store, gere sua própria chave.

Ou gerar o APK na nuvem pelo EAS (sem Android Studio; a chave fica guardada no EAS):

```bash
npx eas-cli@latest build -p android --profile preview
# no fim sai o link do APK
```

> O `eas.json` fixa `"image": "latest"`: sem o pacote `expo`, o EAS cairia numa imagem
> antiga (JDK 11 / Node 18) que não compila o React Native 0.88.

## Importante: o que ele bloqueia e o que não bloqueia

**Bloqueia bem:** anúncios de redes como Google AdMob/DoubleClick, Facebook Audience Network,
Unity Ads, AppLovin, ironSource etc. Isso cobre a maioria dos jogos e apps gratuitos.

**Não consegue bloquear:**
- Anúncios do **YouTube, Instagram, Facebook, TikTok e Twitch**: eles vêm do mesmo servidor do
  conteúdo. Bloquear o anúncio derrubaria o app inteiro.
- Apps que usam DNS próprio criptografado (DoH) ignoram a VPN.

**Desative o "DNS privado"** do Android, senão o bloqueio não funciona:
Configurações > Rede e Internet > DNS privado > **Desativado** (ou "Automático").
No Chrome, desative também Configurações > Privacidade > "Usar DNS seguro".

**iPhone:** a Apple não permite que um app filtre o DNS de outros apps desta forma.
O app abre no iOS, mas só mostra um aviso.

## Estrutura

```
App.tsx                         Tela (React Native)
src/AdBlock.ts                  Ponte JS para o módulo nativo
android/app/src/main/java/com/adblocker/vpn/
  AdBlockVpnService.kt          VPN local que intercepta DNS
  DnsPacket.kt                  Leitura/escrita de pacotes IP/UDP/DNS
  Blocklist.kt                  Lista de bloqueio, download e domínios liberados
  AdBlockModule.kt              Módulo nativo exposto ao JS (NativeModules.AdBlock)
  AdBlockPackage.kt             Registro do módulo
android/app/src/main/assets/hosts_basic.txt   Lista embutida
```
