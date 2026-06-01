import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WINDOWS_INSTALLER_FILENAME = 'Bento_0.1.0_x64-setup.exe';
const FALLBACK_INSTALLER_URL =
  'https://github.com/Kimenzo/Genesis/releases/latest/download/Genesis_Windows_x64-setup.exe';

export async function GET(request: NextRequest) {
  // Try to serve the local installer first
  const localUrl = new URL(`/downloads/${WINDOWS_INSTALLER_FILENAME}`, request.url);
  const localResponse = await fetch(localUrl, {
    method: 'HEAD',
    cache: 'no-store',
  }).catch(() => null);

  if (localResponse?.ok) {
    // Redirect to the local static file for direct download
    return NextResponse.redirect(localUrl);
  }

  // Fallback: proxy from remote URL
  const upstreamUrl = process.env.GENESIS_DESKTOP_WINDOWS_INSTALLER_URL ?? FALLBACK_INSTALLER_URL;
  const upstream = await fetch(upstreamUrl, {
    cache: 'no-store',
    redirect: 'follow',
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      {
        error:
          'The Genesis Windows installer is temporarily unavailable. Please try again shortly.',
      },
      { status: 502 }
    );
  }

  const headers = new Headers();
  headers.set('cache-control', 'no-store');
  headers.set('content-disposition', `attachment; filename="${WINDOWS_INSTALLER_FILENAME}"`);

  const contentType = upstream.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  } else {
    headers.set('content-type', 'application/octet-stream');
  }

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) {
    headers.set('content-length', contentLength);
  }

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
