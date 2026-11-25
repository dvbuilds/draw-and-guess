import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui/index.js';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-12">
      <Card variant="elevated" className="text-center space-y-4">
        <p className="text-4xl font-black text-indigo-600">404</p>
        <h1 className="text-xl font-extrabold text-slate-900">Page Not Found</h1>
        <p className="text-sm text-slate-600">
          That sketch wandered off the canvas. Head back to the home page.
        </p>
        <div className="pt-2">
          <Link to="/">
            <Button variant="primary">Back to Home</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
