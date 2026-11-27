'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import { useBranch } from '../../context/BranchContext';
import { useConfirm } from '../../components/ConfirmModal';
import { apiRequest, getCachedApiData } from '../../lib/api';
import { translateBranchName, translateStatus } from '../../lib/displayTranslations';
import {
  Truck,
  Boxes,
  Trash2,
  Send,
  ArrowLeft,
  Plus,
  PackageCheck,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Search,
  Filter,
} from 'lucide-react';
import { PaginationControls } from '../../components/ui/PaginationControls';

interface TransferItem {
  id: string;
  manifestNumber: string;
  originBranchId: string;
  originBranchName: string;
  destBranchId: string;
  destBranchName: string;
  destBranchCode: string;
  productId: string;
  productName: string;
  cratesCount: number;
  loavesCount: number;
  driverName: string;
  driverPhone?: string | null;
  vehiclePlate?: string | null;
  status: 'DISPATCHED' | 'RECEIVED' | 'REJECTED';
  dispatchTime: string;
  receivedTime?: string | null;
  dispatchedBy: string;
  receivedBy?: string | null;
  goodLoavesReceived?: number | null;
  damagedLoavesCount: number;
  emptyCratesReturned: number;
  discrepancyNotes?: string | null;
  createdAt: string;
}

interface TransferMetrics {
  cratesDispatchedToday: number;
  cratesReceivedToday: number;
  cratesInTransitToday: number;
  loavesDistributedToday: number;
  totalManifestsCount: number;
}

interface ProductOption {
  id: string;
  name: string;
  sku?: string;
  availableStock?: number;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
  isHub: boolean;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function TransfersPage() {
  const { language, l } = useLanguage();
  const { selectedBranchId, selectedBranch, setSelectedBranchId } = useBranch();
  const { confirm, ConfirmModalComponent } = useConfirm();

  const [filterBranchId, setFilterBranchId] = useState<string>(() => selectedBranchId || 'ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'DISPATCHED' | 'RECEIVED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const transfersEndpoint = `/transfers?branchId=${filterBranchId}&status=${filterStatus}&page=${currentPage}&limit=${pageSize}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`;
  const cachedTransfers = getCachedApiData<{ transfers: TransferItem[]; metrics: TransferMetrics; pagination?: PaginationData }>(transfersEndpoint);
  const cachedBranches = getCachedApiData<BranchOption[]>('/branches');
  const cachedProducts = getCachedApiData<ProductOption[]>('/products');

  const [transfers, setTransfers] = useState<TransferItem[]>(() => cachedTransfers?.transfers || []);
  const [branches, setBranches] = useState<BranchOption[]>(() => {
    if (!cachedBranches) return [];
    return Array.isArray(cachedBranches) ? cachedBranches : ((cachedBranches as any).branches || []);
  });
  const [products, setProducts] = useState<ProductOption[]>(() => {
    if (!cachedProducts) return [];
    return (Array.isArray(cachedProducts) ? cachedProducts : []).map((p: any) => ({
      ...p,
      availableStock: Number(p.availableStock ?? p.currentHouseStock ?? 0),
    }));
  });
  const [metrics, setMetrics] = useState<TransferMetrics>(() => cachedTransfers?.metrics || {
    cratesDispatchedToday: 0,
    cratesReceivedToday: 0,
    cratesInTransitToday: 0,
    loavesDistributedToday: 0,
    totalManifestsCount: 0,
  });
  const [loading, setLoading] = useState(!cachedTransfers);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync with global header branch selector
  useEffect(() => {
    if (selectedBranchId !== undefined) {
      setFilterBranchId(selectedBranchId || 'ALL');
      setCurrentPage(1);
    }
  }, [selectedBranchId]);

  const handleBranchFilterChange = (newBranchId: string) => {
    setFilterBranchId(newBranchId);
    setCurrentPage(1);
    setSelectedBranchId(newBranchId === 'ALL' ? null : newBranchId);
  };

interface DispatchItemRow {
  productId: string;
  quantity: number;
}

  // Modals state
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchForm, setDispatchForm] = useState<{
    destBranchId: string;
    items: DispatchItemRow[];
    autoReceive: boolean;
  }>({
    destBranchId: '',
    items: [{ productId: '', quantity: 40 }],
    autoReceive: true,
  });

  const [receiveModalTarget, setReceiveModalTarget] = useState<TransferItem | null>(null);
  const [receiveForm, setReceiveForm] = useState({
    goodLoavesReceived: '',
    damagedLoavesCount: '0',
    emptyCratesReturned: '',
    discrepancyNotes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async (force: boolean | any = false) => {
    const isForce = force === true;
    const params = new URLSearchParams();
    if (filterBranchId && filterBranchId !== 'ALL') {
      params.append('branchId', filterBranchId);
    } else {
      params.append('branchId', 'ALL');
    }
    if (filterStatus && filterStatus !== 'ALL') {
      params.append('status', filterStatus);
    }
    if (debouncedSearch.trim()) {
      params.append('search', debouncedSearch.trim());
    }
    params.append('page', String(currentPage));
    params.append('limit', String(pageSize));

    const endpoint = `/transfers?${params.toString()}`;
    const cached = getCachedApiData<{ transfers: TransferItem[]; metrics: TransferMetrics; pagination?: PaginationData }>(endpoint);

    if (!cached && !isForce) {
      setLoading(true);
    }
    setError(null);

    const [transfersRes, branchesRes, productsRes] = await Promise.all([
      apiRequest<{ transfers: TransferItem[]; metrics: TransferMetrics; pagination?: PaginationData }>(endpoint, { skipCache: isForce }),
      apiRequest<BranchOption[]>('/branches', { skipCache: isForce }),
      apiRequest<ProductOption[]>('/products', { skipCache: isForce }),
    ]);

    if (transfersRes.data) {
      setTransfers(transfersRes.data.transfers || []);
      setMetrics(transfersRes.data.metrics || {
        cratesDispatchedToday: 0,
        cratesReceivedToday: 0,
        cratesInTransitToday: 0,
        loavesDistributedToday: 0,
        totalManifestsCount: 0,
      });
      if (transfersRes.data.pagination) {
        setTotalPages(transfersRes.data.pagination.totalPages || 1);
        setTotalCount(transfersRes.data.pagination.total || 0);
      } else {
        const total = transfersRes.data.metrics?.totalManifestsCount ?? (transfersRes.data.transfers?.length || 0);
        setTotalCount(total);
        setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
      }
    } else {
      if (transfers.length === 0) {
        setError(transfersRes.error || 'Failed to load transfers');
      }
    }

    if (branchesRes.data) {
      const branchList: BranchOption[] = Array.isArray(branchesRes.data)
        ? branchesRes.data
        : ((branchesRes.data as any).branches || []);
      setBranches(branchList);
      const spokes = branchList.filter((b) => !b.isHub);
      if (spokes.length > 0) {
        setDispatchForm((prev) => ({
          ...prev,
          destBranchId: prev.destBranchId || spokes[0].id,
        }));
      }
    }

    if (productsRes.data) {
      const prodList = (Array.isArray(productsRes.data) ? productsRes.data : []).map((p: any) => ({
        ...p,
        availableStock: Number(p.availableStock ?? p.currentHouseStock ?? 0),
      }));
      setProducts(prodList);
      const available = prodList.filter((p) => (p.availableStock ?? 0) > 0);
      if (available.length > 0) {
        setDispatchForm((prev) => ({
          ...prev,
          items: prev.items.map((it, idx) =>
            idx === 0 && !it.productId
              ? { productId: available[0].id, quantity: Math.min(40, available[0].availableStock ?? 40) }
              : it
          ),
        }));
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterBranchId, filterStatus, debouncedSearch, currentPage, pageSize]);

  const openDispatchModal = () => {
    const available = products.filter((p) => (p.availableStock ?? 0) > 0);
    const spokes = branches.filter((b) => !b.isHub);
    const defaultProd = available[0] || products[0];
    const defaultStock = defaultProd?.availableStock ?? 0;
    const initialQty = defaultStock > 0 ? Math.min(40, defaultStock) : 0;
    setDispatchForm({
      destBranchId: spokes[0]?.id || branches[0]?.id || '',
      autoReceive: true,
      items: [
        {
          productId: defaultProd?.id || '',
          quantity: initialQty,
        },
      ],
    });
    setShowDispatchModal(true);
  };

  const handleAddItem = () => {
    const available = products.filter((p) => (p.availableStock ?? 0) > 0);
    const unused = available.find((p) => !dispatchForm.items.some((it) => it.productId === p.id)) || available[0] || products[0];
    if (!unused) return;
    const unusedStock = unused.availableStock ?? 0;
    const initialQty = unusedStock > 0 ? Math.min(40, unusedStock) : 0;
    setDispatchForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: unused.id,
          quantity: initialQty,
        },
      ],
    }));
  };

  const handleUpdateItem = (index: number, updates: Partial<DispatchItemRow>) => {
    setDispatchForm((prev) => {
      const nextItems = [...prev.items];
      const currentItem = nextItems[index];
      if (!currentItem) return prev;

      const nextProductId = updates.productId !== undefined ? updates.productId : currentItem.productId;
      const targetProd = products.find((p) => p.id === nextProductId);
      const stock = targetProd?.availableStock ?? 0;

      let nextQuantity = updates.quantity !== undefined ? updates.quantity : currentItem.quantity;
      if (stock > 0 && nextQuantity > stock) {
        nextQuantity = stock;
      }

      nextItems[index] = {
        ...currentItem,
        ...updates,
        productId: nextProductId,
        quantity: nextQuantity,
      };
      return { ...prev, items: nextItems };
    });
  };

  const handleRemoveItem = (index: number) => {
    if (dispatchForm.items.length <= 1) return;
    setDispatchForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const totalTransferUnits = dispatchForm.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

  const hasStockErrors = dispatchForm.items.some((it) => {
    const prod = products.find((p) => p.id === it.productId);
    const stock = prod?.availableStock ?? 0;
    return it.quantity <= 0 || it.quantity > stock || stock <= 0;
  }) || dispatchForm.items.length === 0 || !dispatchForm.destBranchId;

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchForm.destBranchId) {
      setActionMessage({
        text: l('እባክዎን መድረሻ ቅርንጫፍ ይምረጡ', 'Mee dammee gahiinsaa filadhaa', 'Please select destination branch'),
        type: 'error',
      });
      return;
    }

    if (dispatchForm.items.length === 0) {
      setActionMessage({
        text: l('እባክዎን ቢያንስ አንድ ምርት ይጨምሩ', 'Mee yoo xiqqaate oomisha tokko galchaa', 'Please add at least one product to transfer'),
        type: 'error',
      });
      return;
    }

    for (const item of dispatchForm.items) {
      const prod = products.find((p) => p.id === item.productId);
      const stock = prod?.availableStock ?? 0;
      if (stock <= 0) {
        setActionMessage({
          text: l(
            `ምርት "${prod?.name || item.productId}" በክምችት ውስጥ የለም! ሊተላለፍ አይችልም።`,
            `Oomishni "${prod?.name || item.productId}" kuusaa keessa hin jiru! Dabarsuun hindanda\'amu.`,
            `Product "${prod?.name || item.productId}" is out of stock! Transfer not allowed.`
          ),
          type: 'error',
        });
        return;
      }
      if (item.quantity <= 0) {
        setActionMessage({
          text: l('ብዛት ከዜሮ በላይ መሆን አለበት', 'Baay\'inni zeeroo ol ta\'uu qaba', 'Quantity must be greater than zero'),
          type: 'error',
        });
        return;
      }
      if (item.quantity > stock) {
        setActionMessage({
          text: l(
            `ለ "${prod?.name}" የተጠየቀው ብዛት (${item.quantity}) ካለው ክምችት (${stock}) በላይ ነው!`,
            `Baay\'inni "${prod?.name}" gaafatame (${item.quantity}) kuusaa jiru (${stock}) irra caala!`,
            `Requested quantity (${item.quantity}) for "${prod?.name}" exceeds available stock (${stock})!`
          ),
          type: 'error',
        });
        return;
      }
    }

    const dest = branches.find((b) => b.id === dispatchForm.destBranchId);
    const destName = dest ? translateBranchName(dest.name, language) : 'destination branch';
    const totalUnits = dispatchForm.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

    const ok = await confirm({
      title: l('የዕቃ ዝውውር መላክ ማረጋገጫ', 'Mirkaneessa Daddabarsa Meeshaa', 'Confirm Stock Dispatch'),
      message: l(
        `በአጠቃላይ ${totalUnits} ምርቶችን ወደ '${destName}' መላክ ይፈልጋሉ? የተላኩት ዕቃዎች ከዋናው ክምችት ተቀንሰው በመንገድ ላይ ወደሚል ሁኔታ ይቀየራሉ።`,
        `Waliigala oomishaalee ${totalUnits} gara '${destName}' erguu barbaadduu? Meeshaaleen kun kuusaa keessaa hir'ifamu.`,
        `Are you sure you want to dispatch ${totalUnits} units to '${destName}'? Stock will be deducted from active branch and moved into transit.`
      ),
      variant: 'info',
      confirmText: l('ዕቃዎቹን ላክ', 'Meeshaa Ergi', 'Dispatch Items'),
    });
    if (!ok) return;

    setSubmitting(true);
    setActionMessage(null);
    const res = await apiRequest('/transfers/dispatch', {
      method: 'POST',
      body: JSON.stringify({
        destBranchId: dispatchForm.destBranchId,
        autoReceive: dispatchForm.autoReceive,
        items: dispatchForm.items.map((it) => ({
          productId: it.productId,
          unitsCount: Number(it.quantity),
        })),
      }),
    });

    setSubmitting(false);
    if (res.data) {
      setShowDispatchModal(false);
      setActionMessage({
        text: l(
          `${dispatchForm.items.length} ምርቶች በተሳካ ሁኔታ ተልከዋል፤ በማዕከሉ ክምችት ተቀንሰዋል`,
          `Oomishaaleen ${dispatchForm.items.length} milkaa\'inaan ergamaniiru`,
          `Successfully dispatched ${dispatchForm.items.length} product(s) to branch! Inventory deducted.`
        ),
        type: 'success',
      });
      fetchData();
    } else {
      setActionMessage({ text: res.error || 'Failed to dispatch manifest', type: 'error' });
    }
  };

  const openReceiveModal = (transfer: TransferItem) => {
    setReceiveModalTarget(transfer);
    setReceiveForm({
      goodLoavesReceived: String(transfer.loavesCount),
      damagedLoavesCount: '0',
      emptyCratesReturned: String(transfer.cratesCount),
      discrepancyNotes: '',
    });
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalTarget) return;

    const goodLoaves = Number(receiveForm.goodLoavesReceived) || 0;
    const damagedLoaves = Number(receiveForm.damagedLoavesCount) || 0;
    const returnedCrates = Number(receiveForm.emptyCratesReturned) || 0;

    const ok = await confirm({
      title: l('የዕቃ ርክክብ ማረጋገጫ', 'Mirkaneessa Fudhatama Meeshaa', 'Confirm Stock Receipt'),
      message: l(
        `ይህንን የዕቃ ዝውውር (ማኒፌስት #${receiveModalTarget.manifestNumber}) ተቀብለው ወደ ቅርንጫፍ ክምችት ማስገባት ይፈልጋሉ? የተረከቡት ትክክለኛ ዳቦ፡ ${goodLoaves} ፍሬ፣ የተበላሸ፡ ${damagedLoaves} ፍሬ።`,
        `Daddabarsa kana (Manifest #${receiveModalTarget.manifestNumber}) fudhattanii gara kuusaatti galchuu barbaadduu? Dabboo fayyaa: ${goodLoaves}, kan miidhame: ${damagedLoaves}.`,
        `Are you sure you want to receive transfer manifest #${receiveModalTarget.manifestNumber} into branch inventory? Good units: ${goodLoaves}, Damaged: ${damagedLoaves}.`
      ),
      variant: 'info',
      confirmText: l('ርክክብ አረጋግጥ', 'Fudhatama Mirkaneessi', 'Confirm Receipt'),
    });
    if (!ok) return;

    setSubmitting(true);
    setActionMessage(null);

    const res = await apiRequest(`/transfers/${receiveModalTarget.id}/receive`, {
      method: 'POST',
      body: JSON.stringify({
        goodLoavesReceived: goodLoaves,
        damagedLoavesCount: damagedLoaves,
        emptyCratesReturned: returnedCrates,
        discrepancyNotes: receiveForm.discrepancyNotes || undefined,
      }),
    });

    setSubmitting(false);
    if (res.data) {
      setReceiveModalTarget(null);
      setActionMessage({
        text: l('ምርቱ በቅርንጫፉ ተረክቧል፤ የቅርንጫፉ የዳቦ ክምችት ወዲያውኑ ጨምሯል', 'Dabboon dammeetti fudhatamee kuusaan dabaleera', 'Shipment successfully received and added to branch shelf stock!'),
        type: 'success',
      });
      fetchData();
    } else {
      setActionMessage({ text: res.error || 'Failed to receive shipment', type: 'error' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C7361] hover:text-[#2C1B10] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{l('ወደ ዋናው ማጠቃለያ ተመለስ', 'Gara Iddoo Guddaatti Deebi\'i', 'Back to Dashboard')}</span>
      </Link>

      {/* Header Banner */}
      <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-[#4A2E1B] text-xs font-bold mb-3 border border-amber-200">
            <Truck className="w-3.5 h-3.5 text-[#E87A18]" />
            <span>{l('የዳቦ ማከፋፈያ እና ሎጂስቲክስ', 'Raabsa Dabboo fi Lojistikii', 'Bread Logistics & Distribution')}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10] tracking-tight">
            {l('የሳጥን ዳቦ ማዘዋወሪያ እና የማድረስ ስራዎች', 'Dabboo Saanduqaan Dabarsuu fi Dhiyeessii', 'Bread Crates Logistics & Transit Dispatch')}
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-1 max-w-xl">
            {l('ከማዕከል ወደ ቸርቻሪ ቅርንጫፎች የሚላኩ ምርቶች ማስተላለፊያ እና የርክክብ ማረጋገጫ።', 'Wiirtuu irraa gara dammeewwanii oomisha dabarsuu fi walharkaa fuudhinsa mirkaneessuu.', 'Direct multi-product branch dispatch with destination branch verification & inventory credit.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={openDispatchModal}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{l('አዲስ ማኒፌስት ፍጠር', 'Maanifeestii Haaraa Uumi', 'Create Manifest')}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-[#FAF7EE] border border-[#EDE4D5] text-[#8C7361] hover:text-[#2C1B10] transition-colors shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FFFDF8] rounded-2xl p-5 border border-[#EDE4D5] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-[#8C7361]">
              {l('የዛሬ የተላኩ ሳጥኖች', 'Saanduuqa Har\'a Ergame', 'Crates Dispatched Today')}
            </span>
            <Truck className="w-4 h-4 text-[#E87A18]" />
          </div>
          <p className="text-2xl font-black text-[#2C1B10] mt-2">
            {metrics.cratesDispatchedToday}{' '}
            <span className="text-sm font-bold text-[#8C7361]">{l('ሳጥን', 'saanduuqa', 'crates')}</span>
          </p>
          <p className="text-xs text-emerald-700 font-bold mt-1">
            {metrics.loavesDistributedToday.toLocaleString()}{' '}
            {l('ዳቦዎች ተሰራጭተዋል', 'dabboowwan raabsamaniiru', 'loaves distributed across branches')}
          </p>
        </div>

        <div className="bg-[#FFFDF8] rounded-2xl p-5 border border-[#EDE4D5] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-[#8C7361]">
              {l('በቅርንጫፍ የደረሰ', 'Dammeetti kan Qaqqabe', 'Delivered to Spokes')}
            </span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-2">
            {metrics.cratesReceivedToday}{' '}
            <span className="text-sm font-bold text-[#8C7361]">{l('ሳጥን', 'saanduuqa', 'crates')}</span>
          </p>
          <p className="text-xs text-[#8C7361] mt-1">
            {l('በችርቻሮ ቅርንጫፎች የተረከቡ', 'Dammeewwaniin kan fudhataman', 'Verified and added to store shelf stock')}
          </p>
        </div>

        <div className="bg-[#FFFDF8] rounded-2xl p-5 border border-[#EDE4D5] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-[#8C7361]">
              {l('በመንገድ ላይ ያለ', 'Karaarratti kan Jiru', 'In Transit')}
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-800 mt-2">
            {metrics.cratesInTransitToday}{' '}
            <span className="text-sm font-bold text-[#8C7361]">{l('ሳጥን', 'saanduuqa', 'crates')}</span>
          </p>
          <p className="text-xs text-blue-700 font-bold mt-1">
            {metrics.cratesInTransitToday > 0
              ? l('በመንገድ ላይ ያለ ዝውውር', 'Imala irra kan jiru', 'Transfers in transit')
              : l('ምንም በመንገድ ላይ ያለ ማኒፌስት የለም', 'Maanifeestiin karaarra jiru hin jiru', 'No shipments currently en route')}
          </p>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-3xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-[#EDE4D5] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-[#2C1B10]">
              {l('የተላኩ ማኒፌስቶች', 'Maanifeestiiwwan Ergaman', 'Delivery Manifests')}
            </h2>
            <p className="text-xs text-[#8C7361] mt-0.5">
              {l('ከዳታቤዝ የቀረበ የሳጥን ዳቦ ማዘዋወሪያ እና የርክክብ ሁኔታ', 'Haala dhiyeessii fi walharkaa fuudhinsaa dhugaa', 'Real-time database-tracked crate dispatches')}
            </p>
          </div>
          <span className="text-xs font-bold text-[#8C7361] self-start md:self-auto">
            {totalCount} {l('ማኒፌስቶች', 'maanifeestii', 'manifests')}
          </span>
        </div>

        {/* Filter Toolbar: Branch Filter, Status Filter & Search */}
        <div className="p-3 sm:p-4 bg-[#FAF7EE]/60 border-b border-[#EDE4D5] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left filters: Branch & Status */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Branch Filter Dropdown */}
            <div className="relative flex items-center min-w-[180px]">
              <Building2 className="w-4 h-4 text-[#8C7361] absolute left-3 pointer-events-none" />
              <select
                value={filterBranchId}
                onChange={(e) => handleBranchFilterChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10] hover:border-[#8C7361] focus:ring-1 focus:ring-[#E87A18] focus:outline-none transition cursor-pointer appearance-none shadow-2xs"
                title={l('በቅርንጫፍ አጣራ', 'Dammeen calali', 'Filter by Branch')}
              >
                <option value="ALL">🌐 {l('ሁሉም ቅርንጫፎች', 'Dammeewwan Hunda', 'All Branches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    📍 {translateBranchName(b.name, language)} {b.isHub ? `(${l('ማዕከል', 'Wiirtuu', 'Hub')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center p-1 bg-white border border-[#EDE4D5] rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => { setFilterStatus('ALL'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  filterStatus === 'ALL'
                    ? 'bg-[#E87A18] text-white shadow-xs'
                    : 'text-[#8C7361] hover:text-[#2C1B10]'
                }`}
              >
                {l('ሁሉም', 'Hunda', 'All')}
              </button>
              <button
                type="button"
                onClick={() => { setFilterStatus('DISPATCHED'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  filterStatus === 'DISPATCHED'
                    ? 'bg-[#E87A18] text-white shadow-xs'
                    : 'text-[#8C7361] hover:text-[#2C1B10]'
                }`}
              >
                {l('በመንገድ ላይ', 'Karaarratti', 'In Transit')}
              </button>
              <button
                type="button"
                onClick={() => { setFilterStatus('RECEIVED'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  filterStatus === 'RECEIVED'
                    ? 'bg-[#E87A18] text-white shadow-xs'
                    : 'text-[#8C7361] hover:text-[#2C1B10]'
                }`}
              >
                {l('የተረከቡ', 'Kan Fudhataman', 'Received')}
              </button>
            </div>
          </div>

          {/* Right search input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-[#8C7361] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={l('ማኒፌስት፣ ምርት ወይም ሹፌር ፈልግ...', 'Maanifeestii, oomisha barbaadi...', 'Search manifest, product, driver...')}
              className="w-full pl-9 pr-8 py-2 bg-white border border-[#EDE4D5] rounded-xl text-xs text-[#2C1B10] placeholder:text-[#8C7361]/60 hover:border-[#8C7361] focus:ring-1 focus:ring-[#E87A18] focus:outline-none transition shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7361] hover:text-[#2C1B10]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#8C7361] flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#E87A18]" />
            <span className="text-xs font-bold">{l('ማኒፌስቶች በመጫን ላይ...', 'Maanifeestii fe\'aa jira...', 'Loading manifests...')}</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs font-bold">{error}</div>
        ) : (
          <>
            {/* Mobile Touch Cards: Transfers (block md:hidden) */}
            <div className="block md:hidden divide-y divide-[#EDE4D5]/70 p-3 space-y-3">
              {transfers.length === 0 ? (
                <div className="p-8 text-center text-[#8C7361] text-xs font-bold">
                  {l('ምንም ማኒፌስት አልተገኘም', 'Maanifeestiin hin jiru', 'No manifests found')}
                </div>
              ) : (
                transfers.map((t) => (
                  <div key={t.id} className="p-4 rounded-2xl bg-white border border-[#EDE4D5] shadow-2xs space-y-3">
                    {/* Top Row: Manifest Number & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-[#4A2E1B] bg-[#FAF7EE] px-2 py-0.5 rounded-lg border border-[#EDE4D5]">
                        {t.manifestNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'RECEIVED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {translateStatus(t.status, language)}
                      </span>
                    </div>

                    {/* Route: Origin -> Destination */}
                    <div className="flex items-center gap-2 font-bold text-xs text-[#2C1B10] bg-[#FAF6F0]/60 p-2.5 rounded-xl border border-[#EDE4D5]/60">
                      <span className="truncate flex-1">{translateBranchName(t.originBranchName, language)}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
                      <span className="text-[#E87A18] font-black truncate flex-1 text-right">{translateBranchName(t.destBranchName, language)}</span>
                    </div>

                    {/* Product & Quantity details */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#4A2E1B] truncate mr-2">
                        <PackageCheck className="w-4 h-4 text-[#E87A18] shrink-0" />
                        <span className="truncate">{t.productName}</span>
                      </div>
                      <span className="font-mono font-black text-[#2C1B10] shrink-0">
                        {t.loavesCount.toLocaleString()} {l('ፍሬ', 'firii', 'units')}
                        {t.cratesCount > 0 && (
                          <span className="text-[#8C7361] font-normal text-[10px] ml-1">
                            ({t.cratesCount} {l('ሳጥን', 'saanduuqa', 'crates')})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Driver & Timestamp */}
                    <div className="flex items-center justify-between text-[11px] text-[#8C7361] pt-2 border-t border-[#EDE4D5]/60">
                      <span>Driver: <strong className="text-[#4A2E1B]">{t.driverName}</strong></span>
                      <span>{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Action Button */}
                    {t.status === 'DISPATCHED' ? (
                      <button
                        type="button"
                        onClick={() => openReceiveModal(t)}
                        className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{l('አረጋግጥና ተቀበል', 'Mirkaneessi fi Fudhadhu', 'Receive & Verify Delivery')}</span>
                      </button>
                    ) : (
                      <div className="pt-1 flex items-center justify-end text-[11px] font-bold text-emerald-700 gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{l('ተረክቧል (ተጠናቋል)', 'Simatameera', 'Received & Stock Credited')}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-[#FAF7EE] text-[#4A2E1B] font-bold border-b border-[#EDE4D5]">
                  <tr>
                    <th className="py-3.5 px-4">{l('ማኒፌስት', 'Maanifeestii', 'Manifest #')}</th>
                    <th className="py-3.5 px-4">{l('መነሻ እና መድረሻ', 'Ka\'umsa fi Gahiinsa', 'Origin & Destination')}</th>
                    <th className="py-3.5 px-4">{l('ምርት', 'Oomisha', 'Product')}</th>
                    <th className="py-3.5 px-4">{l('የዳቦ ብዛት', 'Baay\'ina Dabboo', 'Loaves')}</th>
                    <th className="py-3.5 px-4">{l('አሽከርካሪ', 'Konkolaachisaa', 'Driver')}</th>
                    <th className="py-3.5 px-4 text-center">{l('ሁኔታ', 'Haala', 'Status')}</th>
                    <th className="py-3.5 px-4 text-right">{l('ርክክብ', 'Walharkaa Fuudhinsa', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE4D5]">
                  {transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-[#FAF7EE]/50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#8C7361]">{t.manifestNumber}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-[#2C1B10]">
                          <span>{translateBranchName(t.originBranchName, language)}</span>
                          <ArrowRight className="w-3 h-3 text-[#E87A18]" />
                          <span className="text-[#E87A18]">{translateBranchName(t.destBranchName, language)}</span>
                        </div>
                        <span className="text-[10px] text-[#8C7361]">
                          {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#2C1B10]">
                        <div className="flex items-center gap-1.5">
                          <PackageCheck className="w-3.5 h-3.5 text-[#E87A18]" />
                          <span>{t.productName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-[#4A2E1B]">
                        {t.loavesCount.toLocaleString()} {l('ፍሬ', 'firii', 'units')}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold text-[#4A2E1B]">
                        {t.driverName}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {t.status === 'RECEIVED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {translateStatus(t.status, language)}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            {translateStatus(t.status, language)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {t.status === 'DISPATCHED' ? (
                          <button
                            type="button"
                            onClick={() => openReceiveModal(t)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{l('አረጋግጥና ተቀበል', 'Mirkaneessi fi Fudhadhu', 'Approve & Receive')}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{l('ተጠናቋል', 'Xumurameera', 'Completed')}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination Controls */}
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          pageSizeOptions={[10, 15, 25, 50]}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          isLoading={loading}
          itemLabel={l('ማኒፌስቶች', 'maanifeestii', 'manifests')}
          className="border-t border-[#EDE4D5] p-3 sm:p-4 bg-[#FFFDF8]"
        />
      </div>

      {/* Create Manifest Modal (Multi-Item Dispatch) */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl my-auto">
            <div className="p-4 sm:p-5 border-b border-[#EDE4D5] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-[#E87A18] shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2C1B10]">
                    {l('አዲስ የቅርንጫፍ ምርት ዝውውር ማኒፌስት', 'Maanifeestii Dabarsa Oomishaa', 'Dispatch Inter-Branch Stock Transfer')}
                  </h3>
                  <p className="text-[11px] text-[#8C7361] mt-0.5">
                    {l('ሁሉንም የሚላኩ ምርቶች (ዳቦ፣ ኬክ፣ ሳምቡሳ) በአንድ ዝውውር ይጨምሩ', 'Oomishaalee dabarfaman hunda bakka tokkotti galchaa', 'Transfer multiple products (bread, cakes, sambusa) in a single shipment.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="p-1.5 rounded-xl text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF7EE] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Destination Branch */}
              <div>
                <label className="font-bold text-[#4A2E1B] block mb-1">
                  {l('መድረሻ ቅርንጫፍ', 'Dammee Gahiinsaa', 'Destination Branch')}
                </label>
                <select
                  value={dispatchForm.destBranchId}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, destBranchId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE] text-[#2C1B10] font-bold text-xs focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                >
                  {branches
                    .filter((b) => !b.isHub)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {translateBranchName(b.name, language)} ({b.code})
                      </option>
                    ))}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase text-[#8C7361] tracking-wider">
                    {l('የሚላኩ ምርቶች ዝርዝር', 'Tarree Oomishaalee Ergaman', 'Products to Transfer')} ({dispatchForm.items.length})
                  </label>
                  <span className="text-[11px] font-bold text-[#E87A18]">
                    {l('በክምችት ያሉ ምርቶች ብቻ ይተላለፋሉ', 'Oomishaalee jiran qofa', 'Only in-stock products allowed')}
                  </span>
                </div>

                <div className="space-y-3">
                  {dispatchForm.items.map((item, index) => {
                    const prod = products.find((p) => p.id === item.productId);
                    const stock = prod?.availableStock ?? 0;
                    const isOver = item.quantity > stock;
                    const isZero = stock <= 0;

                    return (
                      <div
                        key={index}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isOver || isZero
                            ? 'bg-rose-50/50 border-rose-300'
                            : 'bg-[#FAF7EE] border-[#EDE4D5]'
                        } space-y-2.5`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-black uppercase text-[#8C7361] block mb-1">
                              {l('ምርት', 'Oomisha', 'Product')} #{index + 1}
                            </label>
                            <select
                              value={item.productId}
                              onChange={(e) => handleUpdateItem(index, { productId: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-[#EDE4D5] bg-white text-[#2C1B10] font-bold text-xs focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                            >
                              {products.map((p) => {
                                const pStock = p.availableStock ?? 0;
                                return (
                                  <option
                                    key={p.id}
                                    value={p.id}
                                    disabled={pStock <= 0}
                                    className={pStock <= 0 ? 'text-gray-400 italic' : 'text-[#2C1B10] font-bold'}
                                  >
                                    {p.name} — {pStock > 0 ? `(${pStock} in stock)` : `(Out of Stock - 0)`}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {dispatchForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="mt-5 p-2 rounded-xl text-[#8C7361] hover:text-rose-600 hover:bg-rose-100/50 transition cursor-pointer"
                              title={l('ሰርዝ', 'Haqi', 'Remove item')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#EDE4D5]/70 items-center">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-black uppercase text-[#8C7361]">
                                {l('ብዛት (ፍሬ/ዳቦ)', "Baay'ina", 'Quantity (Units)')}
                              </label>
                              <span
                                className={`text-[10px] font-mono font-black ${
                                  isZero ? 'text-rose-600' : 'text-emerald-700'
                                }`}
                              >
                                {stock} {l('በክምችት አለ', 'kuusaa', 'in stock')}
                              </span>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max={stock > 0 ? stock : 1}
                              required
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') {
                                  handleUpdateItem(index, { quantity: 0 });
                                  return;
                                }
                                const val = parseInt(raw, 10);
                                if (isNaN(val)) return;
                                const clamped = stock > 0 ? Math.min(Math.max(1, val), stock) : 0;
                                handleUpdateItem(index, { quantity: clamped });
                              }}
                              onKeyDown={(e) => {
                                if (['e', 'E', '+', '-'].includes(e.key)) {
                                  e.preventDefault();
                                }
                                if (e.key >= '0' && e.key <= '9') {
                                  const input = e.currentTarget;
                                  const start = input.selectionStart ?? 0;
                                  const end = input.selectionEnd ?? 0;
                                  const nextStr = input.value.slice(0, start) + e.key + input.value.slice(end);
                                  const nextVal = parseInt(nextStr, 10);
                                  if (!isNaN(nextVal) && stock > 0 && nextVal > stock) {
                                    e.preventDefault();
                                    handleUpdateItem(index, { quantity: stock });
                                  }
                                }
                              }}
                              onBlur={() => {
                                if ((item.quantity || 0) <= 0 && stock > 0) {
                                  handleUpdateItem(index, { quantity: 1 });
                                }
                              }}
                              className={`w-full px-3 py-2 rounded-xl border font-mono font-bold text-xs ${
                                isOver || isZero
                                  ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-400'
                                  : 'border-[#EDE4D5] bg-white text-[#2C1B10] focus:ring-[#E87A18]'
                              } focus:outline-none`}
                            />
                          </div>

                          <div className="flex flex-col justify-end text-[10px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {[10, 40, 100].map((step) => {
                                const isCrate = step === 40;
                                const isTooHigh = step > stock || stock <= 0;
                                return (
                                  <button
                                    key={step}
                                    type="button"
                                    disabled={isTooHigh}
                                    onClick={() => handleUpdateItem(index, { quantity: Math.min(step, stock) })}
                                    className="px-2 py-1 rounded-lg bg-white border border-[#EDE4D5] text-[10px] font-bold text-[#4A2E1B] hover:bg-[#F4ECE1] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {isCrate ? '1 Crate (40)' : `${step}`}
                                  </button>
                                );
                              })}
                              {stock > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(index, { quantity: stock })}
                                  className="px-2 py-1 rounded-lg bg-amber-100 border border-amber-300 text-[10px] font-black text-amber-900 hover:bg-amber-200 cursor-pointer"
                                >
                                  Max ({stock})
                                </button>
                              )}
                            </div>
                            {item.quantity >= 40 && (
                              <span className="text-[10px] font-mono text-[#8C7361] mt-1 block">
                                ≈ {Math.floor(item.quantity / 40)} crates {item.quantity % 40 > 0 ? `+ ${item.quantity % 40} loose` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Error Warning Badges */}
                        {isOver && (
                          <div className="p-2 rounded-xl bg-rose-100/70 border border-rose-300 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-700" />
                            <span>
                              {l(
                                `የተጠየቀው ብዛት (${item.quantity}) ካለው ክምችት (${stock}) በላይ ነው!`,
                                `Baay'inni gaafatame (${item.quantity}) kuusaa jiru (${stock}) irra caala!`,
                                `Requested quantity (${item.quantity}) exceeds available stock (${stock})!`
                              )}
                            </span>
                          </div>
                        )}
                        {isZero && (
                          <div className="p-2 rounded-xl bg-rose-100/70 border border-rose-300 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-700" />
                            <span>
                              {l(
                                'ይህ ምርት በክምችት ውስጥ የለም! ሊተላለፍ አይችልም።',
                                "Oomishni kun kuusaa keessatti hin jiru! Dabarsuun hindanda'amu.",
                                'This product is currently out of stock at origin! Cannot transfer.'
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Auto Receive Checkbox */}
                <label className="flex items-start gap-2.5 p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={dispatchForm.autoReceive}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, autoReceive: e.target.checked })}
                    className="mt-0.5 rounded text-[#E87A18] focus:ring-[#E87A18] w-4 h-4 cursor-pointer shrink-0"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-[#2C1B10] block">
                      {l('ቀጥታ ዝውውር (በተቀባይ ቅርንጫፍ ወዲያውኑ ገቢ ይሁን)', 'Daddabarsa Kallattii (Dammeen fudhatu yeruma sana haa fudhatu)', 'Direct Transfer (Auto-receive & credit stock immediately at destination)')}
                    </span>
                    <span className="text-[10px] text-[#8C7361] block mt-0.5">
                      {l('ከተመረጠ ዕቃው ወዲያውኑ ወደ ተቀባይ ቅርንጫፍ ክምችት ገቢ ሆኖ ለሽያጭ ዝግጁ ይሆናል።', 'Yoo filatame oomishni battalatti kuusaa dammee sanatti galmaa\'ee gurgurtaaf qophii ta\'a.', 'If checked, transferred items are immediately added to the destination branch inventory without waiting for a manual receipt.')}
                    </span>
                  </div>
                </label>

                {/* Button to Add More Products */}
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-[#E87A18] text-[#E87A18] hover:bg-amber-50/50 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {l('+ ተጨማሪ ምርት ወደ ዝውውሩ ጨምር', '+ Oomisha Dabalataa Galchi', '+ Add Another Product to Transfer')}
                  </span>
                </button>
              </div>

              {/* Dynamic Overall Math Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/90 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-900 block">
                    {l('ጠቅላላ የሚተላለፉ ምርቶች ድምር', 'Waliigala Oomishaalee Dabarfaman', 'Total Shipment Summary')}
                  </span>
                  <span className="text-sm font-black text-[#2C1B10] mt-0.5 block">
                    {dispatchForm.items.length} {l('የተለያዩ ምርቶች', 'oomishaalee', 'products')} •{' '}
                    {totalTransferUnits.toLocaleString()} {l('ጠቅላላ ፍሬ/ዳቦ', 'waliigala', 'total units')}
                  </span>
                </div>
                <Boxes className="w-6 h-6 text-[#E87A18]" />
              </div>

              <div className="pt-3 border-t border-[#EDE4D5] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#EDE4D5] font-bold text-[#8C7361] hover:text-[#2C1B10] transition-colors cursor-pointer text-center"
                >
                  {l('ሰርዝ', 'Haqi', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || hasStockErrors}
                  className="px-5 py-2.5 rounded-xl bg-[#E87A18] hover:bg-[#D96B10] text-white font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-[0.98]"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {l(
                      `ዝውውሩን ላክና ክምችት ቀንሰው (${dispatchForm.items.length} ምርቶች)`,
                      `Ergi (${dispatchForm.items.length})`,
                      `Confirm & Dispatch (${dispatchForm.items.length} items)`
                    )}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Shipment Modal */}
      {receiveModalTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl my-auto">
            <div className="p-4 sm:p-5 border-b border-[#EDE4D5] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-[#2C1B10]">
                  {l('የማኒፌስት ርክክብ ማረጋገጫ', 'Walharkaa Fuudhinsa Maanifeestii', 'Receive Shipment Handshake')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiveModalTarget(null)}
                className="p-1.5 rounded-lg text-[#8C7361] hover:text-[#2C1B10] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-[#FAF7EE] border border-[#EDE4D5] text-xs">
                <div className="flex justify-between font-bold text-[#4A2E1B]">
                  <span>{receiveModalTarget.manifestNumber}</span>
                  <span>{receiveModalTarget.cratesCount} {l('ሳጥን', 'saanduuqa', 'crates')} ({receiveModalTarget.loavesCount} {l('ዳቦ', 'dabboo', 'loaves')})</span>
                </div>
                <div className="text-[#8C7361] mt-1 flex items-center justify-between">
                  <span>{l('የሚተላለፍ ምርት', 'Oomisha', 'Product')}: <strong className="text-[#2C1B10]">{receiveModalTarget.productName}</strong></span>
                  <span className="text-emerald-700 font-bold">{l('ቀጥታ ዝውውር', 'Dabarsa Kallattii', 'Direct Transfer')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#4A2E1B] block mb-1">
                    {l('ትክክለኛ የተረከቡት ዳቦ', 'Dabboo Qulqulluu Fudhatame', 'Good Loaves Received')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={receiveForm.goodLoavesReceived}
                    onChange={(e) => setReceiveForm({ ...receiveForm, goodLoavesReceived: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE] text-[#2C1B10] font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#4A2E1B] block mb-1">
                    {l('የተጨፈለቀ / የተበላሸ ዳቦ', 'Dabboo Manca\'e', 'Transit Damaged Loaves')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={receiveForm.damagedLoavesCount}
                    onChange={(e) => setReceiveForm({ ...receiveForm, damagedLoavesCount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE] text-[#2C1B10] font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#4A2E1B] block mb-1">
                  {l('ወደ መኪና የተመለሱ ባዶ ሳጥኖች', 'Saanduuqa Duwwaa Deebi\'e', 'Empty Plastic Crates Returned to Van')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={receiveForm.emptyCratesReturned}
                  onChange={(e) => setReceiveForm({ ...receiveForm, emptyCratesReturned: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE] text-[#2C1B10] font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-[#4A2E1B] block mb-1">
                  {l('የልዩነት ማስታወሻ', 'Yaada Garaagarummaa', 'Discrepancy Notes')}
                </label>
                <input
                  type="text"
                  placeholder={l('ለምሳሌ፡ 2 ዳቦ በትራንስፖርት ተጨፍልቋል', 'Fkn: Dabboo 2 geejjibarratti caccabe', 'e.g. 2 loaves crushed on bumpy road')}
                  value={receiveForm.discrepancyNotes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, discrepancyNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EDE4D5] bg-[#FAF7EE] text-[#2C1B10] font-bold"
                />
              </div>

              <div className="pt-3 border-t border-[#EDE4D5] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setReceiveModalTarget(null)}
                  className="px-4 py-2 rounded-xl border border-[#EDE4D5] font-bold text-[#8C7361] hover:text-[#2C1B10] cursor-pointer text-center"
                >
                  {l('ሰርዝ', 'Haqi', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{l('ተረከብና ክምችቱን ጨምር', 'Fudhadhu', 'Confirm Receipt & Credit Stock')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ConfirmModalComponent}
    </div>
  );
}
