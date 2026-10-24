/**
 * The Terms and Conditions and the Privacy Notice, as shown on first
 * launch.
 *
 * ## What is asserted here, and on what basis
 *
 * The Privacy Notice describes what this application actually does. It
 * was written against the code, not from a template:
 *
 *   - the fields in ApplicationDoc (lib/applications.ts)
 *   - the users, applications, visits, activity, notifications and
 *     pageEvents collections, and who may read them (firestore.rules)
 *   - the scanner endpoint in server.ts, which forwards the photograph
 *     to the model inline and writes it nowhere
 *   - lib/pageEvents.ts, whose token is random and per-browser
 *
 * ## What is deliberately NOT asserted
 *
 * Nothing here claims a retention period, a deletion schedule or a
 * security control that the project has not implemented. Where the
 * honest answer is "the parish has not decided this yet", the text
 * says so. Items marked NEEDS CONFIRMATION are for the parish office
 * and the project adviser to settle before this is relied upon.
 */

export interface Doc {
  title: string
  /** Shown on the first-launch card. Short on purpose. */
  summary: string[]
  /** The full text, behind "Read in full". */
  sections: { heading: string; body: string[] }[]
}

export const LAST_UPDATED = '24 October 2026'

export const TERMS: Doc = {
  title: 'Terms and Conditions',
  summary: [
    'SanctiWalk is a companion app for Mary Help of Christians Parish and San Roque Cathedral Parish. It helps you find Mass times, read about the church, pray, and apply for ministries and sacraments.',
    'Schedules and parish information can change. Please confirm anything important with the parish office before you rely on it.',
    'Submitting an application here is a request, not a booking. The parish office reviews it and may ask you to come in person.',
  ],
  sections: [
    {
      heading: '1. What SanctiWalk is',
      body: [
        'SanctiWalk is a student capstone project developed for Mary Help of Christians Parish and San Roque Cathedral Parish in the Diocese of Kalookan. It provides parish information, Mass schedules, church history, a guided Rosary, a camera scanner, a parish assistant and an augmented reality heritage tour.',
        'The application is a companion to the parish, not a replacement for it. It does not speak on behalf of the Diocese of Kalookan.',
      ],
    },
    {
      heading: '2. Using the app properly',
      body: [
        'Please use SanctiWalk respectfully, particularly inside a church. Use the camera and the augmented reality tour in a way that does not disturb people who are praying, and follow any instruction given by parish personnel.',
        'Do not use the application to harass anyone, to submit false information in an application, or to attempt to gain access to parish records that are not yours.',
      ],
    },
    {
      heading: '3. Parish information and Mass schedules',
      body: [
        'Mass times, announcements and parish details are entered by the parish office and can change at short notice. The app shows what the parish has entered at the time you look at it.',
        'Where a schedule has not been confirmed by the parish, the app labels it as such. Please verify anything you are relying on, especially if you are travelling to attend.',
        'A Mass that the parish has suspended is shown struck through rather than removed, so that you can see it exists and is not being celebrated.',
      ],
    },
    {
      heading: '4. Applications for ministries and sacraments',
      body: [
        'An application submitted through SanctiWalk is a request for the parish office to consider. It is not a confirmed booking, a reservation, or an approval.',
        'The parish office reviews each application and may approve it, decline it, or ask for more information. The parish may require you to appear in person and to present documents before anything is finalised. Requirements for sacraments are set by the parish and by the Church, not by this application.',
        'You will see the status of your own applications in the app. The reference number shown is what the parish office uses to find your record.',
        'NEEDS CONFIRMATION: how long the parish takes to respond, and which sacraments require which documents, are matters for the parish office to state.',
      ],
    },
    {
      heading: '5. The camera scanner and the parish assistant',
      body: [
        'The scanner sends a photograph to an artificial intelligence service to identify what you are looking at. The parish assistant answers questions using information the parish office has entered.',
        'Both can be wrong. Treat what they say as a helpful guess rather than an authority, and confirm anything that matters with the parish. The assistant is designed to say that it does not know rather than to invent an answer, but it is not infallible.',
        'There is a daily limit on how many images one account may scan, so that the service remains available to everyone.',
      ],
    },
    {
      heading: '6. The augmented reality tour',
      body: [
        'The augmented reality tour is a separate application that SanctiWalk opens. It requires a compatible Android device and the printed marker that the parish has placed in the church.',
        'Please watch where you are walking. Hold the phone so that you can still see the floor and the people around you, and do not use the tour during Mass or any other celebration.',
      ],
    },
    {
      heading: '7. Availability and limitations',
      body: [
        'SanctiWalk is provided as it is. It is a student project and may contain errors, may be unavailable at times, and may change without notice.',
        'Several features need an internet connection: the scanner, the parish assistant, the map and the augmented reality positioning. Mass times, church history and the Rosary continue to work without a signal.',
        'The proponents are not able to guarantee that the information in the app is complete or current at any given moment, which is why the app points you to the parish office for anything important.',
      ],
    },
    {
      heading: '8. Changes to these terms',
      body: [
        'If these terms change in a way that matters, the app will ask you to read and accept them again the next time you open it.',
      ],
    },
    {
      heading: '9. Contact',
      body: [
        'NEEDS CONFIRMATION: the parish office contact details and the name of the person responsible for SanctiWalk have not been supplied and must be added before this is published.',
      ],
    },
  ],
}

export const PRIVACY: Doc = {
  title: 'Privacy Notice',
  summary: [
    'You can use most of SanctiWalk without an account. You only need to sign in to apply for a ministry or a sacrament.',
    'When you apply, the parish office sees your name, your email address and your answers on the form. Only your own parish can see them.',
    'Photographs you scan are sent for recognition and are not saved by this app.',
  ],
  sections: [
    {
      heading: '1. Who is responsible',
      body: [
        'SanctiWalk is a student capstone project developed for Mary Help of Christians Parish and San Roque Cathedral Parish, Diocese of Kalookan.',
        'NEEDS CONFIRMATION: under the Data Privacy Act of 2012 (Republic Act No. 10173) a personal information controller must be identified, with contact details and a Data Protection Officer where one is required. The parish and the project adviser must decide who is named here before the app is distributed publicly.',
      ],
    },
    {
      heading: '2. What the app collects, and when',
      body: [
        'Without an account: the app records that it was opened, and whether the installer was downloaded, using a random code generated on your device. That code is not linked to you, your account, your phone number or your device identity, and it is cleared when you clear the app’s data.',
        'When you create an account or sign in with Google: your email address, and the name and profile photograph your Google account provides. Passwords are handled by Google Firebase Authentication and are never seen by this application.',
        'When you apply for a ministry or a sacrament: your name, your email address, which parish you belong to, which ministry or sacrament you applied for, your answers to that form, the date, and a reference number.',
        'When you are at a church with the app open and signed in: a record that your account was at that parish at that time. Your coordinates are not stored — only which parish, and when.',
        'When you use the scanner: the photograph is sent to the recognition service and a count is kept of how many scans your account has used that day, so the daily limit can be applied.',
        'On your device only: your chosen language, your home parish, which reminders you have switched on, and which notices you have dismissed. These stay on the phone and are not sent anywhere.',
      ],
    },
    {
      heading: '3. Why it is collected',
      body: [
        'Account details exist so that the parish office knows who submitted an application and can reply to the right person.',
        'Application details exist so that the parish can consider your request. The parish cannot process an application without them.',
        'Visit records and the anonymous open and download counts exist so that the parish can see how much the app is being used. They are counts; nobody is named in them.',
        'The scan count exists only to enforce the daily limit.',
      ],
    },
    {
      heading: '4. Photographs you scan',
      body: [
        'A photograph taken with the scanner is sent to the server and passed directly to the artificial intelligence service that identifies it. It is not written to a file, not saved in the database, and not stored by SanctiWalk in any form.',
        'NEEDS CONFIRMATION: what the artificial intelligence provider does with an image it receives is governed by that provider’s own terms, not by this application. The adviser should confirm which provider terms apply before publication.',
      ],
    },
    {
      heading: '5. Who can see your information',
      body: [
        'You can see your own profile and your own applications.',
        'Administrators of your own parish can see applications submitted to that parish, and the counts described above. The database rules prevent one parish from reading another parish’s applications.',
        'The parish office cannot see who opened the app or who downloaded it. Those are counts only, and the app does not record a name against them.',
        'Information is held in Google Firebase (Authentication, Cloud Firestore and Cloud Storage) and the application is served from a commercial hosting provider. These providers process data on the project’s behalf.',
      ],
    },
    {
      heading: '6. How it is protected',
      body: [
        'Access is controlled by database security rules that check who you are and which parish you belong to before any record is read or written. An unauthenticated visitor can write only the anonymous counts described above, and can read none of them.',
        'Traffic between the app and its services uses HTTPS. Google Firebase encrypts data in transit and at rest as part of its platform.',
        'NEEDS CONFIRMATION: beyond the above, the project has not implemented additional measures such as independent encryption of stored fields, formal access logging for administrators, or a tested breach-response procedure. These should be assessed by the adviser before the app is used with real parishioner data at scale.',
      ],
    },
    {
      heading: '7. How long it is kept',
      body: [
        'NEEDS CONFIRMATION: the application does not currently delete anything automatically. Applications, visit records and counts remain until someone removes them. A retention period must be set by the parish — for example, how long a completed application is kept — and this notice updated to state it.',
      ],
    },
    {
      heading: '8. Your rights',
      body: [
        'Under the Data Privacy Act of 2012 you have the right to be informed, to object, to access your personal data, to correct it, to have it erased or blocked in the circumstances the law allows, to damages, and to lodge a complaint with the National Privacy Commission.',
        'To exercise any of these, contact the parish office. The app does not currently provide a self-service way to download or delete your data; a request has to be made to the parish.',
        'NEEDS CONFIRMATION: the address, email or telephone number through which a request is to be made must be supplied by the parish.',
      ],
    },
    {
      heading: '9. Children',
      body: [
        'Applications for sacraments may concern children. Where a parent or guardian submits an application on a child’s behalf, the information given is handled in the same way as any other application.',
        'NEEDS CONFIRMATION: the Data Privacy Act gives particular weight to the personal information of minors. Whether a separate parental consent step is required for sacramental applications involving children should be confirmed with the parish and the adviser.',
      ],
    },
    {
      heading: '10. Changes to this notice',
      body: [
        'If this notice changes in a way that matters, the app will ask you to read it again the next time you open it.',
      ],
    },
  ],
}
