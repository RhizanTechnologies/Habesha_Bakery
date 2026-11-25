"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api } from "@/lib/axios";
import { useLanguage } from "@/context/LanguageContext";
import {
  SYSTEM_PRIVILEGES,
  getDefaultPrivilegesForRole,
  PrivilegeDefinition,
} from "@/lib/privileges";
import {
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  CheckCheck,
  XCircle,
  Building2,
  Sparkles,
  Info,
  ChevronDown,
} from "lucide-react";

export interface CustomRoleSummary {
  id: string;
  code: string;
  name: string;
  nameAm?: string | null;
  nameOm?: string | null;
  description?: string | null;
  baseRole: string;
  permissions: string[];
}

interface PrivilegeMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    fullName: string;
    phone: string;
    role: string;
    customRoleId?: string | null;
    permissions?: string[];
    customRole?: CustomRoleSummary | null;
    branch?: { name: string; isHub?: boolean } | null;
  } | null;
  customRoles: CustomRoleSummary[];
  onPermissionsUpdated: () => void;
}

export function PrivilegeMatrixModal({
  isOpen,
  onClose,
  targetUser,
  customRoles,
  onPermissionsUpdated,
}: PrivilegeMatrixModalProps) {
  const { language, l } = useLanguage();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize permissions when modal opens or targetUser changes
  useEffect(() => {
    if (targetUser) {
      if (targetUser.permissions && targetUser.permissions.length > 0) {
        setSelectedPermissions([...targetUser.permissions]);
      } else if (targetUser.customRole?.permissions && targetUser.customRole.permissions.length > 0) {
        setSelectedPermissions([...targetUser.customRole.permissions]);
      } else {
        setSelectedPermissions(getDefaultPrivilegesForRole(targetUser.role));
      }
      setSelectedCustomRoleId(targetUser.customRoleId || null);
    }
  }, [targetUser, isOpen]);

  if (!targetUser) return null;

  const isOwner = targetUser.role === "OWNER";
  const isRetailSpokeUser = targetUser.branch?.isHub === false;
  const HUB_ONLY_PRIVS = new Set(["access_production", "access_stock"]);

  const togglePrivilege = (key: string) => {
    if (isOwner) return; // Owner permissions cannot be modified
    if (isRetailSpokeUser && HUB_ONLY_PRIVS.has(key)) {
      toast.warning(
        l(
          "የሽያጭ ቅርንጫፍ ሠራተኞች የምርት ወይም የጥሬ ዕቃ ክምችት ፈቃድ ሊኖራቸው አይችልም።",
          "Hojjettoonni damee gurgurtaa heyyama oomishaa argachuu hin danda'an.",
          "Production and Raw Stock privileges are only available on Production Hub branches."
        )
      );
      return;
    }
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleGrantAll = () => {
    const allowed = SYSTEM_PRIVILEGES.filter((p) => !(isRetailSpokeUser && HUB_ONLY_PRIVS.has(p.key))).map((p) => p.key);
    setSelectedPermissions(allowed);
    toast.info(l("ሁሉም ፈቃዶች ተመርጠዋል", "Heyyamni hundi filatameera", "All applicable privileges granted"));
  };

  const handleRevokeAll = () => {
    setSelectedPermissions([]);
    toast.warning(l("ሁሉም ፈቃዶች ተሰርዘዋል", "Heyyamni hundi haqameera", "All privileges revoked"));
  };

  const handleResetDefaults = () => {
    if (selectedCustomRoleId) {
      const cr = customRoles.find((r) => r.id === selectedCustomRoleId);
      if (cr && cr.permissions.length > 0) {
        setSelectedPermissions([...cr.permissions]);
        toast.info(l("የኃላፊነቱ መደበኛ ፈቃዶች ተመልሰዋል", "Heyyamni gahee haaromfameera", "Reset to custom role preset"));
        return;
      }
    }
    const defaults = getDefaultPrivilegesForRole(targetUser.role);
    setSelectedPermissions(defaults);
    toast.info(l("የመደበኛ ኃላፊነት ፈቃዶች ተመልሰዋል", "Heyyamni gahee bu'uuraa haaromfameera", "Reset to role archetype defaults"));
  };

  const handleCustomRoleChange = (roleId: string) => {
    if (!roleId || roleId === "NONE") {
      setSelectedCustomRoleId(null);
      return;
    }
    setSelectedCustomRoleId(roleId);
    const cr = customRoles.find((r) => r.id === roleId);
    if (cr && cr.permissions && cr.permissions.length > 0) {
      setSelectedPermissions([...cr.permissions]);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.patch(`/users/${targetUser.id}/permissions`, {
        permissions: selectedPermissions,
        customRoleId: selectedCustomRoleId,
      });

      toast.success(
        l(
          `${targetUser.fullName} የሲስተም ፈቃዶች በተሳካ ሁኔታ ተሻሽለዋል`,
          `Heyyamni ${targetUser.fullName} milkaa'inaan haaromfameera`,
          `Permissions for ${targetUser.fullName} updated successfully`
        )
      );
      onPermissionsUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update permissions");
    } finally {
      setIsSaving(false);
    }
  };

  // Group privileges by category
  const categories: Array<'Foundation' | 'Operations' | 'Finance & Catalog'> = [
    'Foundation',
    'Operations',
    'Finance & Catalog',
  ];

  const getCategoryTitle = (cat: 'Foundation' | 'Operations' | 'Finance & Catalog') => {
    switch (cat) {
      case 'Foundation':
        return l('የአስተዳደር እና መሠረታዊ ፈቃዶች', 'Heyyama Bulchiinsaa', 'Foundation & Administrative');
      case 'Operations':
        return l('የምርት እና ክምችት ክዋኔዎች', 'Hojii Oomishaa fi Kuusaa', 'Operations & Bakery Production');
      case 'Finance & Catalog':
        return l('የፋይናንስ፣ ካዝና እና ምርት ካታሎግ', 'Faayinaansii fi Tarree Oomishaa', 'Finance, Drawer & Master Catalog');
    }
  };

  const getPrivilegeLabel = (p: PrivilegeDefinition) => {
    if (language === 'am') return p.labelAm;
    if (language === 'om') return p.labelOm;
    return p.labelEn;
  };

  const getPrivilegeDesc = (p: PrivilegeDefinition) => {
    if (language === 'am') return p.descriptionAm;
    if (language === 'om') return p.descriptionOm;
    return p.descriptionEn;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-3xl md:max-w-4xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden rounded-3xl border border-[#EDE4D5] shadow-2xl bg-[#FCFAF7]">
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-6 pr-14 sm:pr-16 bg-gradient-to-r from-[#4A2E1B] to-[#2C1B10] text-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#E87A18] flex items-center justify-center text-white shadow-md shrink-0">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-xl font-black tracking-tight text-white flex flex-wrap items-center gap-2">
                  <span className="truncate">{targetUser.fullName}</span>
                  <Badge className="bg-[#FAF7EE] text-[#4A2E1B] text-[10px] font-bold px-2 py-0.5 uppercase shrink-0">
                    {targetUser.customRole?.name || targetUser.role}
                  </Badge>
                </DialogTitle>
                <p className="text-[11px] sm:text-xs text-[#E2C7B4] flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-mono">
                  <span>{targetUser.phone}</span>
                  {targetUser.branch && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[#E87A18]" />
                      {targetUser.branch.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center sm:flex-col justify-between sm:justify-center sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 shrink-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-[#E2C7B4] block uppercase tracking-wider">
                {l("የተሰጡ ፈቃዶች", "Heyyama Kenname", "Active Privileges")}
              </span>
              <span className="text-lg sm:text-xl font-black text-amber-400 font-mono">
                {isOwner ? "16 / 16 (ROOT)" : `${selectedPermissions.length} / 16`}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Owner Root Access Warning */}
          {isOwner && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-900">
                  {l("የባለቤት የበላይ ሥልጣን (Root Owner Access)", "Heyyama Guutuu Abbaa Qabeenyaa", "Enterprise Owner Root Access")}
                </h4>
                <p className="text-xs text-amber-800/80 leading-relaxed mt-0.5">
                  {l(
                    "የድርጅቱ ባለቤት ሙሉ እና ያልተገደበ የሲስተም ፈቃድ አለው። ሁሉንም 16 የሥራ ሞጁሎች ያለ ገደብ ማስተዳደር ይችላል።",
                    "Abbaan qabeenyaa heyyama guutuu waan qabuuf, kutaalee hojii hunda to'achuu danda'a.",
                    "The Business Owner possesses unconstrained root authority across all 16 platform modules."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Custom Role Preset Assignment */}
          {!isOwner && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#EDE4D5] shadow-xs flex flex-col gap-3 min-w-0 w-full overflow-hidden">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-[#E87A18] flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs sm:text-sm font-bold text-[#2C1B10] block truncate">
                    {l("ልዩ ኃላፊነት (Custom Role Template)", "Gahee Addaa (Template)", "Assign Custom Role Profile")}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#8C7361] block leading-relaxed mt-0.5">
                    {l("የተዘጋጀ የፈቃድ መደብ ወዲያውኑ ለመጫን ይምረጡ", "Heyyama qophaa'e saffisaan fe'uuf filadhaa", "Load preconfigured capability bundles")}
                  </span>
                </div>
              </div>

              <div className="relative w-full min-w-0">
                <select
                  value={selectedCustomRoleId || "NONE"}
                  onChange={(e) => handleCustomRoleChange(e.target.value)}
                  className="w-full appearance-none pl-3.5 pr-10 py-2.5 rounded-xl border border-[#EDE4D5] bg-[#FAF6F0] text-xs font-bold text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18] focus:border-[#E87A18] truncate cursor-pointer transition-colors shadow-2xs"
                >
                  <option value="NONE">
                    {l("-- ምንም የተለየ ኃላፊነት የለም (በፈቃድ ብቻ) --", "-- Gaheen Addaa Hin Jiru --", "-- Standard Archetype Only --")}
                  </option>
                  {customRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {language === "am" && role.nameAm
                        ? role.nameAm
                        : language === "om" && role.nameOm
                        ? role.nameOm
                        : role.name}{" "}
                      ({role.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-[#8C7361]" />
              </div>
            </div>
          )}

          {/* Quick Actions Bar */}
          {!isOwner && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1">
              <span className="text-xs font-black uppercase tracking-wider text-[#4A2E1B]">
                {l("የፈቃዶች ማትሪክስ (16 ሞጁሎች)", "Heyyamoota 16", "Granular Capability Matrix")}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGrantAll}
                  className="h-8.5 px-3 rounded-xl border-[#EDE4D5] text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1.5 shadow-2xs"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{l("ሁሉንም ፍቀድ", "Hunda Heyyami", "Grant All")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeAll}
                  className="h-8.5 px-3 rounded-xl border-[#EDE4D5] text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center gap-1.5 shadow-2xs"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{l("ሁሉንም ሰርዝ", "Hunda Haqi", "Revoke All")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetDefaults}
                  className="h-8.5 px-3 rounded-xl border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] bg-white hover:bg-[#FAF6F0] flex items-center gap-1.5 shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{l("መደበኛ", "Bu'uura", "Reset")}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Privilege Groups by Category */}
          <div className="space-y-4 sm:space-y-5">
            {categories.map((category) => {
              const privs = SYSTEM_PRIVILEGES.filter((p) => p.category === category);
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2 h-2 rounded-full bg-[#E87A18]" />
                    <h3 className="text-xs font-black tracking-wide uppercase text-[#4A2E1B]">
                      {getCategoryTitle(category)}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {privs.map((priv) => {
                      const isHubRestricted = isRetailSpokeUser && HUB_ONLY_PRIVS.has(priv.key);
                      const isChecked = isOwner || (!isHubRestricted && selectedPermissions.includes(priv.key));
                      return (
                        <div
                          key={priv.key}
                          onClick={() => togglePrivilege(priv.key)}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 select-none min-w-0 overflow-hidden ${
                            isHubRestricted
                              ? "bg-zinc-100/80 border-zinc-200 opacity-55 cursor-not-allowed"
                              : isChecked
                              ? "bg-white border-[#E87A18]/50 shadow-xs ring-1 ring-[#E87A18]/20 cursor-pointer"
                              : "bg-white/70 border-[#EDE4D5] opacity-80 hover:opacity-100 hover:bg-white cursor-pointer"
                          }`}
                        >
                          <div className="space-y-1 flex-1 pr-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-xs sm:text-sm font-bold truncate block ${
                                  isChecked ? "text-[#2C1B10]" : "text-zinc-600"
                                }`}
                              >
                                {getPrivilegeLabel(priv)}
                              </span>
                              {isHubRestricted && (
                                <Badge className="bg-zinc-200 text-zinc-700 text-[9px] font-bold px-1.5 py-0 shrink-0">
                                  Hub Only
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] sm:text-xs text-[#8C7361] leading-relaxed line-clamp-2 break-words">
                              {getPrivilegeDesc(priv)}
                            </p>
                          </div>

                          <Switch
                            checked={isChecked}
                            disabled={isOwner || isHubRestricted}
                            onCheckedChange={() => togglePrivilege(priv.key)}
                            className="mt-0.5 shrink-0 data-[state=checked]:bg-[#E87A18]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="mx-0 mb-0 rounded-none px-5 py-4 sm:px-6 sm:py-4 bg-[#FAF6F0] border-t border-[#EDE4D5] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#8C7361] text-center sm:text-left justify-center sm:justify-start">
            <Info className="w-4 h-4 text-[#E87A18] shrink-0" />
            <span className="leading-relaxed">
              {l(
                "ለውጦች ወዲያውኑ በሠራተኛው ዳሽቦርድ እና የጎን ሜኑ ላይ ተግባራዊ ይሆናሉ።",
                "Jijjiiramni yeruma sanatti hojiirra oola.",
                "Changes take effect immediately on staff next navigation."
              )}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none sm:w-28 rounded-xl border-[#EDE4D5] font-bold text-xs h-10 px-4 text-[#4A2E1B] hover:bg-[#FAF6F0]"
            >
              {l("ሰርዝ", "Dhiisi", "Cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isOwner}
              className="flex-1 sm:flex-none sm:w-44 bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold rounded-xl text-xs h-10 px-5 shadow-sm"
            >
              {isSaving
                ? l("በማስቀመጥ ላይ...", "Olkaa'amaa jira...", "Saving...")
                : l("ፈቃዶችን መዝግብ", "Heyyama Mirkaneessi", "Save Permissions")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
