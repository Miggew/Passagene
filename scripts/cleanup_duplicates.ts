
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const parts = line.split('=');
            const key = parts[0]?.trim();
            const value = parts.slice(1).join('=').trim();
            if (key && value && !key.startsWith('#')) {
                process.env[key] = value.replace(/"/g, '');
            }
        });
    }
} catch (e) {
    console.warn('Could not read .env file');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CUSTOM_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or keys');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates(queueId: string) {
    console.log(`Cleaning up duplicates for Queue ID: ${queueId}`);

    // 1. Get the Queue Item
    const { data: queue, error: qErr } = await supabase
        .from('embryo_analysis_queue')
        .select('lote_fiv_acasalamento_id')
        .eq('id', queueId)
        .single();

    if (qErr || !queue) {
        console.error('Queue not found or error:', qErr);
        return;
    }

    const acasalamentoId = queue.lote_fiv_acasalamento_id;
    console.log(`Acasalamento ID: ${acasalamentoId}`);

    if (!acasalamentoId) {
        console.error('No Acasalamento ID linked to this queue.');
        return;
    }

    // 2. Find ALL embryos for this acasalamento
    const { data: embryos, error: eErr } = await supabase
        .from('embrioes')
        .select('id, identificacao, created_at, queue_id')
        .eq('lote_fiv_acasalamento_id', acasalamentoId)
        .order('created_at', { ascending: true });

    if (eErr) {
        console.error('Error fetching embryos:', eErr);
        return;
    }

    console.log(`Found ${embryos.length} embryos.`);

    // 3. Identify potential duplicates (same identification or created wildly apart?)
    // Strategy: Keep the OLDEST valid ones (likely the original 9). 
    // Delete ones created RECENTLY (likely the duplicates from the buggy run).

    // Hard delete rule: Delete anything created in the last 24 hours that DOES NOT have a valid identification (null) 
    // OR has the specific broken queue_id if we want to be aggressive.

    // Logic: 
    // The original embryos likely have meaningful IDs or were created earlier.
    // The duplicates were created by "Redetect" logic recently.

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const toDelete = embryos.filter(e => {
        const createdAt = new Date(e.created_at);
        // If created recently AND has no identification (auto-created ones often lack it initially)
        // OR if we want to just nuke everything from this queue run?
        // User said "detectou o mesmo embriao mais de 1 vez".

        // Safer: Delete embryos that were created by THIS queue run (queue_id matches)
        // But original embryos might not have queue_id set to this run.
        if (e.queue_id === queueId) return true;

        // Also delete recent ones with null identification
        if (createdAt > oneDayAgo && !e.identificacao) return true;

        return false;
    });

    console.log(`Identified ${toDelete.length} embryos to delete.`);

    if (toDelete.length === 0) {
        console.log("Nothing to delete.");
        return;
    }

    const ids = toDelete.map(e => e.id);
    console.log('Deleting IDs:', ids);

    // 4. Delete related scores first (cascade might handle it, but safer to be explicit)
    await supabase.from('embryo_scores').delete().in('embriao_id', ids);

    // 5. Delete embryos
    const { error: delErr } = await supabase.from('embrioes').delete().in('id', ids);

    if (delErr) console.error('Error deleting:', delErr);
    else console.log('Successfully deleted duplicates.');

    // 6. Reset Job Status to pending? No, user will run query again manually.
}

const id = process.argv[2];
if (id) cleanupDuplicates(id);
else console.log('Please provide Queue ID');
