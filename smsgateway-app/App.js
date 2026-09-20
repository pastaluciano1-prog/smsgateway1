import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { isConnected } from './src/store';
import ConnectScreen from './src/ConnectScreen';
import HomeScreen from './src/HomeScreen';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // On launch, check if we already have a saved host + key
  useEffect(() => {
    (async () => {
      setConnected(await isConnected());
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!connected) {
    return (
      <>
        <ConnectScreen onConnected={() => setConnected(true)} />
        <StatusBar style="auto" />
      </>
    );
  }

  // Temporary placeholder for the home screen (we build it next)
  return (
    <>
      <HomeScreen onDisconnect={() => setConnected(false)} />
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { marginTop: 8, color: '#666' },
});