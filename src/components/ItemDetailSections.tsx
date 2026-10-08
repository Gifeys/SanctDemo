import { Check, Clock, Info, ListOrdered, Phone } from "lucide-react";
import type { ResolvedItem } from "../lib/itemContent";

/**
 * The parts of a ministry or sacrament page beyond the description.
 *
 * ## Why every section can be absent
 *
 * The parish writes these; most have written none of them yet. A
 * heading over an empty list reads as a page that failed to load, so
 * each section renders only when there is something in it. A sacrament
 * page that is just a description and its requirements is a correct
 * page, not a broken one.
 *
 * ## Why cards and not one block of text
 *
 * Somebody reads this standing in a church porch deciding whether they
 * have the right papers. "Requirements" has to be findable by scanning,
 * which means it has to be its own thing with its own heading, not the
 * fourth paragraph.
 */
export default function ItemDetailSections({ item }: { item: ResolvedItem }) {
  return (
    <>
      {item.responsibilities.length > 0 && (
        <Section title="What members do" icon={<Check className="w-3.5 h-3.5" />}>
          <Bullets items={item.responsibilities} />
        </Section>
      )}

      {item.requirements.length > 0 && (
        <Section title="Requirements" icon={<Check className="w-3.5 h-3.5" />}>
          <ul className="space-y-1.5">
            {item.requirements.map(req => (
              <li key={req} className="flex gap-2 items-start text-[15px] leading-relaxed text-[var(--color-brand-text)]">
                <Check className="w-3.5 h-3.5 mt-1 shrink-0 text-[var(--color-brand-success)]" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {item.schedule && (
        <Section title="Schedule" icon={<Clock className="w-3.5 h-3.5" />}>
          <p className="text-[15px] leading-relaxed text-[var(--color-brand-text)]">
            {item.schedule}
          </p>
        </Section>
      )}

      {item.process.length > 0 && (
        <Section title="How applying works" icon={<ListOrdered className="w-3.5 h-3.5" />}>
          <ol className="space-y-2">
            {item.process.map((step, i) => (
              <li key={step} className="flex gap-2.5 items-start text-[15px] leading-relaxed text-[var(--color-brand-text)]">
                <span
                  aria-hidden
                  className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] text-[12px] font-bold grid place-items-center"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {item.reminders.length > 0 && (
        <Section title="Important reminders" icon={<Info className="w-3.5 h-3.5" />}>
          <Bullets items={item.reminders} />
        </Section>
      )}

      {item.contact && (
        <Section title="Contact the parish" icon={<Phone className="w-3.5 h-3.5" />}>
          <p className="text-[15px] leading-relaxed text-[var(--color-brand-text)] break-words">
            {item.contact}
          </p>
        </Section>
      )}
    </>
  );
}

function Section({
  title, icon, children,
}: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-4">
      <h5 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
        <span className="text-[var(--color-brand-primary)]">{icon}</span>
        {title}
      </h5>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map(text => (
        <li key={text} className="flex gap-2 items-start text-[15px] leading-relaxed text-[var(--color-brand-text)]">
          <span aria-hidden className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-[var(--color-brand-secondary)]" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
