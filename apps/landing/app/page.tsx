const releaseNotes = [
  'Windows 64-bit NSIS installer — v0.1.0',
  'Same-domain download route',
  'Starts immediately without a release-page hop',
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-20 sm:px-10 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-white/45">
            Bento Desktop
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-none tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Download the Windows installer.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            Bento Desktop is available for Windows right now. Use the download below and the browser
            will start the installer immediately.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="/download/windows"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black transition-transform duration-200 hover:scale-[1.02] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Download for Windows v0.1.0
            </a>
            <span className="text-sm leading-6 text-white/50">
              Direct installer, no extra release page.
            </span>
          </div>

          <ul className="mt-10 grid gap-3 text-sm text-white/70 sm:grid-cols-3">
            {releaseNotes.map((note) => (
              <li
                key={note}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-sm"
              >
                {note}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
