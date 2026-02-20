
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parser
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (!fs.existsSync(envPath)) return {};
        const content = fs.readFileSync(envPath, 'utf-8');
        const env: Record<string, string> = {};
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                let value = match[2].trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                env[match[1].trim()] = value;
            }
        });
        return env;
    } catch (e) {
        console.error('Failed to load .env', e);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
    console.log('Env keys found:', Object.keys(env));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLegacyData() {
    console.log('Checking for legacy data in embryo_scores...');

    const queries = [
        { col: 'morph_score', label: 'Morph Score' },
        { col: 'kinetic_score', label: 'Kinetic Score' },
        { col: 'stage', label: 'Stage (Legacy String)' },
        { col: 'icm_grade', label: 'ICM Grade' },
        { col: 'te_grade', label: 'TE Grade' },
        { col: 'morph_notes', label: 'Morph Notes' },
        { col: 'kinetic_notes', label: 'Kinetic Notes' },
    ];

    for (const q of queries) {
        const { count, error } = await supabase
            .from('embryo_scores')
            .select('*', { count: 'exact', head: true })
            .not(q.col, 'is', null);

        if (error) {
            console.error(`Error checking ${q.label}:`, error.message);
        } else {
            console.log(`${q.label}: ${count} rows`);
        }
    }
}

checkLegacyData();
