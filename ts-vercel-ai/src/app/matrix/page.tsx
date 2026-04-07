import { redirect } from 'next/navigation';

export default function MatrixPage() {
  redirect('/security?tab=matrix');
}
