import useDocumentTitle from '../../hooks/useDocumentTitle';
import AdminStudentsPage from '../AdminStudentsPage';

export default function StudentManagement() {
  useDocumentTitle('Student Management');
  return <AdminStudentsPage />;
}
