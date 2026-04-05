import { useEffect, useState, useCallback } from 'react';
import { Card, Progress, Button, Spin, Typography, Tag, Space, Empty } from 'antd';
import { MessageOutlined, CheckCircleOutlined, FireOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { designTokens } from '../../designTokens';
import ReadingLabMascotSvg from './ReadingLabMascotSvg';
import TutorSessionMascotSvg from './TutorSessionMascotSvg';

const { Title, Text } = Typography;

/**
 * @param {Error & { status?: number; code?: string }} e
 * @returns {string}
 */
function formatMissionLoadError(e) {
  const status = e?.status;
  const code = e?.code;
  if (status === 401 || code === 'Unauthorized') {
    return '未登录或令牌无效。请刷新页面；若无效，请确认后端已启动且 /api/auth/register-anonymous 可访问。';
  }
  if (code === 'mission_fetch_failed') {
    return '服务器生成任务失败（常见：数据库未迁移、用户记录缺失）。请查看 studybridge-server 控制台日志。';
  }
  const msg = e?.message || '';
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    e?.name === 'TypeError'
  ) {
    return '无法连接 API。请在本机运行 studybridge-server（默认端口 4000），并确认未把 REACT_APP_API_URL 设为 localhost（手机/局域网访问时会失败）。';
  }
  return msg || '请求失败';
}

function taskLeadingVisual(taskType, cfg) {
  if (taskType === 'vocab') {
    return <ReadingLabMascotSvg />;
  }
  if (taskType === 'tutor') {
    return <TutorSessionMascotSvg />;
  }
  if (cfg.icon) {
    return cfg.icon;
  }
  return <MessageOutlined style={{ color: designTokens.color.primary }} />;
}

const TASK_CONFIG = {
  vocab: {
    title: 'Reading & Language',
    desc: 'Short passage, AI chat, words from the text, and a quick exercise',
    link: '/language',
    btnText: 'Open Lab',
    btnColor: '#fd6c5b',
  },
  tutor: {
    title: 'Tutor Session',
    desc: 'Chat with your AI tutor (3+ turns)',
    link: '/tutor',
    btnText: 'Start Chat',
    btnColor: '#fec601',
  },
};

export default function TodayPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await api.getTodayMission();
      setData(res);
      if (res.user) {
        refreshUser({ xp: res.user.xp, streak: res.user.streak });
      }
    } catch (e) {
      console.error(e);
      setData(null);
      setLoadError(formatMissionLoadError(e));
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    load();
    api.trackEvent('page_view', { page: 'today' });
  }, [load]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <Empty
        description={
          <Space direction="vertical" size="small" style={{ maxWidth: 360 }}>
            <Text>无法加载今日任务</Text>
            {loadError ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {loadError}
              </Text>
            ) : null}
          </Space>
        }
      >
        <Button type="primary" onClick={() => load()}>
          重试
        </Button>
      </Empty>
    );
  }

  const { mission, user, rules } = data;
  const overallPercent = Math.round((mission.completionRate || 0) * 100);

  return (
    <div>
      <Card
        size="small"
        style={{ marginBottom: 16, borderRadius: designTokens.radius.md, backgroundColor: 'transparent', boxShadow: 'none', border: 'none' }}
        styles={{ body: { padding: 0 } }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={4} style={{ margin: '0 0 4px', fontSize: 28 }}>Shawn, let's study.</Title>
            <Text type="secondary">{mission.date}</Text>
          </div>
          <Progress
            type="circle"
            percent={overallPercent}
            size={64}
            strokeColor={rules?.missionComplete ? designTokens.color.success : designTokens.color.primary}
          />
        </Space>
        {rules?.missionComplete && (
          <Tag
            icon={<CheckCircleOutlined />}
            color="success"
            style={{ marginTop: 8 }}
          >
            Mission complete! +50 XP
          </Tag>
        )}
        {mission.checkInGranted && (
          <Tag icon={<FireOutlined />} color="warning" style={{ marginTop: 8 }}>
            Checked in · Streak {user.streak}
          </Tag>
        )}
      </Card>

      {mission.tasks.filter((task) => task.type !== 'math').map((task) => {
        const cfg = TASK_CONFIG[task.type] || TASK_CONFIG.tutor;
        const meta = task.meta || {};
        let percent = task.completed ? 100 : 0;
        let detail = '';

        if (task.type === 'vocab' && meta.passageEn) {
          let p = 0;
          if (meta.passageViewed) p += 25;
          p += Math.min(25, ((Number(meta.readingChatUserTurns) || 0) / 2) * 25);
          p += Math.min(25, ((meta.learnedWordIds || []).length / 6) * 25);
          if (meta.applicationComplete) p += 25;
          percent = task.completed ? 100 : Math.round(p);
          const t = Number(meta.readingChatUserTurns) || 0;
          const lw = (meta.learnedWordIds || []).length;
          detail = `chat ${t}/2+ · words ${lw}/6`;
        } else if (task.type === 'vocab' && meta.words) {
          const learned = (meta.learnedWordIds || []).length;
          const total = meta.words.length;
          percent = task.completed ? 100 : Math.round((learned / Math.max(1, total)) * 100);
          detail = `${learned}/${total} words`;
        }
        if (task.type === 'tutor') {
          const turns = meta.turns || 0;
          percent = task.completed ? 100 : Math.round(Math.min(1, turns / 3) * 100);
          detail = `${turns}/3 turns`;
        }

        const taskCardTheme = {
          radius: task.type === 'vocab'
            ? designTokens.radius.readingTaskCard
            : task.type === 'tutor'
              ? designTokens.radius.tutorTaskCard
              : designTokens.radius.md,
          bg: '#fff',
          border: '1px solid #E3E4E4',
          borderBottom: '4px solid #E3E4E4',
          shadow: 'none',
        };

        return (
          <Card
            key={task.id}
            size="small"
            hoverable
            onClick={() => navigate(cfg.link)}
            style={{
              marginBottom: 20,
              borderRadius: taskCardTheme.radius,
              cursor: 'pointer',
              boxShadow: taskCardTheme.shadow,
              backgroundColor: taskCardTheme.bg,
              borderWidth: '1px 1px 4px 1px',
              borderStyle: 'solid',
              borderColor: '#E3E4E4',
            }}
            styles={
              taskCardTheme.bg
                ? {
                    body: { backgroundColor: 'transparent', paddingLeft: 20, paddingRight: 20, paddingTop: 20, paddingBottom: 20 },
                  }
                : {
                    body: { paddingLeft: 20, paddingRight: 20, paddingTop: 20, paddingBottom: 20 },
                  }
            }
          >
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space align="start">
                {taskLeadingVisual(task.type, cfg)}
                <div>
                  <Text strong style={{ fontSize: 18 }}>{cfg.title}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.2 }}>
                    {task.completed ? 'Completed ✓' : cfg.desc}
                  </Text>
                  {detail && (
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      ({detail})
                    </Text>
                  )}
                </div>
              </Space>
              {!task.completed && (
                <Button
                  shape="circle"
                  size="large"
                  onClick={() => navigate(cfg.link)}
                  style={{ backgroundColor: cfg.btnColor, color: '#fff', border: 'none', fontWeight: 'bold' }}
                >
                  GO
                </Button>
              )}
              {task.completed && (
                <CheckCircleOutlined
                  style={{ fontSize: 24, color: designTokens.color.success }}
                />
              )}
            </Space>
            <Progress
              percent={percent}
              showInfo={false}
              strokeColor={task.completed ? designTokens.color.success : designTokens.color.primary}
              style={{ marginTop: 8 }}
              size="small"
            />
          </Card>
        );
      })}
    </div>
  );
}
