import "./globals.css";

export const metadata = {
  title: "VPD Order System",
  description: "Secure Pharma Stock Catalogue & WhatsApp Order Routing System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}

