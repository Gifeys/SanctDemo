import React, { useState } from "react";
import { ShieldCheck, Sparkles, BarChart2, Database, FileText, Settings, Trash2, Edit, Plus, Check, Mail, CalendarRange, X, Send, Clock, Loader2 } from "lucide-react";

interface AdminPortalProps {
  applications: Array<{ id: string; type: string; applicant: string; details: string; date: string; status: string }>;
  onDeleteApplication: (id: string) => void;
  onUpdateApplicationStatus: (id: string, status: string) => void;
  announcements: Array<{ id: string; title: string; date: string; time: string; type: string }>;
  onAddAnnouncement: (announcement: { id: string; title: string; date: string; time: string; type: string }) => void;
  onDeleteAnnouncement: (id: string) => void;
}

export default function AdminPortal({
  applications,
  onDeleteApplication,
  onUpdateApplicationStatus,
  announcements,
  onAddAnnouncement,
  onDeleteAnnouncement
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "content" | "analytics" | "database">("dashboard");

  // Email and Scheduling Modals State
  const [selectedAppForAction, setSelectedAppForAction] = useState<{
    app: { id: string; type: string; applicant: string; details: string; date: string; status: string };
    actionType: "approve" | "schedule" | "reject";
  } | null>(null);

  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [isLastEmailSimulated, setIsLastEmailSimulated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [smtpConfig, setSmtpConfig] = useState<{ isConfigured: boolean; user: string | null; senderName: string } | null>(null);

  React.useEffect(() => {
    fetch("/api/smtp-status")
      .then((res) => res.json())
      .then((data) => setSmtpConfig(data))
      .catch((err) => console.error("Error fetching SMTP status:", err));
  }, []);

  const handleOpenApproveModal = (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => {
    const emailMatch = app.details.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const extractedEmail = emailMatch ? emailMatch[0] : "";
    
    setRecipientEmail(extractedEmail || "applicant@example.com");
    setEmailSubject(`CONGRATULATIONS: Your ${app.type} has been Approved!`);
    setEmailBody(`Dear ${app.applicant},

We are absolutely delighted to inform you that your registration for the "${app.type}" has been officially APPROVED by Father Paul Woo and the parish panel of Mary Help of Christians Parish!

We would like to formally welcome you and invite you to download your official Congratulatory Form from the parish dashboard.

Best regards,
Parish Office
Mary Help of Christians Parish`);
    setSelectedAppForAction({ app, actionType: "approve" });
    setEmailSentSuccess(false);
    setIsSendingEmail(false);
    setErrorMessage(null);
  };

  const handleOpenScheduleModal = (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => {
    const emailMatch = app.details.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const extractedEmail = emailMatch ? emailMatch[0] : "";
    
    const dateMatch = app.details.match(/Scheduled Date: ([^\s\)]+)/);
    const defaultDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    
    setRecipientEmail(extractedEmail || "applicant@example.com");
    setScheduleDate(defaultDate);
    setScheduleTime("10:00 AM");
    
    const initialSubject = `SCHEDULE NOTICE: Appointment for ${app.type}`;
    const initialBody = `Dear ${app.applicant},

This is to confirm that an appointment has been scheduled for your ${app.type}.

Appointment Details:
Date: ${defaultDate}
Time: 10:00 AM
Location: Mary Help of Christians Parish Office

Please bring all required canonical documents with you for this appointment. If you need to reschedule, please contact the Parish Office.

Best regards,
Parish Office
Mary Help of Christians Parish`;

    setEmailSubject(initialSubject);
    setEmailBody(initialBody);
    setSelectedAppForAction({ app, actionType: "schedule" });
    setEmailSentSuccess(false);
    setIsSendingEmail(false);
    setErrorMessage(null);
  };

  const updateScheduleEmailBody = (date: string, time: string) => {
    if (!selectedAppForAction) return;
    const { app } = selectedAppForAction;
    setEmailBody(`Dear ${app.applicant},

This is to confirm that an appointment has been scheduled for your ${app.type}.

Appointment Details:
Date: ${date}
Time: ${time}
Location: Mary Help of Christians Parish Office

Please bring all required canonical documents with you for this appointment. If you need to reschedule, please contact the Parish Office.

Best regards,
Parish Office
Mary Help of Christians Parish`);
  };

  const handleOpenRejectModal = (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => {
    const emailMatch = app.details.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const extractedEmail = emailMatch ? emailMatch[0] : "";
    
    setRecipientEmail(extractedEmail || "applicant@example.com");
    setEmailSubject(`UPDATE REQUIRED: ${app.type} Review`);
    setEmailBody(`Dear ${app.applicant},

Thank you for submitting your request for ${app.type}. After review, some required documents or details are incomplete.

Please resubmit your application with the proper guidelines or contact our Maypajo Parish Office for assistance.

Best regards,
Parish Office
Mary Help of Christians Parish`);
    setSelectedAppForAction({ app, actionType: "reject" });
    setEmailSentSuccess(false);
    setIsSendingEmail(false);
    setErrorMessage(null);
  };

  const handleSendEmailAction = async () => {
    if (!selectedAppForAction) return;
    setIsSendingEmail(true);
    setErrorMessage(null);

    let finalStatus = "";
    let isSimulated = false;

    if (selectedAppForAction.actionType === "approve") {
      finalStatus = "Approved (Congratulation Email Sent)";
    } else if (selectedAppForAction.actionType === "schedule") {
      finalStatus = `Scheduled on ${scheduleDate} @ ${scheduleTime} (Invitation Email Sent)`;
    } else if (selectedAppForAction.actionType === "reject") {
      finalStatus = "Rejected - Resubmit (Notice Email Sent)";
    }

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: recipientEmail,
          subject: emailSubject,
          body: emailBody
        })
      });

      const errData = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (errData.error === "SMTP_NOT_CONFIGURED") {
          isSimulated = true;
        } else {
          throw new Error(errData.message || "Failed to transmit message via SMTP server.");
        }
      }

      // Update state in firebase
      onUpdateApplicationStatus(
        selectedAppForAction.app.id, 
        isSimulated ? `${finalStatus} (Simulated)` : finalStatus
      );

      setIsSendingEmail(false);
      setEmailSentSuccess(true);
      setIsLastEmailSimulated(isSimulated);

      // Auto close modal after showing success state
      setTimeout(() => {
        setSelectedAppForAction(null);
        setIsLastEmailSimulated(false);
      }, 4500);

    } catch (err: any) {
      console.error("SMTP Transmission failed:", err);
      setErrorMessage(err.message || "A connection or authentication error occurred while sending the email.");
      setIsSendingEmail(false);
    }
  };

  // Content edit state
  const [churchName, setChurchName] = useState("Mary Help of Christians Parish");
  const [churchAddress, setChurchNameAddress] = useState("J.P. Rizal Street, Maypajo, Caloocan City");
  const [churchFounded, setChurchFounded] = useState("1952");
  const [churchHistory, setChurchHistory] = useState("Mary Help of Christians Parish in Maypajo was established to serve the growing population of Caloocan and to provide a center for Marian devotion...");
  const [isSavedContent, setIsSavedContent] = useState(false);

  // New Announcement fields
  const [annTitle, setAnnTitle] = useState("");
  const [annDate, setAnnDate] = useState("");
  const [annTime, setAnnTime] = useState("");
  const [annType, setAnnType] = useState("Mass");

  const handleSaveChurchInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavedContent(true);
    setTimeout(() => setIsSavedContent(false), 2500);
  };

  const handleAddAnn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annDate) return;
    onAddAnnouncement({
      id: "ann-" + Date.now(),
      title: annTitle,
      date: annDate,
      time: annTime || "6:00 PM",
      type: annType
    });
    setAnnTitle("");
    setAnnDate("");
    setAnnTime("");
  };

  return (
    <div className="flex-1 flex flex-col bg-[#33332D] text-white overflow-hidden font-sans">
      {/* Admin Web Header Bar */}
      <div className="bg-[#22221E] border-b border-[#5A5A40]/40 p-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#C2A649]" />
          <div>
            <h3 className="text-xs font-bold font-serif italic tracking-wide text-[#C2A649] uppercase">
              SanctiWalk Admin Portal
            </h3>
            <span className="text-[8px] font-mono text-[#8A8A70] uppercase">Maypajo Church DB Server</span>
          </div>
        </div>
        <span className="text-[9px] bg-red-800 text-white font-mono px-2 py-0.5 rounded uppercase tracking-wider font-bold">
          LIVE DEMO MODE
        </span>
      </div>

      {/* Main Admin Workspace split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Figure 9: Admin Left Menu sidebar */}
        <div className="w-18 bg-[#22221E] border-r border-[#5A5A40]/30 flex flex-col items-center py-4 space-y-3 shrink-0">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
              activeTab === "dashboard" ? "bg-[#5A5A40] text-white font-bold" : "text-[#8A8A70] hover:text-[#EBEBE0]"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span className="text-[7px] uppercase font-bold tracking-wider">Stats</span>
          </button>

          <button
            onClick={() => setActiveTab("content")}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
              activeTab === "content" ? "bg-[#5A5A40] text-white font-bold" : "text-[#8A8A70] hover:text-[#EBEBE0]"
            }`}
          >
            <Edit className="w-4 h-4" />
            <span className="text-[7px] uppercase font-bold tracking-wider">Content</span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
              activeTab === "analytics" ? "bg-[#5A5A40] text-white font-bold" : "text-[#8A8A70] hover:text-[#EBEBE0]"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="text-[7px] uppercase font-bold tracking-wider">Graphs</span>
          </button>

          <button
            onClick={() => setActiveTab("database")}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
              activeTab === "database" ? "bg-[#5A5A40] text-white font-bold" : "text-[#8A8A70] hover:text-[#EBEBE0]"
            }`}
          >
            <Database className="w-4 h-4" />
            <span className="text-[7px] uppercase font-bold tracking-wider">Data</span>
          </button>
        </div>

        {/* Dynamic Admin Sub-view screen */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#33332D]">
          {/* TAB 1: Admin Dashboard (Figure 9) */}
          {activeTab === "dashboard" && (
            <div className="space-y-4 font-sans text-xs">
              <div className="flex justify-between items-center border-b border-[#5A5A40]/30 pb-2">
                <h4 className="font-serif italic text-sm font-bold text-[#C2A649]">Overview & Stats</h4>
                <span className="text-[8px] font-mono text-[#8A8A70]">Updated 1 min ago</span>
              </div>

              {/* Grid 4 Stats */}
              <div className="grid grid-cols-2 gap-2 text-center select-none">
                <div className="bg-[#22221E] p-2.5 rounded-xl border border-[#5A5A40]/25">
                  <span className="block text-[8px] text-[#8A8A70] uppercase font-mono">Total Visitors</span>
                  <strong className="text-sm text-white font-bold">300</strong>
                </div>
                <div className="bg-[#22221E] p-2.5 rounded-xl border border-[#5A5A40]/25">
                  <span className="block text-[8px] text-[#8A8A70] uppercase font-mono">AR Usage</span>
                  <strong className="text-sm text-[#C2A649] font-bold">70 Scans</strong>
                </div>
                <div className="bg-[#22221E] p-2.5 rounded-xl border border-[#5A5A40]/25">
                  <span className="block text-[8px] text-[#8A8A70] uppercase font-mono">Peak Visiting Hours</span>
                  <strong className="text-[10px] text-white font-bold font-serif">2:00-4:00 PM</strong>
                </div>
                <div className="bg-[#22221E] p-2.5 rounded-xl border border-[#5A5A40]/25">
                  <span className="block text-[8px] text-[#8A8A70] uppercase font-mono">Engagement Rate</span>
                  <strong className="text-sm text-green-400 font-bold">72.4 %</strong>
                </div>
              </div>

              {/* Figure 9: Most Viewed Sections */}
              <div className="bg-[#22221E] p-3 rounded-2xl border border-[#5A5A40]/25 space-y-2">
                <h5 className="font-serif italic text-xs font-bold text-[#C2A649] border-b border-[#5A5A40]/20 pb-1">
                  Most Visited Church Zones
                </h5>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between p-1 bg-[#33332D]/40 rounded">
                    <span>1. Crucifix Central</span>
                    <strong className="text-[#C2A649]">200 hits</strong>
                  </div>
                  <div className="flex justify-between p-1 bg-[#33332D]/40 rounded">
                    <span>2. Adoration Chapel</span>
                    <strong className="text-[#C2A649]">120 hits</strong>
                  </div>
                  <div className="flex justify-between p-1 bg-[#33332D]/40 rounded">
                    <span>3. Altar Table</span>
                    <strong className="text-[#C2A649]">100 hits</strong>
                  </div>
                  <div className="flex justify-between p-1 bg-[#33332D]/40 rounded">
                    <span>4. Maria Auxiliadora</span>
                    <strong className="text-[#C2A649]">70 hits</strong>
                  </div>
                </div>
              </div>

              {/* Dynamic activity log summary */}
              <div className="bg-[#22221E] p-3 rounded-2xl border border-[#5A5A40]/25 space-y-2">
                <h5 className="font-serif italic text-xs font-bold text-[#C2A649] border-b border-[#5A5A40]/20 pb-1">
                  Recent Activities ({applications.length})
                </h5>
                {applications.length === 0 ? (
                  <p className="text-[10px] text-[#8A8A70] italic">No active requests inside current sandbox.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                    {applications.slice(0, 3).map((app) => (
                      <div key={app.id} className="p-1.5 bg-[#33332D]/50 rounded text-[10px] space-y-0.5 border-l-2 border-[#C2A649]">
                        <div className="flex justify-between">
                          <span className="font-bold text-white">{app.type}</span>
                          <span className="text-[8px] text-[#8A8A70]">{app.date}</span>
                        </div>
                        <p className="text-[#EBEBE0] line-clamp-1">{app.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Content Management (Figure 10) */}
          {activeTab === "content" && (
            <div className="space-y-4 text-xs font-sans">
              <div className="flex justify-between items-center border-b border-[#5A5A40]/30 pb-2">
                <h4 className="font-serif italic text-sm font-bold text-[#C2A649]">Content Management</h4>
                <span className="text-[8px] font-mono text-[#8A8A70]">Static Content Manager</span>
              </div>

              {/* Edit Church Info */}
              <form onSubmit={handleSaveChurchInfo} className="bg-[#22221E] p-3.5 rounded-2xl border border-[#5A5A40]/25 space-y-2.5">
                <h5 className="font-serif italic text-xs font-bold text-[#C2A649] border-b border-[#5A5A40]/15 pb-1">
                  Edit Parish Details
                </h5>

                {isSavedContent && (
                  <div className="p-2 bg-green-950/70 border border-green-700 text-green-200 rounded flex items-center gap-1.5 text-[10px]">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Church database info updated successfully in current buffer!</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="text-[9px] text-[#8A8A70] uppercase tracking-wider font-mono">Church Name</span>
                  <input
                    type="text"
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                    className="w-full bg-[#33332D] border border-[#5A5A40]/30 rounded-lg p-2 text-xs outline-none text-white font-serif"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] text-[#8A8A70] uppercase tracking-wider font-mono">Address location</span>
                  <input
                    type="text"
                    value={churchAddress}
                    onChange={(e) => setChurchNameAddress(e.target.value)}
                    className="w-full bg-[#33332D] border border-[#5A5A40]/30 rounded-lg p-2 text-xs outline-none text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="py-1.5 px-3 bg-[#5A5A40] text-white text-[10px] font-bold uppercase rounded-md border border-[#5A5A40]"
                >
                  Save Global Church Info
                </button>
              </form>

              {/* Announcements Editor */}
              <div className="bg-[#22221E] p-3.5 rounded-2xl border border-[#5A5A40]/25 space-y-2.5">
                <h5 className="font-serif italic text-xs font-bold text-[#C2A649] border-b border-[#5A5A40]/15 pb-1">
                  Create Announcement
                </h5>

                <form onSubmit={handleAddAnn} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Announcement Title (e.g. Feast Day Mass)"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="w-full bg-[#33332D] border border-[#5A5A40]/30 rounded-lg p-2 text-xs outline-none text-white"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Date (e.g. May 13, 2026)"
                      value={annDate}
                      onChange={(e) => setAnnDate(e.target.value)}
                      className="w-full bg-[#33332D] border border-[#5A5A40]/30 rounded-lg p-2 text-xs outline-none text-white"
                    />
                    <input
                      type="text"
                      placeholder="Time (e.g. 3:00 PM)"
                      value={annTime}
                      onChange={(e) => setAnnTime(e.target.value)}
                      className="w-full bg-[#33332D] border border-[#5A5A40]/30 rounded-lg p-2 text-xs outline-none text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!annTitle || !annDate}
                    className="w-full py-2 bg-[#C2A649] hover:bg-[#A88B38] disabled:opacity-50 text-black font-bold uppercase rounded-md text-[10px] tracking-wide"
                  >
                    Publish Announcement to App Bulletin
                  </button>
                </form>

                {/* Published List */}
                <div className="space-y-1.5 pt-2 border-t border-[#33332D]">
                  <span className="text-[9px] text-[#8A8A70] uppercase tracking-wider font-mono">Active Announcements ({announcements.length})</span>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {announcements.map((ann) => (
                      <div key={ann.id} className="flex justify-between items-center p-2 bg-[#33332D] rounded-lg border border-[#5A5A40]/20">
                        <div>
                          <span className="font-serif italic font-bold block">{ann.title}</span>
                          <span className="text-[9px] text-[#8A8A70]">{ann.date} at {ann.time}</span>
                        </div>
                        <button
                          onClick={() => onDeleteAnnouncement(ann.id)}
                          className="p-1 hover:text-red-400 text-gray-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Analytics Reporting (Figure 11) */}
          {activeTab === "analytics" && (
            <div className="space-y-4 text-xs font-sans">
              <div className="flex justify-between items-center border-b border-[#5A5A40]/30 pb-2">
                <h4 className="font-serif italic text-sm font-bold text-[#C2A649]">Analytics Reporting</h4>
                <span className="text-[8px] font-mono text-[#8A8A70]">Statistical Metrics</span>
              </div>

              {/* Feature Usage Pie chart representation */}
              <div className="bg-[#22221E] p-4 rounded-3xl border border-[#5A5A40]/25 space-y-3">
                <h5 className="font-serif italic text-xs font-bold text-[#C2A649] text-center border-b border-[#5A5A40]/15 pb-1.5">
                  Feature Usage Distribution
                </h5>

                {/* Horizontal Bar Chart visualization */}
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>Augmented Reality AR Scans</span>
                      <strong className="text-cyan-400">902 usages (59%)</strong>
                    </div>
                    <div className="w-full h-2 bg-[#33332D] rounded-full overflow-hidden">
                      <div className="bg-cyan-400 h-full rounded-full" style={{ width: "59%" }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>Santo Rosary Guide</span>
                      <strong className="text-rose-400">366 usages (24%)</strong>
                    </div>
                    <div className="w-full h-2 bg-[#33332D] rounded-full overflow-hidden">
                      <div className="bg-rose-400 h-full rounded-full" style={{ width: "24%" }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>History of Church</span>
                      <strong className="text-amber-400">138 usages (9%)</strong>
                    </div>
                    <div className="w-full h-2 bg-[#33332D] rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: "9%" }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>Ministries & Sacraments Form</span>
                      <strong className="text-purple-400">128 usages (8%)</strong>
                    </div>
                    <div className="w-full h-2 bg-[#33332D] rounded-full overflow-hidden">
                      <div className="bg-purple-400 h-full rounded-full" style={{ width: "8%" }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Visitor Frequency (Figure 11 graph representation) */}
              <div className="bg-[#22221E] p-4 rounded-3xl border border-[#5A5A40]/25 space-y-3">
                <h5 className="font-serif italic text-xs font-bold text-[#C2A649] text-center border-b border-[#5A5A40]/15 pb-1.5">
                  Weekly Visitor Frequency
                </h5>
                
                {/* Simulated vertical bar graph */}
                <div className="flex items-end justify-between h-28 pt-2 select-none px-2 border-b border-[#5A5A40]/40">
                  <div className="flex flex-col items-center gap-1 w-6">
                    <div className="bg-[#C2A649] rounded-t w-3" style={{ height: "20px" }}></div>
                    <span className="text-[8px] font-mono text-[#8A8A70]">M</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-6">
                    <div className="bg-[#C2A649] rounded-t w-3" style={{ height: "45px" }}></div>
                    <span className="text-[8px] font-mono text-[#8A8A70]">T</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-6">
                    <div className="bg-[#C2A649] rounded-t w-3" style={{ height: "40px" }}></div>
                    <span className="text-[8px] font-mono text-[#8A8A70]">W</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-6">
                    <div className="bg-[#C2A649] rounded-t w-3" style={{ height: "30px" }}></div>
                    <span className="text-[8px] font-mono text-[#8A8A70]">Th</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-6">
                    <div className="bg-[#C2A649] rounded-t w-3" style={{ height: "65px" }}></div>
                    <span className="text-[8px] font-mono text-[#8A8A70]">F</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-6">
                    <div className="bg-[#C2A649] rounded-t w-3" style={{ height: "80px" }}></div>
                    <span className="text-[8px] font-mono text-[#8A8A70]">Sa</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-6">
                    <div className="bg-green-500 rounded-t w-3 animate-pulse" style={{ height: "98px" }}></div>
                    <span className="text-[8px] font-mono text-[#8A8A70] font-bold text-green-400">Su</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Database Management & Visitor Logs (Figure 12) */}
          {activeTab === "database" && (
            <div className="space-y-4 text-xs font-sans">
              <div className="flex justify-between items-center border-b border-[#5A5A40]/30 pb-2">
                <h4 className="font-serif italic text-sm font-bold text-[#C2A649]">Database Management</h4>
                <span className="text-[8px] font-mono text-[#8A8A70]">Live Query Table logs</span>
              </div>

              {/* Historical assets table */}
              <div className="bg-[#22221E] p-3 rounded-2xl border border-[#5A5A40]/25 space-y-2">
                <h5 className="font-serif italic text-xs font-bold text-[#C2A649] border-b border-[#5A5A40]/15 pb-1">
                  Historical Church Schemas (Stored Local)
                </h5>
                <div className="space-y-1 text-[9px] font-mono text-[#EBEBE0]">
                  <div className="p-1 bg-[#33332D] rounded flex justify-between">
                    <span>1. Main Altar Content description (Maypajo)</span>
                    <span className="text-green-400">[ACTIVE]</span>
                  </div>
                  <div className="p-1 bg-[#33332D] rounded flex justify-between">
                    <span>2. Maria Auxiliadora 3D coordinates</span>
                    <span className="text-green-400">[ACTIVE]</span>
                  </div>
                  <div className="p-1 bg-[#33332D] rounded flex justify-between">
                    <span>3. Cathedral Sanctuary (San Roque) assets</span>
                    <span className="text-green-400">[ACTIVE]</span>
                  </div>
                </div>
              </div>

              {/* Figure 12 style: Visitor Log storage */}
              <div className="bg-[#22221E] p-3 rounded-2xl border border-[#5A5A40]/25 space-y-2">
                <div className="flex justify-between items-center border-b border-[#5A5A40]/15 pb-1">
                  <h5 className="font-serif italic text-xs font-bold text-[#C2A649]">
                    Visitor Logs & Transactions
                  </h5>
                  <span className="text-[8px] font-mono bg-[#5A5A40] text-white px-1.5 py-0.5 rounded">
                    {applications.length} Records
                  </span>
                </div>

                {applications.length === 0 ? (
                  <p className="text-[10px] text-[#8A8A70] italic text-center py-4">No data logged. Test forms/scans inside smartphone emulator first!</p>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                    {applications.map((app) => (
                      <div key={app.id} className="p-2.5 bg-[#33332D] rounded border border-[#5A5A40]/15 text-[10px] space-y-2">
                        <div className="flex justify-between items-center border-b border-[#5A5A40]/10 pb-0.5">
                          <span className="font-bold text-[#C2A649] uppercase tracking-wider text-[8px]">{app.type}</span>
                          <button
                            onClick={() => onDeleteApplication(app.id)}
                            className="text-red-400 hover:text-red-500 font-mono text-[8px]"
                          >
                            DELETE
                          </button>
                        </div>
                        <div>
                          <span className="text-white font-serif italic block">Applicant: {app.applicant}</span>
                          <p className="text-[#8A8A70] font-mono leading-normal break-all text-[9px]">{app.details}</p>
                        </div>
                        <div className="flex justify-between items-center pt-0.5 text-[8px] font-mono text-[#8A8A70]">
                          <span>Logged: {app.date}</span>
                          <span className="text-green-400 font-bold uppercase tracking-wider bg-[#5A5A40]/25 px-1.5 py-0.5 rounded">{app.status}</span>
                        </div>

                        {/* Status update/Review panel */}
                        <div className="pt-1.5 border-t border-[#5A5A40]/10 flex flex-wrap items-center gap-1">
                          <span className="text-[7.5px] text-[#8A8A70] uppercase tracking-wider block mr-1 font-bold">Review Status:</span>
                          <button
                            onClick={() => handleOpenApproveModal(app)}
                            className="bg-green-900/40 hover:bg-green-900/70 text-green-300 font-mono text-[7.5px] px-2 py-0.5 rounded border border-green-700/40 transition-all uppercase font-bold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenScheduleModal(app)}
                            className="bg-blue-900/40 hover:bg-blue-900/70 text-blue-300 font-mono text-[7.5px] px-2 py-0.5 rounded border border-blue-700/40 transition-all uppercase font-bold"
                          >
                            Schedule
                          </button>
                          <button
                            onClick={() => handleOpenRejectModal(app)}
                            className="bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 font-mono text-[7.5px] px-2 py-0.5 rounded border border-rose-700/40 transition-all uppercase font-bold"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Email/Scheduling Modal Overlay */}
      {selectedAppForAction && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-[#33332D] font-sans">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-[#D6D6C2] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#5A5A40] text-white p-4 flex items-center justify-between border-b border-[#D6D6C2]/30">
              <div className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#C2A649]" />
                <h3 className="text-xs font-bold tracking-wider uppercase font-serif italic text-white">
                  {selectedAppForAction.actionType === "approve" && "Draft Approval & Congratulatory Form"}
                  {selectedAppForAction.actionType === "schedule" && "Schedule Appointment & Draft Invitation"}
                  {selectedAppForAction.actionType === "reject" && "Compose Revision / Rejection Notice"}
                </h3>
              </div>
              <button
                disabled={isSendingEmail || emailSentSuccess}
                onClick={() => setSelectedAppForAction(null)}
                className="text-[#EBEBE0] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5">
              {emailSentSuccess ? (
                <div className="py-6 text-center space-y-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${isLastEmailSimulated ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {isLastEmailSimulated ? (
                      <Clock className="w-6 h-6 stroke-[2.5]" />
                    ) : (
                      <Check className="w-6 h-6 stroke-[3]" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-serif italic text-gray-900">
                      {isLastEmailSimulated ? "Database Committed (Simulated Email)" : "Real Email Transmitted Successfully!"}
                    </h4>
                    <p className="text-[9.5px] text-gray-600 max-w-xs mx-auto mt-1 leading-relaxed">
                      {isLastEmailSimulated ? (
                        <>
                          The database state has successfully transitioned to <span className="font-bold text-[#5A5A40]">Approved / Scheduled</span> in Firestore! 
                          <span className="block mt-1.5 text-[8.5px] bg-amber-50 p-2 rounded-lg border border-amber-200/50 text-amber-800">
                            <strong>Note:</strong> Since <strong>SMTP_USER</strong> and <strong>SMTP_PASS</strong> secrets are not configured in AI Studio, a real physical email could not be delivered to <span className="font-mono">{recipientEmail}</span>. Add your credentials in Secrets to trigger actual emails!
                          </span>
                        </>
                      ) : (
                        <>
                          The actual email correspondence was dispatched using your SMTP mail server straight to <strong className="font-mono text-gray-800">{recipientEmail}</strong>.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* SMTP Status banner */}
                  {smtpConfig && (
                    <div className={`p-2 rounded-xl text-[8.5px] leading-normal font-mono border ${smtpConfig.isConfigured ? 'bg-green-50 text-green-800 border-green-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                      {smtpConfig.isConfigured ? (
                        <span>● Real Email Delivery is ACTIVE via <strong className="underline">{smtpConfig.user}</strong></span>
                      ) : (
                        <span>
                          ⚠️ Real Delivery INACTIVE (SMTP Credentials Missing). Click <strong>"Send Email & Commit"</strong> to simulate database logging & status updates!
                        </span>
                      )}
                    </div>
                  )}

                  {/* SMTP Error Banner */}
                  {errorMessage && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[10px] leading-relaxed font-sans">
                      <strong className="block font-bold mb-0.5">⚠️ Email Dispatch Failed:</strong>
                      <span className="font-mono text-[9px] break-words">{errorMessage}</span>
                      <p className="mt-1.5 text-[8.5px] text-red-600 font-serif italic">
                        <strong>Troubleshooting Tips:</strong>
                        <span className="block mt-0.5 ml-1">• If using Gmail/Google Workspace, you <strong>MUST</strong> use an <strong className="underline">App Password</strong> (16 characters) instead of your primary password.</span>
                        <span className="block ml-1">• Double-check that your Secrets variable names (e.g., <span className="font-mono">SMTP_USER</span>, <span className="font-mono">SMTP_PASS</span>) match exactly in AI Studio settings.</span>
                      </p>
                    </div>
                  )}

                  {/* Recipient Details */}
                  <div className="bg-[#F5F5F0] p-2.5 rounded-xl border border-[#D6D6C2]/45 space-y-1">
                    <div className="flex justify-between items-center text-[8.5px] text-[#8A8A70] uppercase font-mono">
                      <span>Recipient Applicant</span>
                      <span>ID: {selectedAppForAction.app.id}</span>
                    </div>
                    <strong className="block text-xs text-[#4A4A35] font-serif italic">{selectedAppForAction.app.applicant}</strong>
                    <span className="block text-[10px] text-[#5A5A40] truncate">{selectedAppForAction.app.type}</span>
                  </div>

                  {/* Recipient Email Address Input */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                      Destination Email Address
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2 text-xs outline-none text-[#33332D] font-mono"
                      placeholder="e.g. applicant@email.com"
                    />
                  </div>

                  {/* Scheduling Fields if actionType is "schedule" */}
                  {selectedAppForAction.actionType === "schedule" && (
                    <div className="grid grid-cols-2 gap-2 bg-blue-50/50 p-2.5 rounded-xl border border-blue-200/50">
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-bold text-blue-900 uppercase tracking-wider font-serif italic flex items-center gap-1">
                          <CalendarRange className="w-3 h-3" /> Date
                        </label>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => {
                            setScheduleDate(e.target.value);
                            updateScheduleEmailBody(e.target.value, scheduleTime);
                          }}
                          className="w-full bg-white border border-blue-300 rounded-lg p-1.5 text-[11px] outline-none text-[#33332D] font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-bold text-blue-900 uppercase tracking-wider font-serif italic flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Time
                        </label>
                        <input
                          type="text"
                          value={scheduleTime}
                          onChange={(e) => {
                            setScheduleTime(e.target.value);
                            updateScheduleEmailBody(scheduleDate, e.target.value);
                          }}
                          placeholder="e.g. 10:00 AM"
                          className="w-full bg-white border border-blue-300 rounded-lg p-1.5 text-[11px] outline-none text-[#33332D] font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Subject Line */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2 text-xs outline-none text-[#33332D] font-sans"
                    />
                  </div>

                  {/* Email Message Composer */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-wider font-serif italic">
                      Email Message Copy
                    </label>
                    <textarea
                      rows={5}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full bg-[#F5F5F0] border border-[#D6D6C2] rounded-xl p-2.5 text-[11px] outline-none text-[#33332D] font-sans resize-none leading-normal"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={isSendingEmail}
                      onClick={() => setSelectedAppForAction(null)}
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSendingEmail || !recipientEmail}
                      onClick={handleSendEmailAction}
                      className="flex-1 py-2 bg-[#5A5A40] hover:bg-[#4A4A35] disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isSendingEmail ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Transmitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Email & Commit</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
