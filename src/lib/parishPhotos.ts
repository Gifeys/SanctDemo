/**
 * Photographs of parishes, and the one rule about them.
 *
 * A parish's photograph is a CLAIM about that place. Before this module the
 * app made that claim falsely in four separate files: the same Unsplash
 * photograph of an unrelated church stood in for San Roque Cathedral on the
 * Mass schedule, in the history screen — captioned "San Roque Cathedral
 * Caloocan" — and on the church-selector cards, while four of the five tour
 * stations carried stock photographs of other churches' altars and fonts.
 *
 * Anyone looking at those screens would reasonably believe they were seeing
 * San Roque. They were not. This is the same principle as `scheduleVerified`
 * in data.ts and the "sample, unconfirmed" Mass times: show the placeholder,
 * never the plausible-looking wrong thing.
 *
 * Centralised so a stock URL cannot be pasted back in one screen at a time.
 * To add a real photograph, put it in PARISH_FACADE_PHOTOS below — and only
 * if it is genuinely a photograph OF THAT PARISH.
 */

/** Shown wherever a real photograph does not exist. Says so on its face. */
export const PLACEHOLDER_PHOTO = '/parish/placeholder-photo.svg'

/**
 * Real, verified photographs, keyed by tour route id.
 *
 * Only Mary Help of Christians has one: the Diocese of Kalookan's own image
 * of the parish. Every other parish resolves to the placeholder until
 * somebody supplies a photograph of the actual building.
 */
export const PARISH_FACADE_PHOTOS: Record<string, string> = {
  'route-mhcp':
    'https://dioceseofkalookan.ph/wp-content/uploads/2020/12/maryhelpPic1-1-1024x680.jpg',
}

/** The facade photograph for a parish, or the placeholder. Never a stand-in. */
export function parishPhoto(routeId: string | null | undefined): string {
  return (routeId && PARISH_FACADE_PHOTOS[routeId]) || PLACEHOLDER_PHOTO
}

/** True when this is a real photograph rather than the placeholder. */
export function hasRealPhoto(routeId: string | null | undefined): boolean {
  return Boolean(routeId && PARISH_FACADE_PHOTOS[routeId])
}

/**
 * Alt text that does not lie.
 *
 * The placeholder is decorative — it depicts no particular church — so it
 * takes an empty alt rather than a parish name. Captioning a drawing "San
 * Roque Cathedral Caloocan" is exactly the bug this module exists to stop,
 * and a screen reader would repeat it as fact.
 */
export function parishPhotoAlt(routeId: string | null | undefined, parishName: string): string {
  return hasRealPhoto(routeId) ? parishName : ''
}
