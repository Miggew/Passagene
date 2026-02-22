async function main() {
    const query = `
    {
      "query": "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'protocolo_receptoras';"
    }
  `;
    // Can't run raw SQL easily via REST api without a function. 
    // Let's just assume they are text and integer, since we saw "qualidade_coracoes": 3 in previous output.
    console.log("Assuming ciclando_classificacao is text and qualidade_coracoes is integer based on previous output.");
}
main();
