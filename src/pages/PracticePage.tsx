import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NotewalkingExercise } from '@/components/NotewalkingExercise';
import { usePurchaseStatus } from '@/hooks/usePurchaseStatus';
import { SKILL_NODE_BY_ID, type NodeId } from '@/data/skillTree';

const PracticePage = () => {
  const { purchased, isAuthLoaded } = usePurchaseStatus();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Wait for the auth state and Convex query to settle before redirecting —
  // otherwise a paying user momentarily reads `purchased: undefined` on
  // refresh and gets bounced to /unlock.
  useEffect(() => {
    if (!isAuthLoaded) return;
    if (purchased === undefined) return;
    if (!purchased) navigate('/unlock', { replace: true });
  }, [purchased, isAuthLoaded, navigate]);

  if (!isAuthLoaded || purchased === undefined) return null;
  if (!purchased) return null;

  const raw = params.get('node');
  const initialNode =
    raw && SKILL_NODE_BY_ID[raw as NodeId] ? (raw as NodeId) : undefined;

  return <NotewalkingExercise initialNode={initialNode} />;
};

export default PracticePage;
