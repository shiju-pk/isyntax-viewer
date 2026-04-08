import { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Worklist from './pages/worklist/Worklist';
import ViewerPage from './pages/viewer/ViewerPage';
import LoginPage from './pages/login/LoginPage';
import { PACSProvider, usePACS } from './context/PACSContext';
import type { PACSContextValue } from './context/PACSContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeatureFlagService } from '../core/capabilities/FeatureFlagService';
import type { AppConfig } from '../core/config/AppConfig';
import { ToastProvider } from './components/ToastNotification';
import { registerBackendProvider, getBackendProvider } from '../adapters/BackendProvider';
import { CompositeAdapter } from '../adapters/CompositeAdapter';
import { ISyntaxProvider } from '../adapters/isyntax/ISyntaxProvider';
import { MockProvider } from '../adapters/mock/MockProvider';
import { ISPACSProvider } from '../adapters/ispacs/ISPACSProvider';

// Register backend providers once at module load
registerBackendProvider(ISyntaxProvider);
registerBackendProvider(ISPACSProvider);
registerBackendProvider(MockProvider);

/**
 * Route guard: redirects to /login when authEnabled and not authenticated.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { adapter, config } = usePACS();
  if (config.authEnabled && !adapter.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App({ config }: { config: AppConfig }) {
  const pacsValue = useMemo<PACSContextValue>(() => {
    const provider = getBackendProvider(config.adapterType);
    const endpoints = config.serviceEndpoints;

    const adapter = new CompositeAdapter({
      name: provider.name,
      auth: provider.createAuthService(endpoints),
      worklist: provider.createWorklistService(endpoints),
      study: provider.createStudyService(endpoints),
      imaging: provider.createImagingService(endpoints),
      persistence: provider.createPersistenceService?.(endpoints),
    });

    const features = new FeatureFlagService(adapter.getCapabilities());
    return { adapter, features, config };
  }, [config]);

  return (
    <ErrorBoundary>
      <PACSProvider value={pacsValue}>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<RequireAuth><Worklist /></RequireAuth>} />
              <Route path="/view/:studyId" element={<RequireAuth><ViewerPage /></RequireAuth>} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </PACSProvider>
    </ErrorBoundary>
  );
}

export default App;
