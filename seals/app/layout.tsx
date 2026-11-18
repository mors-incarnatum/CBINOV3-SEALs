import type { Metadata } from "next";
import OfflineServiceWorker from "./components/OfflineServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
    title: "WiKahon",
    description: "Augmentative and Alternative Communication Board for non-verbal users",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full antialiased">
            <body className="min-h-full flex flex-col">
                <OfflineServiceWorker />
                {children}
            </body>
        </html>
    );
}
