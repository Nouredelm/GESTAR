
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { VoiceTransform } from '../types';
import { Mic, MicOff, Loader2 } from 'lucide-react';

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface VoiceControllerProps {
  isActive: boolean;
  onTransformUpdate: (transform: Partial<VoiceTransform>) => void;
  onReset: () => void;
}

const VoiceController: React.FC<VoiceControllerProps> = ({ isActive, onTransformUpdate, onReset }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    if (!isActive) {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      return;
    }

    const startVoiceSession = async () => {
      setIsConnecting(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const manipulateObjectTool = {
        name: 'manipulateObject',
        parameters: {
          type: Type.OBJECT,
          description: 'Change the scale, rotation, position, color, or animation of the 3D object.',
          properties: {
            action: {
              type: Type.STRING,
              description: 'The type of manipulation',
              enum: ['scale', 'rotate', 'move', 'reset', 'color', 'animate', 'recenter'],
            },
            value: {
              type: Type.STRING,
              description: 'Specific instruction: "larger", "smaller", "forward", "backward", "left", "right", "bounce", "spin", "stop", "center"',
            },
          },
          required: ['action', 'value'],
        },
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const inputAudioContext = new AudioContext({ sampleRate: 16000 });
        const outputAudioContext = new AudioContext({ sampleRate: 24000 });
        inputAudioContextRef.current = inputAudioContext;
        outputAudioContextRef.current = outputAudioContext;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              setIsConnecting(false);
              const source = inputAudioContext.createMediaStreamSource(stream);
              const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                const base64 = encode(new Uint8Array(int16.buffer));
                sessionPromise.then(s => s.sendRealtimeInput({ 
                  media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
                }));
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioContext.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
              }

              if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                  const { action, value } = fc.args as any;
                  
                  if (action === 'scale') {
                    onTransformUpdate({ scaleFactor: value.includes('larger') || value.includes('big') ? 1.4 : 0.6 });
                  } else if (action === 'move') {
                    const offset: [number, number, number] = [0, 0, 0];
                    if (value.includes('left')) offset[0] = -3;
                    if (value.includes('right')) offset[0] = 3;
                    if (value.includes('up')) offset[1] = 3;
                    if (value.includes('down')) offset[1] = -3;
                    if (value.includes('forward')) offset[2] = 5;
                    if (value.includes('backward') || value.includes('back')) offset[2] = -5;
                    onTransformUpdate({ positionOffset: offset });
                  } else if (action === 'animate') {
                    if (value.includes('bounce')) onTransformUpdate({ animation: 'bounce' });
                    else if (value.includes('spin')) onTransformUpdate({ animation: 'spin' });
                    else onTransformUpdate({ animation: 'none' });
                  } else if (action === 'recenter' || action === 'reset') {
                    onReset();
                  }

                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                  }));
                }
              }
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: 'You are a spatial assistant. Control the object via the manipulateObject tool. Handle commands like "move forward", "bounce", "spin it", "recenter", "center the object". Be extremely brief.',
            tools: [{ functionDeclarations: [manipulateObjectTool] }],
          },
        });

        sessionRef.current = await sessionPromise;
      } catch (err) {
        setIsConnecting(false);
      }
    };

    startVoiceSession();

    return () => {
      if (sessionRef.current) sessionRef.current.close();
    };
  }, [isActive, onReset, onTransformUpdate]);

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
      isActive ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
    }`}>
      {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />)}
      <span className="text-[10px] font-bold uppercase tracking-widest">
        {isActive ? 'Live Voice' : 'Voice Controller'}
      </span>
    </div>
  );
};

export default VoiceController;
