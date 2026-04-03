import type { DicomImageMetadata, StudyInfo } from '../../../core/types';
import { X } from 'lucide-react';

interface MetadataPanelProps {
  studyInfo: StudyInfo | null;
  metadata: DicomImageMetadata | null;
  instanceUID: string;
  onClose: () => void;
  width: number;
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <tr className="border-t border-gray-800">
      <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{label}</td>
      <td className="px-3 py-1.5 text-gray-200 font-mono break-all">{String(value)}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider px-3 py-1.5 bg-gray-800/60">
        {title}
      </h4>
      <table className="w-full text-xs">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function MetadataPanel({ studyInfo, metadata, instanceUID, onClose, width }: MetadataPanelProps) {
  return (
    <div className="shrink-0 bg-gray-900/95 flex flex-col overflow-hidden" style={{ width }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200">DICOM Metadata</h3>
        <button
          onClick={onClose}
          aria-label="Close metadata panel"
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto text-xs">
        {studyInfo && (
          <Section title="Patient / Study">
            <Row label="Patient Name" value={studyInfo.patientName} />
            <Row label="Patient ID" value={studyInfo.patientId} />
            <Row label="Modality" value={studyInfo.modality} />
            <Row label="Study UID" value={studyInfo.studyInstanceUID} />
          </Section>
        )}

        <Section title="Instance">
          <Row label="SOP Instance UID" value={instanceUID} />
          <Row label="Series UID" value={metadata?.seriesUID} />
          <Row label="Modality" value={metadata?.modality} />
          <Row label="Image Number" value={metadata?.imageNumber} />
        </Section>

        {metadata && (
          <>
            <Section title="Image Pixel">
              <Row label="Rows" value={metadata.rows} />
              <Row label="Columns" value={metadata.columns} />
              <Row label="Bits Allocated" value={metadata.bitsAllocated} />
              <Row label="Bits Stored" value={metadata.bitsStored} />
              <Row label="High Bit" value={metadata.highBit} />
              <Row label="Pixel Representation" value={metadata.pixelRepresentation} />
              <Row label="Samples Per Pixel" value={metadata.samplesPerPixel} />
              <Row label="Photometric" value={metadata.photometricInterpretation} />
            </Section>

            <Section title="VOI / Modality LUT">
              <Row label="Window Width" value={metadata.windowWidth} />
              <Row label="Window Center" value={metadata.windowCenter} />
              <Row label="Rescale Slope" value={metadata.rescaleSlope} />
              <Row label="Rescale Intercept" value={metadata.rescaleIntercept} />
            </Section>

            {(metadata.pixelSpacing || metadata.imagePositionPatient || metadata.imageOrientationPatient) && (
              <Section title="Image Plane">
                {metadata.pixelSpacing && (
                  <Row label="Pixel Spacing" value={metadata.pixelSpacing.map(v => v.toFixed(4)).join(' \\ ')} />
                )}
                {metadata.imagePositionPatient && (
                  <Row label="Image Position" value={metadata.imagePositionPatient.map(v => v.toFixed(2)).join(' \\ ')} />
                )}
                {metadata.imageOrientationPatient && (
                  <Row label="Image Orientation" value={metadata.imageOrientationPatient.map(v => v.toFixed(4)).join(' \\ ')} />
                )}
              </Section>
            )}

            {metadata.iSyntaxPartitionDimension != null && (
              <Section title="iSyntax">
                <Row label="Partition Dimension" value={metadata.iSyntaxPartitionDimension} />
              </Section>
            )}
          </>
        )}

        {!metadata && (
          <div className="px-3 py-4 text-gray-500 text-center">
            No metadata available for this image.
          </div>
        )}
      </div>
    </div>
  );
}
