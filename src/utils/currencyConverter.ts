export interface CurrencyDetails {
  code: string;
  symbol: string;
  rate: number;
  name: string;
  paystackCurrency: 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'USD';
}

const CURRENCY_DICTIONARY: Record<string, CurrencyDetails> = {
  // --- NORTH AMERICA ---
  "united states": { code: "USD", symbol: "$", rate: 1.0, name: "US Dollar", paystackCurrency: "USD" },
  "canada": { code: "CAD", symbol: "C$", rate: 1.37, name: "Canadian Dollar", paystackCurrency: "USD" },
  "mexico": { code: "MXN", symbol: "Mex$", rate: 16.7, name: "Mexican Peso", paystackCurrency: "USD" },
  "costa rica": { code: "CRC", symbol: "₡", rate: 512.0, name: "Costa Rican Colón", paystackCurrency: "USD" },
  "jamaica": { code: "JMD", symbol: "JA$", rate: 156.0, name: "Jamaican Dollar", paystackCurrency: "USD" },
  "panama": { code: "USD", symbol: "$", rate: 1.0, name: "Panamanian Balboa", paystackCurrency: "USD" },
  "bahamas": { code: "BSD", symbol: "B$", rate: 1.0, name: "Bahamian Dollar", paystackCurrency: "USD" },
  "dominican republic": { code: "DOP", symbol: "RD$", rate: 59.0, name: "Dominican Peso", paystackCurrency: "USD" },
  "honduras": { code: "HNL", symbol: "L", rate: 24.7, name: "Honduran Lempira", paystackCurrency: "USD" },
  "el salvador": { code: "USD", symbol: "$", rate: 1.0, name: "US Dollar", paystackCurrency: "USD" },
  "guatemala": { code: "GTQ", symbol: "Q", rate: 7.8, name: "Guatemalan Quetzal", paystackCurrency: "USD" },

  // --- SOUTH AMERICA ---
  "brazil": { code: "BRL", symbol: "R$", rate: 5.15, name: "Brazilian Real", paystackCurrency: "USD" },
  "argentina": { code: "ARS", symbol: "$", rate: 890.0, name: "Argentine Peso", paystackCurrency: "USD" },
  "colombia": { code: "COP", symbol: "Col$", rate: 3900.0, name: "Colombian Peso", paystackCurrency: "USD" },
  "chile": { code: "CLP", symbol: "CLP$", rate: 920.0, name: "Chilean Peso", paystackCurrency: "USD" },
  "peru": { code: "PEN", symbol: "S/.", rate: 3.72, name: "Peruvian Sol", paystackCurrency: "USD" },
  "venezuela": { code: "VES", symbol: "Bs.S", rate: 36.5, name: "Venezuelan Bolívar", paystackCurrency: "USD" },
  "ecuador": { code: "USD", symbol: "$", rate: 1.0, name: "US Dollar", paystackCurrency: "USD" },
  "bolivia": { code: "BOB", symbol: "Bs", rate: 6.91, name: "Bolivian Boliviano", paystackCurrency: "USD" },
  "uruguay": { code: "UYU", symbol: "$U", rate: 38.8, name: "Uruguayan Peso", paystackCurrency: "USD" },
  "paraguay": { code: "PYG", symbol: "₲", rate: 7450.0, name: "Paraguayan Guaraní", paystackCurrency: "USD" },

  // --- WEST AFRICA ---
  "nigeria": { code: "NGN", symbol: "₦", rate: 1500.0, name: "Nigerian Naira", paystackCurrency: "NGN" },
  "ghana": { code: "GHS", symbol: "GH₵", rate: 14.5, name: "Ghanaian Cedi", paystackCurrency: "GHS" },
  "ivory coast": { code: "XOF", symbol: "CFA", rate: 605.0, name: "West African CFA Franc", paystackCurrency: "USD" },
  "senegal": { code: "XOF", symbol: "CFA", rate: 605.0, name: "West African CFA Franc", paystackCurrency: "USD" },
  "liberia": { code: "LRD", symbol: "L$", rate: 194.0, name: "Liberian Dollar", paystackCurrency: "USD" },
  "sierra leone": { code: "SLE", symbol: "Le", rate: 22.5, name: "Sierra Leonean Leone", paystackCurrency: "USD" },
  "gambia": { code: "GMD", symbol: "D", rate: 68.0, name: "Gambian Dalasi", paystackCurrency: "USD" },
  "togo": { code: "XOF", symbol: "CFA", rate: 605.0, name: "West African CFA Franc", paystackCurrency: "USD" },
  "benin": { code: "XOF", symbol: "CFA", rate: 605.0, name: "West African CFA Franc", paystackCurrency: "USD" },
  "niger": { code: "XOF", symbol: "CFA", rate: 605.0, name: "West African CFA Franc", paystackCurrency: "USD" },
  "burkina faso": { code: "XOF", symbol: "CFA", rate: 605.0, name: "West African CFA Franc", paystackCurrency: "USD" },
  "mali": { code: "XOF", symbol: "CFA", rate: 605.0, name: "West African CFA Franc", paystackCurrency: "USD" },
  "mauritania": { code: "MRU", symbol: "UM", rate: 39.7, name: "Mauritanian Ouguiya", paystackCurrency: "USD" },
  "cape verde": { code: "CVE", symbol: "Esc", rate: 102.5, name: "Cape Verdean Escudo", paystackCurrency: "USD" },
  "guinea": { code: "GNF", symbol: "FG", rate: 8600.0, name: "Guinean Franc", paystackCurrency: "USD" },
  "guinea-bissau": { code: "XOF", symbol: "CFA", rate: 605.0, name: "West African CFA Franc", paystackCurrency: "USD" },

  // --- EAST AFRICA ---
  "kenya": { code: "KES", symbol: "KSh", rate: 130.0, name: "Kenyan Shilling", paystackCurrency: "KES" },
  "uganda": { code: "UGX", symbol: "USh", rate: 3770.0, name: "Ugandan Shilling", paystackCurrency: "USD" },
  "tanzania": { code: "TZS", symbol: "TSh", rate: 2580.0, name: "Tanzanian Shilling", paystackCurrency: "USD" },
  "rwanda": { code: "RWF", symbol: "FRw", rate: 1300.0, name: "Rwandan Franc", paystackCurrency: "USD" },
  "ethiopia": { code: "ETB", symbol: "Br", rate: 57.2, name: "Ethiopian Birr", paystackCurrency: "USD" },
  "somalia": { code: "SOS", symbol: "Sh.So.", rate: 571.0, name: "Somali Shilling", paystackCurrency: "USD" },
  "sudan": { code: "SDG", symbol: "SDG", rate: 600.0, name: "Sudanese Pound", paystackCurrency: "USD" },
  "south sudan": { code: "SSP", symbol: "SSP", rate: 130.0, name: "South Sudanese Pound", paystackCurrency: "USD" },
  "eritrea": { code: "ERN", symbol: "Nfk", rate: 15.0, name: "Eritrean Nakfa", paystackCurrency: "USD" },
  "djibouti": { code: "DJF", symbol: "Fdj", rate: 177.8, name: "Djiboutian Franc", paystackCurrency: "USD" },
  "burundi": { code: "BIF", symbol: "FBu", rate: 2870.0, name: "Burundian Franc", paystackCurrency: "USD" },
  "mauritius": { code: "MUR", symbol: "₨", rate: 46.2, name: "Mauritian Rupee", paystackCurrency: "USD" },
  "seychelles": { code: "SCR", symbol: "₨", rate: 13.6, name: "Seychellois Rupee", paystackCurrency: "USD" },
  "madagascar": { code: "MGA", symbol: "Ar", rate: 4500.0, name: "Malagasy Ariary", paystackCurrency: "USD" },
  "comoros": { code: "KMF", symbol: "CF", rate: 455.0, name: "Comorian Franc", paystackCurrency: "USD" },

  // --- SOUTHERN AFRICA ---
  "south africa": { code: "ZAR", symbol: "R", rate: 18.5, name: "South African Rand", paystackCurrency: "ZAR" },
  "angola": { code: "AOA", symbol: "Kz", rate: 840.0, name: "Angolan Kwanza", paystackCurrency: "USD" },
  "zimbabwe": { code: "ZWG", symbol: "ZiG", rate: 13.5, name: "Zimbabwean Gold", paystackCurrency: "USD" },
  "zambia": { code: "ZMW", symbol: "ZK", rate: 25.4, name: "Zambian Kwacha", paystackCurrency: "USD" },
  "botswana": { code: "BWP", symbol: "P", rate: 13.7, name: "Botswana Pula", paystackCurrency: "USD" },
  "namibia": { code: "NAD", symbol: "N$", rate: 18.5, name: "Namibian Dollar", paystackCurrency: "USD" },
  "mozambique": { code: "MZN", symbol: "MT", rate: 63.8, name: "Mozambican Metical", paystackCurrency: "USD" },
  "malawi": { code: "MWK", symbol: "MK", rate: 1730.0, name: "Malawian Kwacha", paystackCurrency: "USD" },
  "lesotho": { code: "LSL", symbol: "L", rate: 18.5, name: "Lesotho Loti", paystackCurrency: "USD" },
  "eswatini": { code: "SZL", symbol: "E", rate: 18.5, name: "Swazi Lilangeni", paystackCurrency: "USD" },

  // --- CENTRAL AFRICA ---
  "cameroon": { code: "XAF", symbol: "FCFA", rate: 605.0, name: "Central African CFA Franc", paystackCurrency: "USD" },
  "gabon": { code: "XAF", symbol: "FCFA", rate: 605.0, name: "Central African CFA Franc", paystackCurrency: "USD" },
  "democratic republic of the congo": { code: "CDF", symbol: "FC", rate: 2800.0, name: "Congolese Franc", paystackCurrency: "USD" },
  "republic of the congo": { code: "XAF", symbol: "FCFA", rate: 605.0, name: "Central African CFA Franc", paystackCurrency: "USD" },
  "equatorial guinea": { code: "XAF", symbol: "FCFA", rate: 605.0, name: "Central African CFA Franc", paystackCurrency: "USD" },
  "central african republic": { code: "XAF", symbol: "FCFA", rate: 605.0, name: "Central African CFA Franc", paystackCurrency: "USD" },
  "chad": { code: "XAF", symbol: "FCFA", rate: 605.0, name: "Central African CFA Franc", paystackCurrency: "USD" },
  "sao tome and principe": { code: "STN", symbol: "Db", rate: 22.5, name: "São Tomé and Príncipe Dobra", paystackCurrency: "USD" },

  // --- NORTH AFRICA ---
  "egypt": { code: "EGP", symbol: "E£", rate: 47.5, name: "Egyptian Pound", paystackCurrency: "USD" },
  "morocco": { code: "MAD", symbol: "DH", rate: 10.1, name: "Moroccan Dirham", paystackCurrency: "USD" },
  "algeria": { code: "DZD", symbol: "DA", rate: 134.5, name: "Algerian Dinar", paystackCurrency: "USD" },
  "tunisia": { code: "TND", symbol: "DT", rate: 3.12, name: "Tunisian Dinar", paystackCurrency: "USD" },
  "libya": { code: "LYD", symbol: "LD", rate: 4.85, name: "Libyan Dinar", paystackCurrency: "USD" },

  // --- EUROPE ---
  "united kingdom": { code: "GBP", symbol: "£", rate: 0.79, name: "British Pound", paystackCurrency: "USD" },
  "germany": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "france": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "italy": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "spain": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "portugal": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "switzerland": { code: "CHF", symbol: "CHF", rate: 0.91, name: "Swiss Franc", paystackCurrency: "USD" },
  "netherlands": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "belgium": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "austria": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "sweden": { code: "SEK", symbol: "kr", rate: 10.7, name: "Swedish Krona", paystackCurrency: "USD" },
  "norway": { code: "NOK", symbol: "kr", rate: 10.7, name: "Norwegian Krone", paystackCurrency: "USD" },
  "denmark": { code: "DKK", symbol: "kr", rate: 6.9, name: "Danish Krone", paystackCurrency: "USD" },
  "finland": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "ireland": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "poland": { code: "PLN", symbol: "zł", rate: 3.95, name: "Polish Złoty", paystackCurrency: "USD" },
  "greece": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "turkey": { code: "TRY", symbol: "₺", rate: 32.2, name: "Turkish Lira", paystackCurrency: "USD" },
  "ukraine": { code: "UAH", symbol: "₴", rate: 39.8, name: "Ukrainian Hryvnia", paystackCurrency: "USD" },
  "romania": { code: "RON", symbol: "lei", rate: 4.6, name: "Romanian Leu", paystackCurrency: "USD" },
  "czech republic": { code: "CZK", symbol: "Kč", rate: 22.8, name: "Czech Koruna", paystackCurrency: "USD" },
  "hungary": { code: "HUF", symbol: "Ft", rate: 360.0, name: "Hungarian Forint", paystackCurrency: "USD" },
  "croatia": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "slovakia": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "luxembourg": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "malta": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "cyprus": { code: "EUR", symbol: "€", rate: 0.92, name: "Euro", paystackCurrency: "USD" },
  "iceland": { code: "ISK", symbol: "kr", rate: 139.0, name: "Icelandic Króna", paystackCurrency: "USD" },

  // --- ASIA ---
  "india": { code: "INR", symbol: "₹", rate: 83.3, name: "Indian Rupee", paystackCurrency: "USD" },
  "china": { code: "CNY", symbol: "¥", rate: 7.24, name: "Chinese Yuan", paystackCurrency: "USD" },
  "japan": { code: "JPY", symbol: "¥", rate: 156.0, name: "Japanese Yen", paystackCurrency: "USD" },
  "south korea": { code: "KRW", symbol: "₩", rate: 1365.0, name: "South Korean Won", paystackCurrency: "USD" },
  "singapore": { code: "SGD", symbol: "S$", rate: 1.35, name: "Singapore Dollar", paystackCurrency: "USD" },
  "financial hub": { code: "SGD", symbol: "S$", rate: 1.35, name: "Singapore Dollar", paystackCurrency: "USD" }, // Alias support
  "malaysia": { code: "MYR", symbol: "RM", rate: 4.71, name: "Malaysian Ringgit", paystackCurrency: "USD" },
  "indonesia": { code: "IDR", symbol: "Rp", rate: 16100.0, name: "Indonesian Rupiah", paystackCurrency: "USD" },
  "philippines": { code: "PHP", symbol: "₱", rate: 58.2, name: "Philippine Peso", paystackCurrency: "USD" },
  "thailand": { code: "THB", symbol: "฿", rate: 36.6, name: "Thai Baht", paystackCurrency: "USD" },
  "vietnam": { code: "VND", symbol: "₫", rate: 25400.0, name: "Vietnamese Đồng", paystackCurrency: "USD" },
  "pakistan": { code: "PKR", symbol: "₨", rate: 278.0, name: "Pakistani Rupee", paystackCurrency: "USD" },
  "bangladesh": { code: "BDT", symbol: "৳", rate: 117.0, name: "Bangladeshi Taka", paystackCurrency: "USD" },
  "sri lanka": { code: "LKR", symbol: "Rs", rate: 300.0, name: "Sri Lankan Rupee", paystackCurrency: "USD" },
  "taiwan": { code: "TWD", symbol: "NT$", rate: 32.2, name: "New Taiwan Dollar", paystackCurrency: "USD" },
  "nepal": { code: "NPR", symbol: "Rs", rate: 133.0, name: "Nepalese Rupee", paystackCurrency: "USD" },
  "kazakhstan": { code: "KZT", symbol: "₸", rate: 442.0, name: "Kazakhstani Tenge", paystackCurrency: "USD" },
  "uzbekistan": { code: "UZS", symbol: "so'm", rate: 12600.0, name: "Uzbekistan Som", paystackCurrency: "USD" },

  // --- MIDDLE EAST & WEST ASIA ---
  "saudi arabia": { code: "SAR", symbol: "SR", rate: 3.75, name: "Saudi Riyal", paystackCurrency: "USD" },
  "united arab emirates": { code: "AED", symbol: "AED", rate: 3.67, name: "UAE Dirham", paystackCurrency: "USD" },
  "israel": { code: "ILS", symbol: "₪", rate: 3.72, name: "Israeli New Shekel", paystackCurrency: "USD" },
  "qatar": { code: "QAR", symbol: "QR", rate: 3.64, name: "Qatari Riyal", paystackCurrency: "USD" },
  "kuwait": { code: "KWD", symbol: "KD", rate: 0.31, name: "Kuwaiti Dinar", paystackCurrency: "USD" },
  "oman": { code: "OMR", symbol: "RO", rate: 0.38, name: "Omani Rial", paystackCurrency: "USD" },
  "bahrain": { code: "BHD", symbol: "BD", rate: 0.38, name: "Bahraini Dinar", paystackCurrency: "USD" },
  "jordan": { code: "JOD", symbol: "JD", rate: 0.71, name: "Jordanian Dinar", paystackCurrency: "USD" },
  "lebanon": { code: "LBP", symbol: "L£", rate: 89500.0, name: "Lebanese Pound", paystackCurrency: "USD" },
  "iraq": { code: "IQD", symbol: "ID", rate: 1310.0, name: "Iraqi Dinar", paystackCurrency: "USD" },
  "iran": { code: "IRR", symbol: "IRR", rate: 42000.0, name: "Iranian Rial", paystackCurrency: "USD" },

  // --- OCEANIA ---
  "australia": { code: "AUD", symbol: "A$", rate: 1.51, name: "Australian Dollar", paystackCurrency: "USD" },
  "new zealand": { code: "NZD", symbol: "NZ$", rate: 1.63, name: "New Zealand Dollar", paystackCurrency: "USD" },
  "fiji": { code: "FJD", symbol: "FJ$", rate: 2.24, name: "Fijian Dollar", paystackCurrency: "USD" },
  "papua new guinea": { code: "PGK", symbol: "K", rate: 3.88, name: "Papua New Guinean Kina", paystackCurrency: "USD" }
};

export function getCurrencyForCountry(countryName: string): CurrencyDetails {
  const normName = (countryName || "").trim().toLowerCase();
  
  if (CURRENCY_DICTIONARY[normName]) {
    return CURRENCY_DICTIONARY[normName];
  }
  
  // Default values for unknown locations (or "Other" / "🌍")
  return { 
    code: "USD", 
    symbol: "$", 
    rate: 1.0, 
    name: "US Dollar", 
    paystackCurrency: "USD" 
  };
}
