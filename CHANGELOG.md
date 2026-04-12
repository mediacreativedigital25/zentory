# Changelog

All notable changes to this project will be documented in this file.

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
