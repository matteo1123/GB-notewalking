import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RepertoireItem } from '@/types/repertoire';
import { supabase } from '@/integrations/supabase/client';

interface ExerciseHierarchyProps {
  currentExercise: RepertoireItem;
  onExerciseSelect: (exercise: RepertoireItem) => void;
}

const ExerciseHierarchy = ({ currentExercise, onExerciseSelect }: ExerciseHierarchyProps) => {
  const [parentExercise, setParentExercise] = useState<RepertoireItem | null>(null);
  const [childExercises, setChildExercises] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadHierarchy = async () => {
      setLoading(true);
      
      // Load parent if current exercise has one
      if (currentExercise.parent) {
        const { data: parentData } = await supabase
          .from('exercises')
          .select('*')
          .eq('id', currentExercise.parent)
          .single();
        
        if (parentData) {
          const row = parentData as any;
          setParentExercise({
            id: row.id,
            name: row.name,
            category: row.type as RepertoireItem['category'],
            difficulty: row.Difficulty,
            description: row.description ?? undefined,
            notes: (row.notes as any) ?? [],
            notes_per_beat: row.notes_per_beat,
            tonic: row.Tonic,
            tonality: row.Tonality,
            position: row.Position,
            parent: row.Parent,
          });
        }
      }

      // Load children of current exercise OR parent
      const parentId = currentExercise.parent || currentExercise.id;
      try {
        const { data: childrenData } = await (supabase as any)
          .from('exercises')
          .select('*')
          .eq('Parent', parentId)
          .neq('id', currentExercise.id);

      if (childrenData) {
        const mappedChildren = (childrenData as any[]).map((row: any) => ({
          id: row.id,
          name: row.name,
          category: row.type,
          difficulty: row.Difficulty,
          description: row.description ?? undefined,
          notes: row.notes ?? [],
          notes_per_beat: row.notes_per_beat,
          tonic: row.Tonic,
          tonality: row.Tonality,
          position: row.Position,
          parent: row.Parent,
        }));
        setChildExercises(mappedChildren as any);
      }
      } catch (error) {
        console.error('Error loading hierarchy:', error);
      }

      setLoading(false);
    };

    loadHierarchy();
  }, [currentExercise]);

  // Don't show if no parent and no children
  if (!loading && !parentExercise && childExercises.length === 0) {
    return null;
  }

  const isCurrentExerciseChild = currentExercise.parent !== null;
  const displayParent = parentExercise || currentExercise;

  return (
    <Card className="border-primary/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-card/80 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <CardTitle className="text-lg font-bold text-primary">
                  {displayParent.name}
                </CardTitle>
                {isCurrentExerciseChild && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Current: {currentExercise.name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {childExercises.length > 0 && (
                  <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                    {childExercises.length + 1} variations
                  </span>
                )}
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {/* Parent exercise button (if current is a child) */}
              {isCurrentExerciseChild && parentExercise && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto p-3"
                  onClick={() => onExerciseSelect(parentExercise)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">Base Scale</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        parentExercise.difficulty <= 3 ? 'bg-green-500/20 text-green-400' :
                        parentExercise.difficulty <= 7 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {parentExercise.difficulty}/10
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {parentExercise.tonic} {parentExercise.tonality} • Pos {parentExercise.position}
                    </div>
                  </div>
                </Button>
              )}

              {/* Current exercise (if it's the parent) */}
              {!isCurrentExerciseChild && (
                <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary/30">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-primary">Base Scale (Current)</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      currentExercise.difficulty <= 3 ? 'bg-green-500/20 text-green-400' :
                      currentExercise.difficulty <= 7 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {currentExercise.difficulty}/10
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {currentExercise.tonic} {currentExercise.tonality} • Pos {currentExercise.position}
                  </div>
                </div>
              )}

              {/* Child exercises */}
              {childExercises.map((child) => (
                <Button
                  key={child.id}
                  variant="outline"
                  className="w-full justify-start text-left h-auto p-3"
                  onClick={() => onExerciseSelect(child)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{child.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        child.difficulty <= 3 ? 'bg-green-500/20 text-green-400' :
                        child.difficulty <= 7 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {child.difficulty}/10
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {child.description || `${child.tonic} ${child.tonality} • Pos ${child.position}`}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ExerciseHierarchy;