import React, { useState, useCallback, useEffect, useRef } from 'react';
import Scene from './components/Scene';
import HandTracker from './components/HandTracker';
import VoiceController from './components/VoiceController';
import { UploadedFile, HandData, VoiceTransform, AVAILABLE_COMMANDS } from './types';
import { getSpatialInsight } from './services/geminiService';
import { Upload, Hand, Info, RotateCcw, Box, Image as ImageIcon, Volume2, Sparkles, Terminal } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [handData, setHandData] = useState<HandData | null>(null);
  const [isTrackerActive, setIsTrackerActive] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [insight, setInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [lastCommand, setLastCommand] = useState<{ action: string, timestamp: number } | null>(null);
  
  const [voiceTransform, setVoiceTransform] = useState<VoiceTransform>({
    scale: 1,
    color: null,
    bounceTrigger: 0,
    resetTrigger: 0,
    rotationVelocity: 0,
  });

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

  const handleVoiceCommand = (action: string, value?: string) => {
    console.debug("Voice Command Received:", action, value);
    setLastCommand({ action, timestamp: Date.now() });
    
    switch (action) {
      case 'scale':
        const currentScale = voiceTransform.scale;
        const isBigger = value?.toLowerCase().includes('big') || 
                        value?.toLowerCase().includes('larger') || 
                        value?.toLowerCase().includes('up') ||
                        value?.toLowerCase().includes('more');
        const newScale = isBigger ? currentScale * 1.5 : currentScale * 0.7;
        setVoiceTransform(prev => ({ ...prev, scale: Math.max(0.1, Math.min(5, newScale)) }));
        break;
      case 'color':
        setVoiceTransform(prev => ({ ...prev, color: value || 'white' }));
        break;
      case 'bounce':
        setVoiceTransform(prev => ({ ...prev, bounceTrigger: Date.now() }));
        break;
      case 'recenter':
        setVoiceTransform(prev => ({ ...prev, scale: 1, color: null, resetTrigger: Date.now(), rotationVelocity: 0 }));
        break;
      case 'rotate':
        const isFast = value?.toLowerCase().includes('fast') || value?.toLowerCase().includes('quick');
        const isStop = value?.toLowerCase().includes('stop') || value?.toLowerCase().includes('none');
        setVoiceTransform(prev => ({ 
          ...prev, 
          rotationVelocity: isStop ? 0 : (isFast ? 0.1 : 0.03) 
        }));
        break;
      default:
        break;
    }

    // Auto-clear last command highlight
    setTimeout(() => {
      setLastCommand(prev => prev?.action === action ? null : prev);
    }, 2000);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col font-sans selection:bg-blue-500/30 text-zinc-100">
      {/* Header UI */}
      <header className="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1 pointer-events-auto group">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <Sparkles className="w-5 h-5 text-white" />
             </div>
             <h1 className="text-2xl font-black tracking-tighter text-white">
                GESTURE<span className="text-blue-500">LAB</span>
             </h1>
          </div>
          <p className="text-zinc-500 text-[10px] font-bold tracking-[0.2em] uppercase pl-10">Spatial Neural Interface</p>
        </div>

        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          <div className="flex items-center gap-3">
            <VoiceController 
              isActive={isVoiceActive} 
              onCommand={handleVoiceCommand} 
            />
            <button 
              onClick={() => setIsVoiceActive(!isVoiceActive)}
              title={isVoiceActive ? "Disable Voice Control" : "Enable Voice Control"}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 shadow-lg backdrop-blur-xl ${
                isVoiceActive ? 'bg-blue-500 border-blue-400 text-white' : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          <label className="group flex items-center gap-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-500/50 backdrop-blur-xl px-4 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 shadow-xl">
            <Upload className="w-4 h-4 text-zinc-400 group-hover:text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Upload Asset</span>
            <input type="file" className="hidden" accept=".glb,.gltf,image/*" onChange={handleFileUpload} />
          </label>
          
          <button 
            onClick={() => setIsTrackerActive(!isTrackerActive)}
            className={`flex items-center gap-3 border backdrop-blur-xl px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-xl ${
              isTrackerActive 
                ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Hand className={`w-4 h-4 ${isTrackerActive ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-bold uppercase tracking-wider">{isTrackerActive ? 'Tracking Live' : 'Start Hand Tracking'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        <Scene 
          file={file} 
          handData={isTrackerActive ? handData : null} 
          voiceTransform={voiceTransform}
        />
        
        {!file && (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
              <div className="relative mx-auto w-32 h-32">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl animate-pulse" />
                <div className="relative w-full h-full rounded-[2rem] bg-zinc-900/50 border border-zinc-800 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                  <Box className="w-12 h-12 text-zinc-600" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-white tracking-tight">STANDBY MODE</h2>
                <p className="text-zinc-500 text-sm leading-relaxed max-w-xs mx-auto">Upload a 3D model or image to initialize the spatial manipulation environment.</p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Command List UI */}
        {isVoiceActive && (
          <div className="absolute top-24 right-6 w-64 z-20 space-y-4 animate-in slide-in-from-right duration-500">
             <div className="bg-zinc-950/60 border border-zinc-800/50 backdrop-blur-xl rounded-2xl p-4 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between mb-4 px-1">
                   <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Available Commands</span>
                   </div>
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                </div>

                <div className="space-y-1">
                   {AVAILABLE_COMMANDS.map((cmd) => (
                     <div 
                        key={cmd.action} 
                        className={`group relative p-3 rounded-xl border transition-all duration-300 overflow-hidden ${
                          lastCommand?.action === cmd.action 
                            ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                            : 'bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-900/80 hover:border-zinc-700'
                        }`}
                     >
                        {lastCommand?.action === cmd.action && (
                          <div className="absolute top-0 right-0 p-1">
                            <Sparkles className="w-3 h-3 text-blue-400 animate-bounce" />
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                           <span className={`text-[11px] font-black uppercase tracking-tight ${
                             lastCommand?.action === cmd.action ? 'text-blue-400' : 'text-zinc-200'
                           }`}>
                             {cmd.label}
                           </span>
                           <span className="text-[10px] text-zinc-500 font-medium italic">
                             {cmd.examples[0]}
                           </span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>

             {lastCommand && (
               <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(37,99,235,0.4)] animate-in zoom-in slide-in-from-top-4 duration-300 text-center border border-blue-400/50">
                  Command Executed: {lastCommand.action}
               </div>
             )}
          </div>
        )}

        {file && (
          <div className="absolute bottom-8 left-8 max-w-sm z-20 animate-in slide-in-from-left duration-700">
            <div className="bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-50" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Info className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-black text-white text-[10px] uppercase tracking-[0.2em]">Neural Insight</h3>
                  <p className="text-zinc-500 text-[9px] font-bold">ANALYZING SPATIAL PROPERTIES</p>
                </div>
              </div>
              
              <div className="min-h-[60px] flex items-center">
                {isLoadingInsight ? (
                  <div className="space-y-3 w-full">
                    <div className="h-2.5 bg-zinc-800 rounded-full animate-pulse w-full" />
                    <div className="h-2.5 bg-zinc-800 rounded-full animate-pulse w-5/6" />
                    <div className="h-2.5 bg-zinc-800 rounded-full animate-pulse w-2/3" />
                  </div>
                ) : (
                  <p className="text-zinc-300 text-sm leading-relaxed font-medium">
                    {insight || "Awaiting neural analysis..."}
                  </p>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded-lg">
                    {file.type === '3d' ? <Box className="w-4 h-4 text-zinc-400" /> : <ImageIcon className="w-4 h-4 text-zinc-400" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-300 truncate max-w-[140px] uppercase tracking-tight">{file.name}</span>
                    <span className="text-[9px] font-mono text-zinc-500">FORMAT: {file.name.split('.').pop()?.toUpperCase()}</span>
                  </div>
                </div>
                <button 
                  onClick={() => fetchInsight(file)}
                  title="Regenerate Insight"
                  className="p-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all text-zinc-500 hover:text-white border border-zinc-800"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <HandTracker isActive={isTrackerActive} onHandUpdate={onHandUpdate} />

      {isTrackerActive && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 bg-zinc-950/90 border border-zinc-800/50 backdrop-blur-3xl rounded-[2rem] flex items-center gap-10 shadow-2xl z-20 animate-in slide-in-from-bottom duration-500 overflow-x-auto max-w-[95vw] no-scrollbar">
           <div className="flex items-center gap-4 shrink-0 group">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all group-hover:border-blue-500/50 group-hover:bg-blue-500/10">
                <span className="text-xs font-black text-blue-500">01</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Pinch Move</span>
                <span className="text-[9px] font-medium text-zinc-500">Drag to position</span>
              </div>
           </div>
           <div className="w-px h-6 bg-zinc-800/50 shrink-0" />
           <div className="flex items-center gap-4 shrink-0 group">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all group-hover:border-blue-500/50 group-hover:bg-blue-500/10">
                <span className="text-xs font-black text-blue-500">02</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Index Circle</span>
                <span className="text-[9px] font-medium text-zinc-500">Rotate object</span>
              </div>
           </div>
           <div className="w-px h-6 bg-zinc-800/50 shrink-0" />
           <div className="flex items-center gap-4 shrink-0 group">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all group-hover:border-blue-500/50 group-hover:bg-blue-500/10">
                <span className="text-xs font-black text-blue-500">03</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Hand Zoom</span>
                <span className="text-[9px] font-medium text-zinc-500">Use two hands</span>
              </div>
           </div>
        </div>
      )}

      {/* Aesthetic ambient lighting */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-800/20 blur-[160px] rounded-full" />
      </div>
    </div>
  );
};

export default App;
