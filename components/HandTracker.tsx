
import React, { useEffect, useRef } from 'react';
import { HandData } from '../types';

interface HandTrackerProps {
  onHandUpdate: (data: HandData) => void;
  isActive: boolean;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) return;

    // @ts-ignore (MediaPipe loaded via script tag)
    const Hands = window.Hands;
    // @ts-ignore
    const Camera = window.Camera;
    // @ts-ignore
    const drawConnectors = window.drawConnectors;
    // @ts-ignore
    const drawLandmarks = window.drawLandmarks;
    // @ts-ignore
    const HAND_CONNECTIONS = window.HAND_CONNECTIONS;

    const hands = new Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results: any) => {
      if (!canvasRef.current || !videoRef.current) return;

      const canvasCtx = canvasRef.current.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // Mirror the canvas
      canvasCtx.translate(canvasRef.current.width, 0);
      canvasCtx.scale(-1, 1);
      
      canvasCtx.drawImage(
        results.image, 0, 0, canvasRef.current.width, canvasRef.current.height
      );

      if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
          drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });
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
          await hands.send({ image: videoRef.current! });
        },
        width: 1280,
        height: 720,
      });
      camera.start();
      cameraRef.current = camera;
    }

    handsRef.current = hands;

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
      if (handsRef.current) handsRef.current.close();
    };
  }, [isActive, onHandUpdate]);

  return (
    <div className="fixed bottom-4 right-4 w-64 aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-2xl z-50">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full object-cover" width={640} height={360} />
      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur rounded text-[10px] font-mono text-white flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        LIVE TRACKING
      </div>
    </div>
  );
};

export default HandTracker;
