import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TitleBar from '../../components/TitleBar/TitleBar';
import { getStudyInfoAndImageIds } from '../../../services/study/StudyService';
import { Loader2, Plus } from 'lucide-react';
import studyConfigs from '../../../studies.json';

interface StudyConfig {
  studyId: string;
  stackId: string;
}

interface StudyRow {
  studyId: string;
  stackId: string;
  patientName: string;
  patientId: string;
  modality: string;
  imageCount: number;
  loading: boolean;
  error?: string;
}

function makeLoadingRow(config: StudyConfig): StudyRow {
  return {
    studyId: config.studyId,
    stackId: config.stackId,
    patientName: '',
    patientId: '',
    modality: '',
    imageCount: 0,
    loading: true,
  };
}

export default function Worklist() {
  const [rows, setRows] = useState<StudyRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formStudyId, setFormStudyId] = useState('');
  const [formStackId, setFormStackId] = useState('');
  const navigate = useNavigate();

  const fetchAndUpdateRow = useCallback(
    async (config: StudyConfig, index: number) => {
      try {
        const { studyInfo, imageIds } = await getStudyInfoAndImageIds(
          config.studyId,
          config.stackId
        );
        setRows((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            patientName: studyInfo.patientName || 'Unknown',
            patientId: studyInfo.patientId || '',
            modality: studyInfo.modality || '',
            imageCount: imageIds.length,
            loading: false,
          };
          return next;
        });
      } catch (err) {
        console.error(`Failed to fetch StudyDoc for ${config.studyId}:`, err);
        setRows((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            patientName: 'Error loading',
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          };
          return next;
        });
      }
    },
    []
  );

  useEffect(() => {
    const configs = studyConfigs as StudyConfig[];
    const initialRows = configs.map(makeLoadingRow);
    setRows(initialRows);
    configs.forEach((config, index) => fetchAndUpdateRow(config, index));
  }, [fetchAndUpdateRow]);

  const handleAddStudy = () => {
    const studyId = formStudyId.trim();
    const stackId = formStackId.trim();
    if (!studyId || !stackId) return;

    const config: StudyConfig = { studyId, stackId };
    setRows((prev) => {
      const newRows = [...prev, makeLoadingRow(config)];
      fetchAndUpdateRow(config, newRows.length - 1);
      return newRows;
    });

    setFormStudyId('');
    setFormStackId('');
    setShowForm(false);
  };

  const handleStudyClick = (row: StudyRow) => {
    if (row.loading || row.error) return;
    navigate(`/view/${row.studyId}`, { state: { studyId: row.studyId, stackId: row.stackId } });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TitleBar title="iSyntax Viewer" />
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-200">Study Worklist</h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Study
            </button>
          )}
        </div>

        {showForm && (
          <div className="mb-4 flex items-end gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Study ID</label>
              <input
                type="text"
                value={formStudyId}
                onChange={(e) => setFormStudyId(e.target.value)}
                placeholder="e.g. 2.16.840.1.114151..."
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Stack ID</label>
              <input
                type="text"
                value={formStackId}
                onChange={(e) => setFormStackId(e.target.value)}
                placeholder="e.g. PR3"
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleAddStudy}
              disabled={!formStudyId.trim() || !formStackId.trim()}
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setShowForm(false); setFormStudyId(''); setFormStackId(''); }}
              className="px-4 py-1.5 rounded-md border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60 text-gray-300">
                <th className="text-left px-4 py-3 font-medium">Patient Name</th>
                <th className="text-left px-4 py-3 font-medium">Patient ID</th>
                <th className="text-left px-4 py-3 font-medium">Study ID</th>
                <th className="text-left px-4 py-3 font-medium">Stack</th>
                <th className="text-left px-4 py-3 font-medium">Modality</th>
                <th className="text-left px-4 py-3 font-medium">Images</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.studyId}-${row.stackId}-${index}`}
                  onClick={() => handleStudyClick(row)}
                  className={`border-t border-gray-800 transition-colors ${
                    row.loading || row.error
                      ? 'opacity-50 cursor-wait'
                      : 'hover:bg-gray-800/40 cursor-pointer'
                  }`}
                >
                  <td className="px-4 py-3 text-gray-200">
                    {row.loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-blue-400" />
                        <span className="text-gray-500">Loading...</span>
                      </span>
                    ) : (
                      row.patientName
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{row.patientId}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.studyId}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.stackId}</td>
                  <td className="px-4 py-3">
                    {row.modality && (
                      <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 text-xs font-medium">
                        {row.modality}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {row.loading ? '...' : row.imageCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="mt-auto px-4 py-3 text-center text-xs text-gray-500 border-t border-gray-800">
        Proof of Concept — Demo purpose only
      </footer>
    </div>
  );
}
