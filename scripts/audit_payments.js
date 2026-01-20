const fs = require('fs');
const { Client } = require('pg');

// Service Role Key or credentials
const client = new Client({
    user: "postgres.whpbetjyhpttinbxcffs",
    host: "aws-1-eu-west-3.pooler.supabase.com",
    database: "postgres",
    password: "#1rkB&njQ$Gn5C31BWwf",
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = [];
        let inQuote = false;
        let token = '';
        for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            if (char === '"') { inQuote = !inQuote; continue; }
            if (char === ',' && !inQuote) {
                row.push(token); token = '';
            } else {
                token += char;
            }
        }
        row.push(token);
        const obj = {};
        headers.forEach((h, idx) => obj[h] = row[idx]);
        result.push(obj);
    }
    return result;
}

async function run() {
    await client.connect();
    console.log("Reading CSVs...");
    const csvPassive = parseCSV(fs.readFileSync('/Users/davidegentile/Documents/app dev/gleeye erp/tabelle_airtable/Fatture Passive-Grid view (1).csv', 'utf8'));
    const csvPayments = parseCSV(fs.readFileSync('/Users/davidegentile/Documents/app dev/gleeye erp/tabelle_airtable/Pagamenti-Grid view (1).csv', 'utf8'));

    // Check Orders Column availability
    const invWithOrders = csvPassive.filter(r => r['Ordini'] && r['Ordini'].trim() !== '');
    console.log(`Invoices with 'Ordini' populated: ${invWithOrders.length}`);
    if (invWithOrders.length > 0) {
        console.log("Example Orders:", invWithOrders[0]['Ordini'], invWithOrders[9]?.['Ordini']);
    }

    // MAP Payments by Name
    const paymentMap = new Map();
    csvPayments.forEach(p => paymentMap.set(p['Name'], p));

    // Get DB Linking State
    const dbPayments = (await client.query("SELECT id, title, amount, passive_invoice_id, invoice_id FROM payments")).rows;
    const dbPassiveInvoices = (await client.query("SELECT id, invoice_number, amount_tax_included, collaborator_id, supplier_id FROM passive_invoices")).rows;

    console.log("\n--- AUDIT: Payment mismatches ---");
    let mismatches = 0;

    // Simulate Mapping logic
    for (const invRow of csvPassive) {
        // Find DB Invoice
        // We know V6 logic: Number + Amount match.
        const csvAmt = parseFloat(invRow['Importo'].replace('€', '').replace('.', '').replace(',', '.').trim());
        const invNum = invRow['N.'];
        const dbInv = dbPassiveInvoices.find(i => i.invoice_number === invNum && Math.abs((parseFloat(i.amount_tax_included) || 0) - csvAmt) < 0.1);

        if (!dbInv) continue; // Cant audit if not linked in our logic

        // Expected Payment from CSV
        const payNames = (invRow['Pagamenti 2'] || invRow['Pagamenti'] || '').split(',').map(s => s.trim()).filter(s => s);

        // Find DB Payments actually linked to this dbInv
        const actualLinked = dbPayments.filter(p => p.passive_invoice_id === dbInv.id);

        // Compare
        // For each expected payment name in CSV, do we have a linked payment with that Amount/Date?
        // CSV Payment Info:
        for (const pName of payNames) {
            const csvPay = paymentMap.get(pName);
            if (!csvPay) {
                // console.log(`CSV says Inv ${invNum} links to Payment '${pName}' but not found in Pagamenti.csv`);
                continue;
            }

            // Expected Amount
            const expAmt = parseFloat(csvPay['Importo'].replace('€', '').replace('.', '').replace(',', '.').trim());

            // Do we have ONE linked payment with this amount?
            const match = actualLinked.find(p => Math.abs(parseFloat(p.amount) - expAmt) < 0.1);
            if (!match) {
                mismatches++;
                console.log(`[MISMATCH] Inv ${invNum} expects '${pName}' (${expAmt}€). DB has ${actualLinked.length} linked: [${actualLinked.map(p => p.amount).join(', ')}]`);
            }
        }
    }

    console.log(`Total Mismatches found: ${mismatches}`);
    await client.end();
}

run();
