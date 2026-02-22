import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Star, Zap, LogIn, CreditCard, Loader2 } from 'lucide-react';

interface PaywallProps {
  onSubscribe?: () => void;
  onBuyCourse?: () => void;
  isLoading?: boolean;
}

const Paywall = ({ onSubscribe, onBuyCourse, isLoading }: PaywallProps) => {
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <div className="max-w-4xl mx-auto space-y-8 w-full">
        <div className="text-center space-y-6">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-foreground">
              Unlock Advanced Practice Tools
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Take your guitar practice to the next level with
              repertoire-based training, visual tablature, and structured
              practice sessions.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
            <Card className="text-center h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <Music className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Repertoire Library</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Access hundreds of scales, arpeggios, riffs, and exercises
                  with visual tablature display.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Smart Practice Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Structured routines that automatically guide you through
                  exercises for maximum practice efficiency.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <Star className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle>Progress Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track your improvement across different techniques and
                  difficulty levels over time.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="space-y-4 pt-4">
            {onSubscribe ? (
              <div className="flex flex-col md:flex-row gap-4 justify-center items-center w-full">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 w-full md:w-auto min-w-[300px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl hover:scale-105 transition-transform"
                  onClick={onSubscribe}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                  Upgrade to Premium ($29.99/mo)
                </Button>
                {onBuyCourse && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-6 w-full md:w-auto min-w-[300px] border-2 border-indigo-600 text-indigo-400 hover:bg-indigo-600/10 hover:scale-105 transition-transform"
                    onClick={onBuyCourse}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Star className="mr-2 h-5 w-5" />}
                    Buy Course + 3 Months ($179.99)
                  </Button>
                )}
              </div>
            ) : (
              <Link to="/auth">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 w-full md:w-auto min-w-[300px] flex items-center justify-center gap-2"
                >
                  <LogIn className="h-5 w-5" />
                  Sign In to Access Premium Features
                </Button>
              </Link>
            )}

            <p className="text-sm text-muted-foreground mt-4">
              {onSubscribe ? "Secure checkout powered by Stripe. Premium cancels anytime." : "Create an account to access premium guitar training tools"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paywall;