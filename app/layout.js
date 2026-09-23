import "@fontsource-variable/comfortaa";
import "@fontsource-variable/nunito-sans";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata = {
  title: "PAM Essentials",
  description: "PAM Essentials online store",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
