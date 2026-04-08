import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn, Server, ChevronDown } from 'lucide-react';
import { usePACS } from '../../context/PACSContext';
import type { AuthenticationSource } from '../../../adapters/interfaces/IAuthService';
import { CompositeAdapter } from '../../../adapters/CompositeAdapter';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authSource, setAuthSource] = useState('');
  const [authSources, setAuthSources] = useState<AuthenticationSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { adapter, config } = usePACS();

  // ─── On mount: discover services → get auth sources ───────────
  useEffect(() => {
    let cancelled = false;

    async function initLoginFlow() {
      // Only run discovery/authSources for 'ispacs' adapter
      if (config.adapterType !== 'ispacs') {
        setReady(true);
        return;
      }

      if (!(adapter instanceof CompositeAdapter)) {
        setReady(true);
        return;
      }

      const auth = adapter.authService;
      if (!auth.discoverServices || !auth.getAuthenticationSources) {
        setReady(true);
        return;
      }

      setDiscovering(true);
      setError(null);

      try {
        // Step 1: Discover services
        await auth.discoverServices();

        if (cancelled) return;

        // Step 2: Get authentication sources
        const sources = await auth.getAuthenticationSources!();

        if (cancelled) return;

        setAuthSources(sources);
        // Default to first source or 'ISITE'
        const defaultSource = sources.find((s) => s.name === 'ISITE') ?? sources[0];
        if (defaultSource) {
          setAuthSource(defaultSource.name);
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            `Server unavailable: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } finally {
        if (!cancelled) {
          setDiscovering(false);
        }
      }
    }

    initLoginFlow();
    return () => {
      cancelled = true;
    };
  }, [adapter, config.adapterType]);

  // ─── Login handler ────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim()) return;

      setError(null);
      setLoading(true);
      try {
        const result = await adapter.authenticate({
          username: username.trim(),
          password,
          authSource: authSource || undefined,
        });
        if (result.success) {
          navigate('/', { replace: true });
        } else {
          setError(result.errorMessage ?? 'Authentication failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setLoading(false);
      }
    },
    [adapter, username, password, authSource, navigate],
  );

  const isISPACS = config.adapterType === 'ispacs';
  const loginDisabled = loading || discovering || !username.trim() || (isISPACS && !ready);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">iSyntax Viewer</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
          </div>

          {discovering && (
            <div className="flex items-center justify-center gap-2 mb-6 text-sm text-blue-400">
              <Loader2 size={14} className="animate-spin" />
              <span>Discovering services...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Auth Source dropdown — only visible for ISPACS with discovered sources */}
            {isISPACS && authSources.length > 0 && (
              <div>
                <label
                  htmlFor="authSource"
                  className="block text-xs font-medium text-gray-400 mb-1.5"
                >
                  <Server size={12} className="inline mr-1" />
                  Log On To
                </label>
                <div className="relative">
                  <select
                    id="authSource"
                    value={authSource}
                    onChange={(e) => setAuthSource(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 pr-8 text-sm text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  >
                    {authSources.map((src) => (
                      <option key={src.name} value={src.name}>
                        {src.displayName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium text-gray-400 mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                disabled={isISPACS && !ready}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-gray-400 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isISPACS && !ready}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800/50 px-3.5 py-2.5 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loginDisabled}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          {isISPACS ? 'IntelliSpace PACS' : 'Proof of Concept'} — {config.adapterType}
        </p>
      </div>
    </div>
  );
}
