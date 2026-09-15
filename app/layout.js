export const metadata = { title: "Cue Shark", description: "Cue sport tournament management" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{margin:0,fontFamily:"Arial, sans-serif",background:"#f5f5f5"}}>{children}</body>
    </html>
  );
}