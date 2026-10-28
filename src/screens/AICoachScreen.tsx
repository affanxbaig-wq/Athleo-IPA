import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import {AnimatedText as Text} from '../components/AnimatedText';
import {AppCard} from '../components/AppCard';
import {SmoothScrollView} from '../components/SmoothScrollView';
import {
  askCoach,
  CoachContext,
  getLastCoachSource,
  setGeminiApiKey,
} from '../services/aiCoach';
import {ATHLEO_COLORS, ATHLEO_SPACING, TAB_BAR_BOTTOM_PADDING} from '../theme/theme';

type ChatMessage = {
  id: number;
  role: 'assistant' | 'user';
  text: string;
};

type LanguageMode = 'en' | 'ur';

type PlanCard = {
  name: string;
  price: string;
  accent: string;
  description: string;
  features: string[];
};

const QUICK_PROMPTS = [
  {en: 'Build Muscle', ur: 'پٹھوں کی تعمیر'},
  {en: 'Lose Fat', ur: 'چربی کم کریں'},
  {en: 'Improve Endurance', ur: 'استقامت بہتر کریں'},
  {en: 'Diet Plan', ur: 'ڈائیٹ پلان'},
  {en: 'Gym Workout', ur: 'جم ورک آوٹ'},
  {en: 'Subscription Plan', ur: 'سبسکرپشن پلان'},
];

const PLAN_CARDS: PlanCard[] = [
  {
    name: 'Free',
    price: '£0',
    accent: ATHLEO_COLORS.text,
    description: 'Basic coaching, habits, and offline guidance.',
    features: ['Workout basics', 'Nutrition tips', 'General guidance'],
  },
  {
    name: 'Pro',
    price: '£19/mo',
    accent: ATHLEO_COLORS.accent,
    description: 'Personalized plans and premium AI coaching.',
    features: ['Custom training plans', 'Meal planning', 'Progress analysis'],
  },
  {
    name: 'Elite',
    price: '£39/mo',
    accent: '#9DD7FF',
    description: 'For serious athletes who want advanced support.',
    features: ['Advanced recovery', 'VIP support', 'Performance tracking'],
  },
];

export function AICoachScreen() {
  const [language, setLanguage] = useState<LanguageMode>('en');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      text:
        '👋 Hi! I\'m your Athleo AI Coach — powered by Gemini AI with a built-in offline sports science engine.\n\nAsk me anything: workouts, diet plans, fat loss, muscle building, recovery, or your subscription!',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // Live network status — updates automatically as connectivity changes
  const [isOnline, setIsOnline] = useState(false);
  const [coachSource, setCoachSource] = useState<'online' | 'offline'>('offline');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const isMountedRef = useRef(true);

  // Subscribe to real-time network changes
  useEffect(() => {
    NetInfo.fetch().then(state => {
      if (isMountedRef.current) {
        setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
      }
    });
    const unsubscribe = NetInfo.addEventListener(state => {
      if (isMountedRef.current) {
        setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
      }
    });
    return () => unsubscribe();
  }, []);

  const context = useMemo<CoachContext>(
    () => ({
      goal: 'general fitness',
      user_name: 'Athlete',
      user_goals: 'Improve strength and overall health',
      recent_activity: 'Recent workout and nutrition tracking',
      today: new Date().toISOString().slice(0, 10),
      past_notes: 'Prefers realistic routines and practical meal planning',
      language,
    }),
    [language],
  );

  const saveGeminiKey = () => {
    const trimmed = keyInput.trim();
    setGeminiApiKey(trimmed);
    setCoachSource(trimmed ? 'online' : 'offline');
    setShowKeyModal(false);
    if (trimmed && isMountedRef.current) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          text: '✅ Gemini AI key saved! I\'m now connected to Google Gemini for even smarter, personalised coaching.',
        },
      ]);
    }
  };

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || busy || !isMountedRef.current) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      text: trimmed,
    };

    if (isMountedRef.current) {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setBusy(true);
    }

    try {
      const reply = await askCoach(trimmed, context);
      if (!isMountedRef.current) {
        return;
      }
      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        text: reply,
      };
      if (isMountedRef.current) {
        setCoachSource(getLastCoachSource());
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.warn('[AICoach] askCoach failed:', err);
      if (!isMountedRef.current) {
        return;
      }
      if (isMountedRef.current) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 2,
            role: 'assistant',
            text:
              language === 'ur'
                ? '🧠 میں ابھی آف لائن مشورہ دے رہا ہوں۔ کوئی بھی fitness یا diet سوال پوچھیں!'
                : '🧠 Running on Smart Offline mode — I can still answer your fitness and nutrition questions instantly!',
          },
        ]);
      }
    } finally {
      if (isMountedRef.current) {
        setBusy(false);
      }
    }
  };

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const choosePlan = (planName: string) => {
    setSelectedPlan(selectedPlan === planName ? null : planName);
  };

  // Pill is green when online (Gemini cloud), amber when offline
  const aiOnline = isOnline;

  return (
    <>
      {/* Gemini API Key Modal */}
      <Modal
        visible={showKeyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🤖 Connect Gemini AI</Text>
            <Text style={styles.modalSubtitle}>
              Paste your Google Gemini API key to enable cloud AI responses.
              Without it, the built-in Offline Coach handles all questions instantly.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="AIza..."
              placeholderTextColor="#4A4A52"
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowKeyModal(false)}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={saveGeminiKey}>
                <Text style={styles.modalBtnPrimaryText}>Save Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SmoothScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.heroHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 14}}>
            <Image
              source={require('../assets/images/coach_maya.jpg')}
              style={styles.coachAvatarImg}
              resizeMode="cover"
            />
            <View>
              <Text style={styles.eyebrow}>ATHLEO</Text>
              <Text style={styles.title}>AI Coach</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Live network status badge */}
            <View
              style={[
                styles.statusPill,
                aiOnline ? styles.statusOnline : styles.statusOffline,
              ]}>
              <View
                style={[
                  styles.statusDot,
                  {backgroundColor: aiOnline ? '#30D158' : '#FF9F0A'},
                ]}
              />
              <Text style={styles.statusText}>
                {aiOnline
                  ? (language === 'ur' ? 'AI آن لائن' : 'AI Online')
                  : (language === 'ur' ? 'AI آف لائن' : 'AI Offline')}
              </Text>
            </View>

            {/* Language toggle */}
            <View style={styles.langToggle}>
              <TouchableOpacity
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                onPress={() => setLanguage('en')}>
                <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, language === 'ur' && styles.langBtnActive]}
                onPress={() => setLanguage('ur')}>
                <Text style={[styles.langText, language === 'ur' && styles.langTextActive]}>UR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* AI always active — no manual key banner needed */}

        {/* Chat */}
        <AppCard style={styles.chatCard}>
          {messages.map(msg => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}>
              {msg.role === 'assistant' && (
                <Image
                  source={require('../assets/images/coach_maya.jpg')}
                  style={styles.bubbleAvatar}
                  resizeMode="cover"
                />
              )}
              <Text
                style={[
                  styles.messageText,
                  msg.role === 'user'
                    ? styles.userText
                    : styles.assistantText,
                  language === 'ur' && {writingDirection: 'rtl'},
                ]}>
                {msg.text}
              </Text>
            </View>
          ))}
          {busy && (
            <View style={[styles.assistantBubble, {flexDirection: 'row', alignItems: 'center', gap: 8}]}>
              <Image
                source={require('../assets/images/coach_maya.jpg')}
                style={styles.bubbleAvatar}
                resizeMode="cover"
              />
              <ActivityIndicator size="small" color={ATHLEO_COLORS.accent} />
            </View>
          )}
        </AppCard>

        {/* Quick Prompts */}
        <View style={styles.quickPromptsRow}>
          {QUICK_PROMPTS.map(qp => (
            <TouchableOpacity
              key={qp.en}
              style={styles.quickPrompt}
              onPress={() => sendMessage(language === 'ur' ? qp.ur : qp.en)}>
              <Text style={styles.quickPromptText}>
                {language === 'ur' ? qp.ur : qp.en}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input Row */}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, language === 'ur' && {textAlign: 'right'}]}
            placeholder={
              language === 'ur'
                ? 'اپنا سوال لکھیں...'
                : 'Ask your coach anything...'
            }
            placeholderTextColor={ATHLEO_COLORS.muted}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!busy}
          />
          <TouchableOpacity
            style={[styles.sendButton, busy && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={busy}>
            <Text style={styles.sendButtonText}>
              {language === 'ur' ? 'بھیجیں' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Plans */}
        <Text style={styles.sectionTitle}>
          {language === 'ur' ? 'سبسکرپشن پلانز' : 'Subscription Plans'}
        </Text>

        {PLAN_CARDS.map(plan => (
          <TouchableOpacity
            key={plan.name}
            onPress={() => choosePlan(plan.name)}
            activeOpacity={0.85}>
            <AppCard
              style={[
                styles.planCard,
                selectedPlan === plan.name && {
                  borderColor: plan.accent,
                  borderWidth: 1.5,
                },
              ]}>
              <View style={styles.planHeader}>
                <Text style={[styles.planName, {color: plan.accent}]}>
                  {plan.name}
                </Text>
                <Text style={[styles.planPrice, {color: plan.accent}]}>
                  {plan.price}
                </Text>
              </View>
              <Text style={styles.planDesc}>{plan.description}</Text>
              {selectedPlan === plan.name && (
                <View style={styles.planFeatureList}>
                  {plan.features.map(f => (
                    <Text key={f} style={styles.planFeature}>
                      ✓ {f}
                    </Text>
                  ))}
                </View>
              )}
            </AppCard>
          </TouchableOpacity>
        ))}
      </SmoothScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ATHLEO_COLORS.background},
  content: {
    padding: ATHLEO_SPACING.lg,
    paddingBottom: TAB_BAR_BOTTOM_PADDING,
    gap: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coachAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: ATHLEO_COLORS.accent,
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginTop: 2,
    flexShrink: 0,
  },
  eyebrow: {
    color: ATHLEO_COLORS.muted,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    color: ATHLEO_COLORS.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusOnline: {backgroundColor: 'rgba(48, 209, 88, 0.12)'},
  statusOffline: {backgroundColor: 'rgba(255, 159, 10, 0.12)'},
  statusDot: {width: 6, height: 6, borderRadius: 3},
  statusText: {color: ATHLEO_COLORS.text, fontSize: 10, fontWeight: '700'},
  langToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  langBtn: {paddingHorizontal: 12, paddingVertical: 5},
  langBtnActive: {backgroundColor: ATHLEO_COLORS.accent},
  langText: {color: ATHLEO_COLORS.muted, fontSize: 11, fontWeight: '700'},
  langTextActive: {color: '#000000'},
  geminiConnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(66, 153, 225, 0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(66, 153, 225, 0.25)',
    gap: 12,
  },
  geminiConnectIcon: {fontSize: 24},
  geminiConnectText: {flex: 1},
  geminiConnectTitle: {color: '#60A5FA', fontWeight: '700', fontSize: 13},
  geminiConnectSub: {color: ATHLEO_COLORS.muted, fontSize: 11, marginTop: 2},
  geminiConnectArrow: {color: '#60A5FA', fontSize: 16, fontWeight: '700'},
  chatCard: {padding: 14, gap: 10, borderRadius: 18},
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '90%',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: ATHLEO_COLORS.accent,
    flexDirection: 'row-reverse',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D1D21',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    maxWidth: '92%',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  messageText: {fontSize: 13, lineHeight: 20, flex: 1},
  userText: {color: '#000000', fontWeight: '600'},
  assistantText: {color: ATHLEO_COLORS.text},
  quickPromptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPrompt: {
    backgroundColor: '#1A1A1E',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
  },
  quickPromptText: {color: ATHLEO_COLORS.text, fontSize: 12, fontWeight: '600'},
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#18181C',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: ATHLEO_COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: ATHLEO_COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  sendButtonDisabled: {opacity: 0.45},
  sendButtonText: {color: '#000000', fontWeight: '800', fontSize: 13},
  sectionTitle: {
    color: ATHLEO_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  planCard: {padding: 16, borderRadius: 18, gap: 6},
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {fontSize: 18, fontWeight: '800'},
  planPrice: {fontSize: 14, fontWeight: '700'},
  planDesc: {color: ATHLEO_COLORS.muted, fontSize: 12},
  planFeatureList: {marginTop: 6, gap: 4},
  planFeature: {color: ATHLEO_COLORS.text, fontSize: 12, fontWeight: '500'},
  // Gemini Key Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#16161A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  modalTitle: {
    color: ATHLEO_COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: ATHLEO_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  modalInput: {
    backgroundColor: '#0E0E12',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: ATHLEO_COLORS.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: ATHLEO_COLORS.hairline,
    fontFamily: 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtnSecondary: {
    flex: 1,
    backgroundColor: '#252528',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnSecondaryText: {
    color: ATHLEO_COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: ATHLEO_COLORS.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnPrimaryText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
});
