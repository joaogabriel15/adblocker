import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AdBlock, isSupported, Stats } from './src/AdBlock';

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
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Bloqueador de Anúncios</Text>

      <Pressable
        onPress={toggle}
        disabled={busy}
        style={[styles.power, stats.running ? styles.on : styles.off]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <>
            <Text style={styles.powerIcon}>⏻</Text>
            <Text style={styles.powerText}>
              {stats.running ? 'PROTEGIDO' : 'DESLIGADO'}
            </Text>
          </>
        )}
      </Pressable>
      <Text style={styles.muted}>
        {stats.running
          ? 'Anúncios estão sendo bloqueados em todos os apps.'
          : 'Toque para começar a bloquear anúncios.'}
      </Text>

      <View style={styles.row}>
        <Stat
          label="Bloqueados"
          value={stats.blocked.toLocaleString('pt-BR')}
        />
        <Stat label="Consultas" value={stats.total.toLocaleString('pt-BR')} />
        <Stat label="Bloqueio" value={`${pct}%`} />
      </View>

      <Pressable onPress={updateList} disabled={busy} style={styles.button}>
        <Text style={styles.buttonText}>
          Atualizar lista ({stats.listSize.toLocaleString('pt-BR')} domínios)
        </Text>
      </Pressable>

      <View style={styles.tabs}>
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
          <Pressable
            onPress={() => (tab === 'recent' ? askAllow(item) : askBlock(item))}
            style={styles.item}
          >
            <Text style={styles.itemText} numberOfLines={1}>
              {tab === 'recent' ? '🚫 ' : '✅ '}
              {item}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
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
    <Pressable
      onPress={props.onPress}
      style={[styles.tab, props.active && styles.tabActive]}
    >
      <Text style={[styles.tabText, props.active && styles.tabTextActive]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  power: {
    alignSelf: 'center',
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 8,
  },
  on: { backgroundColor: '#16a34a' },
  off: { backgroundColor: '#475569' },
  powerIcon: { color: '#fff', fontSize: 56 },
  powerText: {
    color: '#fff',
    fontWeight: '700',
    marginTop: 4,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#334155',
  },
  itemText: { color: '#e2e8f0' },
});
