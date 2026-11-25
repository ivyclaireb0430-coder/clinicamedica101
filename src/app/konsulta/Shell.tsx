export function KonsultaShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-cm-sky to-white px-4 py-6 print:bg-white print:p-0">
      <div className={`mx-auto ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        <p className="mb-4 text-center text-lg font-extrabold text-cm-navy print:hidden">Clinica Medica 101</p>
        {children}
      </div>
    </main>
  );
}
