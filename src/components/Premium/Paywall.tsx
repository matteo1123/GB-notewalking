import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Star, Zap, LogIn } from 'lucide-react';

const Paywall = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-8">
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
            <Card className="text-center">
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

            <Card className="text-center">
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

            <Card className="text-center">
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
          <div className="space-y-4">
            <Link to="/auth">
              <Button
                size="lg"
                className="text-lg px-8 py-6 flex items-center gap-2"
              >
                <LogIn className="h-5 w-5" />
                Sign In to Access Premium Features
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Create an account to access premium guitar training tools
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paywall;