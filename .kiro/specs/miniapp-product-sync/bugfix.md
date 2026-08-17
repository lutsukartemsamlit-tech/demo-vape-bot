# Bugfix Requirements Document

## Introduction

The mini-app deployed on Vercel is not synchronized with the admin panel - products do not update. The mini-app currently uses a static hardcoded product list from `miniapp/products.js`, while the actual product data managed by the admin panel resides in `data/products.js`. When administrators update products through the bot's admin panel, these changes are not reflected in the mini-app because it continues to load the outdated static file.

This bug prevents the store from displaying accurate product information to customers, including:
- New products added via admin panel
- Updated prices, stock levels, and descriptions
- Removed or disabled products
- Modified product flavors and options

The fix requires implementing an API-based approach where the mini-app fetches current products dynamically from `data/products.js` via a serverless function on Vercel.

## Bug Analysis

### Current Behavior (Defect)

**Section 1: Static Product Loading**

1.1 WHEN the mini-app loads on Vercel THEN the system loads products from the static `miniapp/products.js` file that is bundled at deploy time

1.2 WHEN an administrator adds a new product via the bot's admin panel to `data/products.js` THEN the system writes the product to `data/products.js` but the mini-app continues showing the old static product list

1.3 WHEN an administrator updates product prices, stock, flavors, or any other product attributes via the admin panel THEN the system updates `data/products.js` but the mini-app displays outdated information from `miniapp/products.js`

1.4 WHEN an administrator removes or disables a product via the admin panel THEN the system modifies `data/products.js` but the removed/disabled product continues to appear in the mini-app

1.5 WHEN categories are modified via the admin panel THEN the system updates the categories array in `data/products.js` but the mini-app displays the static categories from `miniapp/products.js`

### Expected Behavior (Correct)

**Section 2: Dynamic Product Loading**

2.1 WHEN the mini-app loads on Vercel THEN the system SHALL fetch the current product list dynamically via an API endpoint that reads from `data/products.js`

2.2 WHEN an administrator adds a new product via the bot's admin panel to `data/products.js` THEN the system SHALL immediately make that product available in the mini-app on the next page load or refresh

2.3 WHEN an administrator updates product prices, stock, flavors, or any other product attributes via the admin panel THEN the system SHALL reflect these changes in the mini-app immediately on the next page load or refresh

2.4 WHEN an administrator removes or disables a product via the admin panel THEN the system SHALL hide or remove that product from the mini-app immediately on the next page load or refresh

2.5 WHEN categories are modified via the admin panel THEN the system SHALL display the updated categories in the mini-app on the next page load or refresh

### Unchanged Behavior (Regression Prevention)

**Section 3: Preserved Functionality**

3.1 WHEN a user navigates the mini-app interface (categories, product details, cart) THEN the system SHALL CONTINUE TO provide the same UI/UX experience and navigation flow

3.2 WHEN a user adds products to cart with selected flavors, colors, or options THEN the system SHALL CONTINUE TO handle cart operations exactly as before

3.3 WHEN a user submits an order through the mini-app THEN the system SHALL CONTINUE TO send order data to the bot manager via the existing Telegram WebApp mechanism

3.4 WHEN the mini-app displays product images using Telegram file IDs (e.g., "AgACAgIAAxk...") THEN the system SHALL CONTINUE TO correctly display these images

3.5 WHEN the mini-app is accessed via Telegram WebApp THEN the system SHALL CONTINUE TO initialize with `Telegram.WebApp` API and display correctly within the Telegram interface

3.6 WHEN a user opens the chat screen to message the manager THEN the system SHALL CONTINUE TO function as before using the existing chat implementation

3.7 WHEN products have parent-child relationships (e.g., "Annima" with subProducts "annima_gold", "annima_sour") THEN the system SHALL CONTINUE TO correctly display the hierarchy

3.8 WHEN products have flavors with stock information or enabled/disabled flags THEN the system SHALL CONTINUE TO correctly filter and display only enabled flavors

## Bug Condition Analysis

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ProductDataSource
  OUTPUT: boolean
  
  // Returns true when products are loaded from static file
  RETURN X.source = "miniapp/products.js" AND X.isStaticFile = true
END FUNCTION
```

### Property Specification - Fix Checking

```pascal
// Property: Fix Checking - Dynamic Product Loading
FOR ALL X WHERE isBugCondition(X) DO
  productData ← loadProducts'(X)
  ASSERT productData.source = "API:/api/products" 
    AND productData.origin = "data/products.js"
    AND productData.isStale = false
    AND no_hardcoded_products(productData)
END FOR
```

**Key Definitions:**
- **loadProducts**: Original function - loads products from static `miniapp/products.js` bundled at deploy time
- **loadProducts'**: Fixed function - fetches products dynamically from API endpoint that reads `data/products.js`

### Preservation Property

```pascal
// Property: Preservation Checking - UI/UX and Feature Preservation
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT loadProducts(X).uiExperience = loadProducts'(X).uiExperience
    AND loadProducts(X).cartFunctionality = loadProducts'(X).cartFunctionality
    AND loadProducts(X).orderSubmission = loadProducts'(X).orderSubmission
    AND loadProducts(X).telegramIntegration = loadProducts'(X).telegramIntegration
END FOR
```

This ensures that all non-data-loading functionality (navigation, cart, checkout, chat, Telegram integration) behaves identically before and after the fix.
