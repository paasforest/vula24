import { Modal, View, TouchableOpacity, Text, StyleSheet, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../constants/theme';

/**
 * PayFast expects POST form. We auto-submit HTML form in WebView.
 */
export function PayFastWebView({ visible, payUrl, fields, onClose, onReturnUrl }) {
  if (!visible || !payUrl || !fields) return null;

  const fieldInputs = Object.keys(fields)
    .map(
      (k) =>
        `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(
          String(fields[k] ?? '')
        )}" />`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body onload="document.getElementById('pf').submit()">
<form id="pf" method="post" action="${escapeHtml(payUrl)}">${fieldInputs}</form>
<p style="font-family:system-ui;padding:16px;color:#fff;background:#111;text-align:center">Redirecting to PayFast…</p>
</body></html>`;

  const handleNav = (navState) => {
    const { url } = navState;
    if (
      url &&
      (url.includes('/api/payments/return') ||
        url.includes('payments/return') ||
        url.includes('status=deposit') ||
        url.includes('status=final'))
    ) {
      onReturnUrl?.(url);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onNavigationStateChange={handleNav}
          onShouldStartLoadWithRequest={(req) => {
            if (
              req.url.includes('/api/payments/return') ||
              req.url.includes('payments/return')
            ) {
              onReturnUrl?.(req.url);
              return false;
            }
            return true;
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { alignSelf: 'flex-end' },
  closeText: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
});
