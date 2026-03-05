import Link from 'next/link';

export default function GoogleServiceAccountGuide() {
  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <Link href="/guides" className="hover:text-zinc-300 transition-colors">Guides</Link>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-zinc-300">Google Service Account Setup</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">Integrations</span>
            <span className="text-xs text-zinc-500">5 min read</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Google Service Account Setup</h1>
          <p className="text-zinc-400 leading-relaxed">
            Connect GA4 and Search Console to SuperClaw Traffic. Once configured, you get 30-day session charts,
            organic vs non-organic breakdowns, and keyword rankings — all in one place.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-10">

          {/* Step 1 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h2 className="text-lg font-semibold text-white">Create a service account</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300">Google Cloud Console → IAM &amp; Admin → Service Accounts</a>.</p>
              <p>Select your project, then click <strong className="text-zinc-200">Create Service Account</strong>.</p>
              <p>Give it a name (e.g. <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300 text-xs">superclaw-analytics</code>), then click through to finish. You do not need to assign any Cloud IAM roles at this step.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">2</span>
              <h2 className="text-lg font-semibold text-white">Download the JSON key</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>Click the service account you just created, go to the <strong className="text-zinc-200">Keys</strong> tab, then <strong className="text-zinc-200">Add Key → Create new key → JSON</strong>.</p>
              <p>A JSON file will download. Keep it safe — this is what you paste into SuperClaw Settings.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">3</span>
              <h2 className="text-lg font-semibold text-white">Grant access to GA4</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>Go to <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300">Google Analytics</a> and open the property you want to connect.</p>
              <p>Navigate to <strong className="text-zinc-200">Admin → Property Access Management</strong>.</p>
              <p>Click the <strong className="text-zinc-200">+</strong> button and add the service account email (found in the JSON file as <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300 text-xs">client_email</code>).</p>
              <p>Set the role to <strong className="text-zinc-200">Viewer</strong>. Repeat for each GA4 property you want in SuperClaw.</p>
            </div>
          </div>

          {/* Step 4 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">4</span>
              <h2 className="text-lg font-semibold text-white">Grant access to Search Console</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>Go to <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300">Google Search Console</a> and open the property.</p>
              <p>Go to <strong className="text-zinc-200">Settings → Users and permissions → Add user</strong>.</p>
              <p>Enter the service account email and set permission to <strong className="text-zinc-200">Full</strong> (required for the API). Repeat for each site you want to track.</p>
            </div>
          </div>

          {/* Step 5 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">5</span>
              <h2 className="text-lg font-semibold text-white">Connect in SuperClaw Settings</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>Open the JSON key file, copy the entire contents, then go to <Link href="/settings#analytics" className="text-orange-400 hover:text-orange-300">Settings → Analytics</Link> in SuperClaw.</p>
              <p>Paste the JSON into the text area and click <strong className="text-zinc-200">Save credentials</strong>. SuperClaw validates the key immediately — if it fails, check that the service account email has been granted access to at least one GA4 property.</p>
            </div>
          </div>

          {/* Step 6 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-orange-500 text-black text-sm font-bold flex items-center justify-center flex-shrink-0">6</span>
              <h2 className="text-lg font-semibold text-white">Configure site mappings</h2>
            </div>
            <div className="ml-10 space-y-3 text-sm text-zinc-400 leading-relaxed">
              <p>After saving, you will see a site configuration section. For each site, enter your <strong className="text-zinc-200">GA4 Property ID</strong> (numeric, e.g. <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300 text-xs">513552077</code>) and your <strong className="text-zinc-200">GSC domain</strong> (e.g. <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300 text-xs">sc-domain:example.com</code>).</p>
              <p>Save site settings, then visit <Link href="/pulse" className="text-orange-400 hover:text-orange-300">Traffic</Link> — your charts will populate within a few seconds.</p>
            </div>
          </div>

        </div>

        {/* Troubleshooting */}
        <div className="mt-12 bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Troubleshooting</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-zinc-200 font-medium mb-1">Credentials saved but no data appears</p>
              <p className="text-zinc-400">GA4 access can take a few minutes to propagate after adding a user. Wait 5 minutes and try again. Also confirm the Property ID is numeric only, no <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300">properties/</code> prefix.</p>
            </div>
            <div className="border-t border-zinc-700 pt-4">
              <p className="text-zinc-200 font-medium mb-1">PERMISSION_DENIED error</p>
              <p className="text-zinc-400">The service account has not been granted access to the GA4 property or GSC site. Re-check step 3 and 4. The email in the JSON <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300">client_email</code> field must match exactly what you added.</p>
            </div>
            <div className="border-t border-zinc-700 pt-4">
              <p className="text-zinc-200 font-medium mb-1">Invalid JSON error when saving</p>
              <p className="text-zinc-400">Copy the entire file contents including the outer <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-orange-300">{`{}`}</code> braces. Do not modify the file before pasting.</p>
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-10 pt-6 border-t border-zinc-800 flex items-center justify-between">
          <Link href="/guides" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All guides
          </Link>
          <Link href="/settings#analytics" className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors font-medium">
            Go to Settings
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

      </div>
    </div>
  );
}
