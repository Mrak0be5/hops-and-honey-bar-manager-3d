import { useEffect, useRef, useState } from 'react';
import { BarScene } from './components/BarScene';
import { gameAudio } from './game/audio';
import { gameEngine } from './game/GameEngine';
import { useGameSnapshot } from './game/useGameSnapshot';
import { Hud } from './ui/Hud';
import { Icon } from './ui/Icon';

export default function App() {
  const snapshot = useGameSnapshot(gameEngine);
  const [contextLost, setContextLost] = useState(false);
  const lastSoundEvent = useRef(0);

  useEffect(() => {
    gameAudio.setEnabled(snapshot.soundEnabled);
  }, [snapshot.soundEnabled]);

  useEffect(() => {
    if (!snapshot.lastEvent || snapshot.lastEvent.id === lastSoundEvent.current) return;
    lastSoundEvent.current = snapshot.lastEvent.id;
    if (snapshot.started) gameAudio.event(snapshot.lastEvent);
  }, [snapshot.lastEvent, snapshot.started]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && snapshot.started && !snapshot.paused) gameEngine.setPaused(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [snapshot.paused, snapshot.started]);

  return (
    <main className="game-shell">
      {contextLost ? (
        <div className="webgl-fallback">
          <Icon name="reset" />
          <h1>3D-сцена остановилась</h1>
          <p>Браузер потерял WebGL-контекст. Прогресс уже сохранён — можно безопасно перезапустить сцену.</p>
          <button onClick={() => window.location.reload()}>
            <Icon name="reset" />
            Перезапустить
          </button>
        </div>
      ) : (
        <BarScene engine={gameEngine} snapshot={snapshot} onContextLost={() => setContextLost(true)} />
      )}
      <Hud engine={gameEngine} snapshot={snapshot} />
      <div className="scene-vignette" />
    </main>
  );
}
