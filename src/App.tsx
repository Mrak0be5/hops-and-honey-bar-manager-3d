import LegacyApp from './LegacyApp';

/**
 * Amber Club v2 is developed beside the published game. Until the vertical
 * slice is connected, this adapter intentionally keeps the legacy runtime as
 * the branch fallback instead of leaving the application in a broken state.
 */
export default function App() {
  return <LegacyApp />;
}
