import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">This page doesn't exist or has moved.</p>
      <Link to="/" className="underline">Back to home</Link>
    </div>
  );
}