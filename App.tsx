import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  PressableProps,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AdBlock, isSupported, Stats } from './src/AdBlock';

// Android TV / Google TV: navegação pelo controle remoto (D-pad) em vez de toque.
const isTV = Platform.isTV;

const EMPTY: Stats = {
  running: false,
  blocked: 0,
  total: 0,
  listSize: 0,
  recent: [],
  allowed: [],
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <Home />
    </SafeAreaProvider>
  );
}

function Home() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'recent' | 'allowed'>('recent');
  const { width, height } = useWindowDimensions();
  // Em TV (ou tablet deitado) a tela é larga: controles à esquerda, lista à direita.
  const wide = isTV || (width > height && width >= 700);

  const refresh = useCallback(async () => {
    if (!isSupported) return;
    try {
      setStats(await AdBlock.getStats());
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (stats.running) await AdBlock.stop();
      else await AdBlock.start();
    } catch (e: any) {
      Alert.alert('Não foi possível ativar', e?.message ?? String(e));
    } finally {
      setBusy(false);
      setTimeout(refresh, 300);
    }
  };

  const updateList = async () => {
    setBusy(true);
    try {
      const n = await AdBlock.updateBlocklist();
      Alert.alert(
        'Lista atualizada',
        `${n.toLocaleString('pt-BR')} domínios de anúncio e rastreio.` +
          (stats.running ? '\nDesligue e ligue o bloqueio para aplicar.' : ''),
      );
    } catch (e: any) {
      Alert.alert('Falha ao atualizar', e?.message ?? String(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const askAllow = (domain: string) =>
    Alert.alert(
      domain,
      'Algum app parou de funcionar? Você pode liberar este domínio.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar',
          onPress: () => AdBlock.setAllowed(domain, true).then(refresh),
        },
      ],
    );

  const askBlock = (domain: string) =>
    Alert.alert(domain, 'Voltar a bloquear este domínio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: () => AdBlock.setAllowed(domain, false).then(refresh),
      },
    ]);

  if (!isSupported) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.title}>Bloqueador de Anúncios</Text>
        <Text style={styles.muted}>
          Este app funciona apenas no Android. No iPhone a Apple não permite
          bloquear anúncios dentro de outros apps.
        </Text>
      </SafeAreaView>
    );
  }

  const list = tab === 'recent' ? stats.recent : stats.allowed;
  const pct = stats.total ? Math.round((stats.blocked / stats.total) * 100) : 0;

  return (
    <SafeAreaView style={[styles.screen, isTV && styles.screenTV]}>
      <Text style={styles.title}>Bloqueador de Anúncios</Text>
      <View style={wide ? styles.columns : styles.flex}>
        <View style={wide ? styles.left : undefined}>
          <View
            style={[
              styles.halo,
              stats.running ? styles.haloOn : styles.haloOff,
            ]}
          >
            <Focusable
              onPress={toggle}
              disabled={busy}
              hasTVPreferredFocus
              accessibilityRole="switch"
              accessibilityState={{ checked: stats.running, busy }}
              accessibilityLabel="Bloqueio de anúncios"
              style={[styles.power, stats.running ? styles.on : styles.off]}
              focusedStyle={styles.powerFocused}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <>
                  <PowerIcon />
                  <Text style={styles.powerText}>
                    {stats.running ? 'PROTEGIDO' : 'DESLIGADO'}
                  </Text>
                </>
              )}
            </Focusable>
          </View>
          <Text style={styles.muted}>
            {stats.running
              ? 'Anúncios estão sendo bloqueados em todos os apps.'
              : isTV
              ? 'Aperte OK no controle para começar a bloquear anúncios.'
              : 'Toque para começar a bloquear anúncios.'}
          </Text>

          <View style={styles.row}>
            <Stat
              label="Bloqueados"
              value={stats.blocked.toLocaleString('pt-BR')}
            />
            <Stat
              label="Consultas"
              value={stats.total.toLocaleString('pt-BR')}
            />
            <Stat label="Bloqueio" value={`${pct}%`} />
          </View>

          <Focusable onPress={updateList} disabled={busy} style={styles.button}>
            <Text style={styles.buttonText}>
              Atualizar lista ({stats.listSize.toLocaleString('pt-BR')}{' '}
              domínios)
            </Text>
          </Focusable>
        </View>

        <View style={styles.flex}>
          <View style={[styles.tabs, wide && styles.tabsWide]}>
            <Tab
              label="Bloqueados agora"
              active={tab === 'recent'}
              onPress={() => setTab('recent')}
            />
            <Tab
              label={`Liberados (${stats.allowed.length})`}
              active={tab === 'allowed'}
              onPress={() => setTab('allowed')}
            />
          </View>
          <FlatList
            style={styles.list}
            data={list}
            keyExtractor={(item, i) => `${item}-${i}`}
            ListEmptyComponent={
              <Text style={styles.muted}>
                {tab === 'recent'
                  ? 'Nada bloqueado ainda. Abra algum app com anúncios.'
                  : 'Toque num domínio bloqueado para liberá-lo.'}
              </Text>
            }
            renderItem={({ item }) => (
              <Focusable
                onPress={() =>
                  tab === 'recent' ? askAllow(item) : askBlock(item)
                }
                style={styles.item}
                focusedStyle={styles.itemFocused}
              >
                <Text style={styles.itemText} numberOfLines={1}>
                  {tab === 'recent' ? '🚫 ' : '✅ '}
                  {item}
                </Text>
              </Focusable>
            )}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function PowerIcon() {
  return (
    <View style={styles.powerGlyph}>
      <View style={styles.powerRing} />
      <View style={styles.powerBar} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tab(props: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Focusable
      onPress={props.onPress}
      // No controle remoto, só passar o foco pela aba já troca a lista.
      onFocus={isTV ? props.onPress : undefined}
      style={[styles.tab, props.active && styles.tabActive]}
    >
      <Text style={[styles.tabText, props.active && styles.tabTextActive]}>
        {props.label}
      </Text>
    </Focusable>
  );
}

type FocusableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  hasTVPreferredFocus?: boolean;
};

/**
 * Pressable que mostra onde está o foco do controle remoto (D-pad).
 * No celular, com toque, se comporta como um Pressable comum.
 */
function Focusable({
  style,
  focusedStyle,
  onFocus,
  onBlur,
  ...rest
}: FocusableProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      focusable
      {...rest}
      onFocus={e => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={({ pressed }) => [
        style,
        focused && (focusedStyle ?? styles.focused),
        pressed && styles.pressed,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  // Margem de segurança: muitas TVs cortam as bordas da imagem (overscan).
  screenTV: { paddingHorizontal: 48, paddingVertical: 27 },
  flex: { flex: 1 },
  columns: { flex: 1, flexDirection: 'row', gap: 32 },
  left: { width: 380, justifyContent: 'center' },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  halo: {
    alignSelf: 'center',
    padding: 10,
    borderRadius: 105,
    marginBottom: 12,
  },
  haloOn: { backgroundColor: 'rgba(22, 163, 74, 0.18)' },
  haloOff: { backgroundColor: 'rgba(71, 85, 105, 0.18)' },
  power: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  on: { backgroundColor: '#16a34a' },
  off: { backgroundColor: '#475569' },
  pressed: { transform: [{ scale: 0.96 }] },
  // Destaque do item com foco do controle remoto.
  focused: {
    borderWidth: 3,
    borderColor: '#facc15',
    transform: [{ scale: 1.04 }],
  },
  powerFocused: {
    borderWidth: 5,
    borderColor: '#facc15',
    transform: [{ scale: 1.06 }],
  },
  itemFocused: { backgroundColor: '#1e3a8a', borderRadius: 6 },
  // Ícone de energia desenhado com Views: o glifo ⏻ não existe na fonte padrão de muitos Androids.
  powerGlyph: { width: 56, height: 56, alignItems: 'center' },
  powerRing: {
    position: 'absolute',
    top: 4,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 6,
    borderColor: '#fff',
    borderTopColor: 'transparent',
  },
  powerBar: {
    width: 6,
    height: 30,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  powerText: {
    color: '#fff',
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 1,
  },
  muted: { color: '#94a3b8', textAlign: 'center', marginVertical: 8 },
  row: { flexDirection: 'row', marginVertical: 16, gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  tabs: { flexDirection: 'row', marginTop: 20, marginBottom: 8 },
  tabsWide: { marginTop: 0 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: '#2563eb' },
  tabText: { color: '#94a3b8', textAlign: 'center' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#334155',
  },
  itemText: { color: '#e2e8f0' },
});
