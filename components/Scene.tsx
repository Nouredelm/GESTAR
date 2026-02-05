
import React, { Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { UploadedFile, HandData, VoiceTransform } from '../types';

const Group = 'group' as any;
const Mesh = 'mesh' as any;
const Primitive = 'primitive' as any;
const PlaneGeometry = 'planeGeometry' as any;
const MeshStandardMaterial = 'meshStandardMaterial' as any;
const AmbientLight = 'ambientLight' as any;
const PointLight = 'pointLight' as any;
const SpotLight = 'spotLight' as any;

const GLTFModel: React.FC<{ file: UploadedFile, color: string | null }> = ({ file, color }) => {
  const gltf = useGLTF(file.url);
  
  useEffect(() => {
    if (color && gltf) {
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          (mesh.material as THREE.MeshStandardMaterial).color.set(color);
        }
      });
    }
  }, [color, gltf]);

  return <Primitive object={gltf.scene} scale={1} />;
};

const ImageModel: React.FC<{ file: UploadedFile, color: string | null }> = ({ file, color }) => {
  const texture = useLoader(THREE.TextureLoader, file.url);
  const aspect = texture.image ? texture.image.height / texture.image.width : 1;
  
  return (
    <Mesh>
      <PlaneGeometry args={[4, 4 * aspect]} />
      <MeshStandardMaterial 
        map={texture} 
        side={THREE.DoubleSide} 
        transparent 
        color={color || 'white'}
      />
    </Mesh>
  );
};

interface ModelProps {
  file: UploadedFile;
  handData: HandData | null;
  voiceTransform: VoiceTransform;
}

const GestureModel: React.FC<ModelProps> = ({ file, handData, voiceTransform }) => {
  const meshRef = useRef<THREE.Group>(null);

  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const targetRot = useRef(new THREE.Euler(0, 0, 0));
  const targetScale = useRef(1);

  const isBouncing = useRef(false);
  const bounceStartTime = useRef(0);
  const lastFistState = useRef(false);
  const lastDetectedAngle = useRef(0);

  // Sync voice triggers
  useEffect(() => {
    if (voiceTransform.resetTrigger > 0) {
      targetPos.current.set(0, 0, 0);
      targetRot.current.set(0, 0, 0);
      targetScale.current = 1;
    }
  }, [voiceTransform.resetTrigger]);

  useEffect(() => {
    if (voiceTransform.bounceTrigger > 0) {
      isBouncing.current = true;
      bounceStartTime.current = performance.now() / 1000;
    }
  }, [voiceTransform.bounceTrigger]);

  useEffect(() => {
    targetScale.current = voiceTransform.scale;
  }, [voiceTransform.scale]);

  useFrame((state) => {
    if (!meshRef.current) return;

    let currentBounceY = 0;
    let currentBounceScale = 0;

    // Apply voice-driven rotation velocity
    if (voiceTransform.rotationVelocity !== 0) {
      targetRot.current.y += voiceTransform.rotationVelocity;
    }

    if (handData && handData.landmarks.length > 0) {
      const hand = handData.landmarks[0];
      const wrist = hand[0];
      const indexTip = hand[8];
      const thumbTip = hand[4];
      const middleBase = hand[9];
      
      const pinchDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
      const isPinching = pinchDist < 0.05;

      const fingerTips = [8, 12, 16, 20];
      const getAvgFingerDist = (h: any[]) => {
        const mBase = h[9];
        return fingerTips.reduce((acc, idx) => {
          const tip = h[idx];
          return acc + Math.sqrt(Math.pow(tip.x - mBase.x, 2) + Math.pow(tip.y - mBase.y, 2));
        }, 0) / 4;
      };

      const avgFingerDist = getAvgFingerDist(hand);
      const isFist = avgFingerDist < 0.12;
      const isOpen = avgFingerDist > 0.35;

      // Circular motion detection: Triggered by index finger pointing up
      const isPointing = (hand[8].y < hand[6].y) && (hand[12].y > hand[10].y) && (hand[16].y > hand[14].y);

      if (isPointing && !isPinching && !isFist) {
        // Track relative angle of index finger to palm center
        const relX = indexTip.x - middleBase.x;
        const relY = indexTip.y - middleBase.y;
        const currentAngle = Math.atan2(relY, relX);
        
        const indexExtension = Math.sqrt(relX * relX + relY * relY);
        if (indexExtension > 0.12) {
          const angleDiff = currentAngle - lastDetectedAngle.current;
          // Normalize the angle jump
          const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
          
          if (Math.abs(normalizedDiff) < 1.0) {
            // Apply horizontal rotation based on finger circular motion
            targetRot.current.y += normalizedDiff * 3.0;
          }
        }
        lastDetectedAngle.current = currentAngle;
      }

      if (isFist && !lastFistState.current) {
        isBouncing.current = true;
        bounceStartTime.current = state.clock.elapsedTime;
      }
      lastFistState.current = isFist;

      if (isPinching) {
        // Translation movement based on pinch position
        targetPos.current.x = (0.5 - middleBase.x) * 12;
        targetPos.current.y = (0.5 - middleBase.y) * 12;
        // Subtle tilt based on hand orientation
        targetRot.current.y += (wrist.x - middleBase.x) * 0.05;
      }

      // Two-hand zoom and reset
      if (handData.landmarks.length === 2) {
        const hand2 = handData.landmarks[1];
        if (isOpen && getAvgFingerDist(hand2) > 0.35) {
          targetPos.current.set(0, 0, 0);
          targetRot.current.set(0, 0, 0);
          targetScale.current = 1;
        } else {
          const h1 = hand[9];
          const h2 = hand2[9];
          const handDist = Math.sqrt(Math.pow(h1.x - h2.x, 2) + Math.pow(h1.y - h2.y, 2));
          targetScale.current = Math.max(0.1, Math.min(5, handDist * 6));
        }
      }
    }

    // Physic-based bounce animation
    if (isBouncing.current) {
      const bounceElapsed = state.clock.elapsedTime - bounceStartTime.current;
      const duration = 1.0; 
      if (bounceElapsed < duration) {
        const freq = 22; 
        const decay = Math.exp(-bounceElapsed * 4);
        currentBounceY = Math.abs(Math.sin(bounceElapsed * freq)) * 1.3 * decay;
        currentBounceScale = Math.sin(bounceElapsed * freq) * 0.18 * decay;
      } else {
        isBouncing.current = false;
      }
    }

    // Smooth LERP transforms
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetPos.current.x, 0.15);
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetPos.current.y + currentBounceY, 0.25);
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetPos.current.z, 0.15);
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.current.x, 0.15);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.current.y, 0.15);
    const finalScale = targetScale.current + currentBounceScale;
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, finalScale, 0.25));
  });

  return (
    <Group ref={meshRef}>
      {file.type === '3d' ? (
        <GLTFModel file={file} color={voiceTransform.color} />
      ) : (
        <ImageModel file={file} color={voiceTransform.color} />
      )}
    </Group>
  );
};

interface SceneProps {
  file: UploadedFile | null;
  handData: HandData | null;
  voiceTransform: VoiceTransform;
}

const Scene: React.FC<SceneProps> = ({ file, handData, voiceTransform }) => {
  return (
    <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-black">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={50} />
        <AmbientLight intensity={0.5} />
        <PointLight position={[10, 10, 10]} intensity={1.5} />
        <SpotLight position={[0, 10, 0]} angle={0.15} penumbra={1} intensity={2} castShadow />
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.6} shadows={{ type: 'contact', opacity: 0.4, blur: 2 }}>
            {file && <GestureModel file={file} handData={handData} voiceTransform={voiceTransform} />}
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
