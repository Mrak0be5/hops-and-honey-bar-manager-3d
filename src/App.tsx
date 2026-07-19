import { useEffect, useRef, useState } from 'react';
import { BarScene } from './components/BarScene';
import { gameAudio } from './game/audio';
import { gameEngine } from './game/GameEngine';
import { useGameSnapshot } from './game/useGameSnapshot';
import { Hud } from './ui/Hud';
import { Icon } from './ui/Icon';
import type { VenueView } from './game/types';

export default function App() {
  const snapshot = useGameSnapshot(gameEngine);
  const [contextLost, setContextLost] = useState(false);
  const [venueView, setVenueView] = useState<VenueView>('bar');
  const [upgradesOpen, setUpgradesOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 980);
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
    let pauseTimer: number | null = null;
    const clearPauseTimer = () => {
      if (pauseTimer === null) return;
      window.clearTimeout(pauseTimer);
      pauseTimer = null;
    };
    const onVisibility = () => {
      clearPauseTimer();
      if (!document.hidden || !snapshot.started || snapshot.paused) return;
      pauseTimer = window.setTimeout(() => {
        pauseTimer = null;
        if (document.hidden) gameEngine.setPaused(true);
      }, 750);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearPauseTimer();
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
        <BarScene
          engine={gameEngine}
          snapshot={snapshot}
          focus={venueView}
          developmentOpen={upgradesOpen}
          onContextLost={() => setContextLost(true)}
        />
      )}
      <Hud
        engine={gameEngine}
        snapshot={snapshot}
        venueView={venueView}
        onVenueView={setVenueView}
        upgradesOpen={upgradesOpen}
        onUpgradesOpen={setUpgradesOpen}
      />
      <div className="scene-vignette" />
    </main>
  );
}
