import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { HALL_NAMES, STUDENT_LEVELS, STUDENT_STATUSES } from '../../types/student.types';

const EMPTY_UPDATE_FIELDS = {
  level: '',
  hallName: '',
  roomNo: '',
  status: '',
};

export default function BulkUpdateModal({
  isOpen,
  isPromotionOnly,
  isSubmitting,
  summary,
  onClose,
  onPreview,
}) {
  const [updateFields, setUpdateFields] = useState(EMPTY_UPDATE_FIELDS);

  useEffect(() => {
    if (isOpen) {
      setUpdateFields(EMPTY_UPDATE_FIELDS);
    }
  }, [isOpen]);

  const effectiveUpdateFields = useMemo(() => {
    if (isPromotionOnly) {
      return { level: updateFields.level };
    }

    return Object.fromEntries(Object.entries(updateFields).filter(([, value]) => Boolean(value)));
  }, [isPromotionOnly, updateFields]);

  const canProceed = Object.keys(effectiveUpdateFields).length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isPromotionOnly ? 'Bulk Level Promotion' : 'Bulk Update Students'}
      actions={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onPreview(effectiveUpdateFields)} disabled={!canProceed || isSubmitting}>
            Preview Update
          </Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <div className="student-summary-box">
          <p>Total matched students: {summary.totalMatched}</p>
          <p>Total selected students: {summary.totalSelected}</p>
          <p>Total excluded students: {summary.totalExcluded}</p>
        </div>

        <div className="form-grid" style={{ marginBottom: 0 }}>
          <label className="field-control">
            <span>Level / Year</span>
            <select value={updateFields.level} onChange={(event) => setUpdateFields((prev) => ({ ...prev, level: event.target.value }))}>
              <option value="">No change</option>
              {STUDENT_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>

          {!isPromotionOnly ? (
            <>
              <label className="field-control">
                <span>Hall Name</span>
                <select
                  value={updateFields.hallName}
                  onChange={(event) => setUpdateFields((prev) => ({ ...prev, hallName: event.target.value }))}
                >
                  <option value="">No change</option>
                  {HALL_NAMES.map((hallName) => (
                    <option key={hallName} value={hallName}>{hallName}</option>
                  ))}
                </select>
              </label>

              <label className="field-control">
                <span>Room No</span>
                <input
                  value={updateFields.roomNo}
                  onChange={(event) => setUpdateFields((prev) => ({ ...prev, roomNo: event.target.value }))}
                  placeholder="e.g. 210"
                />
              </label>

              <label className="field-control">
                <span>Status</span>
                <select
                  value={updateFields.status}
                  onChange={(event) => setUpdateFields((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="">No change</option>
                  {STUDENT_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
