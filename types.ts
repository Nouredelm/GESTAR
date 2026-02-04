
export interface HandData {
  landmarks: any[][];
  handedness: any[];
}

export interface SpatialTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface UploadedFile {
  url: string;
  name: string;
  type: '3d' | 'image';
}

export enum GestureType {
  PINCH = 'PINCH',
  OPEN_PALM = 'OPEN_PALM',
  NONE = 'NONE'
}
