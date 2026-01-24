import React from 'react';
import { Link } from 'react-router-dom';

const AdminIndex = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Page</h1>
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