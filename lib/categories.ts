// Plaid personal_finance_category display name maps

export const PRIMARY_LABELS: Record<string, string> = {
  INCOME: 'Income',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  LOAN_PAYMENTS: 'Loan Payments',
  BANK_FEES: 'Bank Fees',
  ENTERTAINMENT: 'Entertainment',
  FOOD_AND_DRINK: 'Food & Drink',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Home Improvement',
  MEDICAL: 'Healthcare',
  PERSONAL_CARE: 'Personal Care',
  GENERAL_SERVICES: 'Services',
  GOVERNMENT_AND_NON_PROFIT: 'Government & Nonprofit',
  TRANSPORTATION: 'Transportation',
  TRAVEL: 'Travel',
  RENT_AND_UTILITIES: 'Rent & Utilities',
}

export const SUBCATEGORY_LABELS: Record<string, string> = {
  // Food & Drink
  FOOD_AND_DRINK_RESTAURANT: 'Restaurants',
  FOOD_AND_DRINK_RESTAURANTS: 'Restaurants',       // alternate key Plaid has used
  FOOD_AND_DRINK_FAST_FOOD: 'Fast Food',
  FOOD_AND_DRINK_COFFEE: 'Coffee Shops',
  FOOD_AND_DRINK_GROCERIES: 'Groceries',
  FOOD_AND_DRINK_ALCOHOL_AND_BAR: 'Bars & Alcohol',
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: 'Beer, Wine & Liquor',
  FOOD_AND_DRINK_VENDING_MACHINES: 'Vending',
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: 'Other Food & Drink',
  // Entertainment
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: 'Sports & Attractions',
  ENTERTAINMENT_MUSIC_AND_AUDIO: 'Music & Audio',
  ENTERTAINMENT_VIDEO_AND_FILM: 'Video & Film',
  ENTERTAINMENT_VIDEO_GAMES: 'Video Games',
  ENTERTAINMENT_TV_AND_MOVIES: 'TV & Movies',
  ENTERTAINMENT_CASINOS_AND_GAMBLING: 'Gambling',
  ENTERTAINMENT_OTHER_ENTERTAINMENT: 'Other Entertainment',
  // Shopping (General Merchandise)
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: 'Online Shopping',
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: 'Department Stores',
  GENERAL_MERCHANDISE_DISCOUNT_STORES: 'Discount Stores',
  GENERAL_MERCHANDISE_SUPERSTORES: 'General Merchandise Superstores',
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: 'Convenience Stores',
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'Clothing',
  GENERAL_MERCHANDISE_ELECTRONICS: 'Electronics',
  GENERAL_MERCHANDISE_SPORTING_GOODS: 'Sporting Goods',
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: 'Books',
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: 'Gifts & Novelties',
  GENERAL_MERCHANDISE_PET_SUPPLIES: 'Pet Supplies',
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPE: 'Tobacco & Vape',
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: 'Other Shopping',
  // Transportation
  TRANSPORTATION_GAS: 'Gas',
  TRANSPORTATION_GAS_AND_CONVENIENCE_STORES: 'Gas & Convenience',
  TRANSPORTATION_AUTO: 'Auto',
  TRANSPORTATION_PUBLIC_TRANSIT: 'Public Transit',
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: 'Rideshare',
  TRANSPORTATION_PARKING: 'Parking',
  TRANSPORTATION_TOLLS: 'Tolls',
  TRANSPORTATION_OTHER_TRANSPORTATION: 'Other Transportation',
  // Travel
  TRAVEL_AIRLINES_AND_AVIATION_SERVICES: 'Flights',
  TRAVEL_HOTELS_AND_MOTELS: 'Hotels',
  TRAVEL_CAR_RENTAL: 'Car Rental',
  TRAVEL_RENTAL_CARS: 'Rental Cars',
  TRAVEL_VACATION_RENTALS: 'Vacation Rentals',
  TRAVEL_OTHER_TRAVEL: 'Other Travel',
  // Rent & Utilities
  RENT_AND_UTILITIES_RENT: 'Rent',
  RENT_AND_UTILITIES_ELECTRIC: 'Electric',
  RENT_AND_UTILITIES_GAS: 'Gas & Heating',
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: 'Gas & Electricity',
  RENT_AND_UTILITIES_WATER_AND_SEWER: 'Water & Sewer',
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: 'Sewage & Waste',
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: 'Internet & Cable',
  RENT_AND_UTILITIES_TELEPHONE_SERVICES: 'Phone',
  RENT_AND_UTILITIES_OTHER_UTILITIES: 'Other Utilities',
  // Healthcare
  MEDICAL_PHARMACIES: 'Pharmacy',
  MEDICAL_PRIMARY_CARE: 'Medical Primary Care',
  MEDICAL_DOCTOR_AND_HEALTHCARE: 'Doctor',
  MEDICAL_DENTAL_CARE: 'Dental',
  MEDICAL_DENTAL: 'Dental',
  MEDICAL_VISION: 'Vision',
  MEDICAL_MENTAL_HEALTH: 'Mental Health',
  MEDICAL_HOSPITALS_AND_CLINICS: 'Hospital',
  MEDICAL_VETERINARY: 'Veterinary',
  MEDICAL_OTHER_MEDICAL: 'Other Healthcare',
  // Home Improvement
  HOME_IMPROVEMENT_HOME_IMPROVEMENT_STORES: 'Home Improvement Stores',
  HOME_IMPROVEMENT_HARDWARE: 'Hardware',
  HOME_IMPROVEMENT_CONTRACTORS: 'Contractors',
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: 'Repair & Maintenance',
  HOME_IMPROVEMENT_FURNITURE: 'Furniture',
  HOME_IMPROVEMENT_SECURITY: 'Security',
  HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: 'Other Home',
  // Personal Care
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: 'Gym & Fitness',
  PERSONAL_CARE_HAIR_SERVICES: 'Hair',
  PERSONAL_CARE_SALONS: 'Salon & Spa',
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: 'Laundry',
  PERSONAL_CARE_OTHER_PERSONAL_CARE: 'Other Personal Care',
  // Loan Payments
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: 'Credit Card Payment',
  LOAN_PAYMENTS_CAR_PAYMENT: 'Car Payment',
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'Mortgage',
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: 'Student Loan',
  LOAN_PAYMENTS_OTHER_PAYMENT: 'Other Loan',
  LOAN_DISBURSEMENTS_OTHER_DISBURSEMENT: 'Loan Disbursement',
  // Services
  GENERAL_SERVICES_SUBSCRIPTION: 'Subscriptions',
  GENERAL_SERVICES_INSURANCE: 'Insurance',
  GENERAL_SERVICES_AUTOMOTIVE: 'Automotive Services',
  GENERAL_SERVICES_FINANCIAL_PLANNING_AND_FINANCIAL_SERVICES: 'Financial Services',
  GENERAL_SERVICES_CHILDCARE: 'Childcare',
  GENERAL_SERVICES_PET_SERVICES: 'Pet Services',
  GENERAL_SERVICES_EDUCATION: 'Education',
  GENERAL_SERVICES_OTHER_GENERAL_SERVICES: 'Other Services',
  // Government & Nonprofit
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: 'Donations',
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS: 'Government',
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES: 'Government Agencies',
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: 'Taxes',
  // Bank Fees
  BANK_FEES_ATM_FEES: 'ATM Fees',
  BANK_FEES_FOREIGN_TRANSACTION_FEES: 'Foreign Transaction Fees',
  BANK_FEES_OVERDRAFT_FEES: 'Overdraft Fees',
  BANK_FEES_OTHER_BANK_FEES: 'Other Bank Fees',
  // Income
  INCOME_WAGES: 'Wages',
  INCOME_SALARY: 'Salary',
  INCOME_CONTRACTOR: 'Contractor Income',
  INCOME_INTEREST_EARNED: 'Interest Earned',
  INCOME_OTHER_INCOME: 'Other Income',
  // Transfers
  TRANSFER_IN_ACCOUNT_TRANSFER: 'Account Transfer In',
  TRANSFER_IN_DEPOSIT: 'Deposit',
  TRANSFER_IN_TRANSFER_IN_FROM_APPS: 'Transfer In from Apps',
  TRANSFER_OUT_ACCOUNT_TRANSFER: 'Account Transfer Out',
  TRANSFER_OUT_SAVINGS: 'Savings Transfer',
  TRANSFER_OUT_TRANSFER_OUT_FROM_APPS: 'Transfer Out to Apps',
  // Other
  OTHER_OTHER: 'Other',
}

// Formats any Plaid raw category/subcategory string to a readable display name
export function formatCategory(raw: string | null | undefined): string {
  if (!raw) return 'Uncategorized'
  if (PRIMARY_LABELS[raw]) return PRIMARY_LABELS[raw]
  if (SUBCATEGORY_LABELS[raw]) return SUBCATEGORY_LABELS[raw]
  // If it looks like a Plaid key (all caps + underscores), format it; otherwise it's a custom user label
  if (/^[A-Z_]+$/.test(raw)) {
    return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }
  return raw
}

// Effective category for a transaction (display name)
export function effectiveCategory(
  userCategory: string | null | undefined,
  plaidCategory: string | null | undefined
): string {
  return formatCategory(userCategory ?? plaidCategory)
}

// Ordered list of Plaid primary categories for the user picker
export const PLAID_PRIMARY_CATEGORIES = Object.keys(PRIMARY_LABELS)

// Returns subcategory keys that belong to a given primary key
export function getSubcategoriesForPrimary(primaryKey: string): string[] {
  return Object.keys(SUBCATEGORY_LABELS).filter(k => k.startsWith(primaryKey + '_'))
}

// Effective subcategory display name for a transaction
export function effectiveSubcategory(
  userSubcategory: string | null | undefined,
  userCategory: string | null | undefined,
  plaidSubcategory: string | null | undefined,
  plaidCategory: string | null | undefined,
): string {
  if (userSubcategory) return formatCategory(userSubcategory)
  if (userCategory) return formatCategory(userCategory) // no sub when category overridden
  return formatCategory(plaidSubcategory ?? plaidCategory)
}
