import "./globals.css";

export const metadata = {
  title: "PAM Essentials",
  description: "PAM Essentials online store",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
