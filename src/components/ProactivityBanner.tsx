'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProactivitySummary { intel:{total:number;unread:number}; suggestions:{pending:number;approved:number;queued:number}; overnight:{activeRun:boolean;queuedCount:number;lastRunAt:number|null}; lastRefresh:number|null; }
interface SuggestionItem { id:string; title:string; category:string; impact:'low'|'medium'|'high'; effort:'low'|'medium'|'high'; status:string; }

function timeAgo(ts:number):string { if(!ts||isNaN(ts))return'—'; const diff=Date.now()-ts; if(diff<0)return'just now'; const mins=Math.floor(diff/60000); if(mins<1)return'just now'; if(mins<60)return`${mins}m ago`; const hours=Math.floor(mins/60); if(hours<24)return`${hours}h ago`; return`${Math.floor(hours/24)}d ago`; }

const IMPACT_COLORS:Record<string,string>={high:'text-orange-400',medium:'text-yellow-500',low:'text-zinc-500'};
const CATEGORY_LABELS:Record<string,string>={content:'Content',seo:'SEO',code:'Code',marketing:'Marketing',research:'Research',product:'Product'};

export function ProactivityBanner() {
  const [data, setData] = useState<ProactivitySummary|null>(null);
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [intelRes,sugRes,nightRes,itemsRes] = await Promise.all([
        fetch('/api/intel?stats=true'),fetch('/api/suggestions?stats=true'),fetch('/api/overnight'),fetch('/api/suggestions?status=pending&limit=5'),
      ]);
      const intel=intelRes.ok?await intelRes.json():null;
      const sug=sugRes.ok?await sugRes.json():null;
      const night=nightRes.ok?await nightRes.json():null;
      const sugs=itemsRes.ok?await itemsRes.json():null;
      setData({ intel:{total:intel?.total||0,unread:intel?.unread||0}, suggestions:{pending:sug?.pending||0,approved:sug?.approved||0,queued:sug?.queued||0}, overnight:{activeRun:!!night?.activeRun,queuedCount:night?.queuedCount||0,lastRunAt:night?.lastRun?.started_at||null}, lastRefresh:intel?.lastRefresh?parseInt(intel.lastRefresh):null });
      setItems((sugs?.suggestions||[]).slice(0,5));
    } catch {}
  };

  useEffect(() => { load(); const i=setInterval(load,60000); return()=>clearInterval(i); }, []);

  const handleRefresh = async () => { setRefreshing(true); try{await fetch('/api/proactivity/refresh',{method:'POST'});await load();}finally{setRefreshing(false);} };

  if (!data) return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse h-full">
      <div className="h-4 bg-zinc-800 rounded w-32 mb-4"/>
      <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-8 bg-zinc-800 rounded-lg"/>)}</div>
    </div>
  );

  const hasAttention=data.suggestions.pending>0||data.intel.unread>0;
  const isRunning=data.overnight.activeRun;

  return (
    <div className={`relative overflow-hidden rounded-xl border flex flex-col h-full ${isRunning?'border-orange-500/30 bg-orange-500/5':hasAttention?'border-zinc-700 bg-zinc-900':'border-zinc-800 bg-zinc-900/60'}`}>
      {(isRunning||hasAttention)&&<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"/>}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">The Bridge</h2>
            {hasAttention&&<span className="px-1.5 py-0.5 bg-orange-500 rounded-full text-[10px] font-bold text-white leading-none">{data.suggestions.pending+data.intel.unread}</span>}
            {isRunning&&<span className="flex items-center gap-1 text-xs text-orange-400"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"/>Running</span>}
          </div>
          <div className="flex items-center gap-2">
            {data.lastRefresh&&<span className="text-[11px] text-zinc-600 hidden sm:block">refreshed {timeAgo(data.lastRefresh)}</span>}
            <button onClick={handleRefresh} disabled={refreshing} title="Refresh intel" className="p-1.5 text-zinc-600 hover:text-orange-400 hover:bg-zinc-800 rounded-lg transition-colors">
              <svg className={`w-3.5 h-3.5 ${refreshing?'animate-spin':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
            <Link href="/bridge" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors font-medium">Open →</Link>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 text-xs">
          <span><span className={data.intel.unread>0?'text-orange-400 font-medium':'text-zinc-400'}>{data.intel.unread}</span><span className="text-zinc-600"> unread</span></span>
          <span className="text-zinc-700">·</span>
          <span><span className={data.suggestions.pending>0?'text-orange-400 font-medium':'text-zinc-400'}>{data.suggestions.pending}</span><span className="text-zinc-600"> pending</span></span>
          {data.overnight.queuedCount>0&&<><span className="text-zinc-700">·</span><span><span className="text-zinc-400">{data.overnight.queuedCount}</span><span className="text-zinc-600"> queued tonight</span></span></>}
        </div>

        <div className="flex-1 space-y-1.5 min-h-0">
          {items.length===0?(
            <div className="py-6 text-center">
              <p className="text-xs text-zinc-600">No pending suggestions</p>
              <button onClick={handleRefresh} className="mt-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors">Refresh intel to generate</button>
            </div>
          ):items.map(item=>(
            <Link key={item.id} href={`/bridge?id=${item.id}`} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all group">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-200 group-hover:text-white transition-colors line-clamp-1 font-medium">{item.title}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-zinc-600">{CATEGORY_LABELS[item.category]||item.category}</span>
                  <span className="text-zinc-700">·</span>
                  <span className={`text-[10px] font-medium ${IMPACT_COLORS[item.impact]||'text-zinc-500'}`}>{item.impact} impact</span>
                </div>
              </div>
              <svg className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500 flex-shrink-0 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </Link>
          ))}
        </div>

        {items.length>0&&(
          <div className="mt-3 pt-3 border-t border-zinc-800/60">
            <Link href="/bridge" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">View all {data.suggestions.pending} suggestions →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
