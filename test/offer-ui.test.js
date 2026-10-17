const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('offer page has accessible status regions, preview regions, form labels, empty state, and quote actions', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'offer.html'), 'utf8');

  // Accessible live status regions for outreach and quote
  assert.match(html, /id="bookOk"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="quoteOk"[^>]*role="status"[^>]*aria-live="polite"/);

  // Accessible error alert regions
  assert.match(html, /id="bookErr"[^>]*role="alert"/);
  assert.match(html, /id="quoteErr"[^>]*role="alert"/);

  // Accessible preview regions with roles and labels
  assert.match(html, /id="bookPreview"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="quotePreview"[^>]*role="region"[^>]*aria-label="[^"]+"/);

  // Form label association for confirmation checkbox
  assert.match(html, /<label class="check" for="confirmDraft">/);
  assert.match(html, /<input type="checkbox" id="confirmDraft">/);

  // Quote empty state placeholder
  assert.match(html, /<p class="hint" id="quoteEmpty">/);

  // Copy quote and reset buttons present in markup
  assert.match(html, /<button type="button" id="btnQuoteCopy">העתק הצעה<\/button>/);
  assert.match(html, /<button type="button" id="btnQuoteReset"[^>]*>איפוס הצעה<\/button>/);

  // Script wires copy quote and reset handlers
  assert.match(html, /\$\('btnQuoteCopy'\)\.addEventListener\('click'/);
  assert.match(html, /\$\('btnQuoteReset'\)\.addEventListener\('click'/);

  // Validation guard prevents corrupt quote downloads and print
  assert.match(html, /function requireValidQuote\(\)\s*\{[\s\S]*?if\s*\(!q\.ok\)\s*\{[\s\S]*?return null;/);
  assert.match(html, /\$\('btnQuoteTxt'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?const q\s*=\s*requireValidQuote\(\);[\s\S]*?if\s*\(!q\)\s*return;/);
  assert.match(html, /\$\('btnQuoteJson'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?const q\s*=\s*requireValidQuote\(\);[\s\S]*?if\s*\(!q\)\s*return;/);
  assert.match(html, /\$\('btnQuoteCsv'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?const q\s*=\s*requireValidQuote\(\);[\s\S]*?if\s*\(!q\)\s*return;/);
  assert.match(html, /\$\('btnQuotePrint'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?const q\s*=\s*requireValidQuote\(\);[\s\S]*?if\s*\(!q\)\s*return;/);
});
