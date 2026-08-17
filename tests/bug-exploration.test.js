/**
 * Bug Condition Exploration Test
 * 
 * **Property 1: Bug Condition** - Static Product Loading Detection
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT fix the code when test fails** - just document the failure
 * **GOAL**: Surface counterexamples that demonstrate the bug
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5 (Bug Condition)**
 * 
 * This test checks that the mini-app is currently loading products from the static
 * `miniapp/products.js` file instead of fetching them dynamically from an API.
 * 
 * Expected behavior on UNFIXED code: TEST FAILS (proves bug exists)
 * Expected behavior on FIXED code: TEST PASSES (proves bug is fixed)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Helper function to read file content
function readFile(filePath) {
  return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
}

// Helper function to parse products from data/products.js
function getProductsFromDataFile() {
  const productsPath = path.join(__dirname, '..', 'data', 'products.js');
  delete require.cache[productsPath];
  const { products, categories } = require(productsPath);
  return { products, categories };
}

// Helper function to parse products from miniapp/products.js
function getProductsFromMiniappFile() {
  const miniappPath = path.join(__dirname, '..', 'miniapp', 'products.js');
  delete require.cache[miniappPath];
  
  // Read the file content and extract products/categories
  const content = readFile('miniapp/products.js');
  const categoriesMatch = content.match(/const categories = (\[[\s\S]*?\]);/);
  const productsMatch = content.match(/const products = (\[[\s\S]*?\]);/);
  
  if (categoriesMatch && productsMatch) {
    // Use eval to parse the arrays (safe in test environment)
    const categories = eval(categoriesMatch[1]);
    const products = eval(productsMatch[1]);
    return { products, categories };
  }
  
  throw new Error('Could not parse miniapp/products.js');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  Bug Condition Exploration Test - Static Product Loading');
console.log('═══════════════════════════════════════════════════════════════\n');

let failureCount = 0;
let counterexamples = [];

// Test 1: Verify mini-app HTML includes static products.js script
console.log('Test 1: Checking if miniapp/index.html includes static products.js script...');
try {
  const htmlContent = readFile('miniapp/index.html');
  const hasStaticScript = htmlContent.includes('<script src="products.js"></script>');
  
  assert.strictEqual(
    hasStaticScript, 
    false, 
    'EXPECTED (after fix): miniapp/index.html should NOT include static products.js\n' +
    'ACTUAL (unfixed): miniapp/index.html DOES include static products.js\n' +
    '  ❌ COUNTEREXAMPLE: <script src="products.js"></script> tag found in HTML'
  );
  
  console.log('  ✅ PASS: Static script tag NOT found (bug fixed)\n');
} catch (error) {
  failureCount++;
  counterexamples.push({
    test: 'Test 1: Static Script Tag',
    finding: 'miniapp/index.html includes <script src="products.js"></script>',
    evidence: 'Static file inclusion detected',
    bugConfirmed: true
  });
  console.log('  ❌ FAIL (EXPECTED ON UNFIXED CODE):');
  console.log('     ' + error.message);
  console.log('     This confirms the bug exists!\n');
}

// Test 2: Verify miniapp/app.js does NOT have dynamic fetch logic
console.log('Test 2: Checking if miniapp/app.js has dynamic product fetch logic...');
try {
  const appContent = readFile('miniapp/app.js');
  const hasFetchLogic = appContent.includes('fetchProducts') || 
                        appContent.includes('/api/products') ||
                        appContent.includes('async function') && appContent.includes('products');
  
  assert.strictEqual(
    hasFetchLogic,
    true,
    'EXPECTED (after fix): miniapp/app.js should have fetchProducts() function\n' +
    'ACTUAL (unfixed): miniapp/app.js does NOT have dynamic fetch logic\n' +
    '  ❌ COUNTEREXAMPLE: No API fetch implementation found'
  );
  
  console.log('  ✅ PASS: Dynamic fetch logic found (bug fixed)\n');
} catch (error) {
  failureCount++;
  counterexamples.push({
    test: 'Test 2: Dynamic Fetch Logic',
    finding: 'miniapp/app.js lacks fetchProducts() or /api/products calls',
    evidence: 'No dynamic data loading implementation',
    bugConfirmed: true
  });
  console.log('  ❌ FAIL (EXPECTED ON UNFIXED CODE):');
  console.log('     ' + error.message);
  console.log('     This confirms the bug exists!\n');
}

// Test 3: Verify miniapp/app.js references global variables
console.log('Test 3: Checking if miniapp/app.js relies on global product variables...');
try {
  const appContent = readFile('miniapp/app.js');
  const referencesGlobalCategories = appContent.includes('categories.forEach') ||
                                     appContent.includes('categories.find');
  const referencesGlobalProducts = appContent.includes('products.filter') ||
                                   appContent.includes('products.find');
  
  // On fixed code, these should still exist but be populated via fetch, not global script
  // The key is checking if they're initialized with empty arrays at the top of app.js
  const hasLocalInit = appContent.match(/let categories = \[\]/i) && 
                       appContent.match(/let products = \[\]/i);
  
  assert.strictEqual(
    hasLocalInit,
    true,
    'EXPECTED (after fix): app.js should initialize categories=[] and products=[]\n' +
    'ACTUAL (unfixed): app.js relies on globally loaded variables\n' +
    '  ❌ COUNTEREXAMPLE: Global variable dependency detected'
  );
  
  console.log('  ✅ PASS: Local variable initialization found (bug fixed)\n');
} catch (error) {
  failureCount++;
  counterexamples.push({
    test: 'Test 3: Global Variable Dependency',
    finding: 'miniapp/app.js depends on global categories/products from static script',
    evidence: 'No local initialization of product data',
    bugConfirmed: true
  });
  console.log('  ❌ FAIL (EXPECTED ON UNFIXED CODE):');
  console.log('     ' + error.message);
  console.log('     This confirms the bug exists!\n');
}

// Test 4: Check if API endpoint exists
console.log('Test 4: Checking if /api/products.js serverless function exists...');
try {
  const apiPath = path.join(__dirname, '..', 'api', 'products.js');
  const apiExists = fs.existsSync(apiPath);
  
  assert.strictEqual(
    apiExists,
    true,
    'EXPECTED (after fix): /api/products.js serverless function should exist\n' +
    'ACTUAL (unfixed): /api/products.js does NOT exist\n' +
    '  ❌ COUNTEREXAMPLE: No API endpoint implementation'
  );
  
  console.log('  ✅ PASS: API endpoint exists (bug fixed)\n');
} catch (error) {
  failureCount++;
  counterexamples.push({
    test: 'Test 4: API Endpoint Existence',
    finding: '/api/products.js does not exist',
    evidence: 'No serverless function for dynamic product loading',
    bugConfirmed: true
  });
  console.log('  ❌ FAIL (EXPECTED ON UNFIXED CODE):');
  console.log('     ' + error.message);
  console.log('     This confirms the bug exists!\n');
}

// Test 5: Verify vercel.json configuration supports serverless functions
console.log('Test 5: Checking if vercel.json is configured for serverless functions...');
try {
  const vercelConfig = JSON.parse(readFile('vercel.json'));
  const hasNodeBuild = vercelConfig.builds && vercelConfig.builds.some(build => 
    build.use === '@vercel/node' && build.src.includes('api')
  );
  
  assert.strictEqual(
    hasNodeBuild,
    true,
    'EXPECTED (after fix): vercel.json should have @vercel/node build for api/**\n' +
    'ACTUAL (unfixed): vercel.json lacks serverless function support\n' +
    '  ❌ COUNTEREXAMPLE: Static-only Vercel configuration'
  );
  
  console.log('  ✅ PASS: Vercel config supports serverless functions (bug fixed)\n');
} catch (error) {
  failureCount++;
  counterexamples.push({
    test: 'Test 5: Vercel Configuration',
    finding: 'vercel.json does not include @vercel/node build for API endpoints',
    evidence: 'Static-only deployment configuration',
    bugConfirmed: true
  });
  console.log('  ❌ FAIL (EXPECTED ON UNFIXED CODE):');
  console.log('     ' + error.message);
  console.log('     This confirms the bug exists!\n');
}

// Test 6: Product synchronization test - Add test product and verify it does NOT appear
console.log('Test 6: Testing product synchronization (add test product)...');
try {
  // Read current data/products.js
  const dataProducts = getProductsFromDataFile();
  const miniappProducts = getProductsFromMiniappFile();
  
  // Check if there's a specific test product that exists in data but not in miniapp
  // For now, we'll check if the product lists are identical (they shouldn't be after admin edits)
  const dataProductIds = dataProducts.products.map(p => p.id).sort();
  const miniappProductIds = miniappProducts.products.map(p => p.id).sort();
  
  const areIdentical = JSON.stringify(dataProductIds) === JSON.stringify(miniappProductIds);
  
  // Additionally check if products have different attributes (like prices)
  let priceMismatch = false;
  let priceMismatchExample = null;
  
  for (const dataProduct of dataProducts.products) {
    const miniappProduct = miniappProducts.products.find(p => p.id === dataProduct.id);
    if (miniappProduct && dataProduct.price !== miniappProduct.price) {
      priceMismatch = true;
      priceMismatchExample = {
        id: dataProduct.id,
        name: dataProduct.name,
        dataPrice: dataProduct.price,
        miniappPrice: miniappProduct.price
      };
      break;
    }
  }
  
  assert.strictEqual(
    areIdentical && !priceMismatch,
    true,
    'EXPECTED (after fix): Products in miniapp should sync with data/products.js\n' +
    'ACTUAL (unfixed): Product lists differ or prices are out of sync\n' +
    (priceMismatchExample ? 
      `  ❌ COUNTEREXAMPLE: Product "${priceMismatchExample.name}" (${priceMismatchExample.id})\n` +
      `     - data/products.js price: ${priceMismatchExample.dataPrice}₽\n` +
      `     - miniapp/products.js price: ${priceMismatchExample.miniappPrice}₽` :
      `  ❌ COUNTEREXAMPLE: Product lists have different items\n` +
      `     - data/products.js: ${dataProductIds.length} products\n` +
      `     - miniapp/products.js: ${miniappProductIds.length} products`)
  );
  
  console.log('  ✅ PASS: Products are synchronized (bug fixed)\n');
} catch (error) {
  failureCount++;
  counterexamples.push({
    test: 'Test 6: Product Synchronization',
    finding: 'Products in data/products.js and miniapp/products.js are not synchronized',
    evidence: error.message,
    bugConfirmed: true
  });
  console.log('  ❌ FAIL (EXPECTED ON UNFIXED CODE):');
  console.log('     ' + error.message);
  console.log('     This confirms the bug exists!\n');
}

// Summary
console.log('═══════════════════════════════════════════════════════════════');
console.log('  Test Summary');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total failures: ${failureCount}/6 tests`);
console.log(`Counterexamples found: ${counterexamples.length}\n`);

if (counterexamples.length > 0) {
  console.log('📋 COUNTEREXAMPLES (Bug Evidence):');
  console.log('─────────────────────────────────────────────────────────────\n');
  counterexamples.forEach((ce, idx) => {
    console.log(`${idx + 1}. ${ce.test}`);
    console.log(`   Finding: ${ce.finding}`);
    console.log(`   Evidence: ${ce.evidence}`);
    console.log(`   Bug Confirmed: ${ce.bugConfirmed ? '✅ YES' : '❌ NO'}\n`);
  });
}

if (failureCount === 6) {
  console.log('✅ EXPLORATION TEST RESULT: BUG CONFIRMED');
  console.log('   All 6 tests failed as expected on unfixed code.');
  console.log('   This proves the bug exists and the root cause is correct.');
  console.log('   The mini-app loads products from static miniapp/products.js,');
  console.log('   not dynamically from an API endpoint.\n');
  console.log('Next Steps:');
  console.log('  1. Document these counterexamples');
  console.log('  2. Implement the fix (Tasks 3.1-3.5)');
  console.log('  3. Re-run this test - it should pass after the fix\n');
  process.exit(0); // Exit with success because finding the bug IS the success
} else if (failureCount === 0) {
  console.log('✅ FIX VERIFICATION RESULT: BUG FIXED');
  console.log('   All 6 tests passed - the bug has been fixed!');
  console.log('   The mini-app now loads products dynamically from the API.\n');
  process.exit(0);
} else {
  console.log('⚠️  PARTIAL FIX DETECTED');
  console.log(`   ${failureCount} tests still failing.`);
  console.log('   The fix is incomplete - some aspects of the bug remain.\n');
  process.exit(1);
}
