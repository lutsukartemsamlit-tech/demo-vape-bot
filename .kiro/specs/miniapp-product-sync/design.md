# Mini-App Product Sync Bugfix Design

## Overview

The mini-app deployed on Vercel currently loads products from a static hardcoded file (`miniapp/products.js`) that is bundled at deployment time. This creates a critical synchronization issue: when administrators update products through the bot's admin panel (which modifies `data/products.js`), these changes are not reflected in the customer-facing mini-app. The fix implements a dynamic product loading system where the mini-app fetches current product data from an API endpoint that reads directly from `data/products.js`.

**Impact**: This bug prevents customers from seeing accurate product information including new products, updated prices, stock levels, flavors, and product availability changes made by administrators.

**Fix Strategy**: Replace static product loading with a serverless API endpoint on Vercel that dynamically serves product data from `data/products.js`, ensuring the mini-app always displays current product information.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the mini-app loads products from the static `miniapp/products.js` file instead of fetching current data dynamically
- **Property (P)**: The desired behavior - products displayed in the mini-app should always reflect the current state of `data/products.js`
- **Preservation**: Existing UI/UX, navigation, cart operations, order submission, and Telegram integration that must remain unchanged
- **`miniapp/app.js`**: The client-side JavaScript that controls the mini-app interface and currently references global variables `categories` and `products` loaded from `miniapp/products.js`
- **`data/products.js`**: The source of truth for product data, updated by the admin panel via the bot
- **Serverless Function**: A Vercel serverless function that executes on-demand to read and serve data without requiring a persistent server
- **Static Site**: The current Vercel deployment model where all files are served as-is without server-side processing

## Bug Details

### Bug Condition

The bug manifests when the mini-app initializes and loads product data. The `miniapp/index.html` file includes `<script src="products.js"></script>` which loads the static `miniapp/products.js` file into global scope, creating `categories` and `products` arrays. The `miniapp/app.js` then references these global variables throughout the application. Because `miniapp/products.js` is a static file bundled at deploy time, it never reflects changes made to `data/products.js` by the admin panel.

**Formal Specification:**
```
FUNCTION isBugCondition(dataSource)
  INPUT: dataSource of type ProductLoadingMechanism
  OUTPUT: boolean
  
  RETURN dataSource.loadMethod = "static_file_include"
         AND dataSource.filePath = "miniapp/products.js"
         AND dataSource.deployTimeSnapshot = true
         AND NOT dataSource.dynamicFetch
END FUNCTION
```

### Examples

**Example 1: New Product Addition**
- Admin adds "VOZOL Star 6000" (price: 1190₽, stock: 15) via bot admin panel
- System writes new product to `data/products.js`
- Customer opens mini-app: "VOZOL Star 6000" does NOT appear (displays old static list)
- **Expected**: "VOZOL Star 6000" should appear in the disposable category immediately

**Example 2: Price Update**
- Admin updates "Elf Bar 5000" price from 890₽ to 990₽ via admin panel
- System updates price in `data/products.js`
- Customer views "Elf Bar 5000" in mini-app: Still shows 890₽
- **Expected**: Should display updated price 990₽

**Example 3: Flavor Stock Management**
- Admin disables "Кислая вишня" flavor for "Annima Love Gold Edition" (sets `enabled: false`)
- System updates flavor in `data/products.js`
- Customer views product: "Кислая вишня" still appears as available option
- **Expected**: "Кислая вишня" should not appear in the flavor selection list

**Example 4: Category Modification**
- Admin adds new category "Аксессуары" (icon: 🎒)
- System adds category to `data/products.js`
- Customer views home screen: "Аксессуары" category does NOT appear
- **Expected**: New category should appear on home screen

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All UI/UX navigation flows (home → category → product → detail → cart → checkout) must work identically
- Cart operations (add, remove, quantity changes, total calculation) must continue to function exactly as before
- Order submission via Telegram WebApp `sendData()` must remain unchanged
- Telegram integration initialization (`tg.ready()`, `tg.expand()`) must work as before
- Product display logic including parent-child relationships (e.g., Annima with subProducts) must render identically
- Flavor filtering (enabled/disabled flags), color selection, and options selection must work as before
- Image display using Telegram file IDs must continue to render correctly
- Chat functionality must remain unchanged
- All CSS styling and visual appearance must be preserved
- Toast notifications and user feedback mechanisms must work identically

**Scope:**
All functionality NOT related to the initial product data loading should be completely unaffected by this fix. This includes:
- User interactions with already-loaded product data
- Navigation between screens
- Cart state management
- Form handling and validation
- Error handling for images and network requests
- Telegram WebApp API interactions

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Static File Inclusion in HTML**: The `miniapp/index.html` includes `<script src="products.js"></script>` which loads `miniapp/products.js` as a static script tag. This file is bundled at deploy time and never updates.

2. **Global Variable Dependency**: The `miniapp/app.js` references global variables `categories` and `products` that are defined in `miniapp/products.js`. These are captured at the time of deployment.

3. **No Dynamic Data Fetching**: There is no code in `miniapp/app.js` that fetches product data from an API or external source. The app assumes products are available globally at initialization.

4. **Vercel Configuration for Static-Only Serving**: The current `vercel.json` configuration uses `@vercel/static` build and routes everything to static files, with no serverless function support:
   ```json
   {
     "builds": [{ "src": "miniapp/**", "use": "@vercel/static" }],
     "routes": [{ "src": "/(.*)", "dest": "/miniapp/$1" }]
   }
   ```

5. **Two Separate Product Files**: The system maintains two separate product files (`data/products.js` for admin panel, `miniapp/products.js` for mini-app) with no synchronization mechanism between them.

## Correctness Properties

Property 1: Bug Condition - Dynamic Product Loading

_For any_ mini-app load where the user accesses the application, the fixed system SHALL fetch the current product list dynamically from an API endpoint that reads `data/products.js`, ensuring all products, categories, prices, stock levels, flavors, and attributes reflect the most recent changes made by administrators via the admin panel.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - UI/UX and Feature Behavior

_For any_ user interaction that does NOT involve the initial product data loading mechanism (navigation, cart operations, order submission, Telegram integration, product display logic, flavor selection), the fixed system SHALL produce exactly the same behavior as the original system, preserving all existing functionality and user experience.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the following changes are needed:

#### File 1: Create `/api/products.js` (New Serverless Function)

**Purpose**: Serverless function that reads `data/products.js` and returns product data as JSON

**Implementation**:
```javascript
// /api/products.js
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    // Read the products file from data directory
    const productsPath = path.join(process.cwd(), 'data', 'products.js');
    const productsContent = fs.readFileSync(productsPath, 'utf8');
    
    // Extract categories and products from the module.exports
    // Since data/products.js uses module.exports = { products, categories }
    // we need to evaluate it safely or parse it
    
    // Option 1: Use require (if Vercel supports it)
    delete require.cache[productsPath]; // Clear cache to get fresh data
    const { products, categories } = require(productsPath);
    
    // Return as JSON
    res.status(200).json({
      success: true,
      categories: categories,
      products: products
    });
  } catch (error) {
    console.error('Error reading products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load products',
      message: error.message
    });
  }
};
```

**Error Handling**:
- File not found: Return 500 error with descriptive message
- Parse error: Return 500 error indicating malformed product data
- Unexpected errors: Log to console and return generic 500 error

#### File 2: Update `vercel.json`

**Purpose**: Configure Vercel to support serverless functions and route API requests correctly

**Changes**:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    },
    {
      "src": "miniapp/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/miniapp/$1"
    }
  ]
}
```

**Explanation**:
- Add `@vercel/node` builder for serverless functions in `/api` directory
- Keep `@vercel/static` builder for static mini-app files
- Route `/api/*` requests to serverless functions first
- Route all other requests to static files (maintains existing behavior)

#### File 3: Modify `miniapp/app.js`

**Purpose**: Replace global variable references with dynamic API fetch

**Specific Changes**:

1. **Remove Global Variable Declarations** (lines 5-6):
```javascript
// REMOVE: These lines are no longer needed
// let cart = [];
// let history = [];
```

2. **Add Product State Variables** (after line 3):
```javascript
// ─── Telegram WebApp init ────────────────────────────────────────────────────
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ─── Product Data State ──────────────────────────────────────────────────────
let categories = [];
let products = [];
let productsLoaded = false;

// ─── State ───────────────────────────────────────────────────────────────────
let cart = [];
// ... rest of state variables
```

3. **Add Dynamic Fetch Function** (before showHome function):
```javascript
// ─── Load Products ───────────────────────────────────────────────────────────
async function fetchProducts() {
  // Show loading indicator
  showLoadingIndicator();
  
  try {
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (data.success) {
      categories = data.categories;
      products = data.products;
      productsLoaded = true;
      hideLoadingIndicator();
      return true;
    } else {
      throw new Error(data.error || 'Failed to load products');
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    hideLoadingIndicator();
    showToast('⚠️ Ошибка загрузки товаров', '#e74c3c');
    return false;
  }
}

function showLoadingIndicator() {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.add('loading'));
  const loader = document.createElement('div');
  loader.id = 'loading-indicator';
  loader.className = 'loading-indicator';
  loader.innerHTML = '<div class="spinner"></div><p>Загрузка товаров...</p>';
  document.body.appendChild(loader);
}

function hideLoadingIndicator() {
  const loader = document.getElementById('loading-indicator');
  if (loader) loader.remove();
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('loading'));
}
```

4. **Modify Boot Section** (at the end of app.js):
```javascript
// ─── Boot ─────────────────────────────────────────────────────────────────────
(async function init() {
  // Load products first
  const loaded = await fetchProducts();
  
  if (loaded) {
    showHome();
    updateCartBadge();
  } else {
    // Show error screen if products failed to load
    showScreen('screen-home');
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = `
      <div class="error-message">
        <div class="error-icon">⚠️</div>
        <p>Не удалось загрузить товары</p>
        <button class="retry-btn" onclick="location.reload()">Обновить страницу</button>
      </div>
    `;
  }
})();
```

**Key Principles**:
- Products are fetched asynchronously before any UI rendering
- Loading indicator provides user feedback during fetch
- Error handling gracefully degrades to error message with retry option
- All existing functions (`showHome`, `showCategory`, `showDetail`, etc.) continue to work without modification since they reference the same variable names

#### File 4: Update `miniapp/index.html`

**Purpose**: Remove static product script and add loading indicator markup

**Specific Changes**:

1. **Remove Static Script Include** (before closing `</body>` tag):
```html
<!-- REMOVE THIS LINE -->
<!-- <script src="products.js"></script> -->
<script src="app.js"></script>
</body>
```

2. **Add Loading Indicator Styles** (in `<head>` section, or rely on style.css):
```html
<head>
  <!-- existing meta tags and title -->
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <link rel="stylesheet" href="style.css" />
  <style>
    .loading-indicator {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(26, 26, 46, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: #eee;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-top: 4px solid #27ae60;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error-message {
      text-align: center;
      padding: 40px 20px;
    }
    .error-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .retry-btn {
      margin-top: 20px;
      padding: 12px 24px;
      background: #27ae60;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    }
  </style>
</head>
```

#### File 5: Delete `miniapp/products.js` (After Migration)

**Purpose**: Remove redundant static product file to prevent confusion

**Action**: Delete `miniapp/products.js` after verifying the API-based approach works correctly

**Rationale**:
- Eliminates duplicate product data source
- Prevents accidental reversion to static loading
- Clarifies that `data/products.js` is the single source of truth

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: 
1. Deploy the current (unfixed) mini-app to Vercel
2. Use the admin panel to add/modify/remove products in `data/products.js`
3. Open the mini-app and observe that changes are NOT reflected
4. Check browser DevTools to confirm products are loaded from static `miniapp/products.js`
5. Inspect network requests to verify no API calls are made for product data

**Test Cases**:

1. **New Product Not Appearing** (will fail on unfixed code):
   - Action: Add "Test Product X" via admin panel with price 999₽
   - Verify: `data/products.js` contains "Test Product X"
   - Open mini-app: "Test Product X" does NOT appear in catalog
   - Expected counterexample: Static product list missing new product

2. **Price Update Not Reflected** (will fail on unfixed code):
   - Action: Change "Elf Bar 5000" price from 890₽ to 999₽ via admin panel
   - Verify: `data/products.js` shows price 999₽
   - Open mini-app: "Elf Bar 5000" still shows 890₽
   - Expected counterexample: Old price displayed from static file

3. **Flavor Disable Not Working** (will fail on unfixed code):
   - Action: Set `enabled: false` for a flavor in "Annima Love Gold Edition"
   - Verify: `data/products.js` shows `enabled: false` for that flavor
   - Open mini-app product detail: Disabled flavor still appears as selectable
   - Expected counterexample: Disabled flavor still visible in UI

4. **Network Request Inspection** (will confirm root cause):
   - Open mini-app with DevTools Network tab
   - Filter for XHR/Fetch requests
   - Expected counterexample: No API request for products (confirms static loading)
   - Inspect HTML: `<script src="products.js">` tag present
   - Inspect Global Scope: `categories` and `products` defined at page load

**Expected Counterexamples**:
- Products are loaded from static bundled file, not dynamically fetched
- Changes made via admin panel to `data/products.js` are not visible in mini-app
- No network requests to `/api/products` endpoint
- Browser console shows `categories` and `products` defined globally before `app.js` execution
- Possible causes confirmed: static file inclusion, no dynamic fetch, global variable dependency

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (mini-app loading product data), the fixed function produces the expected behavior (fetches current data from API).

**Pseudocode:**
```
FOR ALL miniAppLoad WHERE isBugCondition(miniAppLoad) DO
  result := loadProducts_fixed(miniAppLoad)
  ASSERT result.source = "API:/api/products"
    AND result.categories = readFromFile("data/products.js").categories
    AND result.products = readFromFile("data/products.js").products
    AND result.isCurrent = true
    AND result.timestamp > deployTime
END FOR
```

**Test Plan**: After implementing the fix, verify that product data is fetched dynamically and reflects current state of `data/products.js`.

**Test Cases**:

1. **API Endpoint Functionality**:
   - Deploy fixed version to Vercel
   - Access `/api/products` directly in browser
   - Expected: JSON response with `{ success: true, categories: [...], products: [...] }`
   - Verify: Data matches current content of `data/products.js`

2. **Dynamic Product Addition**:
   - Add "New Product Y" via admin panel (price: 1299₽, category: disposable)
   - Refresh mini-app (or load in new browser session)
   - Expected: "New Product Y" appears in disposable category
   - Verify: Product details, price, and attributes match `data/products.js`

3. **Price Update Reflection**:
   - Update "Monster" price from 249₽ to 299₽ via admin panel
   - Reload mini-app
   - Expected: "Monster" displays 299₽ price
   - Verify: Cart calculation uses updated price

4. **Flavor Disable Enforcement**:
   - Disable flavor "Энергетик вишня" for "Annima Love Sour" (`enabled: false`)
   - Reload mini-app and navigate to product detail
   - Expected: "Энергетик вишня" does NOT appear in flavor selection
   - Verify: Only enabled flavors are displayed

5. **Category Modification**:
   - Add new category "Test Category" with icon 🎯
   - Reload mini-app
   - Expected: "Test Category" appears on home screen
   - Verify: Click opens category (even if empty)

6. **Loading Indicator Appears**:
   - Use browser DevTools Network throttling (Slow 3G)
   - Reload mini-app
   - Expected: Loading spinner with "Загрузка товаров..." message appears
   - Verify: Disappears after products load successfully

7. **Error Handling**:
   - Temporarily rename `data/products.js` to simulate file error
   - Load mini-app
   - Expected: Error message "Не удалось загрузить товары" with retry button
   - Verify: Clicking retry reloads page

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (all non-loading interactions), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL userAction WHERE NOT isBugCondition(userAction) DO
  ASSERT miniapp_original(userAction) = miniapp_fixed(userAction)
    AND miniapp_original.uiRendering = miniapp_fixed.uiRendering
    AND miniapp_original.cartOperations = miniapp_fixed.cartOperations
    AND miniapp_original.orderSubmission = miniapp_fixed.orderSubmission
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first to establish baseline, then write tests capturing that behavior and verify it remains unchanged after fix.

**Test Cases**:

1. **Navigation Flow Preservation**:
   - Unfixed baseline: Home → Catalog (scroll to categories) → Category → Product → Back → Back → Home
   - Fixed verification: Same navigation sequence produces identical screen transitions
   - Expected: Navigation history, back button behavior, screen animations unchanged

2. **Category Display Preservation**:
   - Unfixed baseline: Home screen shows 4 categories with icons and product counts
   - Fixed verification: Home screen rendering identical (same layout, colors, typography)
   - Expected: Category cards render with same structure and styling

3. **Product Card Rendering Preservation**:
   - Unfixed baseline: Product lists display thumbnail/icon, name, description, price, arrow
   - Fixed verification: Product card structure and styling identical
   - Expected: `makeProductCard()` function produces same DOM structure

4. **Flavor Selection Preservation**:
   - Unfixed baseline: Clicking flavor chip toggles selection, updates button text
   - Fixed verification: Flavor selection interaction identical
   - Expected: Multi-flavor selection works as before, button enables/disables correctly

5. **Cart Operations Preservation**:
   - Unfixed baseline: Add product → Cart badge updates → View cart → Change quantity → Total recalculates
   - Fixed verification: All cart operations function identically
   - Expected: `addCartItem()`, `changeQty()`, `cartTotal()`, `cartCount()` produce same results

6. **Parent-Child Product Navigation Preservation**:
   - Unfixed baseline: Click "Annima" → Shows subproducts screen with "Annima Love Gold Edition" and "Annima Love Sour"
   - Fixed verification: Same navigation and rendering behavior
   - Expected: `showSubProducts()` function works identically, parent.subProducts array processed same way

7. **Telegram Integration Preservation**:
   - Unfixed baseline: `tg.ready()`, `tg.expand()` called at init, `tg.sendData()` on order submit
   - Fixed verification: Telegram WebApp API interactions unchanged
   - Expected: Order submission sends same JSON structure via `tg.sendData()`

8. **Image Loading Preservation**:
   - Unfixed baseline: Products with Telegram file IDs (e.g., "AgACAgIAAxk...") display images via Telegram CDN
   - Fixed verification: Image URLs constructed and loaded identically
   - Expected: Images display correctly, onerror fallback to icon works same way

9. **Toast Notification Preservation**:
   - Unfixed baseline: Add to cart → Toast "✅ Добавлено в корзину!" appears for 2.5s
   - Fixed verification: Toast notifications display identically
   - Expected: `showToast()` function unchanged, timing and styling preserved

10. **Checkout Form Preservation**:
    - Unfixed baseline: Checkbox "Взять из профиля Telegram" pre-checked if username available
    - Fixed verification: Form behavior and validation identical
    - Expected: Username input enable/disable, validation, submission logic unchanged

11. **Chat Functionality Preservation**:
    - Unfixed baseline: Open chat → System message appears → Send message → Message added to UI
    - Fixed verification: Chat screen and message handling identical
    - Expected: `showChatScreen()`, `sendChatMessage()`, `renderChatMessages()` unchanged

12. **Error Handling Preservation**:
    - Unfixed baseline: Image fails to load → Falls back to icon emoji
    - Fixed verification: Error handling for images works identically
    - Expected: `img.onerror` handler behavior unchanged

### Unit Tests

- Test `/api/products` endpoint returns correct JSON structure with categories and products arrays
- Test `/api/products` endpoint handles missing `data/products.js` file gracefully (500 error)
- Test `/api/products` endpoint handles malformed product data gracefully
- Test `fetchProducts()` function successfully fetches and parses API response
- Test `fetchProducts()` function handles network errors gracefully
- Test `showLoadingIndicator()` and `hideLoadingIndicator()` display/remove loading UI
- Test boot sequence waits for products to load before calling `showHome()`
- Test error screen displays with retry button when products fail to load

### Property-Based Tests

- **Product Data Consistency Property**: For any state of `data/products.js`, calling `/api/products` should return data that exactly matches the file contents (categories array and products array)
- **Fetch Retry Property**: For any network error scenario during `fetchProducts()`, the system should display error message and allow retry without crashing
- **UI Rendering Property**: For any valid product dataset loaded via API, the `showHome()` and `showCategory()` functions should render the same UI structure as they did with static data
- **Cart Operations Property**: For any sequence of cart operations (add, remove, quantity change) performed after dynamic product load, the cart state and totals should match the original implementation's behavior
- **Navigation Property**: For any sequence of screen transitions (Home → Products → Detail → Cart → Checkout), the navigation stack and back button behavior should match the original implementation

### Integration Tests

- **Full User Flow Test**: 
  1. Load mini-app → Verify loading indicator appears
  2. Products load from API → Verify home screen displays categories
  3. Navigate to category → Verify products from API displayed
  4. Select product with flavors → Verify flavor selection works
  5. Add to cart → Verify cart badge updates
  6. Complete checkout → Verify order submits via Telegram WebApp
  
- **Admin-to-Customer Sync Test**:
  1. Add new product "Integration Test Product" via admin panel
  2. Deploy/update `data/products.js`
  3. Load mini-app (or reload existing session)
  4. Verify "Integration Test Product" appears in correct category
  5. Verify product details, price, and attributes are correct
  
- **Multi-User Scenario Test**:
  1. User A loads mini-app (gets current products)
  2. Admin updates products via admin panel
  3. User B loads mini-app (gets updated products)
  4. Verify User A sees old data (until refresh)
  5. User A refreshes → Verify User A now sees updated products
  
- **Error Recovery Test**:
  1. Simulate network failure during product load
  2. Verify error screen displays
  3. Restore network
  4. Click retry button
  5. Verify products load successfully on retry
  
- **Vercel Deployment Test**:
  1. Deploy to Vercel with updated `vercel.json`
  2. Verify static files (HTML, CSS, JS) served correctly
  3. Verify `/api/products` endpoint accessible and functional
  4. Verify mini-app loads and fetches products successfully in production
  5. Verify admin panel updates to `data/products.js` reflected after mini-app reload

---

## Migration Checklist

1. ✅ Create `/api/products.js` serverless function
2. ✅ Update `vercel.json` with serverless function configuration
3. ✅ Modify `miniapp/app.js` to add dynamic fetch logic
4. ✅ Update `miniapp/index.html` to remove static script include and add loading styles
5. ✅ Test locally (if possible) or deploy to Vercel preview
6. ✅ Run exploratory tests to confirm bug is fixed
7. ✅ Run preservation tests to ensure existing features work
8. ✅ Delete `miniapp/products.js` after successful verification
9. ✅ Monitor production for any errors or issues

## Rollback Plan

If the fix causes issues in production:

1. Revert `vercel.json` to original static-only configuration
2. Restore `<script src="products.js"></script>` in `miniapp/index.html`
3. Revert `miniapp/app.js` changes to use global variables
4. Delete `/api/products.js` if present
5. Redeploy to Vercel

**Mitigation**: Test thoroughly in Vercel preview environment before deploying to production domain.
