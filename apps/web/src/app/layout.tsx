import type { Metadata } from 'next';
import '@/styles/globals.scss';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Arte Modelo Dubois — Sistema de Facturación y Pedidos B2B',
  description:
    'Plataforma B2B de gestión de catálogo, pedidos, consignaciones y facturación de Arte Modelo Dubois.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
