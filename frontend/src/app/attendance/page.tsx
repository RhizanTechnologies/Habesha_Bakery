"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { apiRequest, getFileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { useConfirm } from "@/components/ConfirmModal";
import {
  Clock,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Filter,
  ExternalLink,
  ShieldCheck,
  X,
  Search,
  Moon,
  Sun,
  Eye,
  Calendar,
  Volume2,
  Settings,
  Check,
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  userId: string;
  branchId: string;
  businessDate: string;
  shift: string;
  type: "PUNCH_IN" | "PUNCH_OUT";
  punchTime: string;
  snapshotUrl: string | null;
  voiceNoteUrl?: string | null;
  isLate: boolean;
  lateMinutes: number;
  penaltyId: string | null;
  penalty?: {
    id: string;
    amount: number | string;
    status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    reason: string;
  } | null;
  notes: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    role: string;
    phone: string;
    shift: string | null;
    avatarUrl: string | null;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
}

export default function AttendanceManagementPage() {
  const { user } = useAuth();
  const { branches, selectedBranchId } = useBranch();
  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || null;
  const { l } = useLanguage();

  const isOwner = user?.role === "OWNER";
  const canReviewPenalties = isOwner || user?.role === "ADMIN";
  const { confirm, ConfirmModalComponent } = useConfirm();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState({
    totalPunches: 0,
    onTimePunches: 0,
    latePunches: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [filterType, setFilterType] = useState<string>("");
  const [filterLateOnly, setFilterLateOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal States
  const [viewingSnapshotUrl, setViewingSnapshotUrl] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<AttendanceRecord | null>(null);

  // Penalty Range & Check-In Window Configuration Modal (Owner Only)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [penaltyConfig, setPenaltyConfig] = useState({
    dayCheckInStart: "06:00",
    dayCheckInEnd: "06:30",
    nightCheckInStart: "21:00",
    nightCheckInEnd: "21:30",
    graceMinutes: 0,
    tier1Minutes: 30,
    tier1Amount: 50,
    tier2Minutes: 60,
    tier2Amount: 100,
  });
  const [configSubmitting, setConfigSubmitting] = useState(false);

  const loadPenaltyConfig = async () => {
    const res = await apiRequest<any>("/attendance/penalty-config");
    if (res.data) {
      setPenaltyConfig({
        dayCheckInStart: res.data.dayCheckInStart || "06:00",
        dayCheckInEnd: res.data.dayCheckInEnd || "06:30",
        nightCheckInStart: res.data.nightCheckInStart || "21:00",
        nightCheckInEnd: res.data.nightCheckInEnd || "21:30",
        graceMinutes: res.data.attendanceGraceMinutes ?? 0,
        tier1Minutes: res.data.attendancePenaltyTier1Minutes ?? 30,
        tier1Amount: Number(res.data.attendancePenaltyTier1Amount ?? 50),
        tier2Minutes: res.data.attendancePenaltyTier2Minutes ?? 60,
        tier2Amount: Number(res.data.attendancePenaltyTier2Amount ?? 100),
      });
    }
  };

  const handleSavePenaltyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSubmitting(true);
    const res = await apiRequest("/attendance/penalty-config", {
      method: "POST",
      body: JSON.stringify(penaltyConfig),
    });
    setConfigSubmitting(false);
    if (res.data) {
      setShowConfigModal(false);
      alert(l("የቅጣት ተመን በተሳካ ሁኔታ ተሻሽሏል!", "Qajeelfamni adabbii haaromeera!", "Late penalty ranges updated successfully!"));
    }
  };

  const handleApprovePenalty = async (penaltyId: string) => {
    const ok = await confirm({
      title: l("የመዘግየት ቅጣት ማጽደቅ", "Adabbii Turaatii Mirkaneessuu", "Approve Tardiness Penalty"),
      message: l(
        "ይህን የመዘግየት ቅጣት ማጽደቅ ይፈልጋሉ? ክፍያው ተረጋግጦ በደመወዝ መዝገብ ላይ ተቀናሽ ይሆናል።",
        "Adabbii turaatii kana mirkaneessuu barbaadduu? Kaffaltiin kun mirkanaa'ee mindaa irraa kan hir'ifamu ta'a.",
        "Are you sure you want to approve this late check-in penalty? The fee will be queued for monthly payroll deduction."
      ),
      variant: "warning",
      confirmText: l("ቅጣቱን አጽድቅ", "Adabbii Mirkaneessi", "Approve Penalty"),
    });
    if (!ok) return;

    const res = await apiRequest<{ success: boolean; message: string }>(`/attendance/penalties/${penaltyId}/approve`, {
      method: "POST",
    });
    if (res.data?.success) {
      fetchAttendance();
      if (viewingRecord) {
        setViewingRecord(null);
        setViewingSnapshotUrl(null);
      }
    } else {
      alert(res.error || "Failed to approve penalty.");
    }
  };

  const handleWaivePenalty = async (penaltyId: string) => {
    const ok = await confirm({
      title: l("የመዘግየት ቅጣት በይቅርታ ማለፍ", "Adabbii Turaatii Dhiisuu", "Waive / Forgive Penalty"),
      message: l(
        "የሠራተኛውን የድምፅ ማብራሪያ ካዳመጡ በኋላ ቅጣቱን በይቅርታ መሰረዝ ይፈልጋሉ? ምንም ዓይነት የገንዘብ ተቀናሽ አይደረግም።",
        "Ibsa sagalee hojjataa erga dhaggeeffattanii booda adabbii kana dhiisuu barbaadduu? Qusannaan maallaqaa homaa hin godhamu.",
        "Are you sure you want to forgive and waive this tardiness penalty? No financial deduction will be made."
      ),
      variant: "info",
      confirmText: l("በይቅርታ እለፍ", "Dhiifama Godhi", "Waive Penalty"),
    });
    if (!ok) return;

    const res = await apiRequest<{ success: boolean; message: string }>(`/attendance/penalties/${penaltyId}/waive`, {
      method: "POST",
      body: JSON.stringify({ reason: "Waived by Owner after hearing voice explanation" }),
    });
    if (res.data?.success) {
      fetchAttendance();
      if (viewingRecord) {
        setViewingRecord(null);
        setViewingSnapshotUrl(null);
      }
    } else {
      alert(res.error || "Failed to waive penalty.");
    }
  };

  const handleBatchApprovePenalties = async () => {
    const pending = displayedRecords.filter(
      (r) => r.penalty && r.penalty.status === "PENDING_APPROVAL"
    );
    if (pending.length === 0) return;

    const totalAmount = pending.reduce((sum, r) => sum + Number(r.penalty!.amount), 0);
    const ok = await confirm({
      title: l("የመዘግየት ቅጣቶችን በጅምላ ማጽደቅ", "Adabbiiwwan Hunda Mirkaneessuu", "Batch Approve Tardiness Penalties"),
      message: l(
        `ሁሉንም ${pending.length} በመጠባበቅ ላይ ያሉ የመዘግየት ቅጣቶች (ድምር፡ ${totalAmount.toFixed(0)} ብር) በአንድ ጊዜ ማጽደቅ ይፈልጋሉ? ክፍያዎቹ ተረጋግጠው በደመወዝ መዝገብ ላይ ተቀናሽ ይሆናሉ።`,
        `Adabbiiwwan turaatii ${pending.length} eegaa jiran (Waliigala: ${totalAmount.toFixed(0)} ETB) al-tokkotti mirkaneessuu barbaadduu? Mindaa irraa kan hir'ifaman ta'a.`,
        `Are you sure you want to approve all ${pending.length} pending tardiness penalties (${totalAmount.toFixed(0)} ETB) at once? All approved penalties will be deducted on payroll.`
      ),
      variant: "warning",
      confirmText: l(`ሁሉንም አጽድቅ (${pending.length})`, `Hunda Mirkaneessi (${pending.length})`, `Approve All (${pending.length})`),
    });
    if (!ok) return;

    const res = await apiRequest<{ success: boolean; message: string; count: number }>(
      "/attendance/penalties/batch-approve",
      {
        method: "POST",
        body: JSON.stringify({
          ids: pending.map((r) => r.penalty!.id),
        }),
      }
    );
    if (res.data?.success) {
      fetchAttendance();
    } else {
      alert(res.error || "Failed to batch approve penalties.");
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    const branchParam = isOwner && selectedBranch ? `&branchId=${selectedBranch.id}` : "";
    const dateParam = filterDate ? `&date=${filterDate}` : "";
    const typeParam = filterType ? `&type=${filterType}` : "";

    const res = await apiRequest<{
      records: AttendanceRecord[];
      summary: { totalPunches: number; onTimePunches: number; latePunches: number };
    }>(`/attendance?${dateParam}${branchParam}${typeParam}`);

    if (res.data) {
      setRecords(res.data.records);
      setSummary(res.data.summary);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedBranch, filterDate, filterType]);

  // Filtered Records
  const displayedRecords = records.filter((r) => {
    if (filterLateOnly && !r.isLate) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.user?.fullName?.toLowerCase().includes(q);
      const matchRole = r.user?.role?.toLowerCase().includes(q);
      const matchBranch = r.branch?.name?.toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchBranch) return false;
    }
    return true;
  });

  const pendingPenalties = displayedRecords.filter(
    (r) => r.penalty && r.penalty.status === "PENDING_APPROVAL"
  );
  const pendingPenaltyTotal = pendingPenalties.reduce(
    (sum, r) => sum + Number(r.penalty!.amount),
    0
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Banner & Quick Actions */}
        <div className="bg-gradient-to-r from-[#4A2E1B] via-[#5A3A23] to-[#2C1B10] rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 border border-[#5A3A23]/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-[#E87A18] uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>{l("የሠራተኞች መገኘትና የፊት ስካን ቁጥጥር", "To'annoo Argama Hojjattootaa", "Staff Attendance & Face Verification")}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 font-heading text-white">
              {l("የመገኘት መዝገብ እና የፎቶ ማረጋገጫ", "Galmee Argamaa fi Suuraa", "Attendance Roster & Photo Audit")}
            </h1>
            <p className="text-xs sm:text-sm text-[#E2C7B4] mt-1.5 max-w-2xl leading-relaxed">
              {l(
                "የሠራተኞች የቀጥታ የፊት ስካን መገኘት፣ የፎቶ ማረጋገጫ እና የመዘግየት ቅጣት ማፅደቂያ",
                "Galmee argama hojjattootaa suuraan, to'annoo fuulaa fi mirkaneessa adabbii",
                "Live face scan attendance, photo verification, and tardiness penalty approvals"
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Launch Face Attendance Screen */}
            <Link
              href="/attendance/kiosk"
              target="_blank"
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#E87A18]/30 transition-transform active:scale-95"
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>{l("የፊት ስካን መመዝገቢያ ክፈት", "Galmee Suuraa Bani", "Open Face Attendance")}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
            </Link>

            {/* Owner Penalty Tier Rules */}
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  loadPenaltyConfig();
                  setShowConfigModal(true);
                }}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#FAF7EE] hover:bg-[#FAF6F0] border border-[#EDE4D5] text-[#4A2E1B] font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Settings className="w-4 h-4 text-[#E87A18] shrink-0" />
                <span>{l("የመዘግየት ቅጣት ደንብ", "Qajeelfama Adabbii Turaatii", "Late Penalty Rules")}</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#EDE4D5] shadow-xs">
            <div className="flex items-center justify-between text-[#8C7361] text-xs font-extrabold">
              <span>{l("የዕለቱ አጠቃላይ መግቢያ", "Waliigala Guyyaa", "Total Punches")}</span>
              <Clock className="w-4 h-4 text-[#E87A18]" />
            </div>
            <div className="text-2xl font-black text-[#2C1B10] mt-2 font-heading">{summary.totalPunches}</div>
            <p className="text-[11px] text-[#8C7361] mt-0.5">{filterDate} records</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-xs">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-extrabold">
              <span>{l("በሰዓቱ የገቡ", "Yeroon Kan Seenan", "On-Time Punches")}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-800 mt-2 font-heading">{summary.onTimePunches}</div>
            <p className="text-[11px] text-emerald-600 mt-0.5">
              {summary.totalPunches > 0
                ? `${Math.round((summary.onTimePunches / summary.totalPunches) * 100)}% on time compliance`
                : "No punches"}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs">
            <div className="flex items-center justify-between text-amber-800 text-xs font-extrabold">
              <span>{l("የዘገዩ (Tardy)", "Kan Turan", "Tardy Punches")}</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-900 mt-2 font-heading">{summary.latePunches}</div>
            <p className="text-[11px] text-amber-700 mt-0.5">&gt; 30 mins late from scheduled shift</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#EDE4D5] shadow-xs">
            <div className="flex items-center justify-between text-[#8C7361] text-xs font-extrabold">
              <span>{l("ፈረቃ ሁኔታ", "Haala Hojii", "Active Shifts")}</span>
              <Building2 className="w-4 h-4 text-[#4A2E1B]" />
            </div>
            <div className="text-xs font-bold text-[#4A2E1B] mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-700">
                  <Sun className="w-3.5 h-3.5" /> Day Shift:
                </span>
                <span className="font-mono text-[#2C1B10]">06:00 - 18:00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-indigo-700">
                  <Moon className="w-3.5 h-3.5" /> Night Shift:
                </span>
                <span className="font-mono text-[#2C1B10]">21:00 - 06:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#4A2E1B] shrink-0">
              <Filter className="w-4 h-4 text-[#E87A18]" />
              <span>{l("ማጣሪያዎች", "Calaltuu", "Filters")}:</span>
            </div>

            <div className="flex items-center bg-[#FAF7EE] border border-[#EDE4D5] rounded-xl px-3 py-1.5 gap-2 text-xs font-bold">
              <Calendar className="w-3.5 h-3.5 text-[#8C7361]" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-transparent text-[#2C1B10] focus:outline-none cursor-pointer"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#FAF7EE] border border-[#EDE4D5] rounded-xl px-3 py-1.5 text-xs font-bold text-[#2C1B10] focus:outline-none cursor-pointer"
            >
              <option value="">{l("ሁሉም ዓይነት (All Punches)", "Hunda", "All Punch Types")}</option>
              <option value="PUNCH_IN">PUNCH IN (መግቢያ)</option>
              <option value="PUNCH_OUT">PUNCH OUT (መውጫ)</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#4A2E1B] bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 hover:bg-amber-100 transition-colors">
              <input
                type="checkbox"
                checked={filterLateOnly}
                onChange={(e) => setFilterLateOnly(e.target.checked)}
                className="rounded text-[#E87A18] focus:ring-[#E87A18]"
              />
              <span>{l("የዘገዩ ብቻ (Tardy Only)", "Kan Turan Qofa", "Tardy Only")}</span>
            </label>
          </div>

          <div className="flex items-center bg-[#FAF7EE] border border-[#EDE4D5] rounded-xl px-3 py-1.5 gap-2 text-xs w-full md:w-64">
            <Search className="w-4 h-4 text-[#8C7361] shrink-0" />
            <input
              type="text"
              placeholder={l("ሠራተኛ ወይም ቅርንጫፍ ፈልግ...", "Hojjataa barbaadaa...", "Search staff or branch...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[#2C1B10] focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Pending Late Penalties Batch Approval Banner for Owner */}
        {canReviewPenalties && pendingPenalties.length > 0 && (
          <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-900 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="font-black text-sm text-[#2C1B10] flex items-center gap-2 flex-wrap">
                  <span>{l("የባለቤት ውሳኔ የሚጠብቁ የመዘግየት ቅጣቶች", "Adabbiiwwan Turaatii Mirkaneessa Eegaa Jiran", "Pending Late Penalties Awaiting Owner Approval")}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-[#E87A18] text-white font-mono font-black">
                    {pendingPenalties.length}
                  </span>
                </div>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  {l(
                    `ድምር ቅጣት፡ ${pendingPenaltyTotal.toFixed(0)} ብር። የድምፅ ማብራሪያዎችን መስማት ወይም ሁሉንም በአንድ ጊዜ ማጽደቅ ይችላሉ።`,
                    `Waliigala Adabbii: ${pendingPenaltyTotal.toFixed(0)} ETB. Ibsa sagalee dhaggeeffachuu ykn hunda al-tokkotti mirkaneessuu dandeessu.`,
                    `Total: ${pendingPenaltyTotal.toFixed(0)} ETB. Listen to voice explanations or approve all with 1 tap.`
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleBatchApprovePenalties}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] active:scale-95 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>
                {l(
                  `ሁሉንም አጽድቅ (${pendingPenalties.length})`,
                  `Hunda Mirkaneessi (${pendingPenalties.length})`,
                  `Batch Approve All (${pendingPenalties.length})`
                )}
              </span>
            </button>
          </div>
        )}

        {/* Attendance Log Card / Table Container */}
        <div className="bg-white rounded-3xl border border-[#EDE4D5] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#EDE4D5] bg-[#FAF6F0]/60 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black text-[#2C1B10] font-heading flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#E87A18]" />
              <span>{l("የመገኘት ዝርዝር መዝገብ", "Tarree Argamaa", "Attendance Activity Roster")}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#FAF7EE] text-[#4A2E1B] border border-[#EDE4D5] font-mono">
                {displayedRecords.length}
              </span>
            </h2>
            <span className="text-xs text-[#8C7361] font-bold">
              {selectedBranch ? selectedBranch.name : "All Branches"}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#8C7361] text-xs font-bold">
              {l("መረጃዎች እየተጫኑ ነው...", "Fe'amaa jira...", "Loading attendance records...")}
            </div>
          ) : displayedRecords.length === 0 ? (
            <div className="p-12 text-center text-[#8C7361] text-xs font-bold">
              {l("ምንም የመገኘት መዝገብ አልተገኘም", "Galmeen hin jiru", "No attendance records found for this date/filter.")}
            </div>
          ) : (
            <>
              {/* MOBILE TOUCH CARDS: Attendance Roster (block md:hidden) */}
              <div className="block md:hidden divide-y divide-[#EDE4D5]/60 p-3 space-y-3">
                {displayedRecords.map((r) => {
                  const punchDate = new Date(r.punchTime);
                  return (
                    <div key={r.id} className="p-4 rounded-2xl bg-white border border-[#EDE4D5] shadow-2xs space-y-3">
                      {/* Top Row: User Avatar, Name, Role badge & Punch Type */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-[#4A2E1B] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                            {r.user?.fullName?.charAt(0) || "U"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-sm text-[#2C1B10] truncate">{r.user?.fullName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] uppercase tracking-wide">
                                {r.user?.role}
                              </span>
                              <span className="text-[10px] text-[#8C7361] flex items-center gap-1 truncate font-medium">
                                <Building2 className="w-3 h-3 text-[#E87A18] shrink-0" />
                                {r.branch?.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Clock In / Clock Out Badge */}
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            r.type === "PUNCH_IN"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {r.type === "PUNCH_IN" ? "Clock In" : "Clock Out"}
                        </span>
                      </div>

                      {/* Time, Shift, and Date Row */}
                      <div className="flex items-center justify-between text-xs bg-[#FAF6F0]/70 p-2.5 rounded-xl border border-[#EDE4D5]/70">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#2C1B10]">
                            {punchDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                          <span className="text-[10px] text-[#8C7361] font-mono">({r.businessDate})</span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                            r.shift === "NIGHT"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {r.shift === "NIGHT" ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                          {r.shift} SHIFT
                        </span>
                      </div>

                      {/* Media row: Anti-tamper Photo thumbnail & Voice explanation player */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EDE4D5]/60">
                        <div className="flex items-center gap-2">
                          {r.snapshotUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                setViewingSnapshotUrl(r.snapshotUrl);
                                setViewingRecord(r);
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FAF7EE] hover:bg-[#FAF6F0] border border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] transition-colors cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-[#E87A18]" />
                              <span>{l("ፎቶ ይመልከቱ", "Suuraa Ilaali", "View Photo")}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#8C7361] italic">{l("ምስል የለም", "Suuraan hin jiru", "No photo")}</span>
                          )}
                        </div>

                        {r.voiceNoteUrl && (
                          <div className="flex items-center gap-1.5 bg-amber-50/70 px-2 py-1 rounded-xl border border-amber-200/60 max-w-full">
                            <Volume2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <audio
                              controls
                              src={getFileUrl(r.voiceNoteUrl) || ""}
                              className="h-6 w-36 rounded scale-90 origin-left"
                            />
                          </div>
                        )}
                      </div>

                      {/* Compliance Status and Owner Penalty Actions */}
                      <div className="pt-2 border-t border-[#EDE4D5]/60 flex flex-col gap-2">
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          {r.isLate ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3" />
                              {l(`ዘግይቷል (+${r.lateMinutes}ደ)`, `Tureera (+${r.lateMinutes}d)`, `LATE (+${r.lateMinutes}m)`)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              {l("በሰዓቱ ገብቷል", "Yeroon Seene", "ON TIME")}
                            </span>
                          )}

                          {r.penalty && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              r.penalty.status === "PENDING_APPROVAL"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : r.penalty.status === "APPROVED"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}>
                              {r.penalty.status === "PENDING_APPROVAL" && `⏳ ${Number(r.penalty.amount).toFixed(0)} ETB (Pending)`}
                              {r.penalty.status === "APPROVED" && `✓ ${Number(r.penalty.amount).toFixed(0)} ETB (Approved)`}
                              {r.penalty.status === "REJECTED" && `✕ Waived`}
                            </span>
                          )}
                        </div>

                        {/* Owner Actions if penalty is pending */}
                        {canReviewPenalties && r.penalty && r.penalty.status === "PENDING_APPROVAL" && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleApprovePenalty(r.penalty!.id)}
                              className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{l("ቅጣቱን አጽድቅ", "Adabbii Mirkaneessi", "Approve Penalty")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWaivePenalty(r.penalty!.id)}
                              className="flex-1 py-2 rounded-xl bg-[#FAF7EE] hover:bg-[#FAF6F0] border border-[#EDE4D5] text-[#4A2E1B] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5 text-[#8C7361]" />
                              <span>{l("በይቅርታ እለፍ", "Dhiifama Godhi", "Waive")}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE: Attendance Activity Roster (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[760px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF6F0] border-b border-[#EDE4D5] text-[#4A2E1B] font-extrabold uppercase tracking-wider">
                      <th className="py-3 px-4">{l("ሠራተኛ", "Hojjataa", "Staff Member")}</th>
                      <th className="py-3 px-4">{l("ቅርንጫፍ", "Damee", "Branch")}</th>
                      <th className="py-3 px-4">{l("ቀንና ፈረቃ", "Guyyaa fi Garee", "Date & Shift")}</th>
                      <th className="py-3 px-4">{l("ድርጊት", "Gocha", "Action")}</th>
                      <th className="py-3 px-4">{l("የተመዘገበበት ሰዓት", "Sa'aatii", "Punch Time")}</th>
                      <th className="py-3 px-4">{l("የፊት ፎቶና ድምፅ", "Suuraa fi Sagalee", "Face Photo & Voice")}</th>
                      <th className="py-3 px-4">{l("ሁኔታና ቅጣት", "Haala fi Adabbii", "Compliance & Penalty")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDE4D5] font-medium text-[#2C1B10]">
                    {displayedRecords.map((r) => {
                      const punchDate = new Date(r.punchTime);
                      return (
                        <tr key={r.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                          {/* Staff */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-[#4A2E1B] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                {r.user?.fullName?.charAt(0) || "U"}
                              </div>
                              <div>
                                <div className="font-extrabold text-[#2C1B10] text-xs">{r.user?.fullName}</div>
                                <div className="text-[10px] text-[#8C7361] uppercase tracking-wider font-bold">{r.user?.role}</div>
                              </div>
                            </div>
                          </td>

                          {/* Branch */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#2C1B10]">{r.branch?.name}</span>
                            <span className="block text-[10px] text-[#8C7361] font-mono">{r.branch?.code}</span>
                          </td>

                          {/* Date & Shift */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#2C1B10]">{r.businessDate}</div>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded ${
                                r.shift === "NIGHT"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {r.shift === "NIGHT" ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                              {r.shift} SHIFT
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                r.type === "PUNCH_IN"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {r.type === "PUNCH_IN" ? "Clock In" : "Clock Out"}
                            </span>
                          </td>

                          {/* Punch Timestamp */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-[#2C1B10]">
                              {punchDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </div>
                            <div className="text-[10px] text-[#8C7361] font-mono">{punchDate.toLocaleDateString()}</div>
                          </td>

                          {/* Snapshot Thumbnail & Voice Note */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              {r.snapshotUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingSnapshotUrl(r.snapshotUrl);
                                    setViewingRecord(r);
                                  }}
                                  className="relative group w-10 h-10 rounded-xl overflow-hidden border border-[#EDE4D5] shadow-2xs hover:border-[#E87A18] transition-all shrink-0 cursor-pointer"
                                >
                                  <img
                                    src={getFileUrl(r.snapshotUrl) || ""}
                                    alt="Anti-tamper snapshot"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </button>
                              ) : (
                                <span className="text-[10px] text-[#8C7361] italic">{l("ምስል የለም", "Suuraan hin jiru", "No snapshot")}</span>
                              )}

                              {r.voiceNoteUrl && (
                                <div className="flex items-center gap-1">
                                  <audio
                                    controls
                                    src={getFileUrl(r.voiceNoteUrl) || ""}
                                    className="h-6 w-32 rounded scale-90 origin-left"
                                    title="Listen to voice explanation"
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Compliance Status & Owner Penalty Actions */}
                          <td className="py-3.5 px-4">
                            {r.isLate ? (
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                  <AlertTriangle className="w-3 h-3" />
                                  {l(`ዘግይቷል (+${r.lateMinutes}ደ)`, `Tureera (+${r.lateMinutes}d)`, `LATE (+${r.lateMinutes}m)`)}
                                </span>

                                {r.penalty ? (
                                  <div className="space-y-1">
                                    {r.penalty.status === "PENDING_APPROVAL" && (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/10 text-amber-800 border border-amber-300">
                                        ⏳ {l("የባለቤት ውሳኔ በመጠባበቅ ላይ", "Mirkaneessa Eegaa Jira", "Pending Owner Review")} ({Number(r.penalty.amount).toFixed(0)} ETB)
                                      </span>
                                    )}
                                    {r.penalty.status === "APPROVED" && (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/10 text-rose-800 border border-rose-300">
                                        ✓ {l("ቅጣቱ ፀድቋል", "Adabbiin Mirkanaa'e", "Penalty Approved")} ({Number(r.penalty.amount).toFixed(0)} ETB)
                                      </span>
                                    )}
                                    {r.penalty.status === "REJECTED" && (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-800 border border-emerald-300">
                                        ✕ {l("በይቅርታ ታልፏል", "Dhiifama Argatee", "Waived by Owner")}
                                      </span>
                                    )}

                                    {canReviewPenalties && r.penalty.status === "PENDING_APPROVAL" && (
                                      <div className="flex items-center gap-1.5 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleApprovePenalty(r.penalty!.id)}
                                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                                          title={l("ቅጣቱን አጽድቅ", "Adabbii mirkaneessi", "Approve penalty deduction")}
                                        >
                                          <Check className="w-3 h-3" />
                                          {l("አጽድቅ", "Mirkaneessi", "Approve")}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleWaivePenalty(r.penalty!.id)}
                                          className="px-2 py-1 rounded-lg bg-[#FAF7EE] hover:bg-[#FAF6F0] border border-[#EDE4D5] text-[#4A2E1B] text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                                          title={l("በይቅርታ እለፍ", "Dhiifama godhi", "Waive penalty")}
                                        >
                                          <X className="w-3 h-3" />
                                          {l("ይቅር በል", "Dhiisi", "Waive")}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  r.lateMinutes > 30 && (
                                    <span className="block text-[10px] text-[#8C7361] italic">No penalty attached</span>
                                  )
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                {l("በሰዓቱ ገብቷል", "Yeroon Seene", "ON TIME")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Snapshot High-Resolution Modal */}
        {viewingSnapshotUrl && viewingRecord && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-md w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl border border-[#EDE4D5] my-auto">
              <div className="p-4 bg-[#4A2E1B] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#E87A18]" />
                  <span className="text-sm font-black font-heading text-white">
                    {l("የካሜራ ማረጋገጫ ፎቶ", "Suuraa Mirkaneessaa", "Anti-Tamper Facial Snapshot")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewingSnapshotUrl(null);
                    setViewingRecord(null);
                  }}
                  className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center">
                <div className="w-64 h-64 rounded-2xl overflow-hidden border-2 border-[#EDE4D5] shadow-md bg-[#FAF7EE]">
                  <img
                    src={getFileUrl(viewingSnapshotUrl) || ""}
                    alt="Facial capture"
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                </div>

                <div className="mt-4 text-center w-full">
                  <h3 className="text-base font-black text-[#2C1B10]">{viewingRecord.user?.fullName}</h3>
                  <p className="text-xs text-[#8C7361] font-bold">
                    {viewingRecord.user?.role} • {viewingRecord.branch?.name}
                  </p>
                  <p className="text-xs font-mono font-bold text-[#4A2E1B] mt-1">
                    {new Date(viewingRecord.punchTime).toLocaleString()} ({viewingRecord.type})
                  </p>
                  {viewingRecord.isLate && (
                    <p className="text-xs font-black text-amber-800 mt-1 flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Marked Tardy: +{viewingRecord.lateMinutes} mins late from shift start</span>
                    </p>
                  )}

                  {/* Voice Note Audio Recording in Snapshot Modal */}
                  {viewingRecord.voiceNoteUrl && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-2xl border border-amber-200 w-full text-left">
                      <div className="flex items-center gap-2 text-xs font-black text-amber-900 mb-1">
                        <Volume2 className="w-4 h-4 text-amber-700" />
                        <span>{l("የሠራተኛው የድምፅ ማብራሪያ (Voice Explanation)", "Ibsa Sagalee Hojjataa", "Staff Voice Explanation")}</span>
                      </div>
                      <audio controls src={getFileUrl(viewingRecord.voiceNoteUrl) || ""} className="w-full mt-1 rounded-xl" />
                    </div>
                  )}

                  {/* Penalty Status and Owner Actions */}
                  {viewingRecord.penalty && (
                    <div className="mt-3 p-3 bg-[#FAF7EE] rounded-2xl border border-[#EDE4D5] text-left w-full">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#4A2E1B]">Attendance Penalty:</span>
                        <span className="text-xs font-mono font-black text-rose-600">ETB {Number(viewingRecord.penalty.amount).toFixed(2)}</span>
                      </div>
                      <p className="text-[11px] text-[#8C7361] mt-0.5">{viewingRecord.penalty.reason}</p>
                      <div className="mt-2 text-xs font-bold text-[#2C1B10]">
                        Status:{" "}
                        <span className={
                          viewingRecord.penalty.status === "PENDING_APPROVAL"
                            ? "text-amber-700 font-black"
                            : viewingRecord.penalty.status === "APPROVED"
                            ? "text-rose-600 font-black"
                            : "text-emerald-700 font-black"
                        }>
                          {viewingRecord.penalty.status}
                        </span>
                      </div>

                      {canReviewPenalties && viewingRecord.penalty.status === "PENDING_APPROVAL" && (
                        <div className="flex gap-2 mt-3 pt-2 border-t border-[#EDE4D5]">
                          <button
                            type="button"
                            onClick={() => handleApprovePenalty(viewingRecord.penalty!.id)}
                            className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            {l("ቅጣቱን አጽድቅ", "Adabbii Mirkaneessi", "Approve Penalty")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWaivePenalty(viewingRecord.penalty!.id)}
                            className="flex-1 py-2 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            {l("በይቅርታ እለፍ", "Dhiifama Godhi", "Waive Penalty")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-[#FAF6F0] border-t border-[#EDE4D5] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewingSnapshotUrl(null);
                    setViewingRecord(null);
                  }}
                  className="px-6 py-2 rounded-xl bg-[#4A2E1B] text-white font-black text-xs hover:bg-[#382214] cursor-pointer"
                >
                  {l("ዝጋ", "Cufi", "Close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Owner Penalty Tier Rules Modal */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl border border-[#EDE4D5] my-auto">
              <div className="p-4 bg-[#4A2E1B] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#E87A18]" />
                  <span className="text-sm font-black font-heading text-white">
                    {l("የመዘግየት ቅጣት ተመን ደንብ", "Qajeelfama Adabbii Turaatii", "Late Penalty Tier Rules & Thresholds")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="p-1 rounded-full hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePenaltyConfig} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <p className="text-xs text-[#8C7361] font-medium leading-relaxed">
                  {l(
                    "ባለቤቱ የመግቢያ ሰዓት ገደብ እና የመዘግየት ቅጣት ተመን ማስተካከል ይችላል። የሚጣል ማንኛውም ቅጣት በባለቤቱ ወይም በአስተዳዳሪው ሲፀድቅ ወደ ቅጣት መዝገብ ይገባል።",
                    "Abbaan qabeenyaa yeroo seensaa fi sadarkaa adabbii jijjiiruu danda'a.",
                    "Configure check-in time ranges for each shift and tiered late penalty amounts. Issued penalties are registered upon Owner/Admin acceptance."
                  )}
                </p>

                {/* Day Shift Check-In Time Range */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#FAF7EE] rounded-2xl border border-[#EDE4D5]">
                  <div className="col-span-2 text-xs font-black text-[#2C1B10] flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-[#E87A18]" />
                    <span>{l("የቀን ፈረቃ የመግቢያ ሰዓት (Day Check-In Range)", "Yeroo Seensa Guyyaa", "Day Shift Check-In Window")}</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A2E1B] mb-1">
                      {l("መጀመሪያ ሰዓት (Start)", "Jalqaba", "Window Start")}
                    </label>
                    <input
                      type="time"
                      value={penaltyConfig.dayCheckInStart}
                      onChange={(e) => setPenaltyConfig({ ...penaltyConfig, dayCheckInStart: e.target.value })}
                      className="w-full p-2 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A2E1B] mb-1">
                      {l("መጨረሻ ሰዓት / በሰዓቱ (End)", "Xumura", "On-Time Cutoff")}
                    </label>
                    <input
                      type="time"
                      value={penaltyConfig.dayCheckInEnd}
                      onChange={(e) => setPenaltyConfig({ ...penaltyConfig, dayCheckInEnd: e.target.value })}
                      className="w-full p-2 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  </div>
                </div>

                {/* Night Shift Check-In Time Range */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-200/80">
                  <div className="col-span-2 text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{l("የማታ ፈረቃ የመግቢያ ሰዓት (Night Check-In Range)", "Yeroo Seensa Halkanii", "Night Shift Check-In Window")}</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A2E1B] mb-1">
                      {l("መጀመሪያ ሰዓት (Start)", "Jalqaba", "Window Start")}
                    </label>
                    <input
                      type="time"
                      value={penaltyConfig.nightCheckInStart}
                      onChange={(e) => setPenaltyConfig({ ...penaltyConfig, nightCheckInStart: e.target.value })}
                      className="w-full p-2 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A2E1B] mb-1">
                      {l("መጨረሻ ሰዓት / በሰዓቱ (End)", "Xumura", "On-Time Cutoff")}
                    </label>
                    <input
                      type="time"
                      value={penaltyConfig.nightCheckInEnd}
                      onChange={(e) => setPenaltyConfig({ ...penaltyConfig, nightCheckInEnd: e.target.value })}
                      className="w-full p-2 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200">
                  <div className="sm:col-span-2 text-xs font-black text-amber-950">
                    {l("ደረጃ 1 ቅጣት (1 – N ደቂቃ መዘግየት)", "Adabbii Sadarkaa 1", "Tier 1 Penalty (1 to N mins past cutoff)")}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A2E1B] mb-1">
                      {l("እስከ ደቂቃ (Max Mins)", "Hanga Daqiiqaa", "Up to (Minutes Late)")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={penaltyConfig.tier1Minutes}
                      onChange={(e) => setPenaltyConfig({ ...penaltyConfig, tier1Minutes: parseInt(e.target.value) || 1 })}
                      className="w-full p-2 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A2E1B] mb-1">
                      {l("የቅጣት መጠን (ETB)", "Hanga Adabbii (ETB)", "Penalty Fee (ETB)")}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={penaltyConfig.tier1Amount}
                      onChange={(e) => setPenaltyConfig({ ...penaltyConfig, tier1Amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-rose-50/60 rounded-2xl border border-rose-200">
                  <div className="sm:col-span-2 text-xs font-black text-rose-950">
                    {l(`ደረጃ 2 ቅጣት (ከ ${penaltyConfig.tier1Minutes + 1}+ ደቂቃ በላይ መዘግየት)`, "Adabbii Sadarkaa 2", `Tier 2 Penalty (${penaltyConfig.tier1Minutes + 1}+ mins past cutoff)`)}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A2E1B] mb-1">
                      {l("መለኪያ ደቂቃ", "Daqiiqaa", "Reference Threshold (Mins)")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={penaltyConfig.tier2Minutes}
                      onChange={(e) => setPenaltyConfig({ ...penaltyConfig, tier2Minutes: parseInt(e.target.value) || 1 })}
                      className="w-full p-2 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#4A2E1B] mb-1">
                      {l("የቅጣት መጠን (ETB)", "Hanga Adabbii (ETB)", "Penalty Fee (ETB)")}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={penaltyConfig.tier2Amount}
                      onChange={(e) => setPenaltyConfig({ ...penaltyConfig, tier2Amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#EDE4D5] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#FAF7EE] text-[#4A2E1B] border border-[#EDE4D5] font-bold text-xs hover:bg-[#FAF6F0] cursor-pointer text-center"
                  >
                    {l("ሰርዝ", "Dhiisi", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={configSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] text-white font-black text-xs transition-colors cursor-pointer text-center shadow-xs"
                  >
                    {configSubmitting ? l("በመመዝገብ ላይ...", "Galmaa'aa jira...", "Saving...") : l("ደንቡን መዝግብ", "Qajeelfama Galmeessi", "Save Penalty Rules")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {ConfirmModalComponent}
      </div>
    </DashboardLayout>
  );
}
