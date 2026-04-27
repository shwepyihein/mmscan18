import { Head, Html, Main, NextScript } from 'next/document';

const SITE_NAME = 'ManhwammHub';
const SITE_DESCRIPTION = 'Read your favorite manhwa in Myanmar.';
const THEME_COLOR = '#7c3aed';

export default function Document() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .trim()
    .replace(/\/$/, '');

  return (
    <Html lang='en' className='dark'>
      <Head>
        <meta name='application-name' content={SITE_NAME} />
        <meta name='description' content={SITE_DESCRIPTION} />
        <meta name='theme-color' content={THEME_COLOR} />
        <meta name='color-scheme' content='dark' />

        <link rel='manifest' href='/manifest.json' />
        <link rel='icon' href='/sitemap/favicon.ico' sizes='any' />
        <link
          rel='icon'
          type='image/png'
          sizes='32x32'
          href='/sitemap/favicon-32x32.png'
        />
        <link
          rel='icon'
          type='image/png'
          sizes='16x16'
          href='/sitemap/favicon-16x16.png'
        />
        <link
          rel='apple-touch-icon'
          href='/sitemap/apple-touch-icon.png'
        />

        {siteUrl ? (
          <>
            <meta property='og:site_name' content={SITE_NAME} />
            <meta property='og:type' content='website' />
            <meta property='og:title' content={SITE_NAME} />
            <meta property='og:description' content={SITE_DESCRIPTION} />
            <meta property='og:url' content={siteUrl} />
            <meta
              property='og:image'
              content={`${siteUrl}/sitemap/android-chrome-512x512.png`}
            />
            <meta name='twitter:card' content='summary_large_image' />
            <meta name='twitter:title' content={SITE_NAME} />
            <meta name='twitter:description' content={SITE_DESCRIPTION} />
            <meta
              name='twitter:image'
              content={`${siteUrl}/sitemap/android-chrome-512x512.png`}
            />
          </>
        ) : null}

        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'
        />
        <link
          href='https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;500;600;700&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap'
          rel='stylesheet'
        />
        {/* Ensures `window.Telegram.WebApp` exists in Mini App WebView (often before our React runs). */}
        <script src='https://telegram.org/js/telegram-web-app.js' />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
