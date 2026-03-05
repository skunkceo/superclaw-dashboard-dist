import Link from 'next/link';

const guides = [
  {
    slug: 'google-service-account',
    title: 'Google Service Account Setup',
    description: 'Connect GA4 and Search Console to SuperClaw Traffic by creating and configuring a Google service account.',
    category: 'Integrations',
    readTime: '5 min',
  },
  {
    slug: 'setup',
    title: 'SuperClaw Setup',
    description: 'Install and configure SuperClaw, set up your first agent, and get OpenClaw running autonomously.',
    category: 'Getting Started',
    readTime: '10 min',
  },
];

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Guides</h1>
          <p className="text-zinc-400 text-sm mt-1">Step-by-step documentation for setting up and using SuperClaw.</p>
        </div>

        <div className="grid gap-4">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="block bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 hover:border-zinc-500 hover:bg-zinc-800 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                      {guide.category}
                    </span>
                    <span className="text-xs text-zinc-500">{guide.readTime} read</span>
                  </div>
                  <h2 className="text-white font-semibold text-lg group-hover:text-orange-400 transition-colors">
                    {guide.title}
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{guide.description}</p>
                </div>
                <svg
                  className="w-5 h-5 text-zinc-500 group-hover:text-orange-400 transition-colors flex-shrink-0 mt-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
