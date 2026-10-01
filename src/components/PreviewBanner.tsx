export function PreviewBanner({ source, fetchedAt, listingId, withheld }: { source: string; fetchedAt: string; listingId: string; withheld: string[] }) {
  return (
    <div data-testid="preview-banner" className="border-b border-line bg-demo-wash px-4 py-2 text-center text-xs text-demo">
      Catalog preview · source: <strong>{source}</strong> · listing <code>{listingId}</code> · fetched {fetchedAt.slice(0, 19).replace("T", " ")} UTC · noindex
      {withheld.length > 0 && <span> · withheld: {withheld.join("; ")}</span>}
    </div>
  );
}
