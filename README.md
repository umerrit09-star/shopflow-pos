# ShopFlow POS

Build a mobile-first, cloud-based SaaS Point of Sale (POS) and Inventory Management System with multi-tenancy support. All currency calculations must be in Pakistani Rupees (PKR, display as "Rs.").

### Core User Roles & Authentication:

1. Super Admin Panel:

   - Dashboard to manage all registered shops/tenants.

   - Ability to add new shop accounts, hold (suspend) subscriptions, resume subscriptions, or delete shop accounts.

   - Global overview of total active shops and system-wide sales volume.

2. Shop Owner / Admin Panel:

   - Dedicated login per shop using Supabase Auth with Row Level Security (RLS) so data is strictly isolated per shop.

   - Settings page to upload shop logo, store name, address, and phone number (to display on receipts).

   - Full Inventory Management: Add, edit, delete items (Title, SKU/Barcode, Category, Cost Price in PKR, Selling Price in PKR, Stock Quantity, and Product Image).

   - Sales Analytics Dashboard: Daily/Weekly sales graphs in PKR, top-performing products, low stock alerts, and transaction history log.

3. Cashier / POS Terminal Mode:

   - Mobile-optimized interface designed for quick touch interactions on phones and tablets.

   - AI Product Recognition: A camera button that takes a photo of an item, sends it to an AI Vision edge function, and automatically identifies and adds the matching product to the checkout cart.

   - Fast checkout UI: Touch grid for products, quick search bar, stock indicator, subtotal, tax/discount calculation, and cash tendered entry with change return calculation.

   - Auto-generated receipt layout showing Shop Logo, Shop Name, Date & Time (auto-populated), Itemized list in PKR, Subtotal, Total, and Cash Received.

   - Direct Web Thermal Printing feature using browser print trigger (formatted for standard 80mm/58mm thermal receipt printers).

### UX & Mobile Design:

- Modern, clean aesthetic using Tailwind CSS and Shadcn UI components.

- Responsive tabbed navigation for fast switching between POS Terminal, Inventory, Analytics, and Settings.

- Floating cart bar on mobile screens for seamless one-hand operation.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a44f9b15-f24e-4c52-bcaa-ccf22bf2425d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
