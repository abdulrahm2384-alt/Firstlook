export interface Country {
  name: string;
  code: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  // --- NORTH AMERICA ---
  { name: "United States", code: "US", flag: "🇺🇸" },
  { name: "Canada", code: "CA", flag: "🇨🇦" },
  { name: "Mexico", code: "MX", flag: "🇲🇽" },
  { name: "Costa Rica", code: "CR", flag: "🇨🇷" },
  { name: "Jamaica", code: "JM", flag: "🇯🇲" },
  { name: "Panama", code: "PA", flag: "🇵🇦" },
  { name: "Bahamas", code: "BS", flag: "🇧🇸" },
  { name: "Dominican Republic", code: "DO", flag: "🇩🇴" },
  { name: "Honduras", code: "HN", flag: "🇭🇳" },
  { name: "El Salvador", code: "SV", flag: "🇸🇻" },
  { name: "Guatemala", code: "GT", flag: "🇬🇹" },

  // --- SOUTH AMERICA ---
  { name: "Brazil", code: "BR", flag: "🇧🇷" },
  { name: "Argentina", code: "AR", flag: "🇦🇷" },
  { name: "Colombia", code: "CO", flag: "🇨🇴" },
  { name: "Chile", code: "CL", flag: "🇨🇱" },
  { name: "Peru", code: "PE", flag: "🇵🇪" },
  { name: "Venezuela", code: "VE", flag: "🇻🇪" },
  { name: "Ecuador", code: "EC", flag: "🇪🇨" },
  { name: "Bolivia", code: "BO", flag: "🇧🇴" },
  { name: "Uruguay", code: "UY", flag: "🇺🇾" },
  { name: "Paraguay", code: "PY", flag: "🇵🇾" },

  // --- WEST AFRICA ---
  { name: "Nigeria", code: "NG", flag: "🇳🇬" },
  { name: "Ghana", code: "GH", flag: "🇬🇭" },
  { name: "Ivory Coast", code: "CI", flag: "🇨🇮" },
  { name: "Senegal", code: "SN", flag: "🇸🇳" },
  { name: "Liberia", code: "LR", flag: "🇱🇷" },
  { name: "Sierra Leone", code: "SL", flag: "🇸🇱" },
  { name: "Gambia", code: "GM", flag: "🇬🇲" },
  { name: "Togo", code: "TG", flag: "🇹🇬" },
  { name: "Benin", code: "BJ", flag: "🇧🇯" },
  { name: "Niger", code: "NE", flag: "🇳🇪" },
  { name: "Burkina Faso", code: "BF", flag: "🇧🇫" },
  { name: "Mali", code: "ML", flag: "🇲🇱" },
  { name: "Mauritania", code: "MR", flag: "🇲🇷" },
  { name: "Cape Verde", code: "CV", flag: "🇨🇻" },
  { name: "Guinea", code: "GN", flag: "🇬🇳" },
  { name: "Guinea-Bissau", code: "GW", flag: "🇬🇼" },

  // --- EAST AFRICA ---
  { name: "Kenya", code: "KE", flag: "🇰🇪" },
  { name: "Uganda", code: "UG", flag: "🇺🇬" },
  { name: "Tanzania", code: "TZ", flag: "🇹🇿" },
  { name: "Rwanda", code: "RW", flag: "🇷🇼" },
  { name: "Ethiopia", code: "ET", flag: "🇪🇹" },
  { name: "Somalia", code: "SO", flag: "🇸🇴" },
  { name: "Sudan", code: "SD", flag: "🇸🇩" },
  { name: "South Sudan", code: "SS", flag: "🇸🇸" },
  { name: "Eritrea", code: "ER", flag: "🇪🇷" },
  { name: "Djibouti", code: "DJ", flag: "🇩🇯" },
  { name: "Burundi", code: "BI", flag: "🇧🇮" },
  { name: "Mauritius", code: "MU", flag: "🇲🇺" },
  { name: "Seychelles", code: "SC", flag: "🇸🇨" },
  { name: "Madagascar", code: "MG", flag: "🇲🇬" },
  { name: "Comoros", code: "KM", flag: "🇰🇲" },

  // --- SOUTHERN AFRICA ---
  { name: "South Africa", code: "ZA", flag: "🇿🇦" },
  { name: "Angola", code: "AO", flag: "🇦🇴" },
  { name: "Zimbabwe", code: "ZW", flag: "🇿🇼" },
  { name: "Zambia", code: "ZM", flag: "🇿🇲" },
  { name: "Botswana", code: "BW", flag: "🇧🇼" },
  { name: "Namibia", code: "NA", flag: "🇳🇦" },
  { name: "Mozambique", code: "MZ", flag: "🇲🇿" },
  { name: "Malawi", code: "MW", flag: "🇲🇼" },
  { name: "Lesotho", code: "LS", flag: "🇱🇸" },
  { name: "Eswatini", code: "SZ", flag: "🇸🇿" },

  // --- CENTRAL AFRICA ---
  { name: "Cameroon", code: "CM", flag: "🇨🇲" },
  { name: "Gabon", code: "GA", flag: "🇬🇦" },
  { name: "Democratic Republic of the Congo", code: "CD", flag: "🇨🇩" },
  { name: "Republic of the Congo", code: "CG", flag: "🇨🇬" },
  { name: "Equatorial Guinea", code: "GQ", flag: "🇬🇶" },
  { name: "Central African Republic", code: "CF", flag: "🇨🇫" },
  { name: "Chad", code: "TD", flag: "🇹🇩" },
  { name: "Sao Tome and Principe", code: "ST", flag: "🇸🇹" },

  // --- NORTH AFRICA ---
  { name: "Egypt", code: "EG", flag: "🇪🇬" },
  { name: "Morocco", code: "MA", flag: "🇲🇦" },
  { name: "Algeria", code: "DZ", flag: "🇩🇿" },
  { name: "Tunisia", code: "TN", flag: "🇹🇳" },
  { name: "Libya", code: "LY", flag: "🇱🇾" },

  // --- EUROPE ---
  { name: "United Kingdom", code: "GB", flag: "🇬🇧" },
  { name: "Germany", code: "DE", flag: "🇩🇪" },
  { name: "France", code: "FR", flag: "🇫🇷" },
  { name: "Italy", code: "IT", flag: "🇮🇹" },
  { name: "Spain", code: "ES", flag: "🇪🇸" },
  { name: "Portugal", code: "PT", flag: "🇵🇹" },
  { name: "Switzerland", code: "CH", flag: "🇨🇭" },
  { name: "Netherlands", code: "NL", flag: "🇳🇱" },
  { name: "Belgium", code: "BE", flag: "🇧🇪" },
  { name: "Austria", code: "AT", flag: "🇦🇹" },
  { name: "Sweden", code: "SE", flag: "🇸🇪" },
  { name: "Norway", code: "NO", flag: "🇳🇴" },
  { name: "Denmark", code: "DK", flag: "🇩🇰" },
  { name: "Finland", code: "FI", flag: "🇫🇮" },
  { name: "Ireland", code: "IE", flag: "🇮🇪" },
  { name: "Poland", code: "PL", flag: "🇵🇱" },
  { name: "Greece", code: "GR", flag: "🇬🇷" },
  { name: "Turkey", code: "TR", flag: "🇹🇷" },
  { name: "Ukraine", code: "UA", flag: "🇺🇦" },
  { name: "Romania", code: "RO", flag: "🇷🇴" },
  { name: "Czech Republic", code: "CZ", flag: "🇨🇿" },
  { name: "Hungary", code: "HU", flag: "🇭🇺" },
  { name: "Croatia", code: "HR", flag: "🇭🇷" },
  { name: "Slovakia", code: "SK", flag: "🇸🇰" },
  { name: "Luxembourg", code: "LU", flag: "🇱🇺" },
  { name: "Malta", code: "MT", flag: "🇲🇹" },
  { name: "Cyprus", code: "CY", flag: "🇨🇾" },
  { name: "Iceland", code: "IS", flag: "🇮🇸" },

  // --- ASIA ---
  { name: "India", code: "IN", flag: "🇮🇳" },
  { name: "China", code: "CN", flag: "🇨🇳" },
  { name: "Japan", code: "JP", flag: "🇯🇵" },
  { name: "South Korea", code: "KR", flag: "🇰🇷" },
  { name: "Singapore", code: "SG", flag: "🇸🇬" },
  { name: "Malaysia", code: "MY", flag: "🇲🇾" },
  { name: "Indonesia", code: "ID", flag: "🇮🇩" },
  { name: "Philippines", code: "PH", flag: "🇵🇭" },
  { name: "Thailand", code: "TH", flag: "🇹🇭" },
  { name: "Vietnam", code: "VN", flag: "🇻🇳" },
  { name: "Pakistan", code: "PK", flag: "🇵🇰" },
  { name: "Bangladesh", code: "BD", flag: "🇧🇩" },
  { name: "Sri Lanka", code: "LK", flag: "🇱🇰" },
  { name: "Taiwan", code: "TW", flag: "🇹🇼" },
  { name: "Nepal", code: "NP", flag: "🇳🇵" },
  { name: "Kazakhstan", code: "KZ", flag: "🇰🇿" },
  { name: "Uzbekistan", code: "UZ", flag: "🇺🇿" },

  // --- MIDDLE EAST & WEST ASIA ---
  { name: "Saudi Arabia", code: "SA", flag: "🇸🇦" },
  { name: "United Arab Emirates", code: "AE", flag: "🇦🇪" },
  { name: "Israel", code: "IL", flag: "🇮🇱" },
  { name: "Qatar", code: "QA", flag: "🇶🇦" },
  { name: "Kuwait", code: "KW", flag: "🇰🇼" },
  { name: "Oman", code: "OM", flag: "🇴🇲" },
  { name: "Bahrain", code: "BH", flag: "🇧🇭" },
  { name: "Jordan", code: "JO", flag: "🇯🇴" },
  { name: "Lebanon", code: "LB", flag: "🇱🇧" },
  { name: "Iraq", code: "IQ", flag: "🇮🇶" },
  { name: "Iran", code: "IR", flag: "🇮🇷" },

  // --- OCEANIA ---
  { name: "Australia", code: "AU", flag: "🇦🇺" },
  { name: "New Zealand", code: "NZ", flag: "🇳🇿" },
  { name: "Fiji", code: "FJ", flag: "🇫🇯" },
  { name: "Papua New Guinea", code: "PG", flag: "🇵🇬" },

  // --- OTHER ---
  { name: "Other", code: "UN", flag: "🌍" }
];

// Generate dynamic map index for rapid reverse lookup
export const COUNTRY_ISO_MAP: Record<string, string> = COUNTRIES.reduce((acc, curr) => {
  acc[curr.name] = curr.code;
  return acc;
}, {} as Record<string, string>);
