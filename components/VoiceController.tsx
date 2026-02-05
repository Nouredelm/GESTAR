
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';

// Manual encoding/decoding as per GenAI SDK guidelines
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface VoiceControllerProps {
  isActive: boolean;
  onCommand: (action: string, value?: string) => void;
}

const VoiceController: React.FC<VoiceControllerProps> = ({ isActive, onCommand }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const cleanup = () => {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsConnecting(false);
    };

    if (!isActive) {
      cleanup();
      setError(null);
      return;
    }

    const startVoiceSession = async () => {
      setIsConnecting(true);
      setError(null);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const manipulateObjectTool = {
        name: 'manipulateObject',
        parameters: {
          type: Type.OBJECT,
          description: 'Control the 3D object properties like scale, color, bounce, or reset.',
          properties: {
            action: {
              type: Type.STRING,
              description: 'The type of manipulation',
              enum: ['scale', 'color', 'bounce', 'recenter', 'rotate'],
            },
            value: {
              type: Type.STRING,
              description: 'Optional magnitude or specific value (e.g., "bigger", "red", "fast")',
            },
          },
          required: ['action'],
        },
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              setIsConnecting(false);
              if (!streamRef.current) return;
              
              const source = audioContext.createMediaStreamSource(streamRef.current);
              const processor = audioContext.createScriptProcessor(4096, 1, 1);
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  int16[i] = inputData[i] * 32768;
                }
                const base64 = encode(new Uint8Array(int16.buffer));
                sessionPromise.then(s => {
                  if (s) s.sendRealtimeInput({ 
                    media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
                  });
                });
              };
              source.connect(processor);
              processor.connect(audioContext.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                  const { action, value } = fc.args as any;
                  onCommand(action, value);
                  
                  sessionPromise.then(s => {
                    if (s) s.sendToolResponse({
                      functionResponses: { id: fc.id, name: fc.name, response: { status: "applied" } }
                    });
                  });
                }
              }
            },
            onerror: (e) => {
              console.error("Voice Engine Error:", e);
              setError("Engine sync error.");
            },
            onclose: () => setIsConnecting(false),
          },
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: 'You are a spatial AI assistant. Use the manipulateObject tool to respond to user requests about the 3D model. Be extremely concise in speech. If the user asks for a color change, respond with something like "Applying red color".',
            tools: [{ functionDeclarations: [manipulateObjectTool] }],
          },
        });

        sessionRef.current = await sessionPromise;
      } catch (err: any) {
        console.error("Voice Setup Failed:", err);
        setIsConnecting(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError') {
          setError("Microphone access denied.");
        } else {
          setError("Failed to start voice engine.");
        }
      }
    };

    startVoiceSession();

    return cleanup;
  }, [isActive]);

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300 ${
      isActive ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500'
    } ${error ? 'border-red-500/50 text-red-400' : ''}`}>
      {isConnecting ? (
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
      ) : error ? (
        <AlertCircle className="w-4 h-4 text-red-400" />
      ) : isActive ? (
        <div className="relative">
          <Mic className="w-4 h-4 text-red-400 animate-pulse" />
          <div className="absolute inset-0 bg-red-400/20 blur-sm rounded-full" />
        </div>
      ) : (
        <MicOff className="w-4 h-4" />
      )}
      
      <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
        {error ? error : isConnecting ? 'Syncing...' : isActive ? 'Listening' : 'Voice Off'}
      </span>
    </div>
  );
};

export default VoiceController;
