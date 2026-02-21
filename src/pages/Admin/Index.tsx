import React from 'react';
import { Link } from 'react-router-dom';
import { useRecital } from '@/contexts/RecitalContext';
import { Button } from '@/components/ui/button';
import { RecitalScheduleEditor } from '@/components/RecitalScheduleEditor';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Radio } from 'lucide-react';

const AdminIndex = () => {
  const { activeRecital, startRecital, endRecital } = useRecital();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Page</h1>

      {/* Recital Controls */}
      <div className="mb-6 p-4 border rounded-lg space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Radio className="h-5 w-5" />
          Recital
        </h2>
        {activeRecital ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Recital is live
            </span>
            <Link to="/recital">
              <Button variant="outline" size="sm">Open Recital</Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">End Recital</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End the Recital?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will end the live recital and disconnect all participants.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={endRecital}>End Recital</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Radio className="h-4 w-4" />
                  Start Recital Now
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start a Live Recital?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will open a live recital that all signed-in users can join immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={startRecital}>Start</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <RecitalScheduleEditor />
          </div>
        )}
      </div>

      <ul>
        <li>
          <Link to="/admin/shape-library" className="text-blue-500 hover:underline">
            Shape Library
          </Link>
        </li>
        <li>
          <Link to="/admin/progression-editor" className="text-blue-500 hover:underline">
            Progression Editor
          </Link>
        </li>
        <li>
          <Link to="/admin/scale-sequence-editor" className="text-blue-500 hover:underline">
            Scale Sequence Editor
          </Link>
        </li>
        <li>
          <Link to="/admin/audio-sandbox" className="text-blue-500 hover:underline">
            Audio Sandbox
          </Link>
        </li>
        <li>
          <Link to="/admin/lesson-builder" className="text-blue-500 hover:underline">
            Lesson Builder
          </Link>
        </li>
        <li>
          <Link to="/admin/chord-trainer" className="text-blue-500 hover:underline">
            Chord Progression Trainer (New)
          </Link>
        </li>
        <li>
          <Link to="/admin/json-troubleshooter" className="text-blue-500 hover:underline">
            JSON Troubleshooter
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default AdminIndex;