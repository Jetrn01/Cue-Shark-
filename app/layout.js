export const metadata = {
  title: "PottersMate",
  description: "Cue sport tournament management",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body style={{margin:0,background:"#f3f3f3"}}>{children}</body></html>;
}
