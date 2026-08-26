import React from "react";
import { Clock, Phone, Mail, MapPin, Calendar, Sparkles, AlertTriangle } from "lucide-react";
import { MASS_SCHEDULES, PARISH_CONTACTS } from "../data";
import { Route } from "../types";
import { parseTimes } from "../lib/schedule";

const WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Parish facade photos, keyed by route id — same images used elsewhere
// (ChurchHistory, the church-selector cards) so a parish looks like the
// same place everywhere it appears in the app.
const PARISH_PHOTOS: Record<string, string> = {
  "route-mhcp": "https://dioceseofkalookan.ph/wp-content/uploads/2020/12/maryhelpPic1-1-1024x680.jpg",
  "route-src": "https://images.unsplash.com/photo-1590076241314-e2c7c724490d?auto=format&fit=crop&w=800&q=80",
};

// Groups consecutive weekdays that share the exact same Mass time string into
// a single display row (e.g. "Monday & Tuesday", "Wednesday - Saturday"),
// mirroring how the parish bulletin itself groups days.
function groupWeekdayRows(schedule: { day: string; time: string }[]) {
  const byDay = new Map(schedule.map((s) => [s.day, s.time]));
  const groups: { label: string; time: string }[] = [];
  let i = 0;
  while (i < WEEKDAY_ORDER.length) {
    const day = WEEKDAY_ORDER[i];
    const time = byDay.get(day);
    if (!time) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < WEEKDAY_ORDER.length && byDay.get(WEEKDAY_ORDER[j + 1]) === time) j++;
    const label =
      j === i
        ? day
        : j === i + 1
        ? `${day} & ${WEEKDAY_ORDER[j]}`
        : `${day} - ${WEEKDAY_ORDER[j]}`;
    groups.push({ label, time });
    i = j + 1;
  }
  return groups;
}

interface MassScheduleProps {
  parish: Route;
}

export default function MassSchedule({ parish }: MassScheduleProps) {
  const parishName = parish.name.replace(" Guide", "").replace(" Tour", "");
  const parishSchedule = MASS_SCHEDULES[parish.id];
  const schedule = parishSchedule?.schedule ?? [];
  const scheduleVerified = parishSchedule?.scheduleVerified ?? false;
  const weekdayRows = groupWeekdayRows(schedule);
  const sundayEntry = schedule.find((s) => s.day === "Sunday");
  const sundayTimes = sundayEntry ? parseTimes(sundayEntry.time) : [];
  const contact = PARISH_CONTACTS[parish.id];
  const photo = PARISH_PHOTOS[parish.id];

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[var(--color-brand-primary)] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[var(--color-brand-border)]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Clock className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[var(--color-brand-on-accent)] font-bold text-[15px] tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Liturgical Hours
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Mass & Sacraments
          </h2>
          <p className="text-[15px] text-[var(--color-brand-secondary)] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Plan your visitation and sacramental prayers around {parishName}'s daily liturgical schedule.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Main Schedule Card */}
        <div className="bg-white rounded-3xl border border-[var(--color-brand-border)] overflow-hidden shadow-xs p-5 space-y-4">
          {/* Facade photo representation */}
          <div className="rounded-2xl overflow-hidden h-28 border border-[var(--color-brand-border)]/40 relative">
            {photo && (
              <img
                src={photo}
                alt={parishName}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <span className="text-white text-[15px] font-bold font-serif italic tracking-wider text-center uppercase px-4">
                {parishName}
              </span>
            </div>
          </div>

          <h3 className="text-base font-bold text-center text-[var(--color-brand-text)] font-serif italic border-b border-[var(--color-brand-border)]/45 pb-1.5">
            Holy Mass Schedule
          </h3>

          {/* Unverified-schedule badge — must sit right next to the times
              it qualifies, not buried below them, so nobody reads the mock
              times as confirmed. See scheduleVerified in src/data.ts. */}
          {schedule.length > 0 && !scheduleVerified && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-sm font-bold text-amber-900 leading-snug">
                Sample schedule — not yet confirmed with the parish. Please call ahead before you go.
              </span>
            </div>
          )}

          {schedule.length === 0 ? (
            <div className="p-4 bg-[var(--color-brand-card)]/60 rounded-xl border border-[var(--color-brand-border)]/40 text-center">
              <p className="text-[15px] text-[var(--color-brand-text)] font-bold font-sans">
                Mass schedule not yet published for this parish.
              </p>
              <p className="text-sm text-[var(--color-brand-secondary)] font-sans mt-1">
                Please contact the parish office directly to confirm Mass times before visiting.
              </p>
            </div>
          ) : (
            <div className="space-y-3 font-sans">
              {weekdayRows.map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center p-2.5 bg-[var(--color-brand-card)]/60 rounded-xl border border-[var(--color-brand-border)]/30"
                >
                  <span className="text-[15px] font-bold text-[var(--color-brand-text)]">{row.label}</span>
                  <span className="text-[15px] font-mono font-bold text-[var(--color-brand-text)]">
                    {parseTimes(row.time).join(" / ")}
                  </span>
                </div>
              ))}

              {/* Sunday */}
              {sundayTimes.length > 0 && (
                <div className="p-2.5 bg-[var(--color-brand-card)]/50 rounded-xl border border-[var(--color-brand-border)]/60 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[15px] font-bold text-[var(--color-brand-secondary)]">Sunday Masses</span>
                    <span className="text-sm bg-[var(--color-brand-primary)] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Lord's Day
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-[15px] font-mono font-bold text-[var(--color-brand-text)] pt-1">
                    {sundayTimes.map((time) => (
                      <div key={time} className="p-1.5 bg-white rounded border border-[var(--color-brand-border)]/40">
                        {time}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confessions block — a diocese-wide practice, not specific to
              this parish's own published schedule. */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
            <h4 className="text-[15px] font-bold text-amber-800 font-serif italic">
              Sacrament of Reconciliation
            </h4>
            <p className="text-[15px] text-amber-900 leading-normal font-sans">
              Confessions are available every first Friday of the month, or you can inquire at the Parish office to request an advanced schedule with our priest. This is a diocese-wide practice — confirm the exact time with this parish's office.
            </p>
          </div>
        </div>

        {/* Parish info card */}
        <div className="p-4 bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] space-y-2 text-[15px] text-[var(--color-brand-text)]">
          <h4 className="font-bold text-[var(--color-brand-text)] font-serif italic uppercase tracking-wider text-sm flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> Contact & Administration
          </h4>

          {contact ? (
            <div className="space-y-1.5 font-sans text-[var(--color-brand-secondary)] font-medium pl-1.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{contact.address}</span>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="break-all">{contact.email}</span>
                </div>
              )}
              {(!contact.phone || !contact.email) && (
                <p className="text-sm text-[var(--color-brand-secondary)] pt-1">
                  Phone/email not yet available for this parish office.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[15px] text-[var(--color-brand-secondary)] font-medium pl-1.5 font-sans">
              Contact details not yet available for this parish.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
