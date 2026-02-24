async function main() {
    const res = await fetch('https://twsnzfzjtjdamwwembzp.supabase.co/rest/v1/protocolo_receptoras?select=*&limit=1', {
        headers: {
            'apikey': 'sb_publishable_7JvdCYkOTDjvyGFcjyqT3w_bc92izWO',
            'Authorization': 'Bearer sb_publishable_7JvdCYkOTDjvyGFcjyqT3w_bc92izWO'
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}
main();
