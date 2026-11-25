import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { prisma } from './prisma.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fpufcxgwayrmyrfqtwvp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'erp-uploads';

let supabaseClient: SupabaseClient | null = null;
let bucketChecked = false;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_KEY) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

async function ensureBucket(supabase: SupabaseClient) {
  if (bucketChecked) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.name === BUCKET_NAME);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      });
      if (error && !error.message?.includes('already exists')) {
        console.warn('[Supabase Storage] Create bucket warning:', error.message);
      }
    }
    bucketChecked = true;
  } catch (err: any) {
    console.warn('[Supabase Storage] Bucket check skipped:', err?.message || err);
  }
}

export async function uploadToStorage(
  file: Express.Multer.File,
  folder: 'avatars' | 'documents'
): Promise<string> {
  const rawExt = path.extname(file.originalname).toLowerCase();
  const fallbackExt = folder === 'avatars' ? '.jpg' : '.pdf';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${rawExt || fallbackExt}`;
  const filePath = `${folder}/${filename}`;

  const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
  if (!fileBuffer) {
    throw new Error('Unable to read uploaded file data');
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      await ensureBucket(supabase);
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBuffer, {
          contentType: file.mimetype || 'application/octet-stream',
          upsert: true,
        });

      if (!error) {
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
      }
      console.error('[Supabase Storage Upload Error]', error);
    } catch (sbErr) {
      console.error('[Supabase Storage Exception]', sbErr);
    }
  }

  // Fallback to database persistence if Supabase key is not yet configured
  await prisma.uploadedFile.upsert({
    where: { filename: filePath },
    create: {
      filename: filePath,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size || fileBuffer.length,
      data: fileBuffer,
    },
    update: {
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size || fileBuffer.length,
      data: fileBuffer,
    },
  });

  return `/uploads/${filePath}`;
}

export function saveBase64Media(
  base64Data: string | null | undefined,
  folder: 'attendance' | 'audio'
): string | null {
  if (!base64Data) return null;
  if (!base64Data.startsWith('data:')) {
    return base64Data; // Already a URL path
  }

  const matches = base64Data.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return base64Data;
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  let ext = '.bin';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
  else if (mimeType.includes('png')) ext = '.png';
  else if (mimeType.includes('webp')) ext = '.webp';
  else if (mimeType.includes('webm')) ext = '.webm';
  else if (mimeType.includes('ogg') || mimeType.includes('opus')) ext = '.ogg';
  else if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = '.m4a';
  else if (mimeType.includes('wav')) ext = '.wav';

  const filename = `${folder}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const targetDir = path.join(uploadsDir, folder);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, buffer);

  // If DB persistence fallback table exists, record it
  prisma.uploadedFile.create({
    data: {
      filename: `${folder}/${filename}`,
      mimeType,
      size: buffer.length,
      data: buffer,
    },
  }).catch(() => {});

  return `/uploads/${folder}/${filename}`;
}
