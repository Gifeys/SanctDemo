import { Link } from "react-router-dom";
import { Download, ArrowRight } from "lucide-react";

/**
 * The page a laptop sees at the root.
 *
 * ## Why a laptop sees something different at all
 *
 * SanctiWalk is used standing in a church, holding a phone. Somebody on
 * a Windows machine is almost never doing that - they are deciding
 * whether to look, or they are a panel member, or they followed a link
 * from Facebook. Serving them the phone interface stretched across
 * 1440px tells them nothing about what this is. So the root answers the
 * question they actually have.
 *
 * A phone never sees this page. See RootGate: a phone at the root is
 * somebody who came to use the thing, and a promotional page in front
 * of that is a toll gate.
 *
 * ## Why the phone in the picture is a real screenshot
 *
 * It is `/get/shots/home.jpg`, the same capture the download page uses,
 * taken from the running app. A drawn mockup would let the picture
 * drift from the product every time the app changed, and the one thing
 * a promotional page must not do is promise a screen that does not
 * exist.
 */
export default function Landing() {
  return (
    <div className="lp">
      <div className="lp__panel">
        <header className="lp__bar">
          <img
            className="lp__logo"
            src="/ui/sanctiwalk-lockup-navy.png"
            alt="SanctiWalk"
            width={190}
          />
          <nav className="lp__nav">
            <a href="#what">What it does</a>
            <a href="#parishes">Parishes</a>
            <a href="/get/">Download</a>
          </nav>
        </header>

        <div className="lp__hero">
          <div className="lp__copy">
            <h1 className="lp__headline">
              Every parish,
              <br />
              explained as you
              <br />
              stand in it.
            </h1>

            <p className="lp__lede">
              A companion for the churches of the Diocese of Kalookan. Mass times
              kept current by the parish office itself, the story of each church
              read aloud, the Rosary in English or Filipino, and a camera that
              names the statue in front of you.
            </p>

            <div className="lp__actions">
              {/* Straight to the download page, which already carries the
                  install steps, the file size and the permissions note. */}
              <a className="lp__cta" href="/get/">
                <Download className="w-4 h-4" aria-hidden />
                Get the Android app
              </a>

              {/* For anyone who wants the running app bigger than the
                  frame beside it. Not "Explore" - there is nothing to
                  explore elsewhere, it is already running. */}
              <Link className="lp__cta lp__cta--quiet" to="/app">
                Open full screen
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>

            <p className="lp__footnote">
              The app beside this is live. Tap it. The Android build adds the
              AR heritage tour.
            </p>
          </div>

          <div className="lp__shot">
            {/* The actual application, running, not a picture of it.

                An iframe rather than <App /> rendered inline, for two
                reasons. The app positions things against the viewport -
                the tab bar, the Ask Sancti button, every bottom sheet -
                and inline those would escape into this page and sit at
                the bottom of the browser window. And an iframe at phone
                width makes the app believe it is on a phone, which is
                already how it decides to drop its own desktop mockup
                chrome: see isDeviceSurface in lib/displayMode.ts, which
                is true at 768px and under. So the frame below is the
                only frame, and no new code path was added to the app to
                get that.

                Same origin, so this is the same application with the
                same Firebase session - not a copy. It is the pattern
                the Rosary already uses in DailyRosary.tsx. */}
            <div className="lp__phone">
              <iframe
                className="lp__phone-screen"
                src="/app"
                title="SanctiWalk, running"
                loading="eager"
                // The app asks for these itself when someone taps Scan
                // or opens the map; without them the iframe would deny
                // them before the app ever saw the request.
                allow="camera; geolocation; microphone"
              />
            </div>
            <p className="lp__shot-note">Live — try it</p>
          </div>
        </div>
      </div>

      <section className="lp__band" id="what">
        <div className="lp__bandinner">
          <h2 className="lp__bandtitle">What you get</h2>

          <dl className="lp__grid">
            <div>
              <dt>Mass times that are actually right</dt>
              <dd>
                The parish office edits them directly. When they move a Mass it
                moves on your phone, with no update to install.
              </dd>
            </div>
            <div>
              <dt>A guide to what you are looking at</dt>
              <dd>
                Point the camera at a statue, an altar or an image. It names it
                and tells you who they were, drawn from the parish's own records
                where they exist.
              </dd>
            </div>
            <div>
              <dt>History you can listen to</dt>
              <dd>
                Each church's story, read aloud in English or Filipino, so you
                can walk and look rather than read with your head down.
              </dd>
            </div>
            <div>
              <dt>The Rosary, guided</dt>
              <dd>
                All four sets of mysteries in both languages, with an optional
                voice. Works with no signal at all.
              </dd>
            </div>
            <div>
              <dt>Directions that follow the road</dt>
              <dd>
                Real street routing to any parish in the diocese, not a straight
                line drawn across the map.
              </dd>
            </div>
            <div>
              <dt>Ministries and sacraments</dt>
              <dd>
                Requirements, schedules and the application itself, handled in
                the app and answered by the parish.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="lp__closing" id="parishes">
        <h2>Two parishes, in full</h2>
        <p>
          Mary Help of Christians Parish in Maypajo and San Roque Cathedral
          Parish are implemented completely, with every station, history and
          sacramental requirement confirmed with the parish itself. The rest of
          the diocese appears on the map and in the directory.
        </p>
        <p className="lp__closingnote">
          Accuracy is the limit here, not the code. A guide that misnames an
          image or invents the meaning of an altar damages the heritage it
          exists to serve.
        </p>
        <Link className="lp__cta" to="/app">
          Explore SanctiWalk
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </section>

      <footer className="lp__foot">
        <p>
          A capstone project for STI College, built in consultation with the
          parishes named above.
        </p>
        <p>
          <a href="https://github.com/Gifeys/SanctDemo">Source code</a>
          <span aria-hidden> · </span>
          <a href="/get/">Download for Android</a>
        </p>
      </footer>
    </div>
  );
}
