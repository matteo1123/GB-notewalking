import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RiffPractice from '@/components/RiffPractice';
import { RepertoireItem } from '@/types/repertoire';
import { useAuth } from '@/contexts/AuthContext';
import { Music, Star, Zap, Home, Crown, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample repertoire data
const sampleRepertoire: RepertoireItem[] = [
  {
    id: '1',
    name: 'C Major Scale',
    category: 'scale',
    difficulty: 'beginner',
    tempo: 80,
    description: 'Basic C major scale in first position',
    notes: [
      { time: 0.0, duration: 0.5, string: 5, fret: 3 },
      { time: 0.5, duration: 0.5, string: 4, fret: 2 },
      { time: 1.0, duration: 0.5, string: 3, fret: 0 },
      { time: 1.5, duration: 0.5, string: 3, fret: 2 },
      { time: 2.0, duration: 0.5, string: 2, fret: 0 },
      { time: 2.5, duration: 0.5, string: 2, fret: 1 },
      { time: 3.0, duration: 0.5, string: 2, fret: 3 },
      { time: 3.5, duration: 0.5, string: 1, fret: 0 },
    ]
  },
  {
    id: '2',
    name: 'Blues Riff in A',
    category: 'riff',
    difficulty: 'intermediate',
    tempo: 120,
    description: 'Classic blues riff in the key of A',
    notes: [
      { time: 0.0, duration: 0.25, string: 6, fret: 5 },
      { time: 0.25, duration: 0.25, string: 6, fret: 8 },
      { time: 0.5, duration: 0.5, string: 5, fret: 7 },
      { time: 1.0, duration: 0.25, string: 6, fret: 5 },
      { time: 1.25, duration: 0.25, string: 6, fret: 7 },
      { time: 1.5, duration: 0.5, string: 5, fret: 5 },
    ]
  },
  {
    id: '3',
    name: 'Em Arpeggio',
    category: 'arpeggio',
    difficulty: 'intermediate',
    tempo: 100,
    description: 'E minor arpeggio in open position',
    notes: [
      { time: 0.0, duration: 0.5, string: 6, fret: 0 },
      { time: 0.5, duration: 0.5, string: 4, fret: 2 },
      { time: 1.0, duration: 0.5, string: 3, fret: 0 },
      { time: 1.5, duration: 0.5, string: 2, fret: 0 },
      { time: 2.0, duration: 0.5, string: 1, fret: 0 },
    ]
  }
];

const Premium = () => {
  const { user } = useAuth();
  const [selectedRiff, setSelectedRiff] = useState<RepertoireItem | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header with navigation */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-4 w-4" />
              Back to Free Metronome
            </Link>
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Premium Guitar Training
              </h1>
            </div>
          </div>

          {/* Paywall */}
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-foreground">
                Unlock Advanced Practice Tools
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Take your guitar practice to the next level with repertoire-based training, 
                visual tablature, and structured practice sessions.
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
                    Track your improvement across different techniques 
                    and difficulty levels over time.
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
  }

  if (selectedRiff) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={() => setSelectedRiff(null)}
              className="flex items-center gap-2"
            >
              ← Back to Library
            </Button>
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-4 w-4" />
              Free Metronome
            </Link>
          </div>

          {/* Riff Practice */}
          <RiffPractice 
            repertoireItem={selectedRiff}
            onComplete={() => setSelectedRiff(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Premium Guitar Training
            </h1>
          </div>
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="h-4 w-4" />
            Free Metronome
          </Link>
        </div>

        {/* Content */}
        <Tabs defaultValue="riffs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="riffs">Riffs & Licks</TabsTrigger>
            <TabsTrigger value="scales">Scales</TabsTrigger>
            <TabsTrigger value="arpeggios">Arpeggios</TabsTrigger>
            <TabsTrigger value="sessions">Practice Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="riffs" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sampleRepertoire.filter(item => item.category === 'riff').map(item => (
                <Card key={item.id} className="cursor-pointer hover:bg-card/80 transition-colors" onClick={() => setSelectedRiff(item)}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {item.name}
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                        item.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {item.difficulty}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm mb-2">{item.description}</p>
                    <p className="text-sm font-mono">{item.tempo} BPM</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scales" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sampleRepertoire.filter(item => item.category === 'scale').map(item => (
                <Card key={item.id} className="cursor-pointer hover:bg-card/80 transition-colors" onClick={() => setSelectedRiff(item)}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {item.name}
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                        item.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {item.difficulty}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm mb-2">{item.description}</p>
                    <p className="text-sm font-mono">{item.tempo} BPM</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="arpeggios" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sampleRepertoire.filter(item => item.category === 'arpeggio').map(item => (
                <Card key={item.id} className="cursor-pointer hover:bg-card/80 transition-colors" onClick={() => setSelectedRiff(item)}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {item.name}
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                        item.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {item.difficulty}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm mb-2">{item.description}</p>
                    <p className="text-sm font-mono">{item.tempo} BPM</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4">Practice Sessions Coming Soon</h3>
              <p className="text-muted-foreground">
                Structured practice routines that automatically guide you through multiple exercises.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Premium;