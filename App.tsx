
import React, { useState, useCallback, useEffect } from 'react';
import Scene from './components/Scene';
import HandTracker from './components/HandTracker';
import { UploadedFile, HandData } from './types';
import { getSpatialInsight } from './services/geminiService';
import { Upload, Hand, Info, RotateCcw, Box, Image as ImageIcon } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [handData, setHandData] = useState<HandData | null>(null);
  const [isTrackerActive, setIsTrackerActive] = useState(false);
  const [insight, setInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

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

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col font-sans selection:bg-blue-500/30">
      {/* Header UI */}
      <header className="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1 pointer-events-auto">
          <h1 className="text-3xl font-black tracking-tighter text-white bg-clip-text">
            GESTURE<span className="text-blue-500">LAB</span>
          </h1>
          <p className="text-zinc-500 text-sm font-medium">SPATIAL MANIPULATION INTERFACE</p>
        </div>

        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          <label className="group flex items-center gap-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-500/50 backdrop-blur-xl px-4 py-2.5 rounded-full cursor-pointer transition-all active:scale-95 shadow-lg">
            <Upload className="w-4 h-4 text-zinc-400 group-hover:text-blue-400" />
            <span className="text-sm font-semibold">Upload Asset</span>
            <input type="file" className="hidden" accept=".glb,.gltf,image/*" onChange={handleFileUpload} />
          </label>
          
          <button 
            onClick={() => setIsTrackerActive(!isTrackerActive)}
            className={`flex items-center gap-3 border backdrop-blur-xl px-4 py-2.5 rounded-full transition-all active:scale-95 shadow-lg ${
              isTrackerActive 
                ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <Hand className={`w-4 h-4 ${isTrackerActive ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-semibold">{isTrackerActive ? 'Tracking Active' : 'Start Hand Tracking'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        <Scene file={file} handData={isTrackerActive ? handData : null} />
        
        {/* Instruction Overlay */}
        {!file && (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
            <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="mx-auto w-24 h-24 rounded-3xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center shadow-2xl">
                <Box className="w-10 h-10 text-zinc-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">No Asset Loaded</h2>
                <p className="text-zinc-500 text-sm">Upload a .GLB 3D model or an image to begin the gesture control session.</p>
              </div>
            </div>
          </div>
        )}

        {/* Gemini Insight Panel */}
        {file && (
          <div className="absolute bottom-8 left-8 max-w-sm z-20 animate-in slide-in-from-left duration-700">
            <div className="bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-2xl rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Info className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase tracking-widest">AI Spatial Insight</h3>
              </div>
              
              {isLoadingInsight ? (
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-800 rounded animate-pulse w-full" />
                  <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
                </div>
              ) : (
                <p className="text-zinc-300 text-sm leading-relaxed italic">
                  "{insight}"
                </p>
              )}

              <div className="mt-6 pt-6 border-t border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {file.type === '3d' ? (
                    <Box className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="text-xs font-mono text-zinc-500 truncate max-w-[120px]">{file.name}</span>
                </div>
                <button 
                  onClick={() => fetchInsight(file)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Hand Tracker Overlay */}
      <HandTracker isActive={isTrackerActive} onHandUpdate={onHandUpdate} />

      {/* Controls Help */}
      {isTrackerActive && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-950/90 border border-zinc-800 backdrop-blur-xl rounded-full flex items-center gap-8 shadow-2xl z-20 animate-in slide-in-from-bottom duration-500">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center">
                <span className="text-[10px] font-bold text-blue-400">01</span>
              </div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-tighter">Pinch to Move</span>
           </div>
           <div className="w-px h-4 bg-zinc-800" />
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center">
                <span className="text-[10px] font-bold text-blue-400">02</span>
              </div>
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-tighter">Two Hands Zoom</span>
           </div>
        </div>
      )}

      {/* Glassmorphism Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-800/10 blur-[120px] rounded-full" />
      </div>
    </div>
  );
};

export default App;
