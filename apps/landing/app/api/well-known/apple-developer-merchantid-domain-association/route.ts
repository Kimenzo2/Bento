import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = join(
      process.cwd(),
      'public',
      '.well-known',
      'apple-developer-merchantid-domain-association'
    );
    const content = await readFile(filePath, 'utf-8');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/text',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
