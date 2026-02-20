
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

// USAGE:
// deno run --allow-net --allow-read --allow-write scripts/extract_frames.ts

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const BUCKET_NAME = 'embryo-videos';
const OUTPUT_DIR = './dataset_raw/custom_lab'; // Separate folder for custom images

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    await ensureDir(OUTPUT_DIR);
    console.log(`Checking bucket: ${BUCKET_NAME}...`);

    const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list('', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) {
        console.error("Error listing files:", error);
        return;
    }

    if (!files || files.length === 0) {
        console.log("No files found in bucket.");
        return;
    }

    console.log(`Found ${files.length} files. Downloading 20 samples for annotation...`);

    let count = 0;
    for (const file of files) {
        if (count >= 20) break;
        // Download videos OR valid images
        if (file.name.match(/\.(mp4|jpg|png|jpeg)$/i)) {
            console.log(`Downloading ${file.name}...`);

            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(file.name);
            if (error) {
                console.error(`Failed to download ${file.name}:`, error);
                continue;
            }

            const arrayBuffer = await data.arrayBuffer();
            await Deno.writeFile(join(OUTPUT_DIR, file.name), new Uint8Array(arrayBuffer));
            count++;
        }
    }

    console.log(`Downloaded ${count} files to ${OUTPUT_DIR}.`);
    console.log("TODO: Download 'Rocha' dataset manually from Figshare and place in './dataset_raw/rocha'");
}

main();
