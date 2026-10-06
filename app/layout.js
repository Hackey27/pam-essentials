import "@fontsource-variable/comfortaa";
import "@fontsource-variable/nunito-sans";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import FooterReturn from "@/components/FooterReturn";
import CustomerPageFooter from "@/components/CustomerPageFooter";

export const metadata = {
  title: "PAM Essentials",
  description: "PAM Essentials online store",
  icons: { icon: "/brand/pam-symbol-white.svg" },
};

export const viewport = {
  colorScheme: "only light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider><FooterReturn />{children}<CustomerPageFooter /></AuthProvider>
      </body>
    </html>
  );
}
