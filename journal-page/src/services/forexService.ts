
export interface ExchangeRates {
  [key: string]: number;
}

let cachedRates: ExchangeRates | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  if (cachedRates && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedRates;
  }

  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    cachedRates = data.rates;
    lastFetchTime = now;
    return cachedRates || {};
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    return cachedRates || { USD: 1 };
  }
}

export function getPairCurrencies(pair: string): { base: string; quote: string } {
  const cleanPair = pair.toUpperCase().replace(/[^A-Z]/g, '');
  
  // Handle common aliases
  if (cleanPair === 'GOLD' || cleanPair === 'XAU') return { base: 'XAU', quote: 'USD' };
  if (cleanPair === 'SILVER' || cleanPair === 'XAG') return { base: 'XAG', quote: 'USD' };
  if (cleanPair === 'USOIL' || cleanPair === 'WTI') return { base: 'WTI', quote: 'USD' };
  if (cleanPair === 'UKOIL' || cleanPair === 'BRENT') return { base: 'BRENT', quote: 'USD' };
  
  // Standard 6-character pairs (e.g., EURUSD)
  if (cleanPair.length === 6) {
    return {
      base: cleanPair.substring(0, 3),
      quote: cleanPair.substring(3, 6)
    };
  }
  
  // Fallback for indices/crypto (usually quoted in USD)
  return { base: cleanPair, quote: 'USD' };
}

export async function calculatePipValue(pair: string, accountCurrency: string = 'USD'): Promise<number> {
  const { quote } = getPairCurrencies(pair);
  const rates = await getExchangeRates();
  
  const isJpy = quote === 'JPY' || pair.toUpperCase().includes('JPY');
  const standardPipValueQuote = isJpy ? 1000 : 10; // 1000 JPY or 10 Quote Currency for 1 Standard Lot
  
  if (quote === accountCurrency) {
    return standardPipValueQuote;
  }
  
  // Convert Quote Currency to Account Currency
  // PipValueAccount = PipValueQuote * (AccountCurrency / QuoteCurrency Rate)
  // Since our rates are base USD:
  // Rate(USD/Quote) = rates[quote]
  // Rate(USD/Account) = rates[accountCurrency]
  // Rate(Account/Quote) = Rate(USD/Quote) / Rate(USD/Account)
  
  const usdToQuote = rates[quote];
  const usdToAccount = rates[accountCurrency];
  
  if (!usdToQuote || !usdToAccount) {
    return standardPipValueQuote; // Fallback to 10
  }
  
  // Pip Value in Account Currency = StandardPipValueQuote / Rate(Account/Quote)
  // Rate(Account/Quote) = usdToQuote / usdToAccount
  const accountToQuote = usdToQuote / usdToAccount;
  return standardPipValueQuote / accountToQuote;
}

export function isIndexOrCrypto(pair: string): boolean {
  const p = pair.toUpperCase();
  const indices = ['NAS', 'SPX', 'US30', 'GER', 'DAX', 'UK100', 'JPN225', 'EUSTX50'];
  const cryptos = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOT', 'DOGE', 'USDT'];
  
  return indices.some(i => p.includes(i)) || cryptos.some(c => p.includes(c));
}

export function isCommodity(pair: string): boolean {
  const p = pair.toUpperCase();
  return p.includes('XAU') || p.includes('GOLD') || p.includes('XAG') || p.includes('SILVER') || 
         p.includes('OIL') || p.includes('WTI') || p.includes('BRENT');
}
