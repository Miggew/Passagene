
const URL = "https://embryoscore-pipeline-ijq3pphvbq-uc.a.run.app/health";

async function check() {
    try {
        const start = Date.now();
        const res = await fetch(URL);
        const data = await res.json();
        const end = Date.now();
        console.log(`Status: ${res.status}`);
        console.log(`Latency: ${end - start}ms`);
        console.log('Body:', data);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

check();
