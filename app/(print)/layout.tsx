export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 print:max-w-none print:p-0">{children}</div>
    </div>
  );
}
