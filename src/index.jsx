import { useRef, useEffect } from 'react';
import { useSettings, useSettingsActions } from '@mywallpaper/sdk-react';
import { TubesCursor } from './tubes-engine.js';

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

export default function TubesCursorWidget() {
  const settings = useSettings();
  const { setValue, onButtonClick } = useSettingsActions();
  const canvasRef = useRef(null);
  const instanceRef = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Init once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = settingsRef.current;
    instanceRef.current = TubesCursor(canvas, {
      bloom: s.bloomEnabled ? {
        threshold: s.bloomThreshold ?? 0,
        strength: s.bloomStrength ?? 5,
        radius: s.bloomRadius ?? 1.5,
      } : null,
      tubeCount: s.tubeCount ?? 16,
      maxRadius: s.tubeRadius ?? 0.03,
      maxSegments: s.tubeLength ?? 64,
      metalness: s.metalness ?? 1,
      roughness: s.roughness ?? 0.25,
      colors: [s.tubeColor1 || '#f967fb', s.tubeColor2 || '#ff6b6b', s.tubeColor3 || '#53bc28'],
      lightIntensity: s.lightIntensity ?? 200,
      lightColors: [
        s.lightColor1 || '#83f36e', s.lightColor2 || '#fe8a2e',
        s.lightColor3 || '#ff008a', s.lightColor4 || '#60aed5',
      ],
      lerp: s.smoothness ?? 0.5,
      noise: s.noise ?? 0.05,
    });
    return () => { instanceRef.current?.dispose(); instanceRef.current = null; };
  }, []);

  // Property updates
  useEffect(() => {
    instanceRef.current?.setTubeColors([
      settings.tubeColor1 || '#f967fb', settings.tubeColor2 || '#ff6b6b', settings.tubeColor3 || '#53bc28',
    ]);
  }, [settings.tubeColor1, settings.tubeColor2, settings.tubeColor3]);

  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    inst.setLightColors([
      settings.lightColor1 || '#83f36e', settings.lightColor2 || '#fe8a2e',
      settings.lightColor3 || '#ff008a', settings.lightColor4 || '#60aed5',
    ]);
    inst.setLightIntensity(settings.lightIntensity ?? 200);
  }, [settings.lightColor1, settings.lightColor2, settings.lightColor3, settings.lightColor4, settings.lightIntensity]);

  useEffect(() => {
    instanceRef.current?.setMaterial({ metalness: settings.metalness ?? 1, roughness: settings.roughness ?? 0.25 });
  }, [settings.metalness, settings.roughness]);

  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;
    inst.setLerp(settings.smoothness ?? 0.85);
    inst.setNoise(settings.noise ?? 0.05);
  }, [settings.smoothness, settings.noise]);

  // Bloom
  useEffect(() => { instanceRef.current?.setBloomEnabled(settings.bloomEnabled ?? true); }, [settings.bloomEnabled]);
  useEffect(() => {
    instanceRef.current?.setBloomParams({
      threshold: settings.bloomThreshold ?? 0, strength: settings.bloomStrength ?? 0.7, radius: settings.bloomRadius ?? 1.5,
    });
  }, [settings.bloomThreshold, settings.bloomStrength, settings.bloomRadius]);

  // Structural
  useEffect(() => { instanceRef.current?.setTubeCount(settings.tubeCount ?? 16); }, [settings.tubeCount]);
  useEffect(() => {
    instanceRef.current?.setTubeGeometry({ maxSegments: settings.tubeLength ?? 64, maxRadius: settings.tubeRadius ?? 0.03 });
  }, [settings.tubeLength, settings.tubeRadius]);

  // Buttons
  useEffect(() => {
    onButtonClick('randomizeTubeColors', () => {
      setValue('tubeColor1', randomHex()); setValue('tubeColor2', randomHex()); setValue('tubeColor3', randomHex());
    });
    onButtonClick('randomizeLightColors', () => {
      setValue('lightColor1', randomHex()); setValue('lightColor2', randomHex());
      setValue('lightColor3', randomHex()); setValue('lightColor4', randomHex());
    });
    onButtonClick('randomizeAll', () => {
      setValue('tubeColor1', randomHex()); setValue('tubeColor2', randomHex()); setValue('tubeColor3', randomHex());
      setValue('lightColor1', randomHex()); setValue('lightColor2', randomHex());
      setValue('lightColor3', randomHex()); setValue('lightColor4', randomHex());
    });
  }, [onButtonClick, setValue]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
