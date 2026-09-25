import { ArrowLeft, Plus, Sparkles, Trash2, X } from "lucide-react";
import {
  MAX_TRIP_STOPS,
  formatTripDuration,
  stopLabel,
  type TripRoute,
  type TripStop,
} from "../lib/pilgrimage";
import { formatDistance } from "../lib/routing";

interface TripPlannerProps {
  stops: TripStop[];
  /** The measured trip, or null before the first measurement returns. */
  trip: TripRoute | null;
  measuring: boolean;
  /** False when the order could still be shortened, which is what enables Nearest first. */
  optimal: boolean;
  /** No GPS fix: the plan still works, but nothing can be ordered or measured from here. */
  hasPosition: boolean;
  onAddStop: () => void;
  onRemoveStop: (id: string) => void;
  onOptimise: () => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Planning a Bisita Iglesia — a visit to several churches in one journey.
 *
 * The tradition is seven churches on Maundy Thursday, and the hard part has
 * never been finding them; it is deciding the order. A group standing in
 * Maypajo with a list of seven parishes cannot tell which to walk to first,
 * and getting it wrong is the difference between a six-kilometre evening and
 * an eleven-kilometre one.
 *
 * So the planner does the one thing a map can do that a list cannot: it
 * works out the order. "Nearest first" is offered rather than applied, and
 * only when it would actually shorten the walk — a parish may want to reach
 * a particular church at a particular hour, and a planner that silently
 * reshuffled their evening would be answering a question nobody asked.
 *
 * The layout is a maps app's: the stops in order down the left with their
 * letters, each removable, an Add stop row at the bottom, and the total
 * across the footer.
 */
export default function TripPlanner({
  stops,
  trip,
  measuring,
  optimal,
  hasPosition,
  onAddStop,
  onRemoveStop,
  onOptimise,
  onClear,
  onClose,
}: TripPlannerProps) {
  const full = stops.length >= MAX_TRIP_STOPS;

  return (
    <div className="trip" role="dialog" aria-label="Plan a church visit">
      <div className="trip__head">
        <button type="button" className="trip__icon" onClick={onClose} aria-label="Back to the map">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="trip__heading">
          <p className="trip__title">Bisita Iglesia</p>
          <p className="trip__sub">
            {stops.length === 0
              ? "Add the churches you want to visit"
              : `${stops.length} church${stops.length === 1 ? "" : "es"}`}
          </p>
        </div>
        {stops.length > 0 && (
          <button type="button" className="trip__icon" onClick={onClear} aria-label="Clear this visit">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      <ol className="trip__stops">
        {/* Where the pilgrim is, as the first row. It is not a stop and
            cannot be removed, but leaving it out made the list read as if
            the walk began at the first church rather than at their feet. */}
        <li className="trip__stop trip__stop--start">
          <span className="trip__pip" aria-hidden />
          <span className="trip__name">{hasPosition ? "Your location" : "Location off"}</span>
        </li>

        {stops.map((stop, index) => (
          <li key={stop.id} className="trip__stop">
            <span className="trip__letter" aria-hidden>
              {stopLabel(index)}
            </span>
            <span className="trip__name">{stop.name}</span>
            <button
              type="button"
              className="trip__remove"
              onClick={() => onRemoveStop(stop.id)}
              aria-label={`Remove ${stop.name} from this visit`}
            >
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}

        <li className="trip__stop trip__stop--add">
          <span className="trip__letter trip__letter--ghost" aria-hidden>
            <Plus className="w-4 h-4" />
          </span>
          <button type="button" className="trip__add" onClick={onAddStop} disabled={full}>
            {full ? `That is ${MAX_TRIP_STOPS} churches — enough for one day` : "Add a church"}
          </button>
        </li>
      </ol>

      {/* Offered only when it would change something. A button that promises
          a shorter route and then reorders nothing is worse than no button. */}
      {!optimal && hasPosition && (
        <button type="button" className="trip__optimise" onClick={onOptimise}>
          <Sparkles className="w-4 h-4" />
          Put them in the nearest order
        </button>
      )}

      <div className="trip__foot">
        <div className="trip__total">
          {measuring ? (
            <span className="trip__measuring">Measuring the walk…</span>
          ) : /* A measured trip of zero metres is not a walk, it is the
                 absence of one: one church with no known starting point has
                 nothing between it and anywhere. Printing "Total trip: 0 min"
                 for that reads as an answer when it is the lack of one. */
          trip && trip.distanceMeters > 0 ? (
            <>
              <span className="trip__time">Total trip: {formatTripDuration(trip.durationMinutes)}</span>
              <span className="trip__distance">
                {formatDistance(trip.distanceMeters)}
                {/* Said plainly rather than quietly rolled into the total.
                    A leg the router could not solve is a straight line
                    across the map, which is always shorter than the street
                    it stands in for. */}
                {trip.hasDirectLeg && " · some legs straight-line only"}
              </span>
            </>
          ) : (
            <span className="trip__measuring">
              {hasPosition
                ? "Add churches to see the walk"
                : "Turn on location to measure the walk"}
            </span>
          )}
        </div>
        <button type="button" className="trip__done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
