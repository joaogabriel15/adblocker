# Bloqueador de Anúncios (React Native, Android)

**Português** · [English](README.en.md)

App que bloqueia anúncios e rastreadores **em todos os apps do celular**, sem root.

## Baixar

**[⬇ Baixar o APK (última versão)](https://github.com/joaogabriel15/adblocker/releases/latest/download/adblocker.apk)**,
ou veja todas as versões em [Releases](https://github.com/joaogabriel15/adblocker/releases).

Para instalar no Android:

1. Abra o link no celular e baixe o `adblocker.apk`.
2. Ao abrir o arquivo, o Android pede para **permitir instalar apps desta fonte** (navegador ou
   gerenciador de arquivos). Permita.
3. O **Play Protect** pode avisar que o app é desconhecido, porque ele não está na Play Store.
   Toque em "Mais detalhes" > "Instalar mesmo assim".
4. Abra o app e ligue o bloqueio. O Android pergunta se aceita a conexão VPN: aceite.

Versões novas instalam por cima da anterior, sem perder os domínios liberados.

> **Privacidade:** a VPN só enxerga as consultas de DNS (nomes de sites), e elas não saem do
> celular, a não ser para o DNS público (1.1.1.1 / 8.8.8.8). O app não tem servidor, conta
> nem coleta de dados; a única conexão própria é o download da lista no GitHub, quando você
> toca em "Atualizar lista". O código está todo aqui. Baixe o APK só desta página de Releases.

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

### Publicar uma versão nova

1. Suba `versionCode` (+1) e `versionName` em `android/app/build.gradle`.
2. Gere o APK no EAS (comando acima) e baixe-o como `adblocker.apk`.
3. Crie a release com o APK anexado (o nome `adblocker.apk` mantém o link "Baixar" do topo):

```bash
gh release create v1.0.1 adblocker.apk --title "v1.0.1" --notes "O que mudou"
```

> Sempre gere pelo EAS: a chave que assina o APK fica guardada lá. Um APK assinado com outra
> chave não instala por cima da versão anterior. Guarde um backup da chave fora do repositório
> (`npx eas-cli@latest credentials -p android` > Keystore > Download).

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

## Licença

[MIT](LICENSE). A lista de bloqueio embutida é a [StevenBlack/hosts](https://github.com/StevenBlack/hosts),
também MIT, e mantém o cabeçalho original em `android/app/src/main/assets/hosts_basic.txt`.
