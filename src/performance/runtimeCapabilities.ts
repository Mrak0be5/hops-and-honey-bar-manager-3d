export function isAndroidWebView(userAgent: string) {
  return /\bwv\b/i.test(userAgent) && /\bAndroid\b/i.test(userAgent);
}
