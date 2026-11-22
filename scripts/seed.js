const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const categories = [
  { id: 'cat_mix', name: 'Chocolate Mixtures & Crunch', icon: '🥜', subcategories: ['Nutty Trail Mix', 'Pretzel Crunch', 'Berry Medley', 'Roasted Seed Mix'] },
  { id: 'cat_dark', name: 'Dark Chocolates', icon: '🍫', subcategories: ['Single Origin', '70% Intense', '85% Extra Dark', 'Sea Salt Dark'] },
  { id: 'cat_milk', name: 'Milk & Creamy Chocolates', icon: '🥛', subcategories: ['Classic Milk Silk', 'Roasted Hazelnut', 'Caramel Crunch', 'Coffee Infused'] },
  { id: 'cat_truffles', name: 'Handcrafted Truffles & Bonbons', icon: '✨', subcategories: ['French Ganache', 'Belgian Truffles', 'Raspberry Bonbons', 'Espresso Truffle'] },
  { id: 'cat_nutty', name: 'Nutty Barks & Clusters', icon: '🌰', subcategories: ['Almond Rocher', 'Cashew Bark', 'Pistachio Cranberry', 'Hazelnut Bark'] },
  { id: 'cat_hampers', name: 'Luxury Gift Boxes & Hampers', icon: '🎁', subcategories: ['Mix & Bar Hamper', 'Assorted Box of 12', 'Celebration Hamper', 'Festive Gold Box'] },
  { id: 'cat_healthy', name: 'Sugar-Free & Keto Treats', icon: '🌿', subcategories: ['Stevia Sweetened 85%', 'Keto Dark Almonds', 'Monk Fruit Dark', 'Vegan Oat-Milk'] }
];

const sampleProducts = [
  {
    id: 'choco_prod_mix_01',
    title: 'Royal Roasted Dry-Fruit & Dark Chocolate Trail Mixture',
    category: 'Chocolate Mixtures & Crunch',
    sub_category: 'Nutty Trail Mix',
    cocoa_percentage: '65% Rich Cocoa Droplets',
    mrp: 599,
    price: 499,
    rating: 5.0,
    review_count: 64,
    featured: true,
    best_seller: true,
    new_arrival: false,
    dietary: '100% Vegetarian (Eggless)',
    shelf_life: '6 Months (Store in 15°C - 20°C)',
    ingredients: 'California Roasted Almonds, Creamy Cashew Halves, Iranian Pistachios, Sun-Dried Cranberries, Pumpkin Seeds, and Handcrafted 65% Belgian Dark Chocolate Chunks.',
    description: 'An irresistible gourmet mixture combining whole slow-roasted nuts, plump dried berries, crunchy roasted seeds, and bite-sized Belgian dark chocolate drops. The ultimate crunchy, sweet, and wholesome snacking blend.',
    images: [
      'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80',
      'https://images.unsplash.com/photo-1575372587186-500b3d1ee98a?w=800&q=80'
    ],
    variants: { '250g Jar': 30, '500g Value Pack': 20, '1kg Family Tub': 12 }
  },
  {
    id: 'choco_prod_mix_02',
    title: 'Salted Caramel Pretzel & Milk Chocolate Crunch Mix',
    category: 'Chocolate Mixtures & Crunch',
    sub_category: 'Pretzel Crunch',
    cocoa_percentage: '45% Alpine Milk Chocolate',
    mrp: 540,
    price: 420,
    rating: 4.9,
    review_count: 48,
    featured: true,
    best_seller: true,
    new_arrival: true,
    dietary: '100% Vegetarian (Eggless)',
    shelf_life: '5 Months',
    ingredients: 'Crispy Mini Sea-Salted Pretzels, Toffee Crunch Clusters, Roasted Peanuts, and Thick Creamy Milk Chocolate Coating.',
    description: 'The golden balance of sweet and savory! Crispy salted pretzels tossed with butter toffee nuggets and smothered in smooth alpine milk chocolate. Guaranteed to satisfy any craving.',
    images: [
      'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=800&q=80',
      'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80'
    ],
    variants: { '200g Pouch': 35, '400g Tin': 22 }
  },
  {
    id: 'choco_prod_mix_03',
    title: 'Chocolate Coated Golden Almonds & Berry Medley Mixture',
    category: 'Chocolate Mixtures & Crunch',
    sub_category: 'Berry Medley',
    cocoa_percentage: 'Dark & White Chocolate Duo',
    mrp: 650,
    price: 540,
    rating: 4.8,
    review_count: 37,
    featured: false,
    best_seller: false,
    new_arrival: true,
    dietary: '100% Vegetarian (Eggless)',
    shelf_life: '6 Months',
    ingredients: 'Jumbo Roasted California Almonds dipped in Dark Cocoa, Sweet Blueberries coated in Ivory White Chocolate, and Tangy Cranberries.',
    description: 'A colorful blend of dark chocolate-dipped almonds and white chocolate-coated blueberries and tart cranberries. Offers bursts of fruity freshness alongside deep cocoa crunch.',
    images: [
      'https://images.unsplash.com/photo-1582293041079-7814c2f12063?w=800&q=80',
      'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800&q=80'
    ],
    variants: { '250g Jar': 25, '500g Jar': 15 }
  },
  {
    id: 'choco_prod_01',
    title: 'Signature Belgian Dark Truffle Collection',
    category: 'Handcrafted Truffles & Bonbons',
    sub_category: 'Belgian Truffles',
    cocoa_percentage: '70% Cocoa',
    mrp: 799,
    price: 649,
    rating: 4.9,
    review_count: 38,
    featured: true,
    best_seller: true,
    new_arrival: false,
    dietary: '100% Vegetarian (Eggless)',
    shelf_life: '3 Months (Store in 15°C - 20°C)',
    ingredients: 'Pure Cocoa Butter, 70% Dark Chocolate Mass, Dairy Cream Ganache, Cocoa Powder Dust, Madagascar Bourbon Vanilla.',
    description: 'Silky, melt-in-the-mouth Belgian dark chocolate truffles with a rich velvet ganache center, dusted in single-origin cocoa powder. Perfect for gourmet gifting and personal indulgence.',
    images: [
      'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800&q=80',
      'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=800&q=80'
    ],
    variants: { 'Box of 6': 25, 'Box of 12': 18, 'Box of 24': 10 }
  },
  {
    id: 'choco_prod_02',
    title: 'Madagascar 72% Single Origin Artisan Dark Bar',
    category: 'Dark Chocolates',
    sub_category: 'Single Origin',
    cocoa_percentage: '72% Single Origin',
    mrp: 350,
    price: 280,
    rating: 4.9,
    review_count: 52,
    featured: true,
    best_seller: false,
    new_arrival: false,
    dietary: '100% Vegan & Eggless',
    shelf_life: '9 Months',
    ingredients: 'Organic Madagascar Cocoa Beans, Pure Cocoa Butter, Unrefined Raw Cane Sugar.',
    description: 'Bean-to-bar artisanal dark chocolate crafted exclusively from Madagascar Trinitario beans, showcasing bright fruity notes with a hint of red berries and citrus zest.',
    images: [
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80',
      'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80'
    ],
    variants: { '100g Bar': 40, '200g Pack (2x)': 25, '500g Slab': 12 }
  },
  {
    id: 'choco_prod_03',
    title: 'Roasted California Almond & Himalayan Pink Salt Bark',
    category: 'Nutty Barks & Clusters',
    sub_category: 'Almond Rocher',
    cocoa_percentage: '60% Semi-Dark Cocoa',
    mrp: 499,
    price: 399,
    rating: 4.8,
    review_count: 29,
    featured: false,
    best_seller: false,
    new_arrival: true,
    dietary: '100% Vegetarian (Eggless)',
    shelf_life: '6 Months',
    ingredients: 'Slow-Roasted California Almonds, 60% Dark Chocolate, Himalayan Pink Rock Salt Crystals, Natural Vanilla Extract.',
    description: 'Thick, crunchy artisan bark loaded with whole slow-roasted California almonds and sprinkled with pure Himalayan pink salt to create the quintessential sweet-and-savory crunch.',
    images: [
      'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80',
      'https://images.unsplash.com/photo-1575372587186-500b3d1ee98a?w=800&q=80'
    ],
    variants: { '150g Pouch': 30, '300g Tin': 20, '500g Jar': 15 }
  },
  {
    id: 'choco_prod_05',
    title: 'Grand Royal Gourmet Hamper (Chocolates & Mixtures)',
    category: 'Luxury Gift Boxes & Hampers',
    sub_category: 'Mix & Bar Hamper',
    cocoa_percentage: 'Assorted Gourmet Selection',
    mrp: 2199,
    price: 1799,
    rating: 5.0,
    review_count: 42,
    featured: true,
    best_seller: true,
    new_arrival: true,
    dietary: '100% Vegetarian (Eggless)',
    shelf_life: '4 Months',
    ingredients: 'Includes 1x Royal Nut Trail Mixture Jar (250g), 1x Salted Pretzel Crunch Tin (200g), 12x Belgian Truffles, 2x Dark Chocolate Bars, and Golden Greeting Card.',
    description: 'The definitive luxury hamper uniting our best-selling artisanal dark chocolates with crunchy nut and pretzel mixtures. Packaged in a velvet-lined chest with golden satin ribbon.',
    images: [
      'https://images.unsplash.com/photo-1526081347589-7fa3cb41b4b2?w=800&q=80',
      'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800&q=80'
    ],
    variants: { 'Grand Hamper Chest': 15, 'Royal Deluxe Hamper': 8 }
  },
  {
    id: 'choco_prod_07',
    title: 'Zero Sugar 85% Keto Dark Chocolate with Stevia',
    category: 'Sugar-Free & Keto Treats',
    sub_category: 'Stevia Sweetened 85%',
    cocoa_percentage: '85% Extra Dark (Zero Added Sugar)',
    mrp: 420,
    price: 340,
    rating: 4.7,
    review_count: 19,
    featured: false,
    best_seller: false,
    new_arrival: false,
    dietary: 'Keto Friendly, Sugar-Free, Diabetic Safe, Vegan',
    shelf_life: '12 Months',
    ingredients: '85% Pure Cocoa Mass & Cocoa Butter, Organic Plant-Based Stevia Extract, Erythritol, Sunflower Lecithin.',
    description: 'Guilt-free indulgence crafted for diabetic, keto, and health-conscious chocolate lovers. Rich, velvety dark chocolate with zero sugar spike and no bitter aftertaste.',
    images: [
      'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=800&q=80',
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80'
    ],
    variants: { '90g Bar': 35, 'Pack of 3 (270g)': 18 }
  }
];

async function seed() {
  console.log('[ChocoLux Seed] 🚀 Seeding categories and chocolate mixtures...');
  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

  try {
    await pool.query(schemaSql);

    // Seed Categories
    for (const cat of categories) {
      await pool.query(
        `INSERT INTO choco_categories (id, name, icon, subcategories)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET
           icon = EXCLUDED.icon,
           subcategories = EXCLUDED.subcategories,
           updated_at = CURRENT_TIMESTAMP`,
        [cat.id, cat.name, cat.icon, JSON.stringify(cat.subcategories)]
      );
    }
    console.log(`[ChocoLux Seed] ✅ Seeded ${categories.length} categories.`);

    // Seed Products
    for (const p of sampleProducts) {
      await pool.query(
        `INSERT INTO choco_products (
          id, title, category, sub_category, cocoa_percentage, mrp, price,
          rating, review_count, featured, best_seller, new_arrival,
          dietary, shelf_life, ingredients, description, images, variants
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          category = EXCLUDED.category,
          sub_category = EXCLUDED.sub_category,
          cocoa_percentage = EXCLUDED.cocoa_percentage,
          mrp = EXCLUDED.mrp,
          price = EXCLUDED.price,
          description = EXCLUDED.description,
          images = EXCLUDED.images,
          variants = EXCLUDED.variants,
          updated_at = CURRENT_TIMESTAMP`,
        [
          p.id, p.title, p.category, p.sub_category, p.cocoa_percentage, p.mrp, p.price,
          p.rating, p.review_count, p.featured, p.best_seller, p.new_arrival,
          p.dietary, p.shelf_life, p.ingredients, p.description,
          JSON.stringify(p.images), JSON.stringify(p.variants)
        ]
      );
    }
    console.log(`[ChocoLux Seed] ✅ Seeded ${sampleProducts.length} chocolate & mixture products.`);
  } catch (err) {
    console.error('[ChocoLux Seed] ❌ Error:', err);
  } finally {
    await pool.end();
  }
}

seed();
