import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: '100%', width: '100%', position: 'fixed', overflow: 'hidden' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, user-scalable=no" />
        {/* Theme color matches app background for consistent status bar */}
        <meta name="theme-color" content="#111827" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />

        {/* Basic SEO Meta Tags */}
        <title>iEndorse - Build Your Endorsement List</title>
        <meta name="description" content="Build your endorsement list of favorite brands and businesses. Discover what your friends recommend. Earn discounts for your endorsements." />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://iendorse.app/" />
        <meta property="og:title" content="iEndorse - Build Your Endorsement List" />
        <meta property="og:description" content="Build your endorsement list of favorite brands and businesses. Discover what your friends recommend. Earn discounts for your endorsements." />
        <meta property="og:image" content="https://iendorse.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="iEndorse" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://iendorse.app/" />
        <meta name="twitter:title" content="iEndorse - Build Your Endorsement List" />
        <meta name="twitter:description" content="Build your endorsement list of favorite brands and businesses. Discover what your friends recommend. Earn discounts for your endorsements." />
        <meta name="twitter:image" content="https://iendorse.app/og-image.png" />

        {/* PWA Configuration */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS Specific Meta Tags - CRITICAL FOR STANDALONE MODE */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Use default for light mode status bar with matching background, black-translucent for dark */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="iEndorse" />
        <link rel="apple-touch-icon" href="/icon-512.png" />

        <ScrollViewStyleReset />

        {/* Fix iOS PWA white strip at bottom */}
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            position: fixed;
            overflow: hidden;
            background-color: #111827;
            padding-bottom: env(safe-area-inset-bottom);
          }
          #root {
            height: 100%;
            width: 100%;
            position: fixed;
            overflow: auto;
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
