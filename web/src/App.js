import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import { AuthProvider, useAuth } from './context/AuthContext';
import { designTokens } from './designTokens';
import StudyLayout from './layouts/StudyLayout';
import TodayPage from './pages/studybridge/TodayPage';
import TutorPage from './pages/studybridge/TutorPage';
import LanguagePage from './pages/studybridge/LanguagePage';
import RecordsPage from './pages/studybridge/RecordsPage';

const routerBasename = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

const antdTheme = {
  token: {
    colorPrimary: designTokens.color.primary,
    colorInfo: designTokens.color.info,
    colorSuccess: designTokens.color.success,
    colorError: designTokens.color.error,
    colorTextBase: designTokens.color.text.primary,
    borderRadius: designTokens.radius.md,
  },
};

function AuthGate({ children }) {
  const { ready } = useAuth();
  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
  return children;
}

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <AuthProvider>
        <BrowserRouter basename={routerBasename || undefined}>
          <AuthGate>
            <Routes>
              <Route element={<StudyLayout />}>
                <Route path="/" element={<TodayPage />} />
                <Route path="/photo" element={<Navigate to="/tutor" replace />} />
                <Route path="/tutor" element={<TutorPage />} />
                <Route path="/language" element={<LanguagePage />} />
                <Route path="/records" element={<RecordsPage />} />
              </Route>
            </Routes>
          </AuthGate>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
