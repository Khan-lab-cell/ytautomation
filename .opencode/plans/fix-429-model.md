# Plan: Fix 429 Rate Limit

## Changes

### 1. `src/lib/openrouter.js`
- Change model from `meta-llama/llama-3.3-70b-instruct:free` → `openrouter/free`
- Read `Retry-After` header from 429 responses and use it instead of hardcoded exponential backoff

### 2. No other files need changes
- The single-call architecture we already built is correct
- Only the model ID + retry logic needs updating
