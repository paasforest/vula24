import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoldButton } from '../../components/GoldButton';
import { FormInput } from '../../components/FormInput';
import { COLORS } from '../../constants/theme';
import api from '../../lib/api';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function releaseCountdownLabel(releaseAfter) {
  const ms = new Date(releaseAfter).getTime() - Date.now();
  if (ms <= 0) return 'releasing soon';
  const hours = Math.ceil(ms / (1000 * 60 * 60));
  if (hours < 1) return 'releasing soon';
  return `in ${hours} hours`;
}

export default function EarningsScreen() {
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, p, pend] = await Promise.all([
        api.get('/api/wallet/my-wallet'),
        api.get('/api/locksmith/profile'),
        api.get('/api/wallet/pending-payouts').catch(() => ({ data: { pendingPayouts: [] } })),
      ]);
      setWallet(w.data);
      setProfile(p.data.locksmith);
      setPendingPayouts(pend.data?.pendingPayouts || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load wallet.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const txs = wallet?.transactions || [];
  const now = new Date();
  const d0 = startOfDay(now);
  const w0 = startOfWeek(now);
  const m0 = startOfMonth(now);

  const sumCredit = (from) =>
    txs
      .filter((t) => t.type === 'CREDIT' && new Date(t.createdAt) >= from)
      .reduce((s, t) => s + (t.amount || 0), 0);

  const today = sumCredit(d0);
  const week = sumCredit(w0);
  const month = sumCredit(m0);
  const totalEarned =
    wallet?.totalEarned != null ? Number(wallet.totalEarned) : 0;

  const submitWithdraw = async () => {
    const n = parseFloat(String(amount).replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) {
      Alert.alert('Amount', 'Enter a valid amount.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/payments/withdraw', { amount: n });
      Alert.alert('Success', 'Withdrawal request submitted.');
      setWithdrawOpen(false);
      setAmount('');
      await load();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Withdrawal failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        <Text style={styles.h1}>Earnings</Text>
        <Text style={styles.balanceLabel}>Wallet balance</Text>
        <Text style={styles.balance}>
          R {wallet?.balance != null ? Number(wallet.balance).toFixed(2) : '0.00'}
        </Text>

        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>Pending payouts</Text>
          {pendingPayouts.length === 0 ? (
            <Text style={styles.pendingEmpty}>No pending payouts.</Text>
          ) : (
            pendingPayouts.map((pp, idx) => (
              <View
                key={pp.id}
                style={[styles.pendingRow, idx === 0 && styles.pendingRowFirst]}
              >
                <Text style={styles.pendingAmt}>
                  R {Number(pp.amount).toFixed(2)}
                </Text>
                <Text style={styles.pendingRelease}>
                  Releases: {releaseCountdownLabel(pp.releaseAfter)}
                </Text>
                <Text style={styles.pendingJob}>
                  Job: {(pp.jobId || '').slice(0, 8)}…
                </Text>
              </View>
            ))
          )}
        </View>

        <GoldButton title="Withdraw to Bank" onPress={() => setWithdrawOpen(true)} />

        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>R {today.toFixed(2)}</Text>
            <Text style={styles.statLbl}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>R {week.toFixed(2)}</Text>
            <Text style={styles.statLbl}>This week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>R {month.toFixed(2)}</Text>
            <Text style={styles.statLbl}>This month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>R {totalEarned.toFixed(2)}</Text>
            <Text style={styles.statLbl}>Total earned</Text>
          </View>
        </View>

        <Text style={styles.section}>Transactions</Text>
        {txs.length === 0 ? (
          <Text style={styles.empty}>No transactions yet.</Text>
        ) : (
          txs.map((t) => (
            <View key={t.id} style={styles.tx}>
              <View style={styles.txLeft}>
                <Text style={styles.txDesc}>{t.description}</Text>
                <Text style={styles.txDate}>
                  {new Date(t.createdAt).toLocaleString()}
                </Text>
              </View>
              <Text
                style={[
                  styles.txAmt,
                  { color: t.type === 'CREDIT' ? COLORS.success : COLORS.error },
                ]}
              >
                {t.type === 'CREDIT' ? '+' : '-'}R {Number(t.amount).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={withdrawOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm withdrawal</Text>
            <Text style={styles.modalBank}>
              Bank: {profile?.bankName || '—'}
              {'\n'}
              Account: {profile?.bankAccountNumber || '—'}
              {'\n'}
              Holder: {profile?.bankAccountHolder || '—'}
            </Text>
            <FormInput
              label="Amount (ZAR)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <GoldButton title="Submit" onPress={submitWithdraw} loading={loading} />
            <TouchableOpacity style={styles.cancel} onPress={() => setWithdrawOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  h1: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 16 },
  balanceLabel: { color: COLORS.textMuted, fontSize: 14 },
  balance: { color: COLORS.accent, fontSize: 36, fontWeight: '900', marginBottom: 16 },
  pendingCard: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  pendingTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  pendingEmpty: { color: COLORS.textMuted, fontSize: 14 },
  pendingRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  pendingRowFirst: { borderTopWidth: 0, paddingTop: 0 },
  pendingAmt: { color: COLORS.accent, fontSize: 18, fontWeight: '800' },
  pendingRelease: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  pendingJob: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statVal: { color: COLORS.accent, fontSize: 16, fontWeight: '800' },
  statLbl: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  section: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 16, marginBottom: 12 },
  empty: { color: COLORS.textMuted },
  tx: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  txLeft: { flex: 1, marginRight: 12 },
  txDesc: { color: COLORS.text, fontSize: 15 },
  txDate: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  txAmt: { fontSize: 16, fontWeight: '800' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  modalBank: { color: COLORS.textMuted, fontSize: 14, marginBottom: 16, lineHeight: 22 },
  cancel: { alignItems: 'center', marginTop: 12 },
  cancelText: { color: COLORS.accent, fontSize: 16 },
});
