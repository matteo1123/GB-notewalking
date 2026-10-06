import { Link } from 'react-router-dom';
import { SkillTree } from '@/components/SkillTree';
import { ForceLandscapeWrapper } from '@/components/ForceLandscapeWrapper';

// The legal footer sits OUTSIDE ForceLandscapeWrapper on purpose: anything
// inside gets the 90° portrait rotation, which would stand the links on their
// side. Fixed + z-[60] so it clears the skill tree's own HUD layers (max z-50).
//
// This is the "/" route, i.e. the homepage Google's OAuth reviewer loads, and
// they require a visible Privacy Policy link there — /welcome having one is not
// enough. Don't remove it while the YouTube publishing scope is in review.
const LegalFooter = () => (
  <footer className="fixed bottom-0 inset-x-0 z-[60] pointer-events-none py-2 text-center">
    <span className="pointer-events-auto rounded-full bg-black/60 px-3 py-1 text-[11px] text-slate-300 backdrop-blur-sm">
      <Link to="/privacy" className="underline-offset-2 hover:text-white hover:underline">
        Privacy Policy
      </Link>
      {' · '}
      <Link to="/terms" className="underline-offset-2 hover:text-white hover:underline">
        Terms of Service
      </Link>
    </span>
  </footer>
);

const SkillTreePage = () => (
  <>
    <ForceLandscapeWrapper>
      <SkillTree />
    </ForceLandscapeWrapper>
    <LegalFooter />
  </>
);

export default SkillTreePage;
