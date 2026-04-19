import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NotewalkingExercise } from '@/components/NotewalkingExercise';
import { isPurchasedAtom } from '@/state/skillTreeAtoms';
import { SKILL_NODE_BY_ID, type NodeId } from '@/data/skillTree';

const PracticePage = () => {
  const purchased = useAtomValue(isPurchasedAtom);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (!purchased) navigate('/unlock', { replace: true });
  }, [purchased, navigate]);

  if (!purchased) return null;

  const raw = params.get('node');
  const initialNode =
    raw && SKILL_NODE_BY_ID[raw as NodeId] ? (raw as NodeId) : undefined;

  return <NotewalkingExercise initialNode={initialNode} />;
};

export default PracticePage;
