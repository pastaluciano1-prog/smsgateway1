import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  host: 'cfg_host',
  apiKey: 'cfg_apiKey',
  counters: 'cfg_counters',
};

// --- Generic one-shot flags (e.g. "we already asked for X once") ---

export async function getFlag(name) {
  return (await AsyncStorage.getItem('flag_' + name)) === '1';
}

export async function setFlag(name, value) {
  await AsyncStorage.setItem('flag_' + name, value ? '1' : '0');
}

// --- Connection config (host URL + API key) ---

export async function saveConfig({ host, apiKey }) {
  await AsyncStorage.multiSet([
    [KEYS.host, host],
    [KEYS.apiKey, apiKey],
  ]);
}

export async function loadConfig() {
  const [[, host], [, apiKey]] = await AsyncStorage.multiGet([
    KEYS.host,
    KEYS.apiKey,
  ]);
  return { host: host || '', apiKey: apiKey || '' };
}

export async function clearConfig() {
  await AsyncStorage.multiRemove([KEYS.host, KEYS.apiKey]);
}

export async function isConnected() {
  const { host, apiKey } = await loadConfig();
  return Boolean(host && apiKey);
}

// --- Counters (sent / received / failed) ---

const EMPTY_COUNTERS = { sent: 0, received: 0, failed: 0 };

export async function loadCounters() {
  const raw = await AsyncStorage.getItem(KEYS.counters);
  return raw ? JSON.parse(raw) : { ...EMPTY_COUNTERS };
}

export async function bumpCounter(name) {
  const counters = await loadCounters();
  counters[name] = (counters[name] || 0) + 1;
  await AsyncStorage.setItem(KEYS.counters, JSON.stringify(counters));
  return counters;
}

export async function resetCounters() {
  await AsyncStorage.setItem(KEYS.counters, JSON.stringify(EMPTY_COUNTERS));
}