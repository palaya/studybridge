/**
 * 设计 Token：页面与主题仅从此处引用颜色与圆角，禁止在组件内写死色值。
 */
export const designTokens = {
  color: {
    primary: 'rgba(0, 179, 251, 1)',
    info: 'rgba(0, 179, 251, 1)',
    success: '#00b280',
    error: '#f94346',
    text: {
      primary: '#272e3b',
      /** 筛选区标签按钮等次要图标 */
      secondary: '#576175',
      /** MasterGo DSL：「=」、占位等弱化文案 #A7ADBA */
      muted: '#a7adba',
      /** MasterGo RusSpHUK：弹窗标题 #000000 */
      modalTitle: '#000000',
      /** 禁用态文案（与 antd 链接触发器禁用色一致） */
      disabled: 'rgba(0, 0, 0, 0.25)',
    },
    /** MasterGo DSL：分割线等 #EBECF0 */
    border: {
      subtle: '#ebecf0',
      /** MasterGo RusSpHUK：Select 描边 #C9CDD4 */
      control: '#c9cdd4',
    },
    /**
     * 后台页面背景（iss-ui-style：色值只出现在本文件，页面引用 token）
     * 与 Ant Design 内容区常见灰底 / 白面板一致
     */
    bg: {
      page: '#f5f5f5',
      container: '#ffffff',
      /** StudyBridge Today：Math Problem 任务卡片背景 */
      mathTaskCard: '#BBCDF5',
      /** StudyBridge Today：Reading & Language 任务卡片背景 */
      readingTaskCard: '#FFB9BB',
      /** StudyBridge Today：Tutor Session 任务卡片背景 */
      tutorTaskCard: '#F5E8BB',
    },
  },
  /**
   * MasterGo RuA5UkuN（mcp__getDsl shortLink）：详情弹窗内音频条
   * paint_5754:064244 / paint_1:00659 / effect_5754:063835
   */
  audioPlayer: {
    surfaceGradient: 'linear-gradient(180deg, #fafafb 0%, #e9eaeb 98%)',
    railBg: '#f7f8fa',
    handleShadow: '0px 1px 4px 0px rgba(0, 0, 0, 0.4)',
  },
  /**
   * MasterGo RuACYB9n（mcp__getDsl）：详情字段区
   * paint_333:36118 启用；paint_5754:049312 原文件地址链接字色
   */
  fileDetail: {
    statusEnabled: '#10936b',
    linkText: '#3d3d3d',
  },
  /** MasterGo「标签筛选」等轻弹层 */
  shadow: {
    modal: '0 2px 8px rgba(0, 0, 0, 0.15)',
    /** MasterGo RusSpHUK「批量修改语种」effect_3142:77682 */
    modalBatch: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  /** 标签列：主标签药丸 + 溢出数字徽章 */
  tag: {
    pillBorder: '#d9d9d9',
    pillBg: '#ffffff',
    badgeBg: '#e6f7ff',
  },
  /** 页面留白（与 iss-ui-style 一致：间距集中定义，组件内不写死 px） */
  spacing: {
    lg: 24,
    md: 20,
  },
  radius: {
    md: 4,
    /** 药丸形标签左右圆角 */
    pill: 9999,
    /** 详情弹窗内音频条圆角（RuA5UkuN DSL 12px） */
    player: 12,
    /** StudyBridge Today：Math Problem 任务卡片 */
    mathTaskCard: 20,
    /** StudyBridge Today：Reading & Language 任务卡片 */
    readingTaskCard: 20,
    /** StudyBridge Today：Tutor Session 任务卡片 */
    tutorTaskCard: 20,
  },
};
