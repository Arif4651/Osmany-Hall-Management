import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { portalService } from '../services/portalService';

const EMPTY_STATE = {
  stats: [],
  bills: [],
  payments: [],
  notifications: [],
};

export default function useStudentPortalData() {
  const { user, isSessionLoading } = useAuth();
  const [state, setState] = useState(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadState = useCallback(async () => {
    if (!user?.studentId) {
      setState(EMPTY_STATE);
      setErrorMessage('Student account information is not available.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const nextState = await portalService.getStudentPortalData(user.studentId);
      setState(nextState);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load student data.');
      setState(EMPTY_STATE);
    } finally {
      setIsLoading(false);
    }
  }, [user?.studentId]);

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    loadState();
  }, [isSessionLoading, loadState]);

  return {
    isLoading: isSessionLoading || isLoading,
    errorMessage,
    studentId: user?.studentId || null,
    dashboardStats: state.stats,
    bills: state.bills,
    payments: state.payments,
    notifications: state.notifications,
    reload: loadState,
  };
}