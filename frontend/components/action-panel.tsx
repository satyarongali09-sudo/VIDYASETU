import Link from "next/link";

type ActionPanelProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ActionPanel({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel
}: ActionPanelProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="actions">
        <Link className="button" href={primaryHref}>
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link className="button-secondary" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
