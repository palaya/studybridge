import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  Typography,
  Tag,
  Space,
  Spin,
  message,
  Collapse,
  Progress,
} from 'antd';
import {
  CheckCircleOutlined,
  SoundOutlined,
  AudioOutlined,
  BookOutlined,
  SendOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { api } from '../../api/client';
import { designTokens } from '../../designTokens';
import TutorSessionMascotSvg from './TutorSessionMascotSvg';
import UserAvatarSvg from './UserAvatarSvg';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function LanguagePage() {
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMission = useCallback(async () => {
    try {
      const res = await api.getTodayMission();
      setMission(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMission();
    api.trackEvent('page_view', { page: 'language' });
  }, [loadMission]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const vocabTask = mission?.mission?.tasks?.find((t) => t.type === 'vocab');
  const meta = vocabTask?.meta || {};
  const isReading = Boolean(meta.passageEn);

  return (
    <div>
      <Title level={4} style={{ marginBottom: 0 }}>
        Reading &amp; Language Lab
      </Title>
      {isReading ? (
        <ReadingLabTab
          vocabTaskId={vocabTask?.id}
          meta={meta}
          onRefresh={loadMission}
        />
      ) : (
        <LegacyVocabTab meta={meta} onRefresh={loadMission} vocabTaskId={vocabTask?.id} />
      )}
    </div>
  );
}

/** Fallback if mission has no passage (old data edge case) */
function LegacyVocabTab({ meta, onRefresh, vocabTaskId }) {
  const words = meta.words || [];
  const learnedIds = new Set(meta.learnedWordIds || []);
  const [learningWord, setLearningWord] = useState(null);

  const learnWord = async (word) => {
    setLearningWord(word);
    try {
      await api.learnWord(word);
      message.success(`Learned "${word}"!`);
      onRefresh();
    } catch (e) {
      message.error('Failed to mark word');
    } finally {
      setLearningWord(null);
    }
  };

  if (!words.length) {
    return <Text type="secondary">Loading reading content…</Text>;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Text type="secondary">Legacy word list — open tomorrow for the full reading lab.</Text>
      {words.map((w) => {
        const key = w.word || w;
        const done = learnedIds.has(typeof w === 'string' ? w : w.word);
        return (
          <Card key={key} size="small" style={{ borderRadius: 16 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Text strong>{typeof w === 'string' ? w : w.word}</Text>
              {!done && vocabTaskId && (
                <Button
                  size="small"
                  type="primary"
                  loading={learningWord === key}
                  onClick={() => learnWord(typeof w === 'string' ? w : w.word)}
                >
                  I know this
                </Button>
              )}
              {done && <Tag color="success">Learned</Tag>}
            </Space>
          </Card>
        );
      })}
    </Space>
  );
}

function ReadingLabTab({ vocabTaskId, meta, onRefresh }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [appMode, setAppMode] = useState('blank');
  const [blankAnswer, setBlankAnswer] = useState('');
  const [sentenceAnswer, setSentenceAnswer] = useState('');
  const [blankLoading, setBlankLoading] = useState(false);
  const [sentenceLoading, setSentenceLoading] = useState(false);
  const [passageMarking, setPassageMarking] = useState(false);
  const [speakingWord, setSpeakingWord] = useState(null);
  const [playedWords, setPlayedWords] = useState(new Set());
  const [justLearnedWords, setJustLearnedWords] = useState(new Set());

  const thumbStyle = `
    @keyframes thumbPop {
      0% { transform: scale(0.3) rotate(-30deg); opacity: 0; }
      50% { transform: scale(1.2) rotate(5deg); opacity: 1; }
      70% { transform: scale(0.95) rotate(-2deg); }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    .thumb-btn:active {
      animation: thumbBounce 0.3s ease;
    }
    @keyframes thumbBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(0.8); }
    }
  `;

  const words = meta.words || [];
  const learnedIds = new Set(meta.learnedWordIds || []);
  const turns = Number(meta.readingChatUserTurns) || 0;
  const learnedCount = meta.learnedWordIds?.length || 0;

  const readingProgress = (() => {
    let p = 0;
    if (meta.passageViewed) p += 25;
    p += Math.min(25, (turns / 2) * 25);
    p += Math.min(25, (learnedCount / 6) * 25);
    if (meta.applicationComplete) p += 25;
    return Math.round(p);
  })();

  const markPassageRead = async () => {
    if (!vocabTaskId || meta.passageViewed) return;
    setPassageMarking(true);
    try {
      await api.completeTask(vocabTaskId, { viewPassage: true });
      await onRefresh();
      message.success('Great — now you can chat about the passage below.');
    } catch (e) {
      message.error('Could not save progress');
    } finally {
      setPassageMarking(false);
    }
  };

  const sendReadingChat = async (history, userIntent) => {
    setChatLoading(true);
    try {
      const res = await api.readingChat(history, userIntent ? { userIntent } : {});
      setChatMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
      await onRefresh();
    } catch (e) {
      message.error(e.message || 'Chat failed');
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry: ${e.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const startChat = async () => {
    if (chatLoading || chatMessages.length > 0) return;
    if (!meta.passageViewed) {
      message.info('Please tap “I finished reading” under the passage first.');
      return;
    }
    const opening = [
      { role: 'user', content: "I'm ready. Let's talk about this passage." },
    ];
    setChatMessages(opening);
    await sendReadingChat(opening, null);
  };

  const submitChat = async () => {
    const t = chatInput.trim();
    if (!t || chatLoading) return;
    const next = [...chatMessages, { role: 'user', content: t }];
    setChatMessages(next);
    setChatInput('');
    await sendReadingChat(next, null);
  };

  const quickIntent = async (userIntent, line) => {
    if (chatLoading) return;
    const next = [...chatMessages, { role: 'user', content: line }];
    setChatMessages(next);
    await sendReadingChat(next, userIntent);
  };

  const learnWord = async (word) => {
    try {
      await api.learnWord(word);
      setJustLearnedWords((prev) => new Set(prev).add(word));
      message.success(`Marked "${word}" as learned`);
      await onRefresh();
    } catch (e) {
      message.error('Could not update word');
    }
  };

  const speakWord = useCallback((word) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      message.warning('This browser does not support speech playback.');
      return;
    }
    const text = String(word || '').trim();
    if (!text) {
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    u.pitch = 1.0;
    u.volume = 1.0;
    // Pick the best available English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang === 'en-US' && /samantha|karen|daniel|google.*us|natural/i.test(v.name)
    ) || voices.find((v) => v.lang === 'en-US' && !v.localService === false)
      || voices.find((v) => v.lang.startsWith('en'));
    if (preferred) {
      u.voice = preferred;
    }
    setSpeakingWord(text);
    setPlayedWords((prev) => new Set(prev).add(text));
    u.onend = () => {
      setSpeakingWord((cur) => (cur === text ? null : cur));
    };
    u.onerror = () => {
      setSpeakingWord((cur) => (cur === text ? null : cur));
    };
    window.speechSynthesis.speak(u);
  }, []);

  const submitApplication = async (mode) => {
    const answer = mode === 'blank' ? blankAnswer : sentenceAnswer;
    const setLoading = mode === 'blank' ? setBlankLoading : setSentenceLoading;
    const setAnswer = mode === 'blank' ? setBlankAnswer : setSentenceAnswer;
    if (!answer.trim()) {
      message.warning('Enter your answer');
      return;
    }
    setLoading(true);
    try {
      const res = await api.readingApplication(mode, answer.trim());
      message.info(res.feedback);
      if (res.accepted) {
        message.success('Great work!');
        setAnswer('');
        await onRefresh();
      }
    } catch (e) {
      message.error(e.message || 'Check failed');
    } finally {
      setLoading(false);
    }
  };

  const wordsCard = (
    <Card
      title="Words from the passage"
      size="small"
      style={{ borderRadius: 16 }}
      styles={{ header: { paddingTop: 16, paddingBottom: 0, borderBottom: 'none' }, body: { paddingTop: 4 } }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Learn these words first, then read the passage below. Each word and the example sentence under it need to be read three times.
      </Text>
      <Space direction="vertical" style={{ width: '100%' }}>
        {words.map((w) => {
          const done = learnedIds.has(w.word);
          return (
            <Card
              key={w.word}
              size="small"
              style={{
                borderRadius: 16,
                borderWidth: '1px 1px 4px 1px',
                borderStyle: 'solid',
                borderColor: done ? '#DBEFCA' : '#E3E4E4',
                ...(done ? { backgroundColor: '#F9FFF4' } : {}),
              }}
            >
              <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text strong style={{ fontSize: 16 }}>
                    {w.word}
                  </Text>
                  <br />
                  <Text type="secondary">{w.simpleEnglish}</Text>
                  {w.zh && (
                    <>
                      <br />
                      <Text type="secondary">{w.zh}</Text>
                    </>
                  )}
                </div>
                <Space align="center" size={8}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: designTokens.color.primary,
                      boxShadow: '0 4px 0 #E3E4E4',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    onClick={() => speakWord(w.word)}
                    role="button"
                    aria-label={`Play pronunciation: ${w.word}`}
                    title="Play pronunciation"
                  >
                    <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M33.7911 10.1086C35.2079 12.3719 36.1184 14.741 36.5032 17.175C36.6516 18.1148 36.7215 19.0629 36.7141 20.0152C36.7219 20.9672 36.6516 21.9152 36.5032 22.8555C36.1184 25.2894 35.2079 27.6586 33.7911 29.9219C33.1325 31.0051 32.609 31.6351 32.5563 31.6976C32.2114 32.1082 31.7137 32.3242 31.2102 32.3242C30.8269 32.3245 30.4542 32.1989 30.1493 31.9668C29.3758 31.3801 29.2243 30.2773 29.811 29.5039C30.1497 29.0574 30.4633 28.6062 30.752 28.1508C31.3801 27.1269 32.1985 25.5445 32.7094 23.5953C33.0231 22.3984 33.1864 21.2012 33.1985 20.0152C33.1864 18.8293 33.0231 17.632 32.7094 16.4351C32.1985 14.4859 31.3801 12.9035 30.752 11.8797C30.4633 11.4246 30.1497 10.9734 29.811 10.5266C29.2243 9.75311 29.3758 8.65038 30.1493 8.06366C30.4668 7.82264 30.8399 7.70624 31.2102 7.70624C31.7137 7.70624 32.2114 7.92186 32.5563 8.3328C32.6086 8.3953 33.1321 9.02538 33.7911 10.1086Z" fill="white"/>
                      <path d="M31.3453 20.0152C31.3578 18.3773 30.9675 16.475 29.7406 14.4918C29.3703 13.8758 29.064 13.5 28.9933 13.416C28.6484 13.0039 28.1496 12.7871 27.6453 12.7871C27.2749 12.7871 26.9019 12.9035 26.5843 13.1445C25.8109 13.7312 25.6593 14.834 26.246 15.6074C26.4121 15.8262 26.5644 16.0465 26.7042 16.2684C26.9992 16.7535 27.3851 17.5074 27.6195 18.4328C27.7542 18.9648 27.8238 19.4922 27.8292 20.0148C27.8238 20.5375 27.7542 21.0652 27.6195 21.5969C27.3851 22.5223 26.9992 23.2766 26.7042 23.7613C26.5612 23.9882 26.4083 24.2087 26.246 24.4223C25.6593 25.1957 25.8109 26.2984 26.5843 26.8852C26.8893 27.1173 27.262 27.2429 27.6453 27.2426C28.1496 27.2426 28.648 27.0258 28.9933 26.6137C29.064 26.5297 29.3707 26.1539 29.7406 25.5379C30.9675 23.5551 31.3578 21.6531 31.3453 20.0152Z" fill="white"/>
                      <path d="M20.2113 6.40507C18.527 5.69843 16.6594 6.06484 15.3355 7.36132L11.8441 10.7578H9.69844C7.94609 10.7578 6.30547 11.4809 5.07891 12.7941C3.88438 14.073 3.22656 15.7644 3.22656 17.5574V22.4738C3.22656 24.2668 3.88438 25.9582 5.07891 27.2371C6.30547 28.5504 7.94609 29.2734 9.69844 29.2734H11.8441L15.3355 32.6699C16.2137 33.5297 17.3305 33.9805 18.4746 33.9805C19.0559 33.9805 19.6441 33.8641 20.2113 33.6262C21.0512 33.2738 21.7664 32.684 22.2793 31.9211C22.8176 31.1203 23.102 30.1676 23.102 29.1664V10.8648C23.102 9.86328 22.8176 8.91093 22.2793 8.11015C21.7664 7.34687 21.0512 6.75742 20.2113 6.40507Z" fill="white"/>
                    </svg>
                  </span>
                  {done ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        backgroundColor: '#ffffff',
                        border: '1px solid #E3E4E4',
                        boxShadow: '0 4px 0 #E3E4E4',
                        borderRadius: '50%',
                        padding: 0,
                        animation: justLearnedWords.has(w.word) ? 'thumbPop 0.5s ease-out' : 'none',
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 15.75V19.5H12.8333C8.16667 19.5 4.80667 23.98 6.11333 28.46L8.82 37.74C9.81556 41.1533 12.9444 43.5 16.5 43.5H24.5C28.366 43.5 31.5 40.366 31.5 36.5V15.75C31.5 13.1266 29.3734 11 26.75 11C24.1266 11 22 13.1266 22 15.75Z" fill="#FFDBB7"/>
                        <path d="M20 11H17" stroke="#F571A0" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M37 11H34" stroke="#F571A0" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M27 7V4" stroke="#F571A0" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M31 7.12132L33.1213 5" stroke="#F571A0" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M22.1213 7.53554L20 5.41422" stroke="#F571A0" strokeWidth="2" strokeLinecap="round"/>
                        <rect x="34" y="19" width="10" height="24" rx="5" fill="#14B2FC"/>
                        <circle cx="39" cy="24" r="3" fill="#FCC509"/>
                        <path d="M5.85156 27H14.0001C14.5523 27 15.0001 27.4477 15.0001 28C15.0001 28.5523 14.5523 29 14.0001 29H6.27344C6.02798 28.2086 5.91502 27.768 5.85156 27Z" fill="#FBAD89"/>
                        <path d="M7.74219 34H16C16.5523 34 17 34.4477 17 35C17 35.5523 16.5523 36 16 36H8.3125L7.74219 34Z" fill="#FBAD89"/>
                      </svg>
                    </span>
                  ) : (
                    <Button
                      className="thumb-btn"
                      size="small"
                      onClick={() => learnWord(w.word)}
                      disabled={!playedWords.has(w.word)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #E3E4E4',
                        boxShadow: '0 4px 0 #E3E4E4',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: playedWords.has(w.word) ? 1 : 0.3,
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M26.75 17H24.5C23.1193 17 22 18.1193 22 19.5H12.8333C8.16667 19.5 4.80667 23.98 6.11333 28.46L8.82 37.74C9.81556 41.1533 12.9444 43.5 16.5 43.5H24.5C28.366 43.5 31.5 40.366 31.5 36.5V21.75C31.5 19.1266 29.3734 17 26.75 17Z" fill="#FFDBB7"/>
                        <rect x="34" y="19" width="10" height="24" rx="5" fill="#14B2FC"/>
                        <circle cx="39" cy="24" r="3" fill="#FCC509"/>
                        <path d="M5.85156 27H14.0001C14.5523 27 15.0001 27.4477 15.0001 28C15.0001 28.5523 14.5523 29 14.0001 29H6.27344C6.02798 28.2086 5.91502 27.768 5.85156 27Z" fill="#FBAD89"/>
                        <path d="M7.74219 34H16C16.5523 34 17 34.4477 17 35C17 35.5523 16.5523 36 16 36H8.3125L7.74219 34Z" fill="#FBAD89"/>
                      </svg>
                    </Button>
                  )}
                </Space>
              </Space>
            </Card>
          );
        })}
      </Space>
    </Card>
  );

  const progressCard = (
    <Card size="small" style={{ borderRadius: 16 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Today&apos;s reading task
      </Text>
      <Progress percent={readingProgress} strokeColor={designTokens.color.primary} />
      <Space wrap size={[8, 4]} style={{ marginTop: 8 }}>
        <Tag color={meta.passageViewed ? 'success' : 'default'} style={meta.passageViewed ? { backgroundColor: '#F9FFF4' } : {}}>
          Read passage {meta.passageViewed ? '✓' : '…'}
        </Tag>
        <Tag color={turns >= 2 ? 'success' : 'default'} style={turns >= 2 ? { backgroundColor: '#F9FFF4' } : {}}>
          AI chat {turns}/2+ turns {turns >= 2 ? '✓' : '…'}
        </Tag>
        <Tag color={learnedCount >= 6 ? 'success' : 'default'} style={learnedCount >= 6 ? { backgroundColor: '#F9FFF4' } : {}}>
          Words {learnedCount}/6 {learnedCount >= 6 ? '✓' : '…'}
        </Tag>
        <Tag color={meta.applicationComplete ? 'success' : 'default'} style={meta.applicationComplete ? { backgroundColor: '#F9FFF4' } : {}}>
          Use a word {meta.applicationComplete ? '✓' : '…'}
        </Tag>
      </Space>
    </Card>
  );

  const passageCard = (
    <Card
      title="Passage"
      size="small"
      style={{ borderRadius: 16 }}
      styles={{ header: { paddingTop: 16, borderBottom: 'none' } }}
    >
      <Paragraph style={{ marginBottom: 12 }}>{meta.passageEn}</Paragraph>
      {meta.passageZh ? (
        <Collapse
          bordered={false}
          style={{
            marginTop: 8,
            borderRadius: 16,
            border: '1px solid #d9d9d9',
            background: 'transparent',
          }}
          items={[
            {
              key: 'zh',
              label: 'Chinese (optional)',
              children: <Paragraph style={{ marginBottom: 0 }}>{meta.passageZh}</Paragraph>,
              styles: { header: { borderBottom: 'none' }, body: { paddingTop: 0 } },
            },
          ]}
        />
      ) : null}
      {!meta.passageViewed && vocabTaskId && (
        <Button
          type="primary"
          block
          style={{
            marginTop: 16,
            borderRadius: 12,
            boxShadow: '0 4px 0 #E3E4E4',
            height: 40,
            backgroundColor: designTokens.color.primary,
          }}
          onClick={markPassageRead}
          loading={passageMarking}
        >
          I finished reading
        </Button>
      )}
      {meta.passageViewed && (
        <Tag color="success" style={{ marginTop: 12, backgroundColor: '#F9FFF4' }}>
          Reading checked ✓ — you can start the chat below
        </Tag>
      )}
    </Card>
  );

  const chatCard = (
    <Card
      title="Talk about the passage"
      size="small"
      style={{ borderRadius: 16 }}
      styles={{ header: { paddingTop: 16, borderBottom: 'none' } }}
    >
      {chatMessages.length === 0 && (
        <Button
          type="primary"
          onClick={startChat}
          loading={chatLoading}
          block
          style={{ marginBottom: 12, borderRadius: 12, boxShadow: '0 4px 0 #E3E4E4', height: 40 }}
          disabled={!meta.passageViewed}
        >
          Start reading chat
        </Button>
      )}
      {!meta.passageViewed && chatMessages.length === 0 && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Complete “I finished reading” above to unlock chat.
        </Text>
      )}
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {chatMessages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background:
                  m.role === 'user' ? 'transparent' : '#e6f7ff',
                color: m.role === 'user' ? undefined : designTokens.color.primary,
              }}
            >
              {m.role === 'user' ? <UserAvatarSvg style={{ width: 28, height: 28, borderRadius: '50%' }} /> : <TutorSessionMascotSvg style={{ width: 22, height: 'auto' }} />}
            </span>
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: 16,
                background:
                  m.role === 'user' ? 'rgba(0, 179, 251, 0.05)' : designTokens.color.bg.container,
                color: m.role === 'user' ? designTokens.color.text.primary : designTokens.color.text.primary,
                border: m.role === 'user' ? '2px solid #00B3FB' : '2px solid #E3E4E4',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <Text type="secondary">
            <Spin size="small" /> Thinking…
          </Text>
        )}
      </Space>
      {chatMessages.length > 0 && (
        <>
          <Space wrap style={{ marginTop: 12 }}>
            <Button
              size="small"
              onClick={() => quickIntent('explain_more', 'Please explain a bit more.')}
              disabled={chatLoading}
            >
              Explain more
            </Button>
            <Button
              size="small"
              onClick={() => quickIntent('dont_know', "I don't know.")}
              disabled={chatLoading}
            >
              I don&apos;t know
            </Button>
          </Space>
          <div style={{ position: 'relative', marginTop: 12 }}>
            <TextArea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); submitChat(); } }}
              placeholder="Type your answer…"
              disabled={chatLoading}
              autoSize={{ minRows: 1, maxRows: 3 }}
              style={{ borderRadius: 24, paddingRight: 44, paddingTop: 10, paddingBottom: 10, maxHeight: 180, overflow: 'auto' }}
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={submitChat}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 32,
                height: 32,
                minWidth: 32,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </div>
        </>
      )}
    </Card>
  );

  const applicationCard = (
    <Card
      title="Use a word"
      size="small"
      style={{ borderRadius: 16 }}
      styles={{ header: { paddingTop: 16, borderBottom: 'none' } }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Complete the exercises. AI will give short feedback; try again if needed.
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {/* 第一题：Fill in the blank */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>1. Fill in the blank</Text>
          <Paragraph>
            <Text strong>{meta.blankText}</Text>
          </Paragraph>
          <Input
            value={blankAnswer}
            onChange={(e) => setBlankAnswer(e.target.value)}
            placeholder="Your word for the blank…"
            disabled={meta.applicationComplete || blankLoading}
            maxLength={500}
            style={{ borderRadius: 8 }}
          />
          <Button
            type="primary"
            onClick={() => submitApplication('blank')}
            loading={blankLoading}
            disabled={meta.applicationComplete}
            style={{ borderRadius: 12, boxShadow: '0 4px 0 #E3E4E4', height: 40, marginTop: 8 }}
          >
            {meta.applicationComplete ? 'Completed' : 'Check my answer'}
          </Button>
        </div>
        {/* 第二题：Make a sentence */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>2. Make a sentence</Text>
          {meta.sentenceWord && (
            <Paragraph>
              Use <Text strong>{meta.sentenceWord}</Text> in a short sentence about the passage.
            </Paragraph>
          )}
          <TextArea
            rows={2}
            value={sentenceAnswer}
            onChange={(e) => setSentenceAnswer(e.target.value)}
            placeholder="Your sentence…"
            disabled={meta.applicationComplete || sentenceLoading}
            maxLength={500}
            style={{ borderRadius: 8 }}
          />
          <Button
            type="primary"
            onClick={() => submitApplication('sentence')}
            loading={sentenceLoading}
            disabled={meta.applicationComplete}
            style={{ borderRadius: 12, boxShadow: '0 4px 0 #E3E4E4', height: 40, marginTop: 8 }}
          >
            {meta.applicationComplete ? 'Completed' : 'Check my answer'}
          </Button>
        </div>
      </Space>
    </Card>
  );

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <style>{thumbStyle}</style>
      {progressCard}
      {wordsCard}
      {passageCard}
      {applicationCard}
      {chatCard}
    </Space>
  );
}
