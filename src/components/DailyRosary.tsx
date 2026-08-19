import React from "react";

// The client's own hand-built rosary app is mounted here as-is, via iframe,
// rather than ported to React. See public/rosary/index.html (plus the
// public/rosary/20 Mysteries/ image set) for the source. It is intentionally
// left unstyled to match the rest of this app; it keeps its own look.
//
// Layout note: this component renders inside PhoneContainer's scrollable
// "children" slot (a flex flex-col container with overflow-y-auto and a
// fixed pixel height set by the phone/desktop frame). Using 100vh here would
// overflow that frame on desktop, so instead we stretch to fill the parent
// via flex-1 + h-full, letting the iframe's own height:100% fill that.
export default function DailyRosary() {
  return (
    <div className="flex-1 flex flex-col h-full min-h-[600px] w-full">
      <iframe
        src="/rosary/index.html"
        title="Holy Rosary"
        style={{ border: 0 }}
        className="flex-1 w-full h-full"
      />
    </div>
  );
}
