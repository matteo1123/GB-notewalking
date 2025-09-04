import React from 'react';
import AudioSandbox from '@/components/AudioSandbox';

const AdminAudioSandbox = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Audio Sandbox</h1>
      <AudioSandbox />
    </div>
  );
};

export default AdminAudioSandbox;