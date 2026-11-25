"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useLanguage } from "@/context/LanguageContext";
import {
  SYSTEM_PRIVILEGES,
  getDefaultPrivilegesForRole,
  PrivilegeDefinition,
} from "@/lib/privileges";
import {
  Shield,
  ShieldPlus,
  Plus,
  Users,
  CheckCircle2,
  Lock,
  Edit2,
  Trash2,
  Sparkles,
  Layers,
  ArrowRight,
  RotateCcw,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface CustomRole {
  id: string;
  code: string;
  name: string;
  nameAm?: string | null;
  nameOm?: string | null;
  description?: string | null;
  baseRole: string;
  permissions: string[];
  isSystem: boolean;
  userCount?: number;
}

interface CustomRolesTabProps {
  isOwner: boolean;
  onOpenPrivilegesForUser?: (roleCode: string) => void;
}

export function CustomRolesTab({ isOwner }: CustomRolesTabProps) {
  const { language, l } = useLanguage();
  const queryClient = useQueryClient();

  // Dialog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [nameAm, setNameAm] = useState("");
  const [nameOm, setNameOm] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [baseRole, setBaseRole] = useState("EMPLOYEE");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const res = await api.get("/roles");
      return res.data as {
        systemRoles: any[];
        customRoles: CustomRole[];
        privileges: PrivilegeDefinition[];
      };
    },
  });

  const openCreateModal = () => {
    setEditingRole(null);
    setName("");
    setNameAm("");
    setNameOm("");
    setCode("");
    setDescription("");
    setBaseRole("EMPLOYEE");
    setPermissions(getDefaultPrivilegesForRole("EMPLOYEE"));
    setIsModalOpen(true);
  };

  const openEditModal = (role: CustomRole) => {
    setEditingRole(role);
    setName(role.name);
    setNameAm(role.nameAm || "");
    setNameOm(role.nameOm || "");
    setCode(role.code);
    setDescription(role.description || "");
    setBaseRole(role.baseRole);
    setPermissions([...role.permissions]);
    setIsModalOpen(true);
  };

  const handleBaseRolePreset = (archetype: string) => {
    setBaseRole(archetype);
    setPermissions(getDefaultPrivilegesForRole(archetype));
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleGrantAll = () => {
    setPermissions(SYSTEM_PRIVILEGES.map((p) => p.key));
  };

  const handleRevokeAll = () => {
    setPermissions([]);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(l("እባክዎ የኃላፊነት ስም ያስገቡ", "Maqaa gahee galchaa", "Please provide a role name"));
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, {
          name: name.trim(),
          nameAm: nameAm.trim() || null,
          nameOm: nameOm.trim() || null,
          description: description.trim() || null,
          baseRole,
          permissions,
        });
        toast.success(l("ኃላፊነት በተሳካ ሁኔታ ተሻሽሏል", "Gaheen haaromfameera", "Role updated successfully"));
      } else {
        await api.post("/roles", {
          name: name.trim(),
          nameAm: nameAm.trim() || null,
          nameOm: nameOm.trim() || null,
          code: code.trim() || undefined,
          description: description.trim() || null,
          baseRole,
          permissions,
        });
        toast.success(l("አዲስ ኃላፊነት በተሳካ ሁኔታ ተፈጥሯል", "Gahee haaraan uumameera", "Custom role created successfully"));
      }

      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      queryClient.invalidateQueries({ queryKey: ["users-page"] });
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (id: string) => {
    try {
      await api.delete(`/roles/${id}`);
      toast.success(l("ኃላፊነቱ ተሰርዟል", "Gaheen haqameera", "Custom role deleted successfully"));
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      queryClient.invalidateQueries({ queryKey: ["users-page"] });
      setDeletingRoleId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete role");
    }
  };

  const getPrivilegeLabel = (p: PrivilegeDefinition) => {
    if (language === "am") return p.labelAm;
    if (language === "om") return p.labelOm;
    return p.labelEn;
  };

  return (
    <div className="p-4 sm:p-6 space-y-8 bg-[#FCFAF7]">
      {/* Tab Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#4A2E1B] via-[#382214] to-[#2C1B10] text-white shadow-sm">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#E87A18] flex items-center justify-center text-white shadow-md shrink-0">
            <ShieldPlus className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight text-white flex flex-wrap items-center gap-2">
              <span>{l("የኃላፊነት እና ፈቃድ ማዕቀፍ", "Heyyama fi Gahee Hojii", "Custom Roles & Capability Framework")}</span>
              <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-[10px] font-bold shrink-0">
                16 CAPABILITIES
              </Badge>
            </h2>
            <p className="text-[11px] sm:text-xs text-[#E2C7B4] leading-relaxed mt-1">
              {l(
                "ባለቤቱ ማንኛውንም ብጁ ኃላፊነት መፍጠር፣ የተናጠል የሥራ ፈቃዶችን መቆጣጠርና ወዲያውኑ መሻር ይችላል።",
                "Abbaan qabeenyaa gahee haaraa uumuu fi heyyama hojjettootaa adda addaa to'achuu danda'a.",
                "Define bespoke workstation roles, customize granular permissions, and instantly revoke accessibility."
              )}
            </p>
          </div>
        </div>

        {isOwner && (
          <Button
            type="button"
            onClick={openCreateModal}
            className="w-full sm:w-auto bg-[#E87A18] hover:bg-[#D06910] text-white font-bold rounded-2xl text-xs sm:text-sm h-10 sm:h-11 px-5 shadow-md flex items-center justify-center gap-2 shrink-0 self-stretch sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{l("አዲስ ኃላፊነት ፍጠር", "Gahee Haaraa Uumi", "Create Custom Role")}</span>
          </Button>
        )}
      </div>

      {/* Owner-Defined Custom Roles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E87A18]" />
            <h3 className="text-sm sm:text-base font-extrabold text-[#2C1B10]">
              {l("በባለቤቱ የተፈጠሩ ልዩ ኃላፊነቶች", "Gaheewwan Abbaa Qabeenyaan Uumaman", "Custom Roles (Owner Configured)")}
            </h3>
          </div>
          <span className="text-xs font-bold text-[#8C7361]">
            {data?.customRoles?.length || 0} {l("ልዩ ኃላፊነቶች", "Gaheewwan", "Custom Roles")}
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-3xl" />
            ))}
          </div>
        ) : !data?.customRoles || data.customRoles.length === 0 ? (
          <div className="p-8 rounded-3xl border border-dashed border-[#EDE4D5] bg-white text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] text-[#8C7361] flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2C1B10]">
                {l("ምንም ልዩ ኃላፊነት እስካሁን አልተፈጠረም", "Gaheen addaa hin uumamne", "No custom roles created yet")}
              </p>
              <p className="text-xs text-[#8C7361] mt-1">
                {l(
                  "የዳቦ ቤቱን የሥራ ፍላጎት መሠረት በማድረግ ለሠራተኞች የተለየ ኃላፊነት ማከል ይችላሉ።",
                  "Akka fedhii manneen dabbootti gahee addaa uumuun ni danda'ama.",
                  "Create tailored roles such as Quality Auditor, Distribution Driver, or Assistant Baker."
                )}
              </p>
            </div>
            {isOwner && (
              <Button
                type="button"
                onClick={openCreateModal}
                className="bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold rounded-xl text-xs h-9 px-4 mt-2"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {l("የመጀመሪያውን ኃላፊነት ፍጠር", "Gahee Jalqabaa Uumi", "Create First Custom Role")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.customRoles.map((role) => (
              <div
                key={role.id}
                className="p-5 rounded-3xl bg-white border border-[#EDE4D5] shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm sm:text-base font-extrabold text-[#2C1B10] break-words">
                        {language === "am" && role.nameAm
                          ? role.nameAm
                          : language === "om" && role.nameOm
                          ? role.nameOm
                          : role.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] shrink-0">
                          {role.code}
                        </span>
                        <span className="text-[11px] text-[#8C7361]">
                          Archetype: <strong className="text-[#4A2E1B]">{role.baseRole}</strong>
                        </span>
                      </div>
                    </div>

                    <Badge className="bg-[#FAF6F0] text-[#4A2E1B] border-[#EDE4D5] text-[10px] font-bold shrink-0 self-start">
                      <Users className="w-3 h-3 mr-1 text-[#E87A18]" />
                      {role.userCount || 0} {l("ሠራተኞች", "Hojjettoota", "users")}
                    </Badge>
                  </div>

                  {role.description && (
                    <p className="text-xs text-[#8C7361] mt-2.5 line-clamp-2 leading-relaxed">
                      {role.description}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-[#EDE4D5]/60">
                    <div className="flex items-center justify-between text-xs font-bold text-[#4A2E1B] mb-2">
                      <span>{l("የተሰጡ ፈቃዶች", "Heyyama", "Granted Privileges")}</span>
                      <span className="font-mono text-emerald-700 font-black">
                        {role.permissions.length} / 16
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 4).map((pKey) => {
                        const pDef = SYSTEM_PRIVILEGES.find((sp) => sp.key === pKey);
                        return (
                          <span
                            key={pKey}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            {pDef ? getPrivilegeLabel(pDef) : pKey}
                          </span>
                        );
                      })}
                      {role.permissions.length > 4 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-zinc-100 text-zinc-600">
                          +{role.permissions.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#EDE4D5]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(role)}
                      className="h-8 px-2.5 rounded-xl text-xs font-bold text-[#4A2E1B] hover:bg-[#FAF6F0]"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      {l("አስተካክል", "Gulaali", "Edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingRoleId(role.id)}
                      className="h-8 px-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {l("ሰርዝ", "Haqi", "Delete")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Built-in System Role Archetypes Section */}
      <div className="space-y-4 pt-4 border-t border-[#EDE4D5]">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#8C7361]" />
          <h3 className="text-sm sm:text-base font-extrabold text-[#2C1B10]">
            {l("መደበኛ የሲስተም ኃላፊነቶች (System Archetypes)", "Gaheewwan Bu'uuraa Sirnichaa", "Standard System Role Archetypes")}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {data?.systemRoles?.map((archetype) => (
            <div
              key={archetype.code}
              className="p-4 rounded-2xl bg-white border border-[#EDE4D5] shadow-2xs space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#2C1B10]">
                    {language === "am" && archetype.nameAm
                      ? archetype.nameAm
                      : language === "om" && archetype.nameOm
                      ? archetype.nameOm
                      : archetype.name}
                  </h4>
                  <span className="font-mono text-[9px] uppercase font-bold text-[#8C7361]">
                    {archetype.code}
                  </span>
                </div>
                <Badge
                  className={`text-[9px] font-bold ${
                    archetype.code === "OWNER"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-[#FAF6F0] text-[#4A2E1B] border-[#EDE4D5]"
                  }`}
                >
                  {archetype.code === "OWNER" ? "ROOT (16)" : `${archetype.defaultPermissions.length} DEFAULTS`}
                </Badge>
              </div>

              <p className="text-[11px] text-[#8C7361] line-clamp-2 leading-relaxed">
                {archetype.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Create / Edit Role Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[94vw] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-3xl border border-[#EDE4D5] shadow-2xl bg-[#FCFAF7]">
          <DialogHeader className="p-5 sm:p-6 pr-14 sm:pr-16 bg-gradient-to-r from-[#4A2E1B] to-[#2C1B10] text-white shrink-0">
            <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <ShieldPlus className="w-5 h-5 text-[#E87A18]" />
              <span>
                {editingRole
                  ? l("ልዩ ኃላፊነትን አሻሽል", "Gahee Addaa Gulaali", "Edit Custom Role")
                  : l("አዲስ ልዩ ኃላፊነት ፍጠር", "Gahee Addaa Haaraa Uumi", "Create Custom Role")}
              </span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Role Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C1B10]">
                  {l("የኃላፊነት ስም (እንግሊዝኛ)", "Maqaa Gahee (Afaan Ingilizii)", "Role Name (English)")} *
                </label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Quality Auditor, Hub Dispatcher"
                  className="rounded-xl border-[#EDE4D5] bg-white text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C1B10]">
                  {l("የኃላፊነት መለያ ኮድ", "Koodii Gahee", "Role Code")}
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. QUALITY_AUDITOR"
                  disabled={!!editingRole}
                  className="rounded-xl border-[#EDE4D5] bg-white text-xs h-10 font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C1B10]">
                  {l("የኃላፊነት ስም (አማርኛ)", "Maqaa Gahee (Afaan Amaaraa)", "Role Name (Amharic)")}
                </label>
                <Input
                  value={nameAm}
                  onChange={(e) => setNameAm(e.target.value)}
                  placeholder="ለምሳሌ፡ የጥራት ተቆጣጣሪ"
                  className="rounded-xl border-[#EDE4D5] bg-white text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C1B10]">
                  {l("የኃላፊነት ስም (ኦሮምኛ)", "Maqaa Gahee (Afaan Oromoo)", "Role Name (Afaan Oromoo)")}
                </label>
                <Input
                  value={nameOm}
                  onChange={(e) => setNameOm(e.target.value)}
                  placeholder="Fkn: To'ataa Qulqullinaa"
                  className="rounded-xl border-[#EDE4D5] bg-white text-xs h-10"
                />
              </div>
            </div>

            {/* Base Archetype & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C1B10]">
                  {l("መሠረታዊ ኃላፊነት (Base Archetype)", "Gahee Bu'uuraa", "Base Archetype")}
                </label>
                <select
                  value={baseRole}
                  onChange={(e) => handleBaseRolePreset(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#EDE4D5] bg-white text-xs font-bold text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="EMPLOYEE">General Employee (ጠቅላላ ሠራተኛ)</option>
                  <option value="BAKER">Master Baker (ዋና ጋጋሪ)</option>
                  <option value="CAKE_WORKER">Cake Specialist (የኬክ ባለሙያ)</option>
                  <option value="SAMBUSA_WORKER">Sambusa Specialist (የሳምቡሳ ባለሙያ)</option>
                  <option value="CASHIER">Cashier (ገንዘብ ተቀባይ)</option>
                  <option value="STOCK_KEEPER">Depot Storekeeper (የዕቃ ግምጃ ቤት ኃላፊ)</option>
                  <option value="ADMIN">General Admin (ሥራ አስኪያጅ)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C1B10]">
                  {l("መግለጫ", "Ibsa", "Description")}
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={l("የኃላፊነቱ ዋና የሥራ ድርሻ...", "Hojii bu'uuraa...", "Core responsibilities...")}
                  className="rounded-xl border-[#EDE4D5] bg-white text-xs h-10"
                />
              </div>
            </div>

            {/* Privilege Checkboxes */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#4A2E1B]">
                    {l("የሚፈቀዱ ሞጁሎች (Default Granted Privileges)", "Heyyama Kennamu", "Granted Privileges")}
                  </h4>
                  <span className="text-[11px] text-[#8C7361]">
                    {permissions.length} / 16 {l("ፈቃዶች ተመርጠዋል", "heyyamni filatameera", "privileges selected")}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGrantAll}
                    className="h-7 px-2 rounded-lg border-[#EDE4D5] text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  >
                    <CheckCheck className="w-3 h-3 mr-1" />
                    {l("ሁሉንም", "Hunda", "All")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRevokeAll}
                    className="h-7 px-2 rounded-lg border-[#EDE4D5] text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100"
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    {l("አጽዳ", "Qulqulleessi", "Clear")}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border border-[#EDE4D5] rounded-2xl bg-white">
                {SYSTEM_PRIVILEGES.map((priv) => {
                  const isChecked = permissions.includes(priv.key);
                  return (
                    <div
                      key={priv.key}
                      onClick={() => togglePermission(priv.key)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                        isChecked
                          ? "bg-[#FAF6F0] border-[#E87A18]/50 ring-1 ring-[#E87A18]/20"
                          : "border-zinc-200/70 hover:bg-zinc-50"
                      }`}
                    >
                      <span className={`text-xs font-bold flex-1 min-w-0 pr-1 break-words ${isChecked ? "text-[#4A2E1B]" : "text-zinc-600"}`}>
                        {getPrivilegeLabel(priv)}
                      </span>
                      <Switch
                        checked={isChecked}
                        onCheckedChange={() => togglePermission(priv.key)}
                        className="data-[state=checked]:bg-[#E87A18] scale-75 shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-none bg-transparent px-0 pt-4 pb-0 border-t border-[#EDE4D5]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl border-[#EDE4D5]"
              >
                {l("ሰርዝ", "Dhiisi", "Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold rounded-xl"
              >
                {isSubmitting
                  ? l("በማስቀመጥ ላይ...", "Olkaa'amaa jira...", "Saving...")
                  : editingRole
                  ? l("ለውጦችን መዝግብ", "Gulaallii Mirkaneessi", "Save Changes")
                  : l("ኃላፊነት ፍጠር", "Gahee Uumi", "Create Role")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {deletingRoleId && (
        <Dialog open={!!deletingRoleId} onOpenChange={() => setDeletingRoleId(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6 bg-white border border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#2C1B10]">
                {l("ልዩ ኃላፊነትን መሰረዝ", "Gahee Haquu", "Delete Custom Role")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-[#8C7361] mt-2">
              {l(
                "ይህንን ኃላፊነት መሰረዝ ይፈልጋሉ? የተመደቡ ሠራተኞች ወደ መደበኛ ኃላፊነታቸው ይመለሳሉ።",
                "Gahee kana haquu barbaadduu? Hojjettoonni gara gahee bu'uuraatti deebi'u.",
                "Are you sure you want to delete this custom role? Assigned staff members will revert to their base archetype."
              )}
            </p>
            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingRoleId(null)}
                className="rounded-xl"
              >
                {l("ተመለስ", "Deebi'i", "Cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeleteRole(deletingRoleId)}
                className="rounded-xl"
              >
                {l("ሰርዝ", "Haqi", "Delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
