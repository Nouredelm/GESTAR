
import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { UploadedFile, HandData, VoiceTransform } from '../types';

interface ModelProps {
  file: UploadedFile;
  handData: HandData | null;
  voiceTransform: VoiceTransform;
  resetToken: number;
}

const GestureModel: React.FC<ModelProps> = ({ file, handData, voiceTransform, resetToken }) => {
  const meshRef = useRef<THREE.Group>(null);
  const gltf = file.type === '3d' ? useGLTF(file.url) : null;
  const texture = file.type === 'image' ? useLoader(THREE.TextureLoader, file.url) : null;

  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const targetRot = useRef(new THREE.Euler(0, 0, 0));
  const targetScale = useRef(1);

  // Reset internal targets when resetToken changes
  useEffect(() => {
    targetPos.current.set(0, 0, 0);
    targetRot.current.set(0, 0, 0);
    targetScale.current = 1;
  }, [resetToken]);

  useEffect(() => {
    targetScale.current *= voiceTransform.scaleFactor;
    targetPos.current.x += voiceTransform.positionOffset[0];
    targetPos.current.y += voiceTransform.positionOffset[1];
    targetPos.current.z += voiceTransform.positionOffset[2];
    targetRot.current.x += voiceTransform.rotationOffset[0];
    targetRot.current.y += voiceTransform.rotationOffset[1];
    targetRot.current.z += voiceTransform.rotationOffset[2];
  }, [voiceTransform]);

  useFrame((state) => {
    if (!meshRef.current) return;

    // Handle Active Hand Gestures
    if (handData && handData.landmarks.length > 0) {
      const hand = handData.landmarks[0];
      const thumbTip = hand[4];
      const indexTip = hand[8];
      const middleTip = hand[12];
      const ringTip = hand[16];
      const pinkyTip = hand[20];
      const wrist = hand[0];
      
      const pinchDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
      const isPinching = pinchDist < 0.05;

      // Detection distances from wrist
      const fingerDists = [
        Math.sqrt(Math.pow(indexTip.x - wrist.x, 2) + Math.pow(indexTip.y - wrist.y, 2)),
        Math.sqrt(Math.pow(middleTip.x - wrist.x, 2) + Math.pow(middleTip.y - wrist.y, 2)),
        Math.sqrt(Math.pow(ringTip.x - wrist.x, 2) + Math.pow(ringTip.y - wrist.y, 2)),
        Math.sqrt(Math.pow(pinkyTip.x - wrist.x, 2) + Math.pow(pinkyTip.y - wrist.y, 2))
      ];

      const isOpenPalm = fingerDists.every(d => d > 0.4);
      const isClosedFist = fingerDists.every(d => d < 0.15);

      if (isClosedFist) {
        // Recenter immediately
        targetPos.current.set(0, 0, 0);
        targetRot.current.set(0, 0, 0);
        targetScale.current = 1;
      } else if (isPinching) {
        targetPos.current.x = (0.5 - hand[9].x) * 15;
        targetPos.current.y = (0.5 - hand[9].y) * 15;
      } else if (isOpenPalm) {
        targetRot.current.y += 0.04;
      }

      if (handData.landmarks.length === 2) {
        const h1 = handData.landmarks[0][9];
        const h2 = handData.landmarks[1][9];
        const dist = Math.sqrt(Math.pow(h1.x - h2.x, 2) + Math.pow(h1.y - h2.y, 2));
        targetScale.current = Math.max(0.1, Math.min(10, dist * 8));
      }
    }

    // Apply Procedural Animations
    const time = state.clock.getElapsedTime();
    let animYOffset = 0;
    
    if (voiceTransform.animation === 'bounce') {
      animYOffset = Math.abs(Math.sin(time * 4)) * 2;
    } else if (voiceTransform.animation === 'spin') {
      targetRot.current.y += 0.02;
    }

    // Smooth Interpolation
    const finalPos = new THREE.Vector3(targetPos.current.x, targetPos.current.y + animYOffset, targetPos.current.z);
    meshRef.current.position.lerp(finalPos, 0.1);
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.current.x, 0.1);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.current.y, 0.1);
    meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRot.current.z, 0.1);
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale.current, 0.1));
  });

  return (
    <group ref={meshRef}>
      {file.type === '3d' && gltf && <primitive object={gltf.scene} />}
      {file.type === 'image' && texture && (
        <mesh>
          <planeGeometry args={[5, 5 * (texture.image.height / texture.image.width)]} />
          <meshStandardMaterial map={texture} side={THREE.DoubleSide} transparent />
        </mesh>
      )}
    </group>
  );
};

interface SceneProps {
  file: UploadedFile | null;
  handData: HandData | null;
  voiceTransform: VoiceTransform;
  resetToken: number;
}

const Scene: React.FC<SceneProps> = ({ file, handData, voiceTransform, resetToken }) => {
  return (
    <div className="w-full h-full bg-[#050505]">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 5, 15]} fov={50} />
        <ambientLight intensity={0.4} />
        <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} shadows={{ type: 'contact', opacity: 0.4, blur: 2 }}>
            {file && (
              <GestureModel 
                file={file} 
                handData={handData} 
                voiceTransform={voiceTransform} 
                resetToken={resetToken} 
              />
            )}
          </Stage>
        </Suspense>
        <Environment preset="night" />
        <ContactShadows position={[0, -5, 0]} opacity={0.3} scale={20} blur={2} far={5} />
        <OrbitControls makeDefault enableDamping rotateSpeed={0.5} minDistance={5} maxDistance={30} />
      </Canvas>
    </div>
  );
};

export default Scene;
