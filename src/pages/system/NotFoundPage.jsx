import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Not Found');

  return (
    <div className="not-found-page">
      <h1>404</h1>
      <p>The page you requested does not exist or has been moved.</p>
      <Link to="/">
        <Button>Back to Home</Button>
      </Link>
    </div>
  );
}