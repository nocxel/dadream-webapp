
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qgmdmdadyboedpwhuzun.supabase.co';
const supabaseKey = 'sb_publishable_S1nUKMJv2LE5vRAF5ylYzQ_gyAe8Z4H';

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log("Probing Pin Details...");

    // 1. Get Rep ID
    const { data: reps } = await supabase.from('reps').select('id').eq('email', 'test@test.com').single();
    if (!reps) {
        console.error("Test user not found.");
        return;
    }
    const myId = reps.id;

    // 2. Fetch Pins
    const { data: pins, error } = await supabase.from('pins').select('*').eq('rep_id', myId);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${pins.length} total pins.`);
        pins.forEach((p, i) => {
            console.log(`[${i}] ID: ${p.id.slice(0, 6)}... | Title: "${p.title}" | Status: "${p.status}" | Pos: ${p.lat}, ${p.lng}`);
        });
    }
}

probe();
