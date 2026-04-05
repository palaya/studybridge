import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Input,
  Button,
  Typography,
  Badge,
  Card,
  Spin,
  Space,
  Collapse,
  Tag,
  Switch,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  CameraOutlined,
  PaperClipOutlined,
  CloseCircleFilled,
} from '@ant-design/icons';
import { api } from '../../api/client';
import { designTokens } from '../../designTokens';
import TutorSessionMascotSvg from './TutorSessionMascotSvg';
import UserAvatarSvg from './UserAvatarSvg';
import './TutorPage.css';

const { Title, Text, Paragraph } = Typography;

export default function TutorPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState(null);
  const [showChinese, setShowChinese] = useState(true);
  const [pendingImages, setPendingImages] = useState([]); // [{ file, previewUrl }]
  const listRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const userTurns = messages.filter((m) => m.role === 'user').length;
  const turnsNeeded = 3;

  useEffect(() => {
    api.trackEvent('page_view', { page: 'tutor' });
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const runTutor = useCallback(
    async (history, opts = {}) => {
      const res = await api.tutorMessage(history, {
        photoAnalysis: opts.photoAnalysis ?? photoAnalysis,
        userIntent: opts.userIntent,
      });
      return res;
    },
    [photoAnalysis],
  );

  const addPendingFiles = (files) => {
    const newItems = [];
    for (const file of files) {
      if (file && file.type?.startsWith('image/')) {
        newItems.push({ file, previewUrl: URL.createObjectURL(file) });
      }
    }
    if (newItems.length) setPendingImages((prev) => [...prev, ...newItems]);
  };

  const removePendingImage = (index) => {
    setPendingImages((prev) => {
      const item = prev[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearPendingImages = () => {
    pendingImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setPendingImages([]);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onCameraChange = (e) => {
    const files = e.target.files;
    if (files?.length) addPendingFiles(Array.from(files));
  };

  const onFileChange = (e) => {
    const files = e.target.files;
    if (files?.length) addPendingFiles(Array.from(files));
  };

  const sendMessage = async () => {
    const text = input.trim();
    const hasImages = pendingImages.length > 0;
    if (!text && !hasImages) return;
    if (loading) return;

    const userContent = hasImages
      ? `📷 ${text || 'I uploaded a photo of my homework.'}`
      : text;
    const imageUrls = pendingImages.map((img) => img.previewUrl);
    const updated = [...messages, { role: 'user', content: userContent, images: imageUrls }];
    setMessages(updated);
    setInput('');
    const imageFiles = pendingImages.map((img) => img.file);
    setPendingImages([]);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(true);

    try {
      let analysis = photoAnalysis;
      if (imageFiles.length > 0) {
        // Upload first image for analysis (API expects single photo)
        const { result } = await api.uploadPhoto(imageFiles[0]);
        analysis = result;
        setPhotoAnalysis(result);
        api.trackEvent('photo_analyzed_in_tutor', { imageCount: imageFiles.length });
      }
      const historyForApi = updated.map((m) => ({ role: m.role, content: m.content }));
      const res = await runTutor(historyForApi, { photoAnalysis: analysis });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I had trouble responding. Please try again. (${e.message})`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickIntent = async (userIntent, userLine) => {
    if (loading) return;
    const next = [...messages, { role: 'user', content: userLine }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await runTutor(next, { userIntent });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I had trouble responding. (${e.message})`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const bubbleAiStyle = {
    background: designTokens.color.bg.container,
    border: '2px solid #E3E4E4',
  };
  const bubbleUserStyle = {
    background: 'rgba(0, 179, 251, 0.05)',
    color: designTokens.color.text.primary,
    border: '2px solid #00B3FB',
  };
  const avatarAiStyle = {
    background: '#e6f7ff',
    color: designTokens.color.primary,
  };
  const avatarUserStyle = {
    background: 'transparent',
  };

  return (
    <div className="tutor-page">
      <Card
        size="small"
        style={{ marginBottom: 12, borderRadius: designTokens.radius.md, background: 'transparent', padding: 0, border: 'none' }}
        bodyStyle={{ padding: 0 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Title level={4} style={{ margin: 0 }}>
              AI Tutor
            </Title>
            <Badge
              count={`${userTurns}/${turnsNeeded} turns`}
              style={{
                backgroundColor:
                  userTurns >= turnsNeeded
                    ? designTokens.color.success
                    : designTokens.color.primary,
              }}
            />
          </Space>
          {userTurns < turnsNeeded && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Chat {turnsNeeded - userTurns} more time
              {turnsNeeded - userTurns > 1 ? 's' : ''} to complete today&apos;s tutor task
            </Text>
          )}
        </Space>
      </Card>

      {photoAnalysis && (
        <Collapse
          defaultActiveKey={['q']}
          style={{ marginBottom: 12, borderRadius: designTokens.radius.md }}
          items={[
            {
              key: 'q',
              label: 'Question from your photo',
              children: (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Original
                  </Text>
                  <Paragraph style={{ marginBottom: 8 }}>
                    {photoAnalysis.originalQuestion}
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Simplified English
                  </Text>
                  <Paragraph style={{ marginBottom: 8 }}>
                    {photoAnalysis.simplifiedEnglish}
                  </Paragraph>
                  {photoAnalysis.chineseExplanation ? (
                    <>
                      <Space style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Chinese explanation
                        </Text>
                        <Switch
                          size="small"
                          checked={showChinese}
                          onChange={setShowChinese}
                        />
                      </Space>
                      {showChinese && (
                        <Paragraph style={{ marginBottom: 8 }}>
                          {photoAnalysis.chineseExplanation}
                        </Paragraph>
                      )}
                    </>
                  ) : null}
                  {photoAnalysis.keywords?.length > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        Keywords
                      </Text>
                      <Space wrap size={[4, 4]}>
                        {photoAnalysis.keywords.map((kw, i) => (
                          <Tag key={i} color="processing" style={{ margin: 0 }}>
                            {kw.term}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <div className="tutor-messages" ref={listRef}>
        {messages.length === 0 && !loading && (
          <div className="tutor-welcome">
            <TutorSessionMascotSvg style={{ width: 64, height: 'auto' }} />
            <Text strong style={{ marginTop: 12, display: 'block' }}>
              Hi! Shawn, I'll study with you.
            </Text>
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              Use the camera or upload a photo, or type a question.
            </Text>
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              I'll guide you step by step — I won't give the final answer right away.
            </Text>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              marginBottom: 12,
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
                flexShrink: 0,
                ...(msg.role === 'user' ? avatarUserStyle : avatarAiStyle),
              }}
            >
              {msg.role === 'user'
                ? <UserAvatarSvg style={{ width: 28, height: 28, borderRadius: '50%' }} />
                : <TutorSessionMascotSvg style={{ width: 22, height: 'auto' }} />}
            </span>
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: 16,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 14,
                lineHeight: 1.5,
                ...(msg.role === 'user' ? bubbleUserStyle : bubbleAiStyle),
              }}
            >
              {msg.images?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {msg.images.map((url, j) => (
                    <img
                      key={j}
                      src={url}
                      alt="uploaded"
                      style={{ maxHeight: 100, maxWidth: 120, borderRadius: 6, objectFit: 'cover' }}
                    />
                  ))}
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              marginBottom: 12,
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
                flexShrink: 0,
                ...avatarAiStyle,
              }}
            >
              <TutorSessionMascotSvg style={{ width: 22, height: 'auto' }} />
            </span>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 16,
                ...bubbleAiStyle,
              }}
            >
              <Spin size="small" /> <Text type="secondary">Thinking...</Text>
            </div>
          </div>
        )}
      </div>

      {photoAnalysis && !loading && (
        <Space wrap style={{ marginBottom: 8 }}>
          <Button
            size="small"
            onClick={() => handleQuickIntent('explain_more', 'Please explain a bit more.')}
          >
            Explain more
          </Button>
          <Button
            size="small"
            onClick={() => handleQuickIntent('dont_know', "I don't know.")}
          >
            I don&apos;t know
          </Button>
        </Space>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onCameraChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      <div
        className="tutor-input-bar"
        style={{ borderTopColor: designTokens.color.border.subtle }}
      >
        {pendingImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {pendingImages.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={img.previewUrl}
                  alt="preview"
                  style={{ height: 80, width: 80, borderRadius: 8, objectFit: 'cover' }}
                />
                <CloseCircleFilled
                  onClick={() => removePendingImage(idx)}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    fontSize: 16,
                    color: '#999',
                    cursor: 'pointer',
                    background: '#fff',
                    borderRadius: '50%',
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%' }}>
          <Button
            type="text"
            icon={<CameraOutlined />}
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            aria-label="Take photo"
          />
          <Button
            type="text"
            icon={<PaperClipOutlined />}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-label="Upload image"
          />
          <div style={{ flex: 1, position: 'relative' }}>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              autoSize={{ minRows: 1, maxRows: 3 }}
              disabled={loading}
              style={{ borderRadius: 20, paddingRight: 44, paddingTop: 8 }}
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={sendMessage}
              disabled={(!input.trim() && pendingImages.length === 0) || loading}
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
        </div>
      </div>
    </div>
  );
}
