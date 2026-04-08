import { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Worklist from './pages/worklist/Worklist';
import ViewerPage from './pages/viewer/ViewerPage';
import LoginPage from './pages/login/LoginPage';
import { PACSProvider } from './context/PACSContext';
import type { PACSContextValue } from './context/PACSContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ISyntaxPACSAdapter } from '../adapters/isyntax/ISyntaxPACSAdapter';
import { FeatureFlagService } from '../core/capabilities/FeatureFlagService';
import { DEFAULT_CONFIG } from '../core/config/AppConfig';
import { ToastProvider } from './components/ToastNotification';

function App() {
  const pacsValue = useMemo<PACSContextValue>(() => {
    const adapter = new ISyntaxPACSAdapter();
    const features = new FeatureFlagService(adapter.getCapabilities());
    return { adapter, features, config: DEFAULT_CONFIG };
  }, []);

  return (
    <ErrorBoundary>
      <PACSProvider value={pacsValue}>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Worklist />} />
              <Route path="/view/:studyId" element={<ViewerPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </PACSProvider>
    </ErrorBoundary>
  );
}

export default App;
