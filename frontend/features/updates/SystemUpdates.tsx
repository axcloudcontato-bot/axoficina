import { RELEASE_NOTES } from './release-notes';

export function SystemUpdates() {
  return <section aria-labelledby="system-updates-title" className="space-y-4 p-3">
    <div><h2 id="system-updates-title" className="text-base font-bold">Novidades do sistema</h2><p className="mt-1 text-xs text-text-muted">Confira as melhorias disponíveis para sua oficina.</p></div>
    {RELEASE_NOTES.map((release) => <article key={release.id} className="border-t border-border pt-3">
      <time dateTime={release.date} className="text-xs font-semibold text-primary">{release.date.split('-').reverse().join('/')}</time>
      <h3 className="mt-1 text-sm font-bold text-text">{release.title}</h3>
      <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-5 text-text-muted">{release.items.map((item) => <li key={item}>{item}</li>)}</ul>
    </article>)}
  </section>;
}
