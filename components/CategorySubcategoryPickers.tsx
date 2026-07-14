'use client'

import { useState } from 'react'
import { CategoryPicker } from './CategoryPicker'
import { SubcategoryPicker } from './SubcategoryPicker'

interface Props {
  transactionId: string
  userCategory: string | null
  plaidCategory: string | null
  plaidSubcategory: string | null
  userSubcategory: string | null
  merchantName: string
  merchantNormalized: string
  txDate: string
  customCategories: string[]
  customSubcategories: string[]
}

export function CategorySubcategoryPickers({
  transactionId, userCategory, plaidCategory, plaidSubcategory,
  userSubcategory, merchantName, merchantNormalized, txDate,
  customCategories, customSubcategories,
}: Props) {
  // Tracks the effective primary key so SubcategoryPicker updates instantly when category changes
  const [effectivePrimaryKey, setEffectivePrimaryKey] = useState<string | null>(
    userCategory ?? plaidCategory
  )
  const [currentSubcategory, setCurrentSubcategory] = useState<string | null>(userSubcategory)

  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-300 w-20 shrink-0">Category</span>
        <CategoryPicker
          transactionId={transactionId}
          userCategory={userCategory}
          plaidCategory={plaidCategory}
          plaidSubcategory={plaidSubcategory}
          merchantName={merchantName}
          merchantNormalized={merchantNormalized}
          txDate={txDate}
          customCategories={customCategories}
          onCategoryChange={(newCategory) => {
            setEffectivePrimaryKey(newCategory ?? plaidCategory)
            // When a custom category is set, auto-subcategory becomes "Other"
            if (newCategory && !isPLaidCategory(newCategory)) {
              setCurrentSubcategory('Other')
            } else {
              setCurrentSubcategory(null)
            }
          }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-300 w-20 shrink-0">Subcategory</span>
        <SubcategoryPicker
          key={effectivePrimaryKey ?? '__none__'}
          transactionId={transactionId}
          userSubcategory={currentSubcategory}
          plaidSubcategory={plaidSubcategory}
          effectivePrimaryKey={effectivePrimaryKey}
          merchantName={merchantName}
          merchantNormalized={merchantNormalized}
          txDate={txDate}
          customSubcategories={customSubcategories}
        />
      </div>
    </>
  )
}

// Plaid primary category keys are all-caps + underscores only
function isPLaidCategory(key: string) {
  return /^[A-Z_]+$/.test(key)
}
