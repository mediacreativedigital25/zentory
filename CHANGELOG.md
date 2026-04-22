# Changelog

All notable changes to this project will be documented in this file.

## [2.5.0] - 2026-04-22

### Added
- **Invoice Collection Module**: A dedicated page to track mass collection sessions per customer.
- **Collection Persistence**: Ability to save tagihan sessions to Firestore from the "Tagihkan" modal.
- **Automatic ID Generation**: Implemented uniquely formatted collection numbers (IC-YYYYMM-XXXXXX).
- **Collective Financial Stats**: Summary widgets for total collected and outstanding collective debt.
- **Order Coverage Listing**: Detailed view to see exactly which invoice numbers are included in a specific collection.

## [2.4.0] - 2026-04-22

### Added
- **Target locking logic**: Automatically disable target editing for current and past months to enforce planning discipline.
- **Enhanced Achievement Table**: Added Omzet, multiple targets (Target 1, 2, 3), and percentage progress columns.
- **Shortfall Tracking (Kurang: Rp.XXX)**: Added dynamic calculation of remaining amount needed to reach each target level.
- **Standardized Month Keys**: Implemented local-time based month key generation to fix "current month" detection issues.
- **Visual indicators**: Added "Target Terkunci" status and red "Shortfall" labels for better situational awareness.

### Fixed
- **Timezone Drift**: Resolved issue where current month would not appear in analysis tables due to UTC/Local time differences.
- **Month Selector Sync**: Ensuring the target selector in "Setting Target" matches the display in "Pencapaian".

## [Unreleased] - 2026-04-11

### Added
- **Checkout Modal**: Introduced a dedicated checkout modal for a cleaner sales process.
- **Manual Quantity Input**: Added the ability to manually type product quantities in the cart.
- **Cloudinary Integration**: Switched image uploads to Cloudinary for better performance and reliability.
- **Flexible Payment Methods**: Added support for "Tunai" (Cash) and "Transfer" (Bank Transfer).
- **Auto-generated "TUNAI" Account**: System now automatically creates and protects a "TUNAI" bank account for each tenant.
- **Payment Types**: Support for "Lunas" (Full Payment) and "Tempo" (Credit/Partial Payment).
- **Success Modal**: Added a confirmation modal with order details upon successful checkout.

### Changed
- **UI Refinement**: Updated Sales Order UI for better mobile responsiveness and scannability.
- **Popup Width**: Increased all popup widths (Checkout, Confirm, Success) to 650px for better readability.
- **Sticky Checkout Button**: Fixed the "Simpan Pesanan" button to the bottom of the checkout modal.
- **Cart Display**: Improved product name display in the cart to prevent truncation.

### Fixed
- **Firestore Transaction Error**: Resolved "reads before writes" error in the checkout process by restructuring the transaction logic.
- **Checkout Flow**: Fixed the "Complete Order" button functionality and integrated it into the new modal flow.
- **Stock Validation**: Improved real-time stock checking during manual quantity input and checkout.
