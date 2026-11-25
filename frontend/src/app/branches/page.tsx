"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { Plus, Search, MapPin, Edit2, Building2, Trash2, AlertTriangle, Eye, EyeOff, Flame, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEthDate } from "@/lib/ethiopianDate";

interface Branch {
  id: string;
  name: string;
  code?: string | null;
  isHub: boolean;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const { user } = useAuth();
  const { refreshBranches, selectedBranchId, setSelectedBranchId } = useBranch();
  const { t, l } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "", code: "", isHub: false });
  const [submitting, setSubmitting] = useState(false);
  const [showUnsavedChanges, setShowUnsavedChanges] = useState(false);

  // Delete state
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  const isOwner = user?.role === "OWNER";

  const { data: branches = [], isLoading: loading } = useQuery<Branch[]>({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const res = await api.get("/branches");
      return res.data || [];
    },
    enabled: !!user && user.role === "OWNER",
  });

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!isOwner) return;
    try {
      setToggleLoading(id);
      await api.patch(`/branches/${id}`, { isActive: !currentStatus });
      toast.success(currentStatus ? t('branches.toastBranchDeactivated') : t('branches.toastBranchActivated'));
      await refreshBranches();
      queryClient.invalidateQueries({ queryKey: ["branches-list"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      toast.error(t('branches.toastFailedToUpdate'));
    } finally {
      setToggleLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    if (!formData.name.trim()) return toast.error(t('branches.toastNameRequired'));
    
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        code: formData.code.trim() ? formData.code.trim().toUpperCase() : (editingBranch ? null : undefined),
        isHub: formData.isHub,
      };
      if (editingBranch) {
        // Update
        await api.patch(`/branches/${editingBranch.id}`, payload);
        toast.success(t('branches.toastBranchUpdated'));
      } else {
        // Create
        await api.post("/branches", payload);
        toast.success(t('branches.toastBranchCreated'));
      }
      await refreshBranches();
      queryClient.invalidateQueries({ queryKey: ["branches-list"] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      handleCloseDialog();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error ||
        (editingBranch ? t('branches.toastFailedToUpdate') : t('branches.toastFailedToCreate'))
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDialog = (branch?: Branch) => {
    if (!isOwner) return;
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        address: branch.address || "",
        code: branch.code || "",
        isHub: Boolean(branch.isHub),
      });
    } else {
      setEditingBranch(null);
      setFormData({ name: "", address: "", code: "", isHub: false });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBranch(null);
    setFormData({ name: "", address: "", code: "", isHub: false });
  };

  const isFormDirty = () => {
    if (editingBranch) {
      return (
        formData.name !== editingBranch.name ||
        formData.address !== (editingBranch.address || "") ||
        formData.code !== (editingBranch.code || "") ||
        formData.isHub !== Boolean(editingBranch.isHub)
      );
    }
    return (
      formData.name.trim() !== "" ||
      formData.address.trim() !== "" ||
      formData.code.trim() !== "" ||
      formData.isHub !== false
    );
  };

  const handleRequestCloseDialog = () => {
    if (isFormDirty()) {
      setShowUnsavedChanges(true);
    } else {
      handleCloseDialog();
    }
  };

  const handlePromptDelete = (branch: Branch) => {
    if (!isOwner) return;
    const isMain = (branch.name || "").toLowerCase().includes("main");
    if (isMain || branches.length <= 1) return;
    setBranchToDelete(branch);
    setDeletePassword("");
    setShowDeletePassword(false);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteBranch = async () => {
    if (!branchToDelete) return;
    if (!deletePassword.trim()) {
      toast.error(t('branches.passwordRequired') || "Password is required to delete branch.");
      return;
    }
    try {
      setIsDeleting(true);
      await api.delete(`/branches/${branchToDelete.id}`, {
        data: { password: deletePassword },
      });
      if (selectedBranchId === branchToDelete.id) {
        setSelectedBranchId(null);
      }
      toast.success(t('branches.toastBranchDeleted') || "Branch deleted successfully.");
      await refreshBranches();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["branches-list"] }),
        queryClient.invalidateQueries({ queryKey: ["branches"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setIsDeleteDialogOpen(false);
      setBranchToDelete(null);
      setDeletePassword("");
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('branches.toastFailedToDelete') || "Failed to delete branch");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.address && b.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">{t('branches.title')}</h1>
          </div>

          {isOwner && (
            <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2 bg-[#4A2E1B] hover:bg-[#382214] text-white rounded-xl shadow-xs font-bold text-xs sm:text-sm h-10 px-4">
              <Plus className="w-4 h-4" />
              {t('branches.newBranch')}
            </Button>
          )}

          {isOwner && (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                if (!open) {
                  handleRequestCloseDialog();
                } else {
                  setIsDialogOpen(true);
                }
              }}
            >
              <DialogContent className="w-[94vw] sm:w-full sm:max-w-lg rounded-2xl p-5 sm:p-6">
                <DialogHeader className="pr-8">
                  <DialogTitle>{editingBranch ? t('branches.editBranch') : t('branches.newBranch')}</DialogTitle>
                  <DialogDescription>
                    {t('branches.subtitle')}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="name" className="text-xs font-bold text-[#2C1B10]">
                        {t('branches.colBranchName')} <span className="text-rose-600">*</span>
                      </label>
                      <Input
                        id="name"
                        placeholder={t('branches.branchNamePlaceholder')}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="rounded-xl border-[#EDE4D5]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="code" className="text-xs font-bold text-[#2C1B10]">
                        {l("የቅርንጫፍ ኮድ", "Koodii", "Code")}
                      </label>
                      <Input
                        id="code"
                        placeholder="e.g. MEG"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="rounded-xl border-[#EDE4D5] font-mono uppercase"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="address" className="text-xs font-bold text-[#2C1B10]">
                      {t('branches.colAddress')}
                    </label>
                    <Input
                      id="address"
                      placeholder={t('branches.addressPlaceholder')}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="rounded-xl border-[#EDE4D5]"
                    />
                  </div>

                  {/* Branch Type: Production Hub vs Retail Spoke */}
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-bold text-[#2C1B10] block">
                      {l("የቅርንጫፍ ዓይነት (ምርት ያካትታል?)", "Gosa Damee (Oomisha qabaa?)", "Branch Operation Type")}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isHub: true })}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                          formData.isHub
                            ? "bg-amber-50/90 border-[#E87A18] ring-2 ring-[#E87A18]/25 shadow-xs"
                            : "bg-white border-[#EDE4D5] hover:bg-[#FAF6F0]/60"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          formData.isHub ? "bg-[#E87A18] text-white" : "bg-amber-500/10 text-[#E87A18]"
                        }`}>
                          <Flame className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-extrabold text-[#2C1B10] block">
                            {l("የምርት ማዕከል (Production Hub)", "Wiirtuu Oomishaa (Hub)", "Production Hub")}
                          </span>
                          <span className="text-[11px] text-[#8C7361] block leading-relaxed mt-0.5">
                            {l("ዳቦ እና ኬክ የሚጋገርበት፣ የጥሬ ዕቃ መጋዘን ያለው", "Oomisha daabboo fi keekii qaba", "Has baking ovens, raw stock & dispatches transfers")}
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isHub: false })}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                          !formData.isHub
                            ? "bg-[#FAF6F0] border-[#4A2E1B] ring-2 ring-[#4A2E1B]/20 shadow-xs"
                            : "bg-white border-[#EDE4D5] hover:bg-[#FAF6F0]/60"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          !formData.isHub ? "bg-[#4A2E1B] text-white" : "bg-zinc-100 text-[#4A2E1B]"
                        }`}>
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-extrabold text-[#2C1B10] block">
                            {l("የሽያጭ ቅርንጫፍ (Retail Only)", "Damee Gurgurtaa Qofa", "Retail Spoke")}
                          </span>
                          <span className="text-[11px] text-[#8C7361] block leading-relaxed mt-0.5">
                            {l("ከዋና ማዕከል ምርት ተቀብሎ የሚሸጥ (ያለ ምርት)", "Oomisha fuudhee gurgura qofa", "Receives transfers from Hub; retail sales only")}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <DialogFooter className="pt-4 gap-2">
                    <Button type="button" variant="outline" onClick={handleRequestCloseDialog}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" variant="brand" loading={submitting}>
                      {t('common.save')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[#8C7361]" />
            <Input
              placeholder={t('common.search')}
              className="pl-9 h-10 rounded-xl border-[#EDE4D5] bg-white text-xs sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Data Table (hidden on mobile, visible on md+) */}
        <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAF6F0]/60 border-b border-[#EDE4D5]">
                <TableHead className="font-bold text-[#2C1B10]">{t('branches.colBranchName')}</TableHead>
                <TableHead className="font-bold text-[#2C1B10]">{t('branches.colAddress')}</TableHead>
                <TableHead className="font-bold text-[#2C1B10]">{t('branches.colStatus')}</TableHead>
                <TableHead className="font-bold text-[#2C1B10]">{t('common.date')}</TableHead>
                <TableHead className="text-right pr-6 font-bold text-[#2C1B10]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 ml-auto rounded-xl" /></TableCell>
                  </TableRow>
                ))
              ) : filteredBranches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-[#8C7361]">
                    {t('branches.noBranchesFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBranches.map((branch) => {
                  const isMainBranch = (branch.name || "").toLowerCase().includes("main");
                  const isSoleBranch = branches.length <= 1;
                  const isProtected = isMainBranch || isSoleBranch;

                  return (
                    <TableRow key={branch.id} className="border-b border-[#F4ECE1] hover:bg-[#FAF6F0]/40">
                      <TableCell className="font-bold text-[#2C1B10]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="w-4 h-4 text-[#8C7361] shrink-0" />
                          <span>{branch.name}</span>
                          {branch.code && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#EDE4D5] text-[#8C7361]">
                              {branch.code}
                            </span>
                          )}
                          {branch.isHub ? (
                            <Badge className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold px-2 py-0.5 inline-flex items-center gap-1">
                              <Flame className="w-3 h-3 text-[#E87A18]" />
                              <span>{l("የምርት ማዕከል", "Wiirtuu Oomishaa", "Production Hub")}</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-bold px-2 py-0.5 inline-flex items-center gap-1">
                              <Store className="w-3 h-3 text-zinc-500" />
                              <span>{l("ሽያጭ ብቻ", "Gurgurtaa Qofa", "Retail Only")}</span>
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[#8C7361]">
                        {branch.address ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-[#8C7361]" />
                            {branch.address}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-xs">{t('branches.noAddress')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={branch.isActive ? "default" : "secondary"}
                          className={branch.isActive
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border border-zinc-200 font-bold text-xs"
                          }
                        >
                          {branch.isActive ? `✓ ${t('branches.activeStatus')}` : t('branches.inactiveStatus')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-[#8C7361]">
                        {formatEthDate(branch.createdAt)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {isOwner ? (
                          <div className="flex justify-end items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-[#8C7361]" htmlFor={`switch-${branch.id}`}>
                                {toggleLoading === branch.id ? t('common.updating') : branch.isActive ? t('branches.disableBranch') : t('branches.enableBranch')}
                              </label>
                              <Switch
                                id={`switch-${branch.id}`}
                                checked={branch.isActive}
                                disabled={toggleLoading === branch.id}
                                onCheckedChange={() => handleToggleStatus(branch.id, branch.isActive)}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(branch)}
                              className="h-8 w-8 text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0] rounded-lg"
                              title={t('common.edit') || "Edit"}
                              aria-label={t('common.edit') || "Edit"}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {isProtected ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-zinc-400 border-zinc-200 cursor-not-allowed select-none"
                                title={isMainBranch ? t('branches.mainBranch') || "Main Branch" : t('branches.protected') || "Protected"}
                              >
                                {isMainBranch ? t('branches.mainBranch') || "Main Branch" : t('branches.protected') || "Protected"}
                              </Badge>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handlePromptDelete(branch)}
                                className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                title={t('branches.deleteBranch') || "Delete Branch"}
                                aria-label={t('branches.deleteBranch') || "Delete Branch"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400 font-medium">{t('branches.readOnly')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards (visible on mobile < md, hidden on desktop) */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-[#F4ECE1]">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="bg-white border border-[#EDE4D5] rounded-2xl p-8 text-center text-[#8C7361] text-xs font-semibold">
              {t('branches.noBranchesFound')}
            </div>
          ) : (
            filteredBranches.map((branch) => {
              const isMainBranch = (branch.name || "").toLowerCase().includes("main");
              const isSoleBranch = branches.length <= 1;
              const isProtected = isMainBranch || isSoleBranch;

              return (
                <div key={branch.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3">
                  {/* Header: Name + Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-[#E87A18]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-sm text-[#2C1B10] truncate">{branch.name}</h3>
                          {branch.code && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#EDE4D5] text-[#8C7361]">
                              {branch.code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {branch.isHub ? (
                            <Badge className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold px-1.5 py-0 inline-flex items-center gap-1">
                              <Flame className="w-2.5 h-2.5 text-[#E87A18]" />
                              <span>{l("የምርት ማዕከል", "Wiirtuu Oomishaa", "Production Hub")}</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-bold px-1.5 py-0 inline-flex items-center gap-1">
                              <Store className="w-2.5 h-2.5 text-zinc-500" />
                              <span>{l("ሽያጭ ብቻ", "Gurgurtaa Qofa", "Retail Only")}</span>
                            </Badge>
                          )}
                          <p className="text-[11px] text-[#8C7361]">
                            {formatEthDate(branch.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={branch.isActive ? "default" : "secondary"}
                      className={branch.isActive
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] shrink-0"
                        : "bg-zinc-100 text-zinc-600 border border-zinc-200 font-bold text-[11px] shrink-0"
                      }
                    >
                      {branch.isActive ? `✓ ${t('branches.activeStatus')}` : t('branches.inactiveStatus')}
                    </Badge>
                  </div>

                  {/* Address Row */}
                  <div className="bg-[#FAF6F0]/60 rounded-xl px-3 py-2 text-xs flex items-center gap-2 text-[#4A2E1B]">
                    <MapPin className="w-3.5 h-3.5 text-[#8C7361] shrink-0" />
                    <span className="truncate">
                      {branch.address ? branch.address : <span className="text-zinc-400 italic">{t('branches.noAddress')}</span>}
                    </span>
                  </div>

                  {/* Actions Row */}
                  {isOwner && (
                    <div className="flex items-center justify-between pt-2 border-t border-[#F4ECE1]">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`switch-mob-${branch.id}`}
                          checked={branch.isActive}
                          disabled={toggleLoading === branch.id}
                          onCheckedChange={() => handleToggleStatus(branch.id, branch.isActive)}
                        />
                        <label className="text-xs font-semibold text-[#8C7361]" htmlFor={`switch-mob-${branch.id}`}>
                          {toggleLoading === branch.id ? t('common.updating') : branch.isActive ? t('branches.disableBranch') : t('branches.enableBranch')}
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(branch)}
                          className="h-8 px-3 rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] flex items-center gap-1.5 text-xs font-bold"
                          title={t('common.edit') || "Edit"}
                          aria-label={t('common.edit') || "Edit"}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#E87A18]" />
                          {t('common.edit')}
                        </Button>
                        {isProtected ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-zinc-400 border-zinc-200 cursor-not-allowed select-none px-2 py-1"
                            title={isMainBranch ? t('branches.mainBranch') || "Main Branch" : t('branches.protected') || "Protected"}
                          >
                            {isMainBranch ? t('branches.mainBranch') || "Main Branch" : t('branches.protected') || "Protected"}
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePromptDelete(branch)}
                            className="h-8 px-2.5 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center text-xs font-bold"
                            title={t('branches.deleteBranch') || "Delete"}
                            aria-label={t('branches.deleteBranch') || "Delete"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Delete Branch Confirmation Modal */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !isDeleting && setIsDeleteDialogOpen(open)}>
          <DialogContent className="max-w-md rounded-2xl bg-white border border-rose-200 p-6 shadow-xl">
            <DialogHeader className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto sm:mx-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                  {t('branches.deleteConfirmTitle') || "Permanently Delete Branch?"}
                </DialogTitle>
                <div className="mt-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                  <p className="font-extrabold text-rose-950 text-sm flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-rose-600" /> {branchToDelete?.name}
                  </p>
                  <p className="leading-relaxed">
                    {t('branches.deleteConfirmWarning') ||
                      "Are you sure you want to delete this branch? All data associated with this branch (production batches, daily sessions, sales, expenses, and branch stock items) will be permanently deleted and cannot be recovered. Please ensure you really want to proceed."}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* Password input confirmation */}
            <div className="space-y-1.5 pt-2">
              <label htmlFor="deletePasswordInput" className="text-xs font-bold text-[#2C1B10]">
                {t('branches.enterPasswordToConfirm') || "Enter your password to confirm deletion"} <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Input
                  id="deletePasswordInput"
                  type={showDeletePassword ? "text" : "password"}
                  placeholder={t('branches.passwordPlaceholder') || "Enter your account password"}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="rounded-xl border-[#EDE4D5] pr-10 text-xs sm:text-sm"
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && deletePassword.trim() && !isDeleting) {
                      e.preventDefault();
                      handleDeleteBranch();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7361] hover:text-[#2C1B10]"
                  title={showDeletePassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                loading={isDeleting}
                disabled={isDeleting || !deletePassword.trim()}
                onClick={handleDeleteBranch}
                className="w-full sm:w-auto"
              >
                {t('branches.confirmDelete') || "Delete Branch & Data"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unsaved Changes Confirmation Modal */}
        <UnsavedChangesDialog
          open={showUnsavedChanges}
          onOpenChange={setShowUnsavedChanges}
          onConfirmDiscard={handleCloseDialog}
        />
      </div>
    </DashboardLayout>
  );
}
