import { describe, expect, it } from 'vitest';
import { isAndroidWebView } from '../src/performance/runtimeCapabilities';

describe('runtime capabilities', () => {
  it('recognizes the system Android WebView user agent', () => {
    expect(isAndroidWebView(
      'Mozilla/5.0 (Linux; Android 16; sdk_gphone64_x86_64 Build/BP2A; wv) AppleWebKit/537.36 Version/4.0 Chrome/133.0 Mobile Safari/537.36',
    )).toBe(true);
  });

  it('does not treat mobile Chrome or desktop browsers as Android WebView', () => {
    expect(isAndroidWebView(
      'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36',
    )).toBe(false);
    expect(isAndroidWebView(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150.0 Safari/537.36',
    )).toBe(false);
  });
});
