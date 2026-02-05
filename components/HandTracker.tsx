import React, { useEffect, useRef, useState } from 'react';
import { HandData } from '../types';

interface HandTrackerProps {
  onHandUpdate: (data: any) => void;
  isActive: boolean;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) return;

    let checkInterval: number;
    let attempts = 0;

    const initTracker = () => {
      const win = window as any;
      
      // Extensive detection of MediaPipe objects which sometimes attach to window in different ways
      const Hands = win.Hands;
      const Camera = win.Camera || (win.camera_utils ? win.camera_utils.Camera : null);
      
      if (!Hands || !Camera) {
        if (attempts < 60) { // 30 seconds total
          attempts++;
          checkInterval = window.setTimeout(initTracker, 500);
          return;
        }
        const missing = [];
        if (!Hands) missing.push('Hands');
        if (!Camera) missing.push('Camera');
        
        setError(`System Sync Failed: ${missing.join(' & ')} module timed out.`);
        console.error("MediaPipe Load Error:", { Hands: !!Hands, Camera: !!Camera, win: Object.keys(win).filter(k => k.toLowerCase().includes('mediapipe') || k.toLowerCase().includes('hands') || k.toLowerCase().includes('camera')) });
        return;
      }

      setIsLoaded(true);
      setError(null);

      const drawConnectors = win.drawConnectors;
      const drawLandmarks = win.drawLandmarks;
      const HAND_CONNECTIONS = win.HAND_CONNECTIONS;

      try {
        const hands = new Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence: 0.65,
        });

        hands.onResults((results: any) => {
          if (!canvasRef.current || !videoRef.current) return;

          const canvasCtx = canvasRef.current.getContext('2d');
          if (!canvasCtx) return;

          canvasCtx.save();
          canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Mirror view for user comfort
          canvasCtx.translate(canvasRef.current.width, 0);
          canvasCtx.scale(-1, 1);
          
          canvasCtx.drawImage(
            results.image, 0, 0, canvasRef.current.width, canvasRef.current.height
          );

          if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
              if (drawConnectors && HAND_CONNECTIONS) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#3b82f6', lineWidth: 2 });
              }
              if (drawLandmarks) {
                drawLandmarks(canvasCtx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 2 });
              }
            }
            
            onHandUpdate({
              landmarks: results.multiHandLandmarks,
              handedness: results.multiHandedness
            });
          }
          canvasCtx.restore();
        });

        if (videoRef.current) {
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (handsRef.current) {
                try {
                  await handsRef.current.send({ image: videoRef.current! });
                } catch (e) {
                  // Silent fail on individual frames
                }
              }
            },
            width: 640,
            height: 360,
          });
          camera.start();
          cameraRef.current = camera;
        }

        handsRef.current = hands;
      } catch (e) {
        console.error("Hands Initialization Failure:", e);
        setError("Optical sensor initialization failed.");
      }
    };

    initTracker();

    return () => {
      window.clearTimeout(checkInterval);
      if (cameraRef.current) {
        try { cameraRef.current.stop(); } catch (e) {}
      }
      if (handsRef.current) {
        try { handsRef.current.close(); } catch (e) {}
      }
      handsRef.current = null;
    };
  }, [isActive, onHandUpdate]);

  if (!isActive) return null;

  return (
    <div className="fixed bottom-4 right-4 w-64 aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-2xl z-50 ring-1 ring-white/5 transition-all duration-500">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className={`w-full h-full object-cover transition-opacity duration-500 ${!isLoaded ? 'opacity-0' : 'opacity-100'}`} width={640} height={360} />
      
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-4">
          <div className="relative">
             <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
             <div className="absolute inset-0 blur-md bg-blue-500/20 rounded-full" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-white font-black tracking-widest uppercase">Initializing Sensors</span>
            <span className="text-[8px] text-zinc-600 font-mono tracking-tighter">CALIBRATING OPTICS...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          </div>
          <span className="text-[10px] text-red-400 font-black uppercase leading-tight tracking-widest">{error}</span>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[9px] font-black tracking-widest text-zinc-400 hover:text-white transition-all uppercase"
          >
            Hot Reload System
          </button>
        </div>
      )}

      {isLoaded && !error && (
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/80 backdrop-blur-md rounded-lg border border-zinc-800/50 text-[9px] font-black tracking-widest text-white flex items-center gap-2 shadow-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          OPTICAL_FEED_ACTIVE
        </div>
      )}
    </div>
  );
};

export default HandTracker;