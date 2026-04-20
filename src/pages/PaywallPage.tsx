import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isPurchasedAtom } from '@/state/skillTreeAtoms';
import { Check } from 'lucide-react';

const features = [
  'The complete CAGED skill tree — 20 skills across all 5 shapes',
  'Notewalking practice: I–IV progressions in every key',
  'Pitch detection — see what you play, in real time',
  'Works offline. No subscription. Yours forever.',
];

const PaywallPage = () => {
  const [purchased, setPurchased] = useAtom(isPurchasedAtom);
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Unlock FretQuest</CardTitle>
          <CardDescription>One-time purchase. Lifetime access to the full app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="pt-2 flex flex-col gap-2">
            {purchased ? (
              <>
                <div className="rounded-md bg-primary/10 text-primary p-3 text-sm font-medium">
                  You own FretQuest. Enjoy.
                </div>
                <Button onClick={() => navigate('/')}>Continue</Button>
                <Button variant="ghost" size="sm" onClick={() => setPurchased(false)}>
                  Reset purchase (dev)
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  onClick={() => {
                    setPurchased(true);
                    navigate('/');
                  }}
                >
                  Unlock — $9.99 (dev bypass)
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Payment integration pending. Clicking unlocks locally for now.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaywallPage;
