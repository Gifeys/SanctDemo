import React, { useState } from "react";
import { ROSARY_MYSTERIES, RosaryMystery } from "../data";
import { Heart, ChevronRight, BookOpen, Sparkles, Star, ShieldAlert } from "lucide-react";

export default function DailyRosary() {
  const [selectedCategory, setSelectedCategory] = useState<string>("joyful");
  const [currentBeadIndex, setCurrentBeadIndex] = useState<number>(0);
  const [isMeditating, setIsMeditating] = useState<boolean>(false);

  const activeMystery = ROSARY_MYSTERIES.find((m) => m.id === selectedCategory) || ROSARY_MYSTERIES[0];

  // Define bead structure for prayer progression
  // 1: Apostles Creed, 2: Our Father, 3,4,5: Hail Mary, 6: Glory Be
  // Then Decades: Our Father -> 10 Hail Marys -> Glory Be -> Fatima Prayer (repeated 5 times)
  const rosarySteps = [
    { type: "intro", title: "Opening Prayers", text: "Sign of the Cross: In the name of the Father, and of the Son, and of the Holy Spirit. Amen.", prayerName: "Sign of the Cross" },
    { type: "creed", title: "The Apostles' Creed", text: "I believe in God, the Father Almighty, Creator of heaven and earth, and in Jesus Christ, His only Son, our Lord...", prayerName: "Apostles' Creed" },
    { type: "our-father", title: "Our Father (For the Pope's Intentions)", text: "Our Father, who art in heaven, hallowed be Thy name; Thy kingdom come; Thy will be done on earth as it is in heaven...", prayerName: "Our Father" },
    { type: "hail-mary", title: "Hail Mary (For the increase of Faith)", text: "Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus...", prayerName: "Hail Mary" },
    { type: "hail-mary", title: "Hail Mary (For the increase of Hope)", text: "Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus...", prayerName: "Hail Mary" },
    { type: "hail-mary", title: "Hail Mary (For the increase of Charity)", text: "Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus...", prayerName: "Hail Mary" },
    { type: "glory-be", title: "Glory Be", text: "Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.", prayerName: "Glory Be" },
    
    // Decade 1
    { type: "mystery-1", title: `First Mystery: ${activeMystery.prayers[0]}`, text: "Reflect on this mystery, then pray the Our Father.", prayerName: "Contemplation" },
    { type: "our-father", title: "Decade 1: Our Father", text: "Our Father, who art in heaven...", prayerName: "Our Father" },
    { type: "decade-hm", title: "Hail Mary (x10)", text: "Hail Mary, full of grace... (Bead 1 to 10)", prayerName: "Hail Mary" },
    { type: "glory-be", title: "Glory Be & Fatima Prayer", text: "Glory be to the Father... O my Jesus, forgive us our sins, save us from the fires of hell, lead all souls to Heaven, especially those most in need of Thy mercy.", prayerName: "Glory Be / Fatima Prayer" },

    // Decade 2
    { type: "mystery-2", title: `Second Mystery: ${activeMystery.prayers[1]}`, text: "Reflect on this mystery, then pray the Our Father.", prayerName: "Contemplation" },
    { type: "our-father", title: "Decade 2: Our Father", text: "Our Father, who art in heaven...", prayerName: "Our Father" },
    { type: "decade-hm", title: "Hail Mary (x10)", text: "Hail Mary, full of grace... (Bead 1 to 10)", prayerName: "Hail Mary" },
    { type: "glory-be", title: "Glory Be & Fatima Prayer", text: "Glory be to the Father... O my Jesus, forgive us...", prayerName: "Glory Be / Fatima Prayer" },

    // Decade 3
    { type: "mystery-3", title: `Third Mystery: ${activeMystery.prayers[2]}`, text: "Reflect on this mystery, then pray the Our Father.", prayerName: "Contemplation" },
    { type: "our-father", title: "Decade 3: Our Father", text: "Our Father, who art in heaven...", prayerName: "Our Father" },
    { type: "decade-hm", title: "Hail Mary (x10)", text: "Hail Mary, full of grace... (Bead 1 to 10)", prayerName: "Hail Mary" },
    { type: "glory-be", title: "Glory Be & Fatima Prayer", text: "Glory be to the Father... O my Jesus, forgive us...", prayerName: "Glory Be / Fatima Prayer" },

    // Decade 4
    { type: "mystery-4", title: `Fourth Mystery: ${activeMystery.prayers[3]}`, text: "Reflect on this mystery, then pray the Our Father.", prayerName: "Contemplation" },
    { type: "our-father", title: "Decade 4: Our Father", text: "Our Father, who art in heaven...", prayerName: "Our Father" },
    { type: "decade-hm", title: "Hail Mary (x10)", text: "Hail Mary, full of grace... (Bead 1 to 10)", prayerName: "Hail Mary" },
    { type: "glory-be", title: "Glory Be & Fatima Prayer", text: "Glory be to the Father... O my Jesus, forgive us...", prayerName: "Glory Be / Fatima Prayer" },

    // Decade 5
    { type: "mystery-5", title: `Fifth Mystery: ${activeMystery.prayers[4]}`, text: "Reflect on this mystery, then pray the Our Father.", prayerName: "Contemplation" },
    { type: "our-father", title: "Decade 5: Our Father", text: "Our Father, who art in heaven...", prayerName: "Our Father" },
    { type: "decade-hm", title: "Hail Mary (x10)", text: "Hail Mary, full of grace... (Bead 1 to 10)", prayerName: "Hail Mary" },
    { type: "glory-be", title: "Glory Be & Fatima Prayer", text: "Glory be to the Father... O my Jesus, forgive us...", prayerName: "Glory Be / Fatima Prayer" },

    // Closing
    { type: "salve-regina", title: "Hail Holy Queen (Salve Regina)", text: "Hail, Holy Queen, Mother of Mercy, our life, our sweetness, and our hope. To thee do we cry, poor banished children of Eve...", prayerName: "Hail Holy Queen" },
    { type: "closing-prayer", title: "Final Prayer", text: "O God, whose only begotten Son, by His life, death, and resurrection, has purchased for us the rewards of eternal salvation... Amen. (In the name of the Father, and of the Son, and of the Holy Spirit. Amen)", prayerName: "Sign of the Cross / Dismissal" }
  ];

  const currentStep = rosarySteps[currentBeadIndex];

  const handleNextBead = () => {
    if (currentBeadIndex < rosarySteps.length - 1) {
      setCurrentBeadIndex(currentBeadIndex + 1);
    } else {
      setIsMeditating(false);
      setCurrentBeadIndex(0);
    }
  };

  const handlePrevBead = () => {
    if (currentBeadIndex > 0) {
      setCurrentBeadIndex(currentBeadIndex - 1);
    }
  };

  const handleStartRosary = () => {
    setCurrentBeadIndex(0);
    setIsMeditating(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <Heart className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[#C2A649] font-bold text-xs tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Spiritual Companion
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Daily Holy Rosary
          </h2>
          <p className="text-xs text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            "The Rosary is the weapon for these times." Pray and contemplate on the sacred mysteries.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
        {!isMeditating ? (
          <div className="space-y-4 flex-1">
            {/* Mystery Category Switcher */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 select-none">
              {ROSARY_MYSTERIES.map((mystery) => (
                <button
                  key={mystery.id}
                  onClick={() => setSelectedCategory(mystery.id)}
                  className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full transition-all border shrink-0 ${
                    selectedCategory === mystery.id
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                      : "bg-[#EBEBE0] text-[#8A8A70] border-[#D6D6C2] hover:bg-[#D6D6C2]"
                  }`}
                >
                  {mystery.category}
                </button>
              ))}
            </div>

            {/* Active Mystery Detail Card */}
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-[#D6D6C2]/45 pb-2">
                <span className="text-[10px] font-bold text-[#C2A649] font-serif italic">
                  Traditional Days: {activeMystery.days}
                </span>
                <span className="text-[9px] bg-[#EBEBE0] text-[#5A5A40] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {activeMystery.category}
                </span>
              </div>

              <h3 className="font-bold text-base text-[#4A4A35] font-serif italic">
                {activeMystery.title}
              </h3>

              <div className="space-y-2">
                <h4 className="text-[9px] font-bold text-[#8A8A70] uppercase tracking-wider">
                  The Five Mysteries to Contemplate:
                </h4>
                <ul className="space-y-2 text-xs text-[#33332D] font-sans">
                  {activeMystery.prayers.map((prayer, index) => (
                    <li key={index} className="flex gap-2.5 items-start p-2 bg-[#F5F5F0]/65 rounded-xl border border-[#D6D6C2]/40">
                      <span className="h-4 w-4 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                        {index + 1}
                      </span>
                      <span className="leading-relaxed">{prayer.replace(/^\d+\.\s*/, "")}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={handleStartRosary}
                className="w-full mt-2 py-3 px-4 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-xs font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-1.5 shadow-md border border-[#4A4A35] transition-all"
              >
                <Heart className="w-4 h-4 fill-current text-[#C2A649]" /> Begin Rosary Meditations
              </button>
            </div>

            {/* Rosary How-To Card */}
            <div className="bg-[#EBEBE0]/40 p-4 rounded-3xl border border-[#D6D6C2] space-y-2.5">
              <h4 className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest font-serif italic flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> Rosary Devotional Guide
              </h4>
              <p className="text-[11px] text-[#33332D] leading-relaxed font-sans">
                The Holy Rosary is a scripture-based prayer reflecting on the life of Christ. Tapping the virtual prayer guide helps first-time pilgrims and devotees follow along the 59 beads seamlessly without losing track.
              </p>
            </div>
          </div>
        ) : (
          /* Meditating Screen / Interactive Bead tracker */
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-sm flex-1 flex flex-col justify-between space-y-4">
            {/* Top Stats */}
            <div className="flex items-center justify-between border-b border-[#D6D6C2]/45 pb-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-[#8A8A70] uppercase tracking-wider">Active Meditation</span>
                <span className="text-xs font-bold text-[#4A4A35] font-serif italic">{activeMystery.title}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-white bg-[#C2A649] px-2 py-0.5 rounded-full">
                Step {currentBeadIndex + 1} of {rosarySteps.length}
              </span>
            </div>

            {/* Simulated Rosary Bead Visualizer chain */}
            <div className="flex items-center justify-center py-2 relative">
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#D6D6C2] to-transparent"></div>
              <div className="flex gap-2 items-center relative z-10 select-none">
                {/* 5 mini indicator circles representing beads */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const relativeIndex = currentBeadIndex - 2 + i;
                  const isCurrent = i === 2;
                  const isValid = relativeIndex >= 0 && relativeIndex < rosarySteps.length;
                  const step = isValid ? rosarySteps[relativeIndex] : null;

                  return (
                    <div
                      key={i}
                      className={`h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 border ${
                        isCurrent
                          ? "bg-[#5A5A40] text-white border-[#5A5A40] scale-125 shadow-md"
                          : isValid
                          ? "bg-[#EBEBE0] text-[#5A5A40] border-[#D6D6C2] opacity-60 scale-95"
                          : "opacity-0 h-0 w-0"
                      }`}
                    >
                      {isCurrent ? (
                        <Star className="w-4.5 h-4.5 text-[#C2A649] fill-current animate-spin" style={{ animationDuration: "12s" }} />
                      ) : (
                        <span className="text-[10px] font-mono font-bold">
                          {isValid ? relativeIndex + 1 : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Bead Content */}
            <div className="bg-[#F5F5F0]/70 p-4 rounded-2xl border border-[#D6D6C2]/50 space-y-2 flex-1 flex flex-col justify-center text-center">
              <span className="text-[9px] font-bold text-[#C2A649] uppercase tracking-widest">
                {currentStep.prayerName}
              </span>
              <h4 className="text-sm font-bold text-[#4A4A35] font-serif italic leading-tight">
                {currentStep.title}
              </h4>
              <p className="text-xs text-[#33332D] leading-relaxed italic font-medium font-sans px-2">
                {currentStep.text}
              </p>
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3 shrink-0">
              <button
                onClick={handlePrevBead}
                disabled={currentBeadIndex === 0}
                className="flex-1 py-2.5 bg-[#EBEBE0] text-[#5A5A40] border border-[#D6D6C2] hover:bg-[#D6D6C2] text-xs font-bold uppercase tracking-wider rounded-full disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              
              <button
                onClick={handleNextBead}
                className="flex-[2] py-2.5 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-xs font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-1 shadow-sm border border-[#4A4A35] transition-all"
              >
                {currentBeadIndex === rosarySteps.length - 1 ? "Complete Rosary" : "Next Bead"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsMeditating(false)}
              className="text-[10px] text-[#8A8A70] hover:text-[#5A5A40] underline text-center"
            >
              Exit Prayer Guide
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
