# Quietcare design system

## Foundations

- Typeface: Manrope, self-hosted in weights 400, 500, 600, 700, and 800.
- Primary text/action: Slate 900, `#0F172A`; secondary text: Slate 600, `#475569`; tertiary text: Slate 500, `#64748B`.
- Surfaces: white `#FFFFFF`, Slate 50 `#F8FAFC`, Slate 100 `#F1F5F9`.
- Borders: Slate 300 `#CBD5E1` and Slate 200 `#E2E8F0`.
- Success/progress: Green 600 `#16A34A` and Green 500 `#22C55E`; success surface: Green 100 `#DCFCE7`.
- Warning: Orange 600 `#EA580C`; warning surface: Orange 100 `#FFEDD5`.
- Error: Red 500 `#EF4444`.

## Type and spacing

Mobile screen headings use 20/25px bold Manrope. Body copy uses 12/17px regular. Controls use 13/18px bold. The reference system also defines larger title and heading scales plus 18, 16, 14, and 12px body styles; only the styles needed by the main flow are coded.

The primary mobile gutter is 24px. Common internal spacing follows 4, 8, 12, 16, 20, 24, and 32px increments. Cards use 10, 14, or 16px radii. Primary actions are 52px high with a pill radius.

## Components

- Primary, secondary, danger, and disabled pill buttons
- Mobile status and progress headers
- Prescription and medicine capture illustrations
- Prescription preview and medicine cards
- Warning and success states
- Bottom sheets with structured controls
- Select and quantity controls
- Pouch labels and packing rows
- Caregiver dashboard cards, alerts, records, and floating action

Use the shared CSS variables and reusable components before introducing a new visual value. The source design library contains broad color and type scales; this implementation intentionally codes the subset visible in the main flow.
