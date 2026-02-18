import { useParams, Navigate } from 'react-router-dom';
import PlateAnnotator from '@/components/embryoscore/PlateAnnotator';

export default function QuickClassifyPage() {
  const { queueId } = useParams();
  if (!queueId) return <Navigate to="/bancada" />;
  return <PlateAnnotator queueId={queueId} />;
}
