import { useEffect } from 'react';
import { BRANDING } from '../constants/branding';

const APP_NAME = `${BRANDING.hallName} | ${BRANDING.universityShortName}`;

export default function useDocumentTitle(pageTitle) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
  }, [pageTitle]);
}