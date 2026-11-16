/**
 * Mount point for «Slett kontoen min» (parallel PR). Keep an empty, stable wrapper
 * so the deletion UI can replace this node without reshaping Min side.
 */
export function AccountDeletionSlot() {
  return (
    <div
      data-account-deletion-slot
      className="rounded-2xl border border-dashed border-border bg-muted/20 p-6"
      aria-hidden
    />
  );
}