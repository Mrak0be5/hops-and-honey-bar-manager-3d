abstract interface class GameBrowserCommands {
  Future<void> reload();

  /// Returns true when the browser consumed the system back action.
  Future<bool> goBackIfPossible();
}
