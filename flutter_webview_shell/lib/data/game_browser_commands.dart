abstract interface class GameBrowserCommands {
  Future<void> reload();

  /// Returns true when an open in-page dialog or panel consumed back.
  Future<bool> dismissPageOverlayIfPossible();

  /// Returns true when the browser consumed the system back action.
  Future<bool> goBackIfPossible();
}
