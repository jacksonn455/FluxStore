const fs = require('fs');
const path = require('path');

function generateLargeCSV(rows = 200000) {
  console.log(`Generating CSV with ${rows} rows...`);

  const headers = 'name;price;expiration\n';
  const categories = [
    'Calypso - Lemonade',
    'Cheese - Grana Padano',
    'Cape Capensis - Fillet',
    'Alize Gold Passion',
    'Wine - White, Colubia Cresh',
    'Chevril',
    'Pork - Chop, Frenched',
    'Lamb - Whole, Fresh',
    'Pork - Shoulder',
    'Shrimp - Black Tiger 8 - 12',
    'Wine - Red, Cooking',
    'Icecream - Dibs',
  ];

  const filePath = path.join(__dirname, 'data', `products-${rows}.csv`);
  const stream = fs.createWriteStream(filePath);

  stream.write(headers);

  for (let i = 1; i <= rows; i++) {
    const name = categories[Math.floor(Math.random() * categories.length)];
    const price = (Math.random() * 200 + 1).toFixed(2);

    const year = 2023 + Math.floor(Math.random() * 3);
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const expiration = `${month}/${day}/${year}`;

    const id = Math.floor(Math.random() * 10000000000000000);

    const row = `${name} #(${id});$${price};${expiration}`;
    stream.write(row + '\n');

    if (i % 10000 === 0) {
      console.log(`  Generated ${i} rows...`);
    }
  }

  stream.end(() => {
    const stats = fs.statSync(filePath);
    console.log(
      `✅ products-${rows}.csv generated: ${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    );
  });
}

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

generateLargeCSV(1000);
generateLargeCSV(10000);
generateLargeCSV(100000);
generateLargeCSV(200000);
generateLargeCSV(500000);

console.log('📊 All CSV files generated successfully!');
