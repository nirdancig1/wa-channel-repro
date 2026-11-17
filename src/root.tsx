import { Outlet } from 'react-router';
import { Comments } from '@/components/ui/comments';

export default function Root() {
  return (
    <>
      <Outlet />
      <Comments />
    </>
  );
}