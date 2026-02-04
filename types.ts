
export interface HandData {
  landmarks: any[][];
  handedness: any[];
}

export interface VoiceTransform {
  scaleFactor: number;
  rotationOffset: [number, number, number];
  positionOffset: [number, number, number];
  animation?: 'bounce' | 'spin' | 'none';
  color?: string;
}

export interface UploadedFile {
  url: string;
  name: string;
  type: '3d' | 'image';
}

export enum GestureType {
  PINCH = 'PINCH',
  OPEN_PALM = 'OPEN_PALM',
  CLOSED_FIST = 'CLOSED_FIST',
  NONE = 'NONE'
}
