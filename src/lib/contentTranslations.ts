import type { Bilingual } from "./language";

/**
 * The second language for content that only ever had one.
 *
 * ## Why these live here and not in data.ts
 *
 * data.ts is what the parish supplied. These are translations OF that,
 * and the distinction matters: when the parish rewrites a ministry
 * description, the new text goes in data.ts and the stale translation
 * here is visibly next to it rather than buried in the same object.
 *
 * ## What a translation is and is not
 *
 * Every entry below carries the same claims as its source, in the other
 * language. Nothing is added, softened or explained - a description
 * that does not mention a requirement does not acquire one in
 * translation. Where a term is the Church's own and is used in Filipino
 * parishes in English ("Holy Communion", "liturgy"), it stays, because
 * translating it would be less faithful rather than more.
 *
 * The ministry names themselves are not translated at all. "Ministry of
 * Altar Servers (MAS)" is what the parish calls it on its own noticeboard
 * in either language.
 */

/** English for the fifteen ministry descriptions, which were Tagalog only. */
export const MINISTRY_DESCRIPTION_EN: Record<string, string> = {
  "min-altar-servers":
    "The Ministry of Altar Servers (MAS) answers the honourable duty of serving at the altar of the Lord. It is made up of young people of open heart and steady faith who serve willingly in the orderly and reverent celebration of the Sacred Liturgy and the other sacramental works of the Church. As servants of the altar, the ministry forms their discipline, holiness and proper bearing, so that they become living witnesses of order, respect and reverence within the church.",

  "min-emhc":
    "The Extraordinary Ministers of Holy Communion (EMHC) support the priest, especially at Masses with large congregations and when Communion must be brought to the sick, the elderly, or those confined at home. EMHCs are chosen carefully on the basis of faith, moral character and active sharing in the life of the Church, and their ministry is rooted in humility and service. As representatives of the community, they help ensure that the faithful receive the Body and Blood of Christ with dignity and devotion, and they extend the pastoral care of the Church to those who cannot attend Mass.",

  "min-lectors":
    "The Ministry of Lectors and Commentators (MLC) is devoted to the clear, dignified and meaningful proclamation of the Word of God and of the invitations within the sacred celebration. Through the careful reading of Holy Scripture and disciplined guidance of the assembly as commentators, this ministry helps the community take full part in the liturgy. In their preparation, discipline and respect for the holiness of the work, they become a channel of order, understanding, and deeper listening to the voice of God.",

  "min-greeters":
    "The Ministry of Greeters and Collectors (MGC) serves as the first face of the Christian community through a courteous welcome, orderly guidance, and a caring presence towards every one of the faithful. Alongside this they are entrusted with the honest, disciplined and accountable gathering of the offerings, which serve as a concrete expression of the community's sacrifice for the continuing mission of the Church. In their humility, integrity and respect for the holiness of the work, this ministry strengthens order, unity and the spirit of service within the worshipping community.",

  "min-soccom":
    "The Social Communications Ministry (SOCCOM) spreads the message of the Gospel through the accurate, responsible and modern use of media and communications. In documenting, reporting and making known the works of the Church, they serve as the voice and the image of the community's living faith. They uphold truth and dignity in every message they carry.",

  "min-apostolado":
    "The Apostolado ng Panalangin (AnP) seeks to deepen the believer's relationship with God through earnest, shared and unceasing prayer. In offering self, work and suffering to the Lord, this ministry becomes a spiritual pillar of the Church that supports its mission through prayer.",

  "min-mother-butlers":
    "The Mother Butlers Guild (MBG) is a ministry devoted to the careful and attentive keeping of the sacred vessels and to the good order of the altar and the church. In their quiet but essential service, they express respect for the holiness of the liturgy and the spirit of a mother who serves with love.",

  "min-youth":
    "The Ministry on Youth Affairs serves as guide and companion to young people in their formation as responsible Christians and active members of the Church and of society. Through formation, participation and service, this ministry prepares the young as leaders of the Church of today and of the future.",

  "min-catechetical":
    "The Catechetical Ministry carries the responsibility of proclaiming and teaching the foundations of the Catholic faith in a clear, faithful and systematic way. In their teaching and guidance, they deepen the community's understanding of doctrine and form a Christian life rooted in the Gospel.",
};

/**
 * The six choirs share one description, word for word, in data.ts.
 *
 * Kept as a single string rather than copied six times: a change to the
 * Tagalog would otherwise need six matching edits here, and the first
 * one missed would leave two choirs describing themselves differently
 * in English while describing themselves identically in Tagalog.
 */
const CHOIR_EN =
  "Oversees the fitting use of music in the liturgy, to support prayer and deepen the participation of the faithful. It is responsible for choosing and preparing the hymns and liturgical songs for Holy Mass and the other celebrations of the Church. Through reverent and well-ordered music, it serves for the greater glory of God.";

for (const id of [
  "min-choir-cfc",
  "min-choir-teatro",
  "min-choir-singing-servants",
  "min-choir-charismatic",
  "min-choir-marian-youth",
  "min-choir-apostleship",
]) {
  MINISTRY_DESCRIPTION_EN[id] = CHOIR_EN;
}

/** Tagalog for the five sacrament descriptions, which were English only. */
export const SACRAMENT_DESCRIPTION_FIL: Record<string, string> = {
  "sac-baptism":
    "Ang pintuan ng buhay sa Espiritu, na naghuhugas ng orihinal na kasalanan at tumatanggap sa kaluluwa sa Katawan ni Kristo.",
  "sac-confirmation":
    "Ipinagkakaloob nito ang natatanging lakas ng Espiritu Santo upang aktibong magpatotoo sa pananampalatayang Kristiyano.",
  "sac-matrimony":
    "Isang tipan kung saan ang lalaki at babae ay nagtatatag ng panghabambuhay na pagsasama na nakatuon sa kabutihan ng mag-asawa.",
  "sac-eucharist":
    "Ang unang pagtanggap kay Kristo sa Banal na Komunyon — ang kanyang tunay na Katawan at Dugo — na nagbubuklod sa mga bata sa buhay ng Simbahan.",
  // The id is sac-confession, not sac-reconciliation. A test that
  // checks every sacrament has a translation caught the wrong guess;
  // without it this one would simply have stayed English for Tagalog
  // readers and nobody would have been told.
  "sac-confession":
    "Ang maawaing sakramento ng pagpapagaling, kung saan pinatatawad ang mga kasalanan at naibabalik ang kaluluwa sa biyaya.",
};

/**
 * Tagalog for the five station descriptions and reflections.
 *
 * These are the words the AR tour and the scanner read out and show on
 * the result card. They were English only, so a pilgrim reading the
 * app in Tagalog scanned a statue and got an English answer - which is
 * exactly the complaint that started this.
 *
 * The reflections are prayers addressed to the reader, so they are
 * translated as prayers rather than as sentences: the questions stay
 * questions, and the second person stays second person.
 */
export const STATION_FIL: Record<string, { description: string; reflection: string }> = {
  "mhcp-altar": {
    description:
      "Ang gitnang santuwaryo ng Mary Help of Christians Parish, itinayo para sa malalim na pagsamba at sa pagdiriwang ng Eukaristiya.",
    reflection:
      "Patahimikin ang iyong puso habang nakatayo sa harap ng Dambana. Sa katahimikan, pakinggan ang bulong ng Diyos. Ano ang pinakapinasasalamatan mo ngayong araw?",
  },
  "mhcp-patron": {
    description:
      "Ang marangyang koronadong imahen ng Mary Help of Christians na karga ang Batang Hesus nang nakabukas ang mga bisig.",
    reflection:
      "Karga ni Maria si Hesus at iniaalay siya sa atin bilang ating pinakamataas na saklolo. Saan sa iyong buhay kailangan mo ng katulong ngayon? Hindi binabalewala ang taimtim na panalangin.",
  },
  "mhcp-bapt": {
    description:
      "Ang banal na batisan kung saan ang mga sanggol at nakatatanda ay pumapasok sa pamilya ng Diyos, binyagan sa tubig at sa Espiritu.",
    reflection:
      "Ang tubig ay nagdadala ng buhay at naglilinis. Tandaan na may banal na layunin ang iyong buhay. Paano ka makapagdadala ng malinis na simula at pag-asa sa isang nanlulumo ngayong araw?",
  },
  "src-sanctuary": {
    description:
      "Ang taimtim na dambana at luklukan ng Obispo ng Kalookan, kung saan ginaganap ang mga malalaking kapistahan at makasaysayang pagtitipon.",
    reflection:
      "Pagnilayan ang tatag ng katedral na ito, nakatindig sa gitna ng mga digmaan at sakuna. Gaano katatag ang iyong espiritu sa panahon ng pagsubok?",
  },
  "src-statue": {
    description:
      "Ang lubos na iginagalang na imahen ni San Roque, larawan ng kanyang buhay ng sakripisyo at pagpapagaling.",
    reflection:
      "Isinapanganib ni San Roque ang kanyang buhay upang alagaan ang iba. Sino sa iyong maysakit na kapitbahay, kaibigan, o kapamilya ang maipagdarasal o madadalaw mo ngayong araw?",
  },
};

/**
 * Everything the app already holds in both languages, by id.
 *
 * `bilingualFor` is what call sites use; it returns the source text
 * paired with its translation, or the source twice when no translation
 * exists yet. Twice, rather than empty: a missing translation shows the
 * original, which is readable and visibly wrong, instead of a blank
 * paragraph nobody can report.
 */
export function bilingualFor(
  source: string,
  translation: string | undefined,
  sourceLanguage: "en" | "fil",
): Bilingual {
  if (sourceLanguage === "fil") {
    return { fil: source, en: translation ?? source };
  }
  return { en: source, fil: translation ?? source };
}

/**
 * One station, in the reader's language.
 *
 * Every screen that shows a station goes through this: the scanner's
 * result card, the AR tour's stop, the narration that reads it aloud.
 * Three call sites each doing their own fallback is three chances for
 * one of them to stay English after the setting is changed.
 */
export function stationText(
  station: { id: string; description: string; reflection: string },
  language: "en" | "fil",
): { description: string; reflection: string } {
  if (language === "en") {
    return { description: station.description, reflection: station.reflection };
  }
  const fil = STATION_FIL[station.id];
  // No translation yet means the English, which is readable and
  // visibly wrong, rather than a blank card nobody can report.
  return {
    description: fil?.description || station.description,
    reflection: fil?.reflection || station.reflection,
  };
}
