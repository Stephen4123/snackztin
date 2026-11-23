const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const FALLBACK_DB_URL = Buffer.from(
  'cG9zdGdyZXNxbDovL25lb25kYl9vd25lcjpucGdfcmFRbzJnd2pSNG54QGVwLXByb3VkLWJyb29rLWJlZDM4Zjc5LXBvb2xlci5jLTkudXMtZWFzdC0yLmF3cy5uZW9uLnRlY2gvbmVvbmRiP3NzbG1vZGU9cmVxdWlyZQ==',
  'base64'
).toString('utf8');

const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB_URL;
const SITE_URL = 'https://snackztin.web.app';

async function generate() {
  console.log('🚀 Generating static product preview pages for WhatsApp & Social Crawlers...');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const productsRes = await pool.query('SELECT * FROM choco_products');
    const settingsRes = await pool.query('SELECT brand_name FROM choco_store_settings WHERE id = 1');
    const brand = settingsRes.rows[0]?.brand_name || 'SnackzTin';

    const indexHtmlPath = path.join(__dirname, '..', 'index.html');
    const templateHtml = fs.readFileSync(indexHtmlPath, 'utf8');

    const productsDir = path.join(__dirname, '..', 'product');
    if (!fs.existsSync(productsDir)) {
      fs.mkdirSync(productsDir, { recursive: true });
    }

    let count = 0;
    for (const p of productsRes.rows) {
      const rawImg = (Array.isArray(p.images) && p.images[0]) || '';
      const imgUrl = rawImg.startsWith('http') ? rawImg : `${SITE_URL}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
      const pageTitle = `${p.title} — ₹${p.price} | ${brand}`;
      
      let rawDesc = p.description || `Order ${p.title} at ₹${p.price} on ${brand}. Melt-free delivery across India.`;
      let pageDesc = rawDesc;
      if (rawDesc.length > 150) {
        const truncated = rawDesc.substring(0, 147);
        const lastSpace = truncated.lastIndexOf(' ');
        pageDesc = (lastSpace > 60 ? truncated.substring(0, lastSpace) : truncated) + '...';
      }
      const prodUrl = `${SITE_URL}/product/${p.id}`;

      let html = templateHtml;
      html = html.replace(/<title id="page-title">.*?<\/title>/i, `<title id="page-title">${pageTitle}</title>`);
      html = html.replace(/<meta name="title" content=".*?">/i, `<meta name="title" content="${pageTitle}">`);
      html = html.replace(/<meta name="description" content=".*?">/i, `<meta name="description" content="${pageDesc}">`);
      html = html.replace(/<meta property="og:title" id="og-title" content=".*?">/i, `<meta property="og:title" id="og-title" content="${pageTitle}">`);
      html = html.replace(/<meta property="og:description" id="og-desc" content=".*?">/i, `<meta property="og:description" id="og-desc" content="${pageDesc}">`);
      html = html.replace(/<meta property="og:image" id="og-image" content=".*?">/i, `<meta property="og:image" id="og-image" content="${imgUrl}">`);
      html = html.replace(/<meta property="og:image:secure_url" content=".*?">/i, `<meta property="og:image:secure_url" content="${imgUrl}">`);
      html = html.replace(/<meta property="og:url" content=".*?">/i, `<meta property="og:url" content="${prodUrl}">`);
      html = html.replace(/<meta name="twitter:title" content=".*?">/i, `<meta name="twitter:title" content="${pageTitle}">`);
      html = html.replace(/<meta name="twitter:description" content=".*?">/i, `<meta name="twitter:description" content="${pageDesc}">`);
      html = html.replace(/<meta name="twitter:image" content=".*?">/i, `<meta name="twitter:image" content="${imgUrl}">`);
      html = html.replace(/<link rel="image_src" href=".*?">/i, `<link rel="image_src" href="${imgUrl}">`);

      // Remove misleading hardcoded width/height so crawler uses native image aspect ratio
      html = html.replace(/<meta property="og:image:width" content=".*?">\s*/i, '');
      html = html.replace(/<meta property="og:image:height" content=".*?">\s*/i, '');

      // Write product/<id>/index.html
      const subDir = path.join(productsDir, p.id);
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
      fs.writeFileSync(path.join(subDir, 'index.html'), html, 'utf8');
      count++;
    }

    console.log(`✅ Successfully pre-rendered ${count} product pages with Open Graph tags!`);
  } catch (err) {
    console.error('❌ Error generating product pages:', err);
  } finally {
    await pool.end();
  }
}

generate();
