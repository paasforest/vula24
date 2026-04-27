import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../../components/GoldButton';
import { FormInput } from '../../components/FormInput';
import { COLORS } from '../../constants/theme';
import api from '../../lib/api';
import { getUser } from '../../lib/storage';

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
  const [isMember, setIsMember] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUser().then((u) => setIsMember(u?.isMember === true));
  }, []);

  const load = useCallback(async () => {
    try {
      if (isMember) {
        const { data } = await api.get('/api/member/jobs/my-jobs');
        setJobs(data.jobs || []);
        return;
      }
      const [w, p, pend] = await Promise.all([
        api.get('/api/wallet/my-wallet'),
        api.get('/api/locksmith/profile'),
        api.get('/api/wallet/pending-payouts').catch(() => ({ data: { pendingPayouts: [] } })),
      ]);
      setWallet(w.data);
      console.log('wallet data:', JSON.stringify(w.data));
      setProfile(p.data.locksmith);
      setPendingPayouts(pend.data?.pendingPayouts || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load data.');
    }
  }, [isMember]);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(() => {
        load();
      }, 30000);
      return () => clearInterval(id);
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
    wallet?.totalEarned != null ? Number(wallet.totalEarned) : null;

  const sumToday = today;
  const sumWeek = week;
  const sumMonth = month;

  const submitWithdraw = async () => {
    const n = parseFloat(String(amount).replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) {
      Alert.alert('Amount', 'Enter a valid amount.');
      return;
    }
    if (n < 100) {
      Alert.alert('Minimum', 'Minimum withdrawal amount is R100.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/payments/withdraw', { amount: n });
      Alert.alert(
        'Withdrawal requested',
        'Your withdrawal request has been submitted. Funds will be transferred to your bank account within 1-2 business days.'
      );
      setWithdrawOpen(false);
      setAmount('');
      await load();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Withdrawal failed.');
    } finally {
      setLoading(false);
    }
  };

  if (isMember) {
    return (
      <SafeAreaView style={styles.safe} edges={['top','bottom']}>
        <Text style={styles.h1}>My Jobs</Text>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {(jobs || [])
            .filter(j => j.status === 'COMPLETED')
            .map(j => (
              <View key={j.id} style={{
                backgroundColor: COLORS.inputBg,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#2a2a2a',
              }}>
                <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 15 }}>
                  {String(j.serviceType).replace(/_/g, ' ')}
                </Text>
                <Text style={{ color: COLORS.textMuted, marginTop: 4 }}>
                  {j.customerAddress}
                </Text>
                <Text style={{ color: COLORS.textMuted, marginTop: 4, fontSize: 12 }}>
                  {new Date(j.completedAt || j.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          }
          {(jobs || []).filter(j => j.status === 'COMPLETED').length === 0 && (
            <Text style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 40 }}>
              No completed jobs yet
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, styles.scrollGrow]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
          }
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.h1}>Earnings</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLbl}>Wallet balance</Text>
          <Text style={styles.balanceVal}>
            R {Number(wallet?.wallet?.balance ?? wallet?.balance ?? 0).toFixed(2)}
          </Text>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => {
              if (
                !profile?.bankName ||
                !profile?.bankAccountNumber ||
                !profile?.bankAccountHolder
              ) {
                Alert.alert(
                  'Bank details required',
                  'Please add your bank details in your profile before withdrawing.',
                  [
                    {
                      text: 'Add bank details',
                      onPress: () => router.push('/bank-details'),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
                return;
              }
              setWithdrawOpen(true);
            }}
          >
            <Text style={styles.withdrawBtnText}>Withdraw to bank</Text>
            <Ionicons name="arrow-forward" size={16} color="#111" />
          </TouchableOpacity>
        </View>

        {pendingPayouts.length > 0 ? (
          <View style={styles.pendingNote}>
            <Text style={styles.pendingNoteText}>
              You have {pendingPayouts.length} pending payout
              {pendingPayouts.length > 1 ? 's' : ''} releasing soon. Pull down to
              refresh.
            </Text>
          </View>
        ) : null}

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

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLbl}>Today</Text>
            <Text style={styles.statVal}>R {sumToday.toFixed(0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLbl}>This week</Text>
            <Text style={styles.statVal}>R {sumWeek.toFixed(0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLbl}>This month</Text>
            <Text style={styles.statVal}>R {sumMonth.toFixed(0)}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccent]}>
            <Text style={styles.statLbl}>Total earned</Text>
            <Text style={styles.statVal}>
              {totalEarned !== null ? `R ${totalEarned.toFixed(0)}` : '...'}
            </Text>
            <Text style={styles.totalEarnedHint}>
              {totalEarned !== null ? '' : 'Calculating...'}
            </Text>
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
                {t.job?.teamMember?.name && (
                  <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
                    via {t.job.teamMember.name}
                  </Text>
                )}
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
      </KeyboardAvoidingView>

      <Modal visible={withdrawOpen} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.modalBg}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScroll}
            >
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40 },
  scrollGrow: { flexGrow: 1 },
  h1: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 16 },
  balanceCard: {
    margin: 20,
    backgroundColor: COLORS.inputBg,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  balanceLbl: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  balanceVal: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 20,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  withdrawBtnText: {
    color: '#111',
    fontWeight: '700',
    fontSize: 15,
  },
  pendingNote: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1a1a0a',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    padding: 12,
  },
  pendingNoteText: {
    color: COLORS.accent,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  pendingCard: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statCardAccent: {
    borderColor: COLORS.accent,
  },
  statLbl: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  statVal: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  totalEarnedHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 6,
    minHeight: 14,
  },
  section: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  empty: { color: COLORS.textMuted, paddingHorizontal: 20 },
  tx: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
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
  },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
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
