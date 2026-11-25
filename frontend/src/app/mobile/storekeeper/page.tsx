"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { apiRequest } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmModal";
import {
  ArrowLeft,
  Boxes,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  PackagePlus,
  UserCheck,
  Edit3,
  Search,
  History,
  ShieldAlert,
  Loader2,
  Check,
  X,
  Tag,
  AlertCircle,
} from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  nameLatin?: string | null;
  category?: string | null;
  unitType: string;
  currentQuantity: number;
  unitPrice?: number;
  minStockLevel?: number;
}

interface StaffUser {
  id: string;
  fullName: string;
  role: string;
  phone: string;
  branchId?: string | null;
}

interface MovementLog {
  id: string;
  stockItemId: string;
  type: string;
  quantity: number;
  receivedBy?: string | null;
  reason?: string | null;
  createdAt: string;
  stockItem?: { name: string; unitType: string };
  user?: { fullName: string; role: string };
}

export default function MobileStorekeeperPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { l, language } = useLanguage();
  const { selectedBranchId, branches } = useBranch();
  const { confirm, ConfirmModalComponent } = useConfirm();

  const [activeTab, setActiveTab] = useState<"INTAKE" | "DISBURSE" | "CORRECT" | "OVERVIEW">("DISBURSE");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [branchStaff, setBranchStaff] = useState<StaffUser[]>([]);
  const [recentMovements, setRecentMovements] = useState<MovementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Intake State (Add new bought/imported stock)
  const [intakeItemId, setIntakeItemId] = useState<string>("");
  const [intakeQty, setIntakeQty] = useState<string>("10");
  const [intakeUnitPrice, setIntakeUnitPrice] = useState<string>("");
  const [intakeSupplier, setIntakeSupplier] = useState<string>("");
  const [intakeReason, setIntakeReason] = useState<string>("");

  // 2. Disbursement State (Issue raw material to worker)
  const [disburseItemId, setDisburseItemId] = useState<string>("");
  const [disburseQty, setDisburseQty] = useState<string>("1");
  const [disburseWorkerId, setDisburseWorkerId] = useState<string>("");
  const [customWorkerName, setCustomWorkerName] = useState<string>("");
  const [disburseReason, setDisburseReason] = useState<string>("");

  // 3. Correction / Edit State (Accidental count correction)
  const [correctingItem, setCorrectingItem] = useState<StockItem | null>(null);
  const [correctedCount, setCorrectedCount] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState<string>("");

  // Overview Search
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const loadData = async () => {
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const bid = user?.branchId || selectedBranchId;
      const branchParam = bid ? `?branchId=${bid}` : "";

      const [stockRes, usersRes, movementsRes] = await Promise.all([
        apiRequest<any>(`/stock-items${branchParam}`),
        apiRequest<any>(`/users${branchParam}`),
        apiRequest<any>(`/stock-movements${branchParam}&limit=15`),
      ]);

      const items: StockItem[] = Array.isArray(stockRes.data)
        ? stockRes.data
        : stockRes.data?.data || stockRes.data?.items || [];
      setStockItems(items);

      if (items.length > 0) {
        if (!intakeItemId) setIntakeItemId(items[0].id);
        if (!disburseItemId) setDisburseItemId(items[0].id);
      }

      const rawStaff: StaffUser[] = Array.isArray(usersRes.data)
        ? usersRes.data
        : usersRes.data?.users || [];
      // Filter production workers and staff
      const workers = rawStaff.filter(
        (u) => u.id !== user?.id && u.role !== "OWNER"
      );
      setBranchStaff(workers);
      if (workers.length > 0 && !disburseWorkerId) {
        setDisburseWorkerId(workers[0].id);
      }

      const moves: MovementLog[] = Array.isArray(movementsRes.data)
        ? movementsRes.data
        : movementsRes.data?.data || movementsRes.data?.list || [];
      setRecentMovements(moves);
    } catch (e: any) {
      console.error("Failed to load storehouse data", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedBranchId]);

  // Selected Item Helpers
  const selectedIntakeItem = stockItems.find((i) => i.id === intakeItemId);
  const selectedDisburseItem = stockItems.find((i) => i.id === disburseItemId);

  // 1. Submit Stock Intake (Add stock -> notifies Owner)
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeItemId || !intakeQty || parseFloat(intakeQty) <= 0) {
      setStatusMsg({ type: "error", text: l("እባክዎ ትክክለኛ የዕቃ መጠን ያስገቡ", "Madaallii sirrii galchaa", "Please enter a valid quantity") });
      return;
    }

    const item = selectedIntakeItem;
    const ok = await confirm({
      title: l("የጥሬ ዕቃ ገቢ ማረጋገጫ", "Mirkaneessa Galii Meeshaa", "Confirm Raw Material Intake"),
      message: l(
        `${intakeQty} ${item?.unitType || ""} '${item?.name || "Item"}' ወደ መጋዘን ገቢ መሆኑን ያረጋግጣሉ? ይህ መረጃ ወዲያውኑ ለድርጅቱ ባለቤት በማሳወቂያ ይላካል።`,
        `${intakeQty} '${item?.name}' gara kuusaatti galuu isaa mirkaneessituu? Abbaa qabeenyaaf beeksisni ni ergama.`,
        `Confirm intake of ${intakeQty} ${item?.unitType || ""} of '${item?.name}'? An automated notification will be dispatched to the Business Owner.`
      ),
      variant: "info",
      confirmText: l("ገቢ መዝግብ", "Galmeessi", "Record Intake"),
    });
    if (!ok) return;

    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await apiRequest("/stock-movements", {
        method: "POST",
        body: JSON.stringify({
          stockItemId: intakeItemId,
          quantity: parseFloat(intakeQty),
          unitPrice: intakeUnitPrice ? parseFloat(intakeUnitPrice) : item?.unitPrice || 0,
          type: "IN",
          reason: intakeReason.trim() || (intakeSupplier.trim() ? `Purchase from ${intakeSupplier.trim()}` : "Storehouse raw material intake"),
          autoConfirm: true,
        }),
      });

      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: l(
            "የጥሬ ዕቃ ገቢ በተሳካ ሁኔታ ተመዝግቧል! ለባለቤቱ ማሳወቂያ ተልኳል።",
            "Galiin meeshaa galmaa'eera! Abbaa qabeenyaaf ergamera.",
            "Stock intake recorded successfully! Owner has been notified."
          ),
        });
        setIntakeQty("10");
        setIntakeReason("");
        setIntakeSupplier("");
        loadData();
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to submit intake" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Submit Material Issuance (Deduct & Tag Worker)
  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyToGive = parseFloat(disburseQty);
    if (!disburseItemId || isNaN(qtyToGive) || qtyToGive <= 0) {
      setStatusMsg({ type: "error", text: l("እባክዎ የሚሰጠውን ትክክለኛ መጠን ያስገቡ", "Hanga sirrii galchaa", "Please enter a valid disbursement quantity") });
      return;
    }

    const item = selectedDisburseItem;
    if (item && qtyToGive > Number(item.currentQuantity)) {
      setStatusMsg({
        type: "error",
        text: l(
          `በቂ ክምችት የለም! በመጋዘን ያለው፡ ${item.currentQuantity} ${item.unitType}`,
          `Kuusaa gahaa hin qabu! Kan jiru: ${item.currentQuantity} ${item.unitType}`,
          `Insufficient stock! In store: ${item.currentQuantity} ${item.unitType}`
        ),
      });
      return;
    }

    // Resolve tagged worker
    let taggedWorkerName = "";
    if (disburseWorkerId && disburseWorkerId !== "OTHER") {
      const staff = branchStaff.find((s) => s.id === disburseWorkerId);
      if (staff) {
        taggedWorkerName = `${staff.fullName} (${staff.role})`;
      }
    } else {
      taggedWorkerName = customWorkerName.trim();
    }

    if (!taggedWorkerName) {
      setStatusMsg({ type: "error", text: l("እባክዎ ጥሬ ዕቃውን የሚወስደውን ሠራተኛ ይምረጡ ወይም ስም ያስገቡ", "Hojjataa meeshaa fudhatu filadhaa", "Please tag the worker receiving the materials") });
      return;
    }

    const ok = await confirm({
      title: l("ጥሬ ዕቃ ለሠራተኛ ማውጣት", "Meeshaa Hojjataaf Kennuu", "Confirm Material Issuance"),
      message: l(
        `${qtyToGive} ${item?.unitType || ""} '${item?.name || "Item"}' ለ '${taggedWorkerName}' ወጪ እንዲሆን ያረጋግጣሉ? ከመጋዘኑ ክምችት ተቀናሽ ይደረጋል።`,
        `${qtyToGive} '${item?.name}' '${taggedWorkerName}'-f kennuun kuusaa irraa akka hir'atu mirkaneessituu?`,
        `Issue ${qtyToGive} ${item?.unitType || ""} of '${item?.name}' to ${taggedWorkerName}? Warehouse stock will be decremented.`
      ),
      variant: "info",
      confirmText: l("ወጪ አድርግ", "Kenni", "Issue & Deduct"),
    });
    if (!ok) return;

    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await apiRequest("/stock-movements", {
        method: "POST",
        body: JSON.stringify({
          stockItemId: disburseItemId,
          quantity: qtyToGive,
          type: "OUT",
          receivedBy: taggedWorkerName,
          reason: disburseReason.trim() || `Issued to ${taggedWorkerName}`,
          autoConfirm: true,
        }),
      });

      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: l(
            `ጥሬ ዕቃው ለ '${taggedWorkerName}' ወጪ ተደርጓል፤ ከመጋዘን ተቀናንሷል!`,
            `Meeshaan '${taggedWorkerName}'-f kennameera!`,
            `Material issued to ${taggedWorkerName} and decremented from warehouse!`
          ),
        });
        setDisburseQty("1");
        setDisburseReason("");
        setCustomWorkerName("");
        loadData();
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to issue material" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Accidental Stock Count Correction (Edit -> Warning + Owner Notification)
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingItem) return;

    const newTarget = parseFloat(correctedCount);
    if (isNaN(newTarget) || newTarget < 0) {
      setStatusMsg({ type: "error", text: l("እባክዎ ትክክለኛ የቁጥር መጠን ያስገቡ", "Lakkofsa sirrii galchaa", "Please enter a valid count") });
      return;
    }

    if (!correctionReason.trim()) {
      setStatusMsg({
        type: "error",
        text: l("እባክዎ የስህተቱን ምክንያት በግልጽ ያስመዝግቡ", "Sababa sirreeffamaa galchaa", "Please state the reason for correcting the stock count"),
      });
      return;
    }

    const current = Number(correctingItem.currentQuantity);
    const delta = newTarget - current;
    const ok = await confirm({
      title: l("የክምችት ስህተት ማስተካከያ ማረጋገጫ", "Mirkaneessa Sirreeffama Kuusaa", "Confirm Stock Count Correction"),
      message: l(
        `'${correctingItem.name}' መጠን ከ ${current} ወደ ${newTarget} ${correctingItem.unitType} (ልዩነት: ${delta > 0 ? `+${delta}` : delta}) ማስተካከል ይፈልጋሉ? ይህ የስህተት ማስተካከያ በቀጥታ ለድርጅቱ ባለቤት በኦዲት ማሳወቂያ ይላካል።`,
        `Kuusaa '${correctingItem.name}' ${current} irraa gara ${newTarget} jijjiiruu barbaadduu? Beeksisni ooditii abbaa qabeenyaaf ni ergama.`,
        `Correct '${correctingItem.name}' from ${current} to ${newTarget} ${correctingItem.unitType} (${delta > 0 ? `+${delta}` : delta})? This correction triggers an urgent audit alert to the Business Owner.`
      ),
      variant: "warning",
      confirmText: l("አስተካክልና ለባለቤቱ አሳውቅ", "Sirreessi fi Beeksisi", "Apply Correction & Notify Owner"),
    });
    if (!ok) return;

    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await apiRequest("/stock-movements", {
        method: "POST",
        body: JSON.stringify({
          stockItemId: correctingItem.id,
          type: "ADJUSTMENT",
          quantity: Math.abs(delta),
          adjustTo: newTarget,
          reason: `Accidental entry correction: ${correctionReason.trim()}`,
        }),
      });

      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: l(
            "የክምችት መጠኑ ተስተካክሏል፤ ለድርጅቱ ባለቤት የኦዲት ማሳወቂያ ተልኳል!",
            "Kuusaan sirreeffameera; abbaa qabeenyaaf beeksifameera!",
            "Stock quantity corrected and audit alert dispatched to the Business Owner!"
          ),
        });
        setCorrectingItem(null);
        setCorrectedCount("");
        setCorrectionReason("");
        loadData();
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Correction failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = stockItems.filter((i) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.category && i.category.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-[#2C1B10] flex flex-col justify-between pb-10">
      {/* Top Header */}
      <div className="bg-[#FFFDF8] border-b border-[#EDE4D5] p-4 sticky top-0 z-20 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/mobile"
            className="p-2.5 rounded-xl bg-[#FAF7EE] hover:bg-[#F4ECE1] text-[#4A2E1B] border border-[#EDE4D5] transition-all shrink-0"
            title="Back to Stations"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-extrabold text-base tracking-tight text-[#4A2E1B] flex items-center gap-1.5 truncate">
              <Boxes className="w-4 h-4 text-[#E87A18] shrink-0" />
              <span className="truncate">{l("የዕቃ ቤትና ጥሬ ዕቃ ጣቢያ", "Iddoo Kuusaa Meeshaalee", "Storekeeper Station")}</span>
            </h1>
            <p className="text-[11px] text-[#8C7361] font-semibold flex items-center gap-1 truncate">
              <Building2 className="w-3 h-3 text-[#E87A18] shrink-0" />
              <span className="truncate">
                {user?.branch?.name || (branches.find((b) => b.id === selectedBranchId)?.name ?? "Central Hub Store")}
              </span>
            </p>
          </div>
        </div>

        <Link
          href="/stock"
          className="px-3 py-1.5 rounded-xl bg-[#FAF7EE] hover:bg-[#FAF6F0] border border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] shrink-0 flex items-center gap-1"
        >
          <span>{l("ዴስክቶፕ", "Desktop", "Desktop")}</span>
        </Link>
      </div>

      {/* Main Container */}
      <div className="p-3.5 sm:p-5 flex-1 max-w-xl mx-auto w-full space-y-4">
        {/* Status Message Banner */}
        {statusMsg && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold border flex items-center gap-2.5 shadow-2xs ${
              statusMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="flex-1 break-words">{statusMsg.text}</span>
            <button type="button" onClick={() => setStatusMsg(null)} className="p-1 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4-Tab Navigation Bar */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#EDE4D5]/70 rounded-2xl shadow-2xs text-xs font-extrabold">
          <button
            type="button"
            onClick={() => {
              setActiveTab("DISBURSE");
              setStatusMsg(null);
            }}
            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "DISBURSE"
                ? "bg-[#4A2E1B] text-white shadow-xs"
                : "text-[#8C7361] hover:text-[#2C1B10]"
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
            <span className="text-[10px] leading-tight truncate w-full">{l("ለሠራተኛ ማውጫ", "Hojjataaf", "Issue to Worker")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("INTAKE");
              setStatusMsg(null);
            }}
            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "INTAKE"
                ? "bg-[#4A2E1B] text-white shadow-xs"
                : "text-[#8C7361] hover:text-[#2C1B10]"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[10px] leading-tight truncate w-full">{l("ዕቃ ገቢ", "Galii", "Add Stock")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("CORRECT");
              setStatusMsg(null);
            }}
            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "CORRECT"
                ? "bg-[#4A2E1B] text-white shadow-xs"
                : "text-[#8C7361] hover:text-[#2C1B10]"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="text-[10px] leading-tight truncate w-full">{l("ስህተት ማረም", "Sirreessi", "Edit Count")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("OVERVIEW");
              setStatusMsg(null);
            }}
            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-0.5 transition-all ${
              activeTab === "OVERVIEW"
                ? "bg-[#4A2E1B] text-white shadow-xs"
                : "text-[#8C7361] hover:text-[#2C1B10]"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span className="text-[10px] leading-tight truncate w-full">{l("ክምችት", "Kuusaa", "Inventory")}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-[#8C7361] flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#E87A18]" />
            <span className="text-xs font-bold">{l("የመጋዘን መረጃ በመጫን ላይ...", "Kuusaan fe'amaa jira...", "Loading warehouse data...")}</span>
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* TAB 1: DISBURSE (Deduct Raw Material & Tag Worker)        */}
            {/* ======================================================== */}
            {activeTab === "DISBURSE" && (
              <form onSubmit={handleDisburseSubmit} className="bg-white rounded-3xl p-4 sm:p-6 border border-[#EDE4D5] shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#FAF6F0]">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-[#4A2E1B] flex items-center justify-center font-bold">
                    <Minus className="w-5 h-5 text-[#E87A18]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#2C1B10]">{l("ጥሬ ዕቃ ለሠራተኛ ማውጫ ቫውቸር", "Baasii Meeshaa Dheedaa", "Issue Raw Materials to Worker")}</h2>
                    <p className="text-[11px] text-[#8C7361]">{l("የተሰጠውን ጥሬ ዕቃ ይቀንሱ፤ የተቀበለውን ጋጋሪ ወይም ባለሙያ በስም ይምረጡ", "Meeshaa hojjataaf kenne hir'isi; hojjataa filadhu", "Deduct raw materials and tag the receiving baker / worker")}</p>
                  </div>
                </div>

                {/* 1. Select Raw Material */}
                <div>
                  <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                    {l("ጥሬ ዕቃ ይምረጡ", "Meeshaa Dheedaa Filadhaa", "Select Raw Material")} *
                  </label>
                  <select
                    value={disburseItemId}
                    onChange={(e) => setDisburseItemId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE] text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
                    required
                  >
                    {stockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — ({l("ክምችት", "Kuusaa", "Available")}: {Number(item.currentQuantity).toLocaleString()} {item.unitType})
                      </option>
                    ))}
                  </select>
                  {selectedDisburseItem && (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[#8C7361] px-1 font-semibold">
                      <span>{l("የአሁን የመጋዘን ክምችት", "Kuusaa Ammaa", "Current Storehouse Stock")}:</span>
                      <span className="font-mono font-extrabold text-[#2C1B10]">
                        {Number(selectedDisburseItem.currentQuantity).toLocaleString()} {selectedDisburseItem.unitType}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Quantity to Disburse */}
                <div>
                  <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                    {l("የሚሰጠው መጠን (የሚቀነሰው)", "Hanga Kennamu", "Quantity to Issue & Deduct")} *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={disburseQty}
                      onChange={(e) => setDisburseQty(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full p-2.5 bg-[#FAF7EE] rounded-xl border border-[#EDE4D5] font-mono font-bold text-sm text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                      required
                    />
                    <span className="px-3 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] shrink-0">
                      {selectedDisburseItem?.unitType || "Units"}
                    </span>
                  </div>
                  {/* Quick increment buttons */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[1, 2, 5, 10, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDisburseQty(String(num))}
                        className="px-2.5 py-1 rounded-lg bg-[#FAF7EE] hover:bg-[#FAF6F0] border border-[#EDE4D5] text-[10px] font-bold text-[#4A2E1B] transition-colors"
                      >
                        +{num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Explicit Worker Tagging (CRITICAL REQUIREMENT) */}
                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#4A2E1B]">
                    <UserCheck className="w-4 h-4 text-[#E87A18]" />
                    <span>{l("ጥሬ ዕቃውን የተቀበለው ሠራተኛ (Tag Recipient)", "Hojjataa Meeshaa Fudhate", "Tag Recipient Worker")} *</span>
                  </div>

                  <select
                    value={disburseWorkerId}
                    onChange={(e) => setDisburseWorkerId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#EDE4D5] bg-white text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
                    required
                  >
                    {branchStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName} — [{staff.role}]
                      </option>
                    ))}
                    <option value="OTHER">{l("-- ሌላ ሰው / ልዩ ማብራሪያ --", "-- Kan Biraa --", "-- Other Staff / Custom Name --")}</option>
                  </select>

                  {disburseWorkerId === "OTHER" && (
                    <input
                      type="text"
                      value={customWorkerName}
                      onChange={(e) => setCustomWorkerName(e.target.value)}
                      placeholder={l("የተቀባዩን ሙሉ ስም እና የሥራ ድርሻ ያስገቡ...", "Maqaa hojjataa galchaa...", "Enter recipient full name and role...")}
                      className="w-full p-2.5 bg-white rounded-xl border border-[#EDE4D5] font-bold text-xs text-[#2C1B10]"
                      required
                    />
                  )}

                  <p className="text-[10px] text-[#8C7361] leading-tight">
                    {l(
                      "የተመዘገበው ሠራተኛ ስም በክምችት ወጪ መዝገብ ላይ በቋሚነት ይቀመጣል።",
                      "Maqaan hojjataa meeshaa fudhatee galmee irratti ni qabama.",
                      "The tagged worker name is permanently recorded in the warehouse movement audit log."
                    )}
                  </p>
                </div>

                {/* 4. Purpose / Note */}
                <div>
                  <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                    {l("የወጪ ምክንያት / ማስታወሻ (አማራጭ)", "Sababa Baasii", "Reason / Production Batch Note (Optional)")}
                  </label>
                  <input
                    type="text"
                    value={disburseReason}
                    onChange={(e) => setDisburseReason(e.target.value)}
                    placeholder={l("ለምሳሌ፡ ለጠዋት ፈረቃ ዳቦ ጋጋሪዎች የተሰጠ", "Fkn: Garee ganamaaf kan kenname", "e.g. Morning bread shift batch")}
                    className="w-full p-2.5 bg-[#FAF7EE] rounded-xl border border-[#EDE4D5] text-xs font-bold text-[#2C1B10]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-[#E87A18] hover:bg-[#D96B10] active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Minus className="w-4 h-4" />
                      <span>{l("ወጪ መዝግብና ከመጋዘን ቀንሥ", "Kenni fi Hir'isi", "Issue to Worker & Decrement Stock")}</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* TAB 2: INTAKE (Add Stock -> Notifies Owner)               */}
            {/* ======================================================== */}
            {activeTab === "INTAKE" && (
              <form onSubmit={handleIntakeSubmit} className="bg-white rounded-3xl p-4 sm:p-6 border border-[#EDE4D5] shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#FAF6F0]">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#2C1B10]">{l("አዲስ የተገዛ ጥሬ ዕቃ ገቢ ማድረጊያ", "Galii Meeshaa Haaraa", "Raw Material Purchase & Intake")}</h2>
                    <p className="text-[11px] text-[#8C7361]">{l("ከውጭ የመጣ ወይም የተገዛ ጥሬ ዕቃ ወደ መጋዘን ይጨምሩ", "Meeshaa bitame gara kuusaatti dabalaa", "Add bought or delivered raw products to warehouse")}</p>
                  </div>
                </div>

                {/* Owner Notification Advisory Banner */}
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-[#E87A18] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 leading-relaxed font-bold">
                    {l(
                      "ማስታወሻ፡ አዲስ ገቢ ሲመዘገብ ለድርጅቱ ባለቤት አፋጣኝ ማሳወቂያ በቀጥታ ይላካል!",
                      "Hubachiisa: Galiin haaraan yeroo galmaa'u abbaa qabeenyaaf yeruma san beeksisni ni ergama!",
                      "Notice: Logging stock additions automatically dispatches an immediate notification to the Business Owner!"
                    )}
                  </p>
                </div>

                {/* 1. Select Raw Material */}
                <div>
                  <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                    {l("ጥሬ ዕቃ ይምረጡ", "Meeshaa Dheedaa Filadhaa", "Select Raw Material")} *
                  </label>
                  <select
                    value={intakeItemId}
                    onChange={(e) => setIntakeItemId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE] text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
                    required
                  >
                    {stockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — [{Number(item.currentQuantity).toLocaleString()} {item.unitType}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Quantity Added */}
                <div>
                  <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                    {l("የተገዛ / የገባ መጠን", "Hanga Bitame", "Quantity Added / Bought")} *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={intakeQty}
                      onChange={(e) => setIntakeQty(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full p-2.5 bg-[#FAF7EE] rounded-xl border border-[#EDE4D5] font-mono font-bold text-sm text-[#2C1B10]"
                      required
                    />
                    <span className="px-3 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] shrink-0">
                      {selectedIntakeItem?.unitType || "Units"}
                    </span>
                  </div>
                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[10, 20, 50, 100].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setIntakeQty(String(num))}
                        className="px-2.5 py-1 rounded-lg bg-[#FAF7EE] hover:bg-[#FAF6F0] border border-[#EDE4D5] text-[10px] font-bold text-[#4A2E1B]"
                      >
                        +{num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Unit Buy Price (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                    {l("የአንዱ መግዣ ዋጋ (ETB) - አማራጭ", "Gatii Bitame (ETB)", "Unit Purchase Price (ETB) - Optional")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={intakeUnitPrice}
                    onChange={(e) => setIntakeUnitPrice(e.target.value)}
                    placeholder={selectedIntakeItem?.unitPrice ? String(selectedIntakeItem.unitPrice) : "0.00"}
                    className="w-full p-2.5 bg-[#FAF7EE] rounded-xl border border-[#EDE4D5] text-xs font-bold text-[#2C1B10]"
                  />
                </div>

                {/* 4. Supplier / Delivery Source */}
                <div>
                  <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                    {l("አቅራቢ / መገኛ (Supplier / Source)", "Madda Meeshaa", "Supplier / Delivery Source")}
                  </label>
                  <input
                    type="text"
                    value={intakeSupplier}
                    onChange={(e) => setIntakeSupplier(e.target.value)}
                    placeholder={l("ለምሳሌ፡ ቦሌ ዱቄት ፋብሪካ ወይም ከገበያ", "Fkn: Faabrikaa Daakuu Boolee", "e.g. Bole Flour Silos, Wholesale Market")}
                    className="w-full p-2.5 bg-[#FAF7EE] rounded-xl border border-[#EDE4D5] text-xs font-bold text-[#2C1B10]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{l("ገቢ መዝግብና ለባለቤቱ አሳውቅ", "Galchi fi Beeksisi", "Record Intake & Notify Owner")}</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* TAB 3: CORRECT / EDIT (Accidental Count Correction)      */}
            {/* ======================================================== */}
            {activeTab === "CORRECT" && (
              <div className="space-y-4">
                {/* PROMINENT MANDATORY ADVISORY ALERT FOR STOREKEEPER */}
                <div className="p-4 bg-amber-500/15 border-2 border-amber-500/40 rounded-3xl space-y-1.5 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wide">
                    <ShieldAlert className="w-4 h-4 text-[#E87A18] shrink-0" />
                    <span>{l("ማስጠንቀቂያ ለዕቃ ቤት ኃላፊ", "Akeekkachiisa Kuusaa", "Storekeeper Audit Advisory Notice")}</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed font-bold">
                    {l(
                      "የክምችት መጠን በቀጥታ ማስተካከል በሲስተሙ ኦዲት ላይ ይመዘገባል፤ ማስተካከያው እንደተደረገም ለድርጅቱ ባለቤት አፋጣኝ ማሳወቂያ ይላካል። እባክዎ የስህተቱን ምክንያት በግልጽ ያስመዝግቡ።",
                      "Kuusaa sirreessuun yeruma san abbaa qabeenyaaf akka beeksisamuu fi ooditii ta'u hubadhaa. Sababa sirreeffamaa ifatti galchaa.",
                      "Notice: Directly editing stock quantities is strictly audited. An immediate alert will be dispatched to the Business Owner detailing the old count, new count, and your explanation."
                    )}
                  </p>
                </div>

                {/* If item is selected for correction, show correction form */}
                {correctingItem ? (
                  <form onSubmit={handleCorrectionSubmit} className="bg-white rounded-3xl p-4 sm:p-6 border border-[#EDE4D5] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#FAF6F0]">
                      <div>
                        <h3 className="text-sm font-black text-[#2C1B10]">{correctingItem.name}</h3>
                        <p className="text-xs text-[#8C7361] font-semibold">
                          {l("የአሁን የተመዘገበ መጠን", "Hanga Ammaa", "Current Recorded Count")}: <strong className="text-[#4A2E1B]">{Number(correctingItem.currentQuantity).toLocaleString()} {correctingItem.unitType}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCorrectingItem(null)}
                        className="p-1 rounded-xl bg-[#FAF7EE] text-[#8C7361] hover:text-[#2C1B10]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                        {l("ትክክለኛው የክምችት መጠን (የተስተካከለ)", "Hanga Sirrii", "Corrected Actual Stock Count")} *
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={correctedCount}
                          onChange={(e) => setCorrectedCount(e.target.value)}
                          placeholder="e.g. 45"
                          className="w-full p-2.5 bg-[#FAF7EE] rounded-xl border border-[#EDE4D5] font-mono font-bold text-sm text-[#2C1B10]"
                          required
                        />
                        <span className="px-3 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] shrink-0">
                          {correctingItem.unitType}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
                        {l("የስህተት ማረሚያው ምክንያት", "Sababa Sirreeffamaa", "Reason for Correction")} *
                      </label>
                      <textarea
                        rows={2}
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                        placeholder={l("ለምሳሌ፡ ሳልፈልግ የተሳሳተ ቁጥር አስገብቼ ስለነበር (Accidental wrong entry)", "Fkn: Dogoggoraan lakkofsa biraa galchee ture", "e.g. Accidentally keyed in wrong count earlier")}
                        className="w-full p-2.5 bg-[#FAF7EE] rounded-xl border border-[#EDE4D5] text-xs font-bold text-[#2C1B10]"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setCorrectingItem(null)}
                        className="flex-1 py-2.5 rounded-xl bg-[#FAF7EE] border border-[#EDE4D5] text-xs font-bold text-[#4A2E1B]"
                      >
                        {l("ሰርዝ", "Dhiisi", "Cancel")}
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-xs"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : l("አስተካክልና አሳውቅ", "Sirreessi", "Apply & Alert Owner")}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Item List with Edit Buttons */
                  <div className="bg-white rounded-3xl border border-[#EDE4D5] shadow-xs divide-y divide-[#EDE4D5]/60 overflow-hidden">
                    <div className="p-3.5 bg-[#FAF6F0]/60 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#4A2E1B]">{l("ሊስተካከል የሚፈልገውን ዕቃ ይምረጡ", "Meeshaa sirreeffamu filadhaa", "Select Stock Item to Correct")}</span>
                      <span className="text-[11px] text-[#8C7361] font-mono font-bold">{stockItems.length} items</span>
                    </div>

                    {stockItems.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#FAF7EE]/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-xs text-[#2C1B10] truncate">{item.name}</p>
                          <p className="text-[11px] text-[#8C7361] font-mono">
                            {Number(item.currentQuantity).toLocaleString()} {item.unitType}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCorrectingItem(item);
                            setCorrectedCount(String(item.currentQuantity));
                            setCorrectionReason("");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#E87A18]" />
                          <span>{l("አስተካክል", "Sirreessi", "Edit Count")}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: OVERVIEW (Live Inventory & Recent Logs)            */}
            {/* ======================================================== */}
            {activeTab === "OVERVIEW" && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8C7361] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={l("ጥሬ ዕቃ ፈልግ...", "Meeshaa barbaadaa...", "Search raw materials...")}
                    className="w-full pl-9 pr-4 py-2.5 bg-white rounded-2xl border border-[#EDE4D5] text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
                  />
                </div>

                {/* Stock Item Cards */}
                <div className="bg-white rounded-3xl border border-[#EDE4D5] shadow-xs divide-y divide-[#EDE4D5]/60 overflow-hidden">
                  <div className="p-3.5 bg-[#FAF6F0]/60 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#4A2E1B]">{l("የመጋዘን ጥሬ ዕቃዎች ዝርዝር", "Tarree Meeshaalee Kuusaa", "Warehouse Inventory Roster")}</span>
                    <span className="text-[11px] text-[#8C7361] font-mono font-bold">{filteredItems.length} items</span>
                  </div>

                  {filteredItems.map((item) => {
                    const isLow = item.minStockLevel != null && Number(item.currentQuantity) <= Number(item.minStockLevel);
                    return (
                      <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#FAF7EE]/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-xs text-[#2C1B10] truncate">{item.name}</p>
                          <span className="text-[10px] text-[#8C7361] block">{item.category || "General Raw Material"}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`font-mono text-xs font-black ${isLow ? "text-rose-600" : "text-[#2C1B10]"}`}>
                            {Number(item.currentQuantity).toLocaleString()} {item.unitType}
                          </span>
                          {isLow && (
                            <span className="flex items-center justify-end gap-1 text-[9px] font-bold text-rose-600 uppercase tracking-wide">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                              <span>{l("አነስተኛ ክምችት", "Kuusaa Gadi aanaa", "Low Stock")}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent Activity Log */}
                {recentMovements.length > 0 && (
                  <div className="bg-white rounded-3xl border border-[#EDE4D5] shadow-xs p-4 space-y-3">
                    <h3 className="text-xs font-black text-[#4A2E1B] uppercase tracking-wide flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-[#E87A18]" />
                      <span>{l("የቅርብ ጊዜ የክምችት እንቅስቃሴዎች", "Sochii Dhihoo", "Recent Movements & Tagged Dispatches")}</span>
                    </h3>

                    <div className="divide-y divide-[#EDE4D5]/50 text-xs">
                      {recentMovements.slice(0, 6).map((m) => (
                        <div key={m.id} className="py-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-[#2C1B10] truncate">{m.stockItem?.name || "Material"}</p>
                            <p className="text-[11px] text-[#8C7361] truncate">
                              {m.receivedBy ? (
                                <span className="font-bold text-[#E87A18]">Recipient: {m.receivedBy}</span>
                              ) : (
                                <span>{m.reason || m.type}</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-mono font-bold text-xs ${m.type === "IN" ? "text-emerald-700" : m.type === "OUT" ? "text-amber-800" : "text-indigo-700"}`}>
                              {m.type === "IN" ? `+${m.quantity}` : `-${m.quantity}`} {m.stockItem?.unitType || ""}
                            </span>
                            <span className="block text-[10px] text-[#8C7361]">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {ConfirmModalComponent}
    </div>
  );
}
