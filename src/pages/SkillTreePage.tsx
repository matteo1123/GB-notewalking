import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { SkillTree } from '@/components/SkillTree';
import { ForceLandscapeWrapper } from '@/components/ForceLandscapeWrapper';
import { isPurchasedAtom } from '@/state/skillTreeAtoms';

const SkillTreePage = () => {
  const purchased = useAtomValue(isPurchasedAtom);
  const navigate = useNavigate();

  useEffect(() => {
    if (!purchased) navigate('/unlock', { replace: true });
  }, [purchased, navigate]);

  if (!purchased) return null;
  return (
    <ForceLandscapeWrapper>
      <SkillTree />
    </ForceLandscapeWrapper>
  );
};

export default SkillTreePage;
