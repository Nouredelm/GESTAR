
import React, { useState, useCallback } from 'react';
import Scene from './components/Scene';
import HandTracker from './components/HandTracker';
import VoiceController from './components/VoiceController';
import { UploadedFile, HandData, VoiceTransform } from './types';
import { getSpatialInsight } from './services/geminiService';
import { Upload, Hand, Info, RotateCcw, Box, Image as ImageIcon, Volume2 } from 'lucide-react';

const INITIAL_VOICE_TRANSFORM: VoiceTransform = {
  scaleFactor: 1,
  rotationOffset: [0, 0, 0],
  positionOffset: [0, 0, 0],
  animation: 'none'
};

const App: React.FC = () => {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [handData, setHandData] = useState<HandData | null>(null);
  const [isTrackerActive, setIsTrackerActive] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceTransform, setVoiceTransform] = useState<VoiceTransform>(INITIAL_VOICE_TRANSFORM);
  const [insight, setInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      const is3d = uploadedFile.name.endsWith('.glb') || uploadedFile.name.endsWith('.gltf');
      const newFile: UploadedFile = {
        url,
        name: uploadedFile.name,
        type: is3d ? '3d' : 'image',
      };
      setFile(newFile);
      fetchInsight(newFile);
    }
  };

  const fetchInsight = async (f: UploadedFile) => {
    setIsLoadingInsight(true);
    const text = await getSpatialInsight(f.name, f.type);
    setInsight(text);
    setIsLoadingInsight(false);
  };

  const onHandUpdate = useCallback((data: HandData) => {
    setHandData(data);
  }, []);

  const updateVoiceTransform = (update: Partial<VoiceTransform>) => {
    setVoiceTransform(prev => ({ ...prev, ...update }));
  };

  const resetAll = useCallback(() => {
    setVoiceTransform(INITIAL_VOICE_TRANSFORM);
    setResetToken(t => t + 1);
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col font-sans selection:bg-blue-500/30">
      <header className="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1 pointer-events-auto">
          <h1 className="text-3xl font-black tracking-tighter text-white">
            GESTR<span className="text-blue-500">.</span>
          </h1>
          <div className="flex items-center gap-3">
            <p className="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">Spatial Interface v2.5</p>
            <VoiceController 
              isActive={isVoiceActive} 
              onTransformUpdate={updateVoiceTransform}
              onReset={resetAll}
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          <div className="flex gap-2">
            <button 
              onClick={() => setIsVoiceActive(!isVoiceActive)}
              className={`p-2.5 rounded-full border backdrop-blur-xl transition-all shadow-lg ${
                isVoiceActive ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
              title="Toggle Voice Control"
            >
              <Volume2 className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setIsTrackerActive(!isTrackerActive)}
              className={`p-2.5 rounded-full border backdrop-blur-xl transition-all shadow-lg ${
                isTrackerActive ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
              title="Toggle Hand Tracking"
            >
              <Hand className="w-5 h-5" />
            </button>
          </div>

          <label className="group flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 hover:border-blue-500/50 backdrop-blur-xl px-5 py-2.5 rounded-full cursor-pointer transition-all active:scale-95 shadow-lg">
            <Upload className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-bold text-white">Load Asset</span>
            <input type="file" className="hidden" accept=".glb,.gltf,image/*" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      <main className="flex-1 relative">
        <Scene 
          file={file} 
          handData={isTrackerActive ? handData : null} 
          voiceTransform={voiceTransform} 
          resetToken={resetToken}
        />
        
        {!file && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="max-w-md w-full text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                <Box className="w-8 h-8 text-zinc-600" />
              </div>
              <h2 className="text-xl font-bold text-zinc-400">Waiting for Asset</h2>
            </div>
          </div>
        )}

        {file && (
          <div className="absolute bottom-8 left-8 max-w-sm z-20">
            <div className="bg-zinc-950/90 border border-zinc-800 backdrop-blur-2xl rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-white text-xs uppercase tracking-widest">AI Insight</h3>
              </div>
              <p className="text-zinc-400 text-sm italic leading-relaxed">
                {isLoadingInsight ? "Analyzing..." : insight}
              </p>
            </div>
          </div>
        )}
      </main>

      <HandTracker isActive={isTrackerActive} onHandUpdate={onHandUpdate} />

      {/* Control Help Hud */}
      {(isTrackerActive || isVoiceActive) && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 bg-zinc-950/80 border border-zinc-800 backdrop-blur-2xl rounded-2xl flex items-center gap-12 shadow-2xl z-20">
           <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-blue-500 uppercase">Gesture</span>
              <span className="text-[11px] text-zinc-300">Pinch: Move | Palm: Spin | Fist: Recenter</span>
           </div>
           <div className="w-px h-8 bg-zinc-800" />
           <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-red-500 uppercase">Voice</span>
              <span className="text-[11px] text-zinc-300">"Go left" | "Bounce" | "Recenter"</span>
           </div>
        </div>
      )}

      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(circle_at_50%_50%,#111,black)]" />
    </div>
  );
};

export default App;
