import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TitleBar from '../../components/TitleBar/TitleBar';
import { Loader2, Search, RefreshCw } from 'lucide-react';
import { usePACS } from '../../context/PACSContext';
import type { WorklistEntry } from '../../../adapters/IPACSAdapter';
import { CompositeAdapter } from '../../../adapters/CompositeAdapter';

/** Module-level cache so navigating back renders instantly. */
let cachedEntries: WorklistEntry[] | null = null;

export default function Worklist() {
  const [entries, setEntries] = useState<WorklistEntry[]>(cachedEntries ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [loadingExamKey, setLoadingExamKey] = useState<string | null>(null);
  const navigate = useNavigate();
  const { adapter, config } = usePACS();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep module cache in sync
  useEffect(() => { cachedEntries = entries; }, [entries]);

  // ─── Fetch worklist from PACS ──────────────────────────────────
  const fetchWorklist = useCallback(
    async (search?: string) => {
      setLoading(true);
      setError(null);
      try {
        let results: WorklistEntry[];
        if (search && search.trim()) {
          // Use quickSearch if available, otherwise examSearch with patient name
          if (adapter instanceof CompositeAdapter && adapter.worklistService.quickSearch) {
            results = await adapter.worklistService.quickSearch(search.trim());
          } else {
            results = await adapter.queryWorklist({ patientName: search.trim() });
          }
        } else {
          // Default: fetch recent exams (empty query = all, limited by maxResults)
          results = await adapter.queryWorklist({ maxResults: 200 });
        }
        setEntries(results);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [adapter],
  );

  // Initial load
  useEffect(() => {
    if (cachedEntries && cachedEntries.length > 0) return;
    fetchWorklist();
  }, [fetchWorklist]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchText(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        fetchWorklist(value);
      }, 400);
    },
    [fetchWorklist],
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleRefresh = () => {
    fetchWorklist(searchText);
  };

  const handleRowClick = useCallback(
    async (entry: WorklistEntry) => {
      if (loadingExamKey) return; // Prevent double-click

      // For ISPACS: resolve ExamKey → StudyUid + StudyStackUid via ExamStudies query
      if (adapter instanceof CompositeAdapter && adapter.worklistService.getExamStudies) {
        setLoadingExamKey(entry.examKey);
        setError(null);
        try {
          const studies = await adapter.getExamStudies(entry.examKey);
          if (studies.length === 0) {
            setError(`No studies found for exam ${entry.examKey}`);
            return;
          }
          const study = studies[0];
          navigate(`/view/${encodeURIComponent(study.studyUid)}?sid=${encodeURIComponent(study.studyStackUid)}`, {
            state: { studyId: study.studyUid, stackId: study.studyStackUid, examKey: entry.examKey },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Failed to load exam: ${msg}`);
        } finally {
          setLoadingExamKey(null);
        }
        return;
      }

      // Non-ISPACS: navigate directly with studyUID
      const studyId = entry.studyUIDs[0] ?? entry.examKey;
      navigate(`/view/${encodeURIComponent(studyId)}`, {
        state: { studyId, examKey: entry.examKey },
      });
    },
    [adapter, navigate, loadingExamKey],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    fetchWorklist(searchText);
  };

  const isISPACS = config.adapterType === 'ispacs';

  return (
    <div className="flex flex-col min-h-screen">
      <TitleBar title="iSyntax Viewer" />
      <div className="px-6 py-4">
        {/* Header + Search */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="text-xl font-semibold text-gray-200 shrink-0">
            {isISPACS ? 'Exam Worklist' : 'Study Worklist'}
          </h2>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by patient name, ID, or accession..."
                className="w-full rounded-md border border-gray-600 bg-gray-900 pl-9 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-md border border-gray-600 text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-40 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Loading indicator */}
        {loading && entries.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-blue-400">
            <Loader2 size={16} className="animate-spin" />
            <span>Loading worklist...</span>
          </div>
        )}

        {/* Table */}
        {(!loading || entries.length > 0) && (
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/60 text-gray-300">
                  <th className="text-left px-4 py-3 font-medium">Patient Name</th>
                  <th className="text-left px-4 py-3 font-medium">Patient ID</th>
                  <th className="text-left px-4 py-3 font-medium">Accession #</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Modality</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Images</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {searchText ? 'No results found.' : 'No exams found. Try searching by patient name or ID.'}
                    </td>
                  </tr>
                )}
                {entries.map((entry, index) => {
                  const isResolving = loadingExamKey === entry.examKey;
                  return (
                  <tr
                    key={`${entry.examKey}-${index}`}
                    onClick={() => handleRowClick(entry)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(entry);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    className={`border-t border-gray-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${
                      isResolving ? 'bg-blue-900/20 cursor-wait' : 'hover:bg-gray-800/40 cursor-pointer'
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-200">
                      {isResolving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-blue-400" />
                          <span>{entry.patientName || 'Loading...'}</span>
                        </span>
                      ) : (
                        entry.patientName || '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{entry.patientId || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{entry.accessionNumber || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{entry.studyDescription || '—'}</td>
                    <td className="px-4 py-3">
                      {entry.modality && (
                        <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 text-xs font-medium">
                          {entry.modality}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{entry.studyDate || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{entry.imageCount ?? '—'}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {loading && entries.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-blue-400 border-t border-gray-800">
                <Loader2 size={12} className="animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
        )}

        {/* Result count */}
        {!loading && entries.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            {entries.length} exam{entries.length !== 1 ? 's' : ''} found
          </div>
        )}
      </div>
      <footer className="mt-auto px-4 py-3 text-center text-xs text-gray-500 border-t border-gray-800">
        Proof of Concept — Demo purpose only
      </footer>
    </div>
  );
}
