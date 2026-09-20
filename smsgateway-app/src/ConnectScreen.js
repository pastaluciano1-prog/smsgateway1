import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { saveConfig } from './store';

export default function ConnectScreen({ onConnected }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(false);
    const [host, setHost] = useState('');
    const [apiKey, setApiKey] = useState('');

    // Called when a QR code is detected
    function handleScan({ data }) {
        setScanning(false);
        try {
            const parsed = JSON.parse(data);
            if (!parsed.host || !parsed.apiKey) throw new Error('missing fields');
            setHost(parsed.host);
            setApiKey(parsed.apiKey);
            save(parsed.host, parsed.apiKey);
        } catch (e) {
            Alert.alert('Invalid QR', 'This QR code is not a valid connection code.');
        }
    }

    async function save(h, k) {
        if (!h || !k) {
            Alert.alert('Missing info', 'Both host URL and API key are required.');
            return;
        }
        await saveConfig({ host: h.trim(), apiKey: k.trim() });
        onConnected();
    }

    // Scanner view
    if (scanning) {
        if (!permission?.granted) {
            return (
                <View style={styles.center}>
                    <Text style={styles.info}>Camera permission is needed to scan.</Text>
                    <TouchableOpacity style={styles.btn} onPress={requestPermission}>
                        <Text style={styles.btnText}>Grant camera access</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setScanning(false)}>
                        <Text style={styles.link}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.container}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={handleScan}
                />
                <TouchableOpacity style={styles.cancelScan} onPress={() => setScanning(false)}>
                    <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Default: connect form
    return (
        <View style={styles.center}>
            <Text style={styles.title}>Connect to your panel</Text>

            <TouchableOpacity style={styles.btn} onPress={async () => {
                if (!permission?.granted) await requestPermission();
                setScanning(true);
            }}>
                <Text style={styles.btnText}>📷 Scan QR code</Text>
            </TouchableOpacity>

            <Text style={styles.or}>— or enter manually —</Text>

            <TextInput
                style={styles.input}
                placeholder="Host URL (https://...)"
                autoCapitalize="none"
                value={host}
                onChangeText={setHost}
            />
            <TextInput
                style={styles.input}
                placeholder="API key"
                autoCapitalize="none"
                value={apiKey}
                onChangeText={setApiKey}
            />
            <TouchableOpacity style={styles.btn} onPress={() => save(host, apiKey)}>
                <Text style={styles.btnText}>Connect</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
    camera: { flex: 1 },
    cancelScan: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#000a', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
    btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    or: { textAlign: 'center', color: '#888', marginVertical: 16 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginVertical: 6, fontSize: 15 },
    info: { textAlign: 'center', marginBottom: 16, color: '#444' },
    link: { color: '#2563eb', textAlign: 'center', marginTop: 16 },
});