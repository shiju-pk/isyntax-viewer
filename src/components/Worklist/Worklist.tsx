import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TitleBar from '../TitleBar/TitleBar';
import { getStudyInfoAndImageIds } from '../../lib/studyDocService';
import type { StudyInfo } from '../../lib/dicomMetadata';
import { Loader2 } from 'lucide-react';
import studyConfigs from '../../studies.json';

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

export default function Worklist() {
  const [rows, setRows] = useState<StudyRow[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const configs = studyConfigs as StudyConfig[];

    // Initialize rows with loading state
    setRows(
      configs.map((c) => ({
        studyId: c.studyId,
        stackId: c.stackId,
        patientName: '',
        patientId: '',
        modality: '',
        imageCount: 0,
        loading: true,
      }))
    );

    // Fetch StudyDoc for each study to get patient info + image count
    configs.forEach(async (config, index) => {
      try {
        const { studyInfo, imageIds } = await getStudyInfoAndImageIds(config.studyId, config.stackId);
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
    });
  }, []);

  const handleStudyClick = (row: StudyRow) => {
    if (row.loading || row.error) return;
    navigate(`/view/${row.studyId}`, { state: { studyId: row.studyId, stackId: row.stackId } });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TitleBar title="iSyntax Viewer" />
      <div className="px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-200 mb-4">Study Worklist</h2>
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
