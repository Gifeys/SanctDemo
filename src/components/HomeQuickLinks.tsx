import { BookOpen, Church, Users } from "lucide-react";
import { t } from "../lib/ui";
import type { Language } from "../lib/language";

/**
 * The three parts of the Parish Bulletin, as a chooser.
 *
 * ## Why it filters rather than scrolls
 *
 * It scrolled to the section for one version, and that was the wrong
 * answer to the right problem: the sections were below the fold, so a
 * smooth scroll moved the page and left the pilgrim to work out which
 * of the three things now on screen was the one they asked for.
 *
 * Choosing shows that section and only that section. Nothing has to be
 * scrolled past, and there is never a second section underneath to be
 * mistaken for the answer.
 *
 * ## Why the verse and the announcements are not in here
 *
 * They are not alternatives to each other - they are the parish's
 * standing notices, and they stay below whatever is chosen. The
 * chooser only governs the part that changes.
 */

export type HomeSection = "ministries" | "mass" | "history";

const SECTIONS: Array<{
  id: HomeSection;
  icon: React.ReactNode;
  label: { en: string; fil: string };
}> = [
  {
    id: "ministries",
    icon: <Users className="w-[17px] h-[17px]" />,
    // One button for both: they sit side by side and a visitor who is
    // not sure which word covers their errand should not have to guess.
    label: { en: "Ministry &\nSacraments", fil: "Ministeryo at\nSakramento" },
  },
  {
    id: "mass",
    icon: <Church className="w-[17px] h-[17px]" />,
    label: { en: "Mass\nSchedule", fil: "Oras ng\nMisa" },
  },
  {
    id: "history",
    icon: <BookOpen className="w-[17px] h-[17px]" />,
    label: { en: "History", fil: "Kasaysayan" },
  },
];

export default function HomeQuickLinks({
  language,
  active,
  onSelect,
}: {
  language: Language;
  active: HomeSection;
  onSelect: (section: HomeSection) => void;
}) {
  return (
    <div
      className="quick"
      role="tablist"
      aria-label={t("quick.heading", language)}
    >
      {SECTIONS.map(section => {
        const on = section.id === active;
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(section.id)}
            data-spotlight={`home-${section.id}`}
            className={`quick__btn${on ? " is-on" : ""}`}
          >
            <span className="quick__icon">{section.icon}</span>
            <span className="quick__label">{section.label[language]}</span>
          </button>
        );
      })}
    </div>
  );
}
