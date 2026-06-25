import prisma from '@/lib/db';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // 1. Try to fetch from settings database
    const bgDataSetting = await prisma.setting.findUnique({
      where: { key: 'RETAILER_BG_DATA' }
    });

    const bgMimeSetting = await prisma.setting.findUnique({
      where: { key: 'RETAILER_BG_MIME' }
    });

    if (bgDataSetting && bgDataSetting.value && bgMimeSetting && bgMimeSetting.value) {
      const mime = bgMimeSetting.value;
      const base64Data = bgDataSetting.value.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      return new Response(buffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    // 2. Fallback to public/retailer-bg.jpg
    const defaultPath = join(process.cwd(), 'public', 'retailer-bg.jpg');
    const buffer = await readFile(defaultPath);
    
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Serve background image error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
