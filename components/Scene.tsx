
import React, { Suspense, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { UploadedFile, HandData } from '../types';

interface ModelProps {
  file: UploadedFile;
  handData: HandData | null;
}

const GestureModel: React.FC<ModelProps> = ({ file, handData }) => {
  const meshRef = React.useRef<THREE.Group>(null);
  const gltf = file.type === '3d' ? useGLTF(file.url) : null;
  const texture = file.type === 'image' ? useLoader(THREE.TextureLoader, file.url) : null;

  // Smoothing refs
  const targetPos = React.useRef(new THREE.Vector3(0, 0, 0));
  const targetRot = React.useRef(new THREE.Euler(0, 0, 0));
  const targetScale = React.useRef(1);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (handData && handData.landmarks.length > 0) {
      const hand = handData.landmarks[0];
      
      // Detect pinch (Index Tip 8 and Thumb Tip 4)
      const thumbTip = hand[4];
      const indexTip = hand[8];
      const dist = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) + 
        Math.pow(thumbTip.y - indexTip.y, 2)
      );
      
      const isPinching = dist < 0.05;

      if (isPinching) {
        // Map hand screen coords to 3D space
        // hand.x is [0, 1], convert to [-5, 5]
        targetPos.current.x = (0.5 - hand[9].x) * 10; // hand[9] is middle finger base
        targetPos.current.y = (0.5 - hand[9].y) * 10;
        
        // Rotation based on hand tilt (approximate)
        targetRot.current.y += (hand[0].x - hand[9].x) * 0.1;
      }

      // If two hands, handle zoom
      if (handData.landmarks.length === 2) {
        const h1 = handData.landmarks[0][9];
        const h2 = handData.landmarks[1][9];
        const handDist = Math.sqrt(Math.pow(h1.x - h2.x, 2) + Math.pow(h1.y - h2.y, 2));
        targetScale.current = Math.max(0.1, Math.min(5, handDist * 5));
      }
    }

    // Apply smoothing
    meshRef.current.position.lerp(targetPos.current, 0.1);
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.current.x, 0.1);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.current.y, 0.1);
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale.current, 0.1));
  });

  return (
    <group ref={meshRef}>
      {file.type === '3d' && gltf && (
        <primitive object={gltf.scene} scale={1} />
      )}
      {file.type === 'image' && texture && (
        <mesh>
          <planeGeometry args={[4, 4 * (texture.image.height / texture.image.width)]} />
          <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
        </mesh>
      )}
    </group>
  );
};

interface SceneProps {
  file: UploadedFile | null;
  handData: HandData | null;
}

const Scene: React.FC<SceneProps> = ({ file, handData }) => {
  return (
    <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-black">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={50} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <spotLight position={[0, 10, 0]} angle={0.15} penumbra={1} intensity={2} castShadow />
        
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.6} contactShadow={{ opacity: 0.4, blur: 2 }}>
            {file && <GestureModel file={file} handData={handData} />}
          </Stage>
        </Suspense>

        <Environment preset="city" />
        <ContactShadows position={[0, -4.5, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
};

export default Scene;
