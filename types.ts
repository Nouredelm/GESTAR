export interface HandData {
  landmarks: any[][];
  handedness: any[];
}

export interface VoiceTransform {
  scale: number;
  color: string | null;
  bounceTrigger: number;
  resetTrigger: number;
  rotationVelocity: number; // For continuous rotation via voice
}

export interface UploadedFile {
  url: string;
  name: string;
  type: '3d' | 'image';
}

export interface VoiceCommand {
  action: string;
  label: string;
  description: string;
  examples: string[];
}

export const AVAILABLE_COMMANDS: VoiceCommand[] = [
  { action: 'scale', label: 'Size', description: 'Modify object scale', examples: ['"Make it bigger"', '"Shrink it"'] },
  { action: 'color', label: 'Color', description: 'Change object tint', examples: ['"Make it red"', '"Color it blue"'] },
  { action: 'bounce', label: 'Physics', description: 'Trigger bounce animation', examples: ['"Bounce"', '"Jump"'] },
  { action: 'recenter', label: 'Reset', description: 'Reset transformations', examples: ['"Recenter"', '"Start over"'] },
  { action: 'rotate', label: 'Spin', description: 'Apply rotation', examples: ['"Rotate fast"', '"Spin it"'] },
];

export enum GestureType {
  PINCH = 'PINCH',
  OPEN_PALM = 'OPEN_PALM',
  CLOSED_FIST = 'CLOSED_FIST',
  BOUNCE = 'BOUNCE',
  ROTATE = 'ROTATE',
  NONE = 'NONE'
}
