import { Inter } from 'next/font/google';
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: "VPD Order System",
  description: "Secure Pharma Stock Catalogue & WhatsApp Order Routing System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}

