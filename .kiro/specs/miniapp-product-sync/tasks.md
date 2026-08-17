# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Static Product Loading Detection
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition in design
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - Test Cases:
    - Verify mini-app loads products from static `miniapp/products.js` file (not API)
    - Add new product via admin panel to `data/products.js`
    - Confirm new product does NOT appear in mini-app (static file unchanged)
    - Update product price in `data/products.js`
    - Confirm price update does NOT reflect in mini-app
    - Disable a flavor in `data/products.js`
    - Confirm disabled flavor still appears in mini-app
    - Check browser DevTools: No API request to `/api/products` on page load
    - Verify `<script src="products.js">` tag exists in HTML
    - Verify `categories` and `products` are global variables at page load
  - _Requirements: Bug Condition section (isBugCondition returns true for static_file_include)_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - UI/UX and Feature Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - Test Cases:
    - Navigation Flow: Home → Category → Product → Detail → Cart → Checkout
    - Category Display: 4 categories with icons and product counts render correctly
    - Product Card Rendering: Thumbnails, names, descriptions, prices display with correct styling
    - Flavor Selection: Multi-flavor selection toggles, button text updates
    - Cart Operations: Add item → Badge updates → View cart → Change quantity → Total recalculates
    - Parent-Child Navigation: Click "Annima" → Shows subproducts → Navigate back
    - Telegram Integration: `tg.ready()`, `tg.expand()`, `tg.sendData()` work correctly
    - Image Loading: Telegram file IDs display images, fallback to icons on error
    - Toast Notifications: "✅ Добавлено в корзину!" appears for 2.5s
    - Checkout Form: Username checkbox behavior, validation works
    - Chat Functionality: Open chat → System message → Send message → Message renders
    - Error Handling: Image load errors fall back to emoji icons
  - _Requirements: Preservation Requirements section (all UI/UX, navigation, cart, order submission unchanged)_

- [x] 3. Fix for Mini-App Product Sync

  - [x] 3.1 Create `/api/products.js` serverless function
    - Create new file at `/api/products.js`
    - Implement serverless function that reads `data/products.js`
    - Extract `categories` and `products` using `require()` with cache clearing
    - Return JSON response with `{ success: true, categories: [...], products: [...] }`
    - Implement error handling for file not found (500 error)
    - Implement error handling for parse errors (500 error)
    - Log errors to console for debugging
    - _Bug_Condition: isBugCondition(dataSource) where dataSource.loadMethod = "static_file_include"_
    - _Expected_Behavior: dataSource.loadMethod = "dynamic_api_fetch" AND dataSource.reflectsCurrent = true_
    - _Preservation: API should only affect product loading, not other functionality_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Update `vercel.json` configuration
    - Add `@vercel/node` builder for `api/**/*.js` files
    - Keep `@vercel/static` builder for `miniapp/**` files
    - Add route for `/api/(.*)` pointing to serverless functions (higher priority)
    - Keep catch-all route `/(.**)` pointing to `/miniapp/$1` (lower priority)
    - Set version to 2 for proper routing support
    - _Bug_Condition: Current config uses static-only serving_
    - _Expected_Behavior: Config supports both serverless functions and static files_
    - _Preservation: Static file serving for mini-app files unchanged_
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Modify `miniapp/app.js` for dynamic loading
    - Add product state variables: `let categories = []`, `let products = []`, `let productsLoaded = false`
    - Create `async fetchProducts()` function that calls `/api/products`
    - Implement `showLoadingIndicator()` and `hideLoadingIndicator()` functions
    - Add error handling in `fetchProducts()` with toast notification
    - Modify boot section to call `fetchProducts()` before `showHome()`
    - If products fail to load, display error screen with retry button
    - Ensure all existing functions continue to reference same variable names
    - _Bug_Condition: App currently references global variables from static script_
    - _Expected_Behavior: App fetches products dynamically, initializes state before rendering_
    - _Preservation: All existing functions (showHome, showCategory, etc.) unchanged, only initialization modified_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.4 Update `miniapp/index.html`
    - Remove `<script src="products.js"></script>` line from HTML
    - Add loading indicator styles in `<head>` section (or ensure style.css has them)
    - Add styles for `.loading-indicator`, `.spinner`, `@keyframes spin`
    - Add styles for `.error-message`, `.error-icon`, `.retry-btn`
    - Keep `<script src="app.js"></script>` at end of body
    - _Bug_Condition: HTML includes static script that loads products at page load_
    - _Expected_Behavior: HTML does not include static script, loading handled by app.js_
    - _Preservation: All other HTML structure, Telegram WebApp script, and styling unchanged_
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 Delete `miniapp/products.js` (after verification)
    - Verify API endpoint works correctly
    - Verify mini-app loads products dynamically
    - Delete `miniapp/products.js` file to eliminate duplicate data source
    - _Bug_Condition: Two separate product files exist with no synchronization_
    - _Expected_Behavior: Single source of truth (`data/products.js`) remains_
    - _Preservation: Deletion does not affect functionality since API is now used_
    - _Requirements: 2.1, 2.2_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Dynamic Product Loading Works
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Test Verifications:
      - New product added to `data/products.js` appears in mini-app immediately after reload
      - Price updates in `data/products.js` reflect in mini-app immediately
      - Disabled flavors in `data/products.js` do not appear in mini-app
      - Browser DevTools shows API request to `/api/products` on page load
      - Response from `/api/products` matches current content of `data/products.js`
      - Loading indicator appears during fetch
      - Products render after successful fetch
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - UI/UX and Feature Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - Test Verifications:
      - Navigation flow works identically
      - Category and product card rendering unchanged
      - Flavor selection and cart operations work as before
      - Parent-child product navigation preserved
      - Telegram integration works correctly
      - Image loading and error fallbacks work
      - Toast notifications display correctly
      - Checkout form behavior unchanged
      - Chat functionality preserved
      - All styling and visual appearance identical

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all bug condition tests (should pass)
  - Run all preservation tests (should pass)
  - Test full user flow: Load mini-app → Browse categories → Select product → Add to cart → Checkout
  - Test admin-to-customer sync: Add product via admin → Reload mini-app → Verify new product appears
  - Test error handling: Simulate network failure → Verify error screen → Retry → Verify success
  - Deploy to Vercel preview environment
  - Test production deployment with real product updates
  - Monitor for any errors or regressions
  - If all tests pass and no issues found, mark spec as complete
  - Ask the user if questions arise

---

## Notes

### Implementation Order
1. **First**: Write exploration test (Task 1) - confirms bug exists
2. **Second**: Write preservation tests (Task 2) - establishes baseline
3. **Third**: Implement fix (Tasks 3.1-3.5) - apply changes
4. **Fourth**: Verify fix works (Task 3.6) - exploration test should pass
5. **Fifth**: Verify no regressions (Task 3.7) - preservation tests should pass
6. **Sixth**: Final validation (Task 4) - comprehensive testing

### Key Dependencies
- Task 3.1 (`/api/products.js`) must be completed before 3.3 (`app.js` fetch logic)
- Task 3.2 (`vercel.json`) must be completed before deploying to Vercel
- Task 3.4 (`index.html` changes) must be coordinated with 3.3 (remove static script only after dynamic loading works)
- Task 3.5 (delete `miniapp/products.js`) should only be done after full verification

### Testing Strategy
- **Exploration Testing**: Run on UNFIXED code to surface counterexamples (expected to fail)
- **Preservation Testing**: Run on UNFIXED code to establish baseline (expected to pass)
- **Fix Validation**: Re-run exploration tests on FIXED code (should pass) and preservation tests (should still pass)
- **Property-Based Testing**: Use for preservation to ensure broad coverage across input domain

### Rollback Plan
If issues arise:
1. Revert `vercel.json` to static-only configuration
2. Restore `<script src="products.js">` in `index.html`
3. Revert `app.js` changes to global variable usage
4. Delete `/api/products.js`
5. Redeploy to Vercel
