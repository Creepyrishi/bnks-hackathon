import './globals.css'

export const metadata = {
  title: 'Accessible Computing Playground',
  description: 'Train with eye blinks and head nods'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">{children}</body>
    </html>
  )
}
