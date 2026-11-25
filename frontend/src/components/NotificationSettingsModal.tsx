'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Volume2,
  Vibrate,
  Sparkles,
  ShieldAlert,
  Boxes,
  Clock,
  CreditCard,
  Banknote,
  Truck,
  Receipt,
  Flame,
  Check,
  Play,
  Smartphone,
  Loader2,
  Music2,
  Disc,
  AlertTriangle,
  Radio
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  SoundTheme,
  testNotificationSound,
  testVibration
} from '@/lib/notificationAudio';
import {
  getPushSubscriptionState,
  subscribeToPushNotifications,
  unsubscribePush
} from '@/lib/pushNotifications';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreferencesUpdated?: () => void;
}

interface SoundThemeOption {
  id: SoundTheme;
  name: string;
  desc: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const SOUND_THEMES: SoundThemeOption[] = [
  {
    id: 'CHIME',
    name: 'Caramel Chime',
    desc: 'Warm harmonic tone',
    icon: Music2,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-[#E87A18]'
  },
  {
    id: 'BELL',
    name: 'Digital Bell',
    desc: 'Clear high ping',
    icon: Bell,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600'
  },
  {
    id: 'POP',
    name: 'Subtle Pop',
    desc: 'Soft acoustic droplet',
    icon: Disc,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600'
  },
  {
    id: 'ALARM',
    name: 'Urgent Alarm',
    desc: 'Tri-tone warning alert',
    icon: AlertTriangle,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600'
  },
];

export default function NotificationSettingsModal({
  isOpen,
  onClose,
  onPreferencesUpdated,
}: NotificationSettingsModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isOwner = user?.role === 'OWNER';

  const l = (am: string, om: string, en: string) => {
    if (language === 'am') return am;
    if (language === 'om') return om;
    return en;
  };

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);

  // Hardware & PWA Controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundTheme, setSoundTheme] = useState<SoundTheme>('CHIME');
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [inAppToasts, setInAppToasts] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<string>('default');

  // Category Toggles
  const [stockIn, setStockIn] = useState(true);
  const [stockOut, setStockOut] = useState(true);
  const [stockAdjust, setStockAdjust] = useState(true);
  const [lowStock, setLowStock] = useState(true);
  const [supplierDeliveries, setSupplierDeliveries] = useState(true);
  const [attendanceLate, setAttendanceLate] = useState(true);
  const [attendancePunches, setAttendancePunches] = useState(false);
  const [customerCredit, setCustomerCredit] = useState(true);
  const [staffLoans, setStaffLoans] = useState(true);
  const [transfers, setTransfers] = useState(true);
  const [dailyClose, setDailyClose] = useState(true);
  const [cashDiscrepancy, setCashDiscrepancy] = useState(true);
  const [productionBatches, setProductionBatches] = useState(false);

  // Admin Delegation (Owner only)
  const [adminReceivesAlerts, setAdminReceivesAlerts] = useState(false);

  // Load Preferences & Push Status on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [prefRes, pushState] = await Promise.all([
          api.get('/notifications/preferences').catch(() => null),
          getPushSubscriptionState().catch(() => null),
        ]);

        if (pushState) {
          setPushSupported(pushState.isSupported);
          setPushPermission(pushState.permission);
          setPushEnabled(pushState.isSubscribed);
        }

        if (prefRes?.data) {
          const p = prefRes.data;
          setSoundEnabled(p.soundEnabled ?? true);
          setSoundTheme((p.soundTheme as SoundTheme) || 'CHIME');
          setVibrationEnabled(p.vibrationEnabled ?? true);
          setInAppToasts(p.inAppToasts ?? true);

          setStockIn(p.stockIn ?? true);
          setStockOut(p.stockOut ?? true);
          setStockAdjust(p.stockAdjust ?? true);
          setLowStock(p.lowStock ?? true);
          setSupplierDeliveries(p.supplierDeliveries ?? true);
          setAttendanceLate(p.attendanceLate ?? true);
          setAttendancePunches(p.attendancePunches ?? false);
          setCustomerCredit(p.customerCredit ?? true);
          setStaffLoans(p.staffLoans ?? true);
          setTransfers(p.transfers ?? true);
          setDailyClose(p.dailyClose ?? true);
          setCashDiscrepancy(p.cashDiscrepancy ?? true);
          setProductionBatches(p.productionBatches ?? false);
        }

        if (isOwner) {
          const delegRes = await api.get('/notifications/admin-delegation').catch(() => null);
          if (delegRes?.data && isMounted) {
            setAdminReceivesAlerts(delegRes.data.adminReceivesAlerts ?? false);
          }
        }
      } catch (err) {
        console.error('Failed to load notification settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, isOwner]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        soundEnabled,
        soundTheme,
        vibrationEnabled,
        pushEnabled,
        inAppToasts,
        stockIn,
        stockOut,
        stockAdjust,
        lowStock,
        supplierDeliveries,
        attendanceLate,
        attendancePunches,
        customerCredit,
        staffLoans,
        transfers,
        dailyClose,
        cashDiscrepancy,
        productionBatches,
      };

      await api.put('/notifications/preferences', payload);

      if (isOwner) {
        await api.put('/notifications/admin-delegation', { adminReceivesAlerts });
      }

      // Save to localStorage for instant client-side sound/vibration lookup
      if (typeof window !== 'undefined') {
        localStorage.setItem('bakery_notif_sound_enabled', String(soundEnabled));
        localStorage.setItem('bakery_notif_sound_theme', soundTheme);
        localStorage.setItem('bakery_notif_vibration_enabled', String(vibrationEnabled));
        localStorage.setItem('bakery_notif_toasts_enabled', String(inAppToasts));
      }

      toast.success(
        l(
          'የማሳወቂያ ቅንብሮች በተሳካ ሁኔታ ተቀምጠዋል!',
          'Qindaa\'inni beeksisaa milkaa\'inaan olkaa\'ameera!',
          'Notification preferences saved successfully!'
        )
      );

      if (soundEnabled) {
        testNotificationSound(soundTheme);
      }
      if (vibrationEnabled) {
        testVibration('normal');
      }

      onPreferencesUpdated?.();
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.error ||
        l('ቅንብሮችን ማስቀመጥ አልተቻለም', 'Qindaa\'ina olkaa\'uu hin dandeenye', 'Failed to save preferences')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePush = async (checked: boolean) => {
    setPushEnabled(checked);
    if (checked) {
      const res = await subscribeToPushNotifications();
      if (!res.success) {
        setPushEnabled(false);
        toast.error(
          res.error === 'Permission denied'
            ? l('የስልክ ማሳወቂያ ፈቃድ ተከልክሏል', 'Heyyamni beeksisaa dhorkameera', 'Notification permission was denied in browser')
            : l('የስልክ ማሳወቂያን ማገናኘት አልተቻለም', 'Beeksisa waliin walqabsiisuu hin dandeenye', 'Failed to enable push notifications')
        );
      } else {
        toast.success(
          l('የስልክ ማሳወቂያ በተሳካ ሁኔታ ተገናኝቷል!', 'Beeksisni bilbilaa milkaa\'inaan qabateera!', 'Push notifications connected successfully!')
        );
      }
    } else {
      await unsubscribePush();
      toast.info(
        l('የስልክ ማሳወቂያ ተዘግቷል', 'Beeksisni bilbilaa cufameera', 'Push notifications turned off')
      );
    }
    const state = await getPushSubscriptionState();
    setPushPermission(state.permission);
  };

  const handleSendTestPush = async () => {
    setIsTestingPush(true);
    try {
      await api.post('/notifications/test');
      toast.success(
        l('የሙከራ ማሳወቂያ ተልኳል!', 'Beeksisni yaalii ergameera!', 'Test notification dispatched!')
      );
      if (soundEnabled) {
        testNotificationSound(soundTheme);
      }
      if (vibrationEnabled) {
        testVibration('double');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Test notification failed');
    } finally {
      setIsTestingPush(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[94vw] sm:w-full sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-3xl border border-[#EDE4D5] shadow-2xl bg-[#FBF9F5]">
        {/* Modal Header */}
        <DialogHeader className="px-5 py-4 sm:px-6 sm:py-5 bg-gradient-to-r from-[#4A2E1B] to-[#2C1B10] text-white shrink-0 pr-14 sm:pr-16">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#E87A18] flex items-center justify-center text-white shadow-md shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm sm:text-lg font-black text-white truncate tracking-tight">
                  {l('የማሳወቂያዎች እና ድምፅ ቅንብር', 'Qindaa\'ina Beeksisaa fi Sagalee', 'Notification & Sound Controls')}
                </DialogTitle>
                <Badge className="bg-[#FAF7EE] text-[#4A2E1B] text-[10px] font-bold px-2 py-0.5 uppercase shrink-0">
                  PWA Ready
                </Badge>
              </div>
              <p className="text-xs text-[#E2C7B4] mt-0.5 truncate leading-relaxed">
                {l(
                  'ድምፅ፣ ንዝረት እና የሥራ ማሳወቂያዎችን እንደፍላጎትዎ ያስተካክሉ',
                  'Sagalee, socho\'iinsa fi beeksisoota akka fedha keessanitti jijjiiraa',
                  'Customize audio chimes, haptics, and event alert subscriptions'
                )}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto min-h-[400px] p-4 sm:p-6 space-y-4 sm:space-y-5">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#8C7361]">
              <Loader2 className="w-8 h-8 animate-spin text-[#E87A18]" />
              <span className="text-xs font-bold font-mono">
                {l('ቅንብሮችን በማምጣት ላይ...', 'Qindaa\'ina fidaa jira...', 'Loading preferences...')}
              </span>
            </div>
          ) : (
            <>
              {/* SECTION 1: Hardware & App Experience (Divided clean row architecture) */}
              <div className="rounded-2xl bg-white border border-[#EDE4D5] shadow-xs overflow-hidden">
                <div className="p-4 sm:px-5 sm:py-4 bg-[#FAF6F0]/80 border-b border-[#EDE4D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-[#E87A18] flex items-center justify-center shrink-0">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-[#2C1B10] tracking-tight">
                        {l('የመተግበሪያ ድምፅ እና ንዝረት', 'Sagalee fi Socho\'iinsa App', 'App Sound & Haptic Chimes')}
                      </h4>
                      <p className="text-xs text-[#8C7361] mt-0.5">
                        {l('ማሳወቂያ ሲመጣ የሚሰማ ድምፅ እና የሞባይል ንዝረት', 'Yeroo beeksisni dhufu sagalee fi socho\'iinsa bilbilaa', 'Audible tones and vibration on incoming updates')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => testNotificationSound(soundTheme)}
                      className="h-8.5 px-3 rounded-xl border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] bg-white hover:bg-[#FAF6F0] flex items-center gap-1.5 shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-[#4A2E1B] text-[#4A2E1B]" />
                      <span>{l('ድምፅ ሞክር', 'Yaali', 'Play Tone')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => testVibration('double')}
                      className="h-8.5 px-3 rounded-xl border-amber-200 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Vibrate className="w-3.5 h-3.5 text-amber-700" />
                      <span>{l('ንዝረት ሞክር', 'Socho\'i Yaali', 'Vibrate')}</span>
                    </Button>
                  </div>
                </div>

                <div className="divide-y divide-zinc-100">
                  {/* Sound Toggle Row */}
                  <div className="p-4 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/40 transition-colors">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <span className="text-sm font-bold text-[#2C1B10] block">
                        {l('የማሳወቂያ ድምፅ (Audio Chime)', 'Sagalee Beeksisaa', 'Notification Sound')}
                      </span>
                      <span className="text-xs text-[#8C7361] block leading-relaxed">
                        {soundEnabled ? l('በርቷል — ማሳወቂያ ሲመጣ ዜማ ይሰማል', 'Baneera — sagaleen ni dhagahama', 'Active — plays selected melodic chime on alert') : l('ጠፍቷል — ድምፅ አልባ', 'Cufameera — sagalee malee', 'Muted — visual only')}
                      </span>
                    </div>
                    <Switch
                      checked={soundEnabled}
                      onCheckedChange={(val) => setSoundEnabled(val)}
                      className="shrink-0"
                    />
                  </div>

                  {/* Sound Profile Selector */}
                  {soundEnabled && (
                    <div className="p-4 sm:px-5 sm:py-4 bg-[#FAF6F0]/50 space-y-2.5">
                      <label className="text-xs font-bold text-[#4A2E1B] uppercase tracking-wider block">
                        {l('የድምፅ ዓይነት ይምረጡ', 'Gosa Sagalee Filadhaa', 'Choose Audio Tone Profile')}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {SOUND_THEMES.map((item) => {
                          const Icon = item.icon;
                          const isSelected = soundTheme === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSoundTheme(item.id);
                                testNotificationSound(item.id);
                              }}
                              className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${isSelected
                                ? 'bg-amber-100/90 border-[#E87A18] text-[#2C1B10] font-black ring-2 ring-[#E87A18]/30 shadow-xs'
                                : 'bg-white border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B]'
                                }`}
                            >
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#E87A18] text-white shadow-xs' : `${item.iconBg} ${item.iconColor}`
                                }`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold block truncate">{item.name}</span>
                                <span className="text-[10px] text-[#8C7361] block truncate">{item.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Vibration Row */}
                  <div className="p-4 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/40 transition-colors">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <span className="text-sm font-bold text-[#2C1B10] block">
                        {l('የሞባይል ንዝረት (Haptic Vibration)', 'Socho\'iinsa Bilbilaa', 'Haptic Vibration')}
                      </span>
                      <span className="text-xs text-[#8C7361] block leading-relaxed">
                        {vibrationEnabled ? l('በርቷል — ስልክዎ ኪስዎ ውስጥ እያለ ይንቀጠቀጣል', 'Baneera — bilbilli ni socho\'a', 'Active — mobile device vibrates on new updates') : l('ጠፍቷል — ንዝረት አይኖርም', 'Cufameera', 'Disabled')}
                      </span>
                    </div>
                    <Switch
                      checked={vibrationEnabled}
                      onCheckedChange={(val) => setVibrationEnabled(val)}
                      className="shrink-0"
                    />
                  </div>

                  {/* PWA Device Push Row */}
                  <div className="p-4 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/40 transition-colors">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <span className="text-sm font-bold text-[#2C1B10] block flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-[#E87A18]" />
                        <span>{l('የስልክ ማሳወቂያ (PWA Device Push)', 'Beeksisa Bilbilaa', 'Device Push Alerts')}</span>
                      </span>
                      <span className="text-xs text-[#8C7361] block leading-relaxed">
                        {pushEnabled ? l('ንቁ — አፕ ሲዘጋም ማሳወቂያ ይደርስዎታል', 'Hojjataa jira — yeroo appliin cufamus ni dhufa', 'Connected — alerts arrive even when app is closed') : l('አልተገናኘም — ለማብራት ማብሪያውን ይጫኑ', 'Hin qabanne', 'Not connected — toggle to request device push permission')}
                      </span>
                    </div>
                    <Switch
                      checked={pushEnabled}
                      onCheckedChange={handleTogglePush}
                      className="shrink-0"
                    />
                  </div>

                  {/* In-App Toasts Row */}
                  <div className="p-4 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/40 transition-colors">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <span className="text-sm font-bold text-[#2C1B10] block flex items-center gap-2">
                        <Radio className="w-4 h-4 text-[#E87A18]" />
                        <span>{l('የውስጥ ብቅ-ባይ ባነሮች (Screen Toasts)', 'Beeksisa Keessaa', 'In-App Toast Banners')}</span>
                      </span>
                      <span className="text-xs text-[#8C7361] block leading-relaxed">
                        {inAppToasts ? l('በስክሪኑ ላይ ብቅ ይላል', 'Iskiriinii irratti ni mul\'ata', 'Floating banner pops up on screen') : l('በደወሉ ላይ ብቻ ይቀመጣል (ዝምተኛ)', 'Qilleensa qofa', 'Subdued — updates silent badge count only')}
                      </span>
                    </div>
                    <Switch
                      checked={inAppToasts}
                      onCheckedChange={(val) => setInAppToasts(val)}
                      className="shrink-0"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Admin Delegation (Owner Only) */}
              {isOwner && (
                <div className="rounded-2xl bg-gradient-to-r from-amber-50/90 to-orange-50/90 border-2 border-amber-300/80 shadow-xs p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-[#E87A18] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <ShieldAlert className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black text-amber-950">
                            {l('የአድሚን ማሳወቂያ ውክልና', 'Heyyama Beeksisaa Admin', 'Admin Notification Delegation')}
                          </h4>
                          <Badge className="bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wide">
                            Owner Root
                          </Badge>
                        </div>
                        <p className="text-xs text-amber-900/85 leading-relaxed">
                          {l(
                            'ለቅርንጫፍ አድሚኖች የሥራ ማሳወቂያዎች (ዕቃ ገቢ፣ ክምችት፣ ብድርና ሽያጭ) እንዲደርሳቸው ይፍቀዱ። ይህ ሲጠፋ፣ ሁሉም ማሳወቂያዎች ለባለቤቱ ብቻ በጥብቅ ይገደባሉ።',
                            'Adminoota dameef beeksisoonni akka gahan heyyamaa. Kun yoo cufame, beeksisni hundi abbaa qabeenyaa qofatti daangeffama.',
                            'Permit Branch Admins to receive bakery operational notifications. When disabled, all management alerts are strictly confined to the Owner.'
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 pt-1">
                      <Switch
                        checked={adminReceivesAlerts}
                        onCheckedChange={(val) => setAdminReceivesAlerts(val)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: Granular Operational Category Toggles (Clean Divided Architecture) */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-[#4A2E1B]">
                    {l('የሥራ ክንዋኔዎች ማሳወቂያ ምርጫ (8 ዘርፎች)', 'Filannoo Kutaalee Hojii 8', 'Operational Event Subscriptions (8 Modules)')}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isTestingPush}
                    onClick={handleSendTestPush}
                    className="h-8 px-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100/60 rounded-xl flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#E87A18]" />
                    <span>{isTestingPush ? '...' : l('የሙከራ ማሳወቂያ ላክ', 'Yaalii Ergi', 'Send Test Alert')}</span>
                  </Button>
                </div>

                {/* 1. Inventory & Raw Materials */}
                <div className="rounded-2xl bg-white border border-[#EDE4D5] shadow-xs overflow-hidden">
                  <div className="px-4.5 py-3.5 bg-[#FAF6F0]/80 border-b border-[#EDE4D5] flex items-center gap-2.5">
                    <Boxes className="w-4 h-4 text-[#E87A18]" />
                    <span className="text-sm font-black text-[#2C1B10]">
                      {l('1. የዕቃ ግምጃ ቤት እና ጥሬ ዕቃ', '1. Kuusaa fi Meeshaa Dheedhii', '1. Warehouse Stock & Raw Materials')}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('የዕቃ ገቢ ምዝገባ', 'Galii Meeshaa Kuusaa', 'Stock Intake Notifications')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('አዲስ የተገዛ ጥሬ ዕቃ ወይም ገቢ ሲመዘገብ የሚላክ', 'Yeroo meeshaan dheedhiin haaraan galu', 'When Storekeeper records bought or imported raw goods')}
                        </span>
                      </div>
                      <Switch checked={stockIn} onCheckedChange={setStockIn} className="shrink-0" />
                    </div>

                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('ለሠራተኛ የወጣ ጥሬ ዕቃ', 'Meeshaa Hojjataaf Kenname', 'Material Disbursement to Workers')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('ለጋጋሪው ወይም ለሠራተኛ ዕቃ ሲሰጥና ሰራተኛው ሲታወቅ', 'Yeroo meeshaan hojjataaf baasii ta\'u', 'When materials are disbursed to tagged staff')}
                        </span>
                      </div>
                      <Switch checked={stockOut} onCheckedChange={setStockOut} className="shrink-0" />
                    </div>

                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-rose-900 flex items-center gap-2">
                          <span>{l('የክምችት ስህተት ማስተካከያ', 'Sirreeffama Dogoggora Kuusaa', 'Direct Count Adjustments / Audits')}</span>
                          <Badge className="bg-rose-100 text-rose-800 text-[9px] px-1.5 py-0.5 shrink-0">Audit</Badge>
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('በስህተት የተመዘገበ ዕቃ መጠን በቀጥታ ሲስተካከል የሚላክ አፋጣኝ ኦዲት', 'Ooditii ariifachiisaa yeroo lakkoofsi kuusaa sirreeffamu', 'Instant audit alert when mistaken counts are edited')}
                        </span>
                      </div>
                      <Switch checked={stockAdjust} onCheckedChange={setStockAdjust} className="shrink-0" />
                    </div>

                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('ዝቅተኛ እና ያለቀ ክምችት', 'Meeshaa Xumurame / Hir\'ate', 'Low Stock & Depletion Warnings')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('ጥሬ ዕቃዎች ከደህንነት ወሰን በታች ሲወርዱ ወይም ሲያልቁ', 'Yeroo kuusaan sadarkaa eegumsaa gadi bu\'u', 'When materials fall below safety thresholds or reach zero')}
                        </span>
                      </div>
                      <Switch checked={lowStock} onCheckedChange={setLowStock} className="shrink-0" />
                    </div>

                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('የአቅራቢዎች ዕቃ ርክክብ', 'Galii Dhiyeessitootaa', 'Inward Supplier Deliveries')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('የአቅራቢዎች ዕቃ መምጣት፣ ማረጋገጥ ወይም ውድቅ መደረግ', 'Meeshaan dhiyeessitootaa yeroo mirkanaa\'u ykn dhowwamu', 'Supplier shipments arrived, confirmed, or rejected')}
                        </span>
                      </div>
                      <Switch checked={supplierDeliveries} onCheckedChange={setSupplierDeliveries} className="shrink-0" />
                    </div>
                  </div>
                </div>

                {/* 2. Attendance & Staffing */}
                <div className="rounded-2xl bg-white border border-[#EDE4D5] shadow-xs overflow-hidden">
                  <div className="px-4.5 py-3.5 bg-[#FAF6F0]/80 border-b border-[#EDE4D5] flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-black text-[#2C1B10]">
                      {l('2. የሠራተኞች ሰዓት አከባበር', '2. Hordoffii Sa\'aatii Hojjattootaa', '2. Staff Attendance & Biometrics')}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-amber-900 flex items-center gap-2">
                          <span>{l('አርፍደው የገቡ ሠራተኞች', 'Hojjattoota Sa\'aatii Dabarsanii Galan', 'Late Arrivals & Penalty Tiers')}</span>
                          <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 shrink-0">Tiers</Badge>
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('ሠራተኞች ከፈቃድ ሰዓት ዘግይተው ሲገቡና የቅጣት ደንብ ሲነካ', 'Yeroo hojjattoonni barfatan beeksisa ergamu', 'Notifies when staff punch in late, triggering late tiers')}
                        </span>
                      </div>
                      <Switch checked={attendanceLate} onCheckedChange={setAttendanceLate} className="shrink-0" />
                    </div>

                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('መደበኛ የሰዓት ምዝገባ', 'Galmee Sa\'aatii Guyyaa', 'Standard Shift Punches')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('እያንዳንዱ ሠራተኛ ጠዋትና ማታ ፎቶ ሲነሳ (ለብዙ ሠራተኞች ድምፅ ላለማብዛት ይመከራል)', 'Hojjataan yeroo seenuu fi bahu hunda', 'Every routine shift punch (recommend OFF for low noise)')}
                        </span>
                      </div>
                      <Switch checked={attendancePunches} onCheckedChange={setAttendancePunches} className="shrink-0" />
                    </div>
                  </div>
                </div>

                {/* 3. Customer Credits & Debt */}
                <div className="rounded-2xl bg-white border border-[#EDE4D5] shadow-xs overflow-hidden">
                  <div className="px-4.5 py-3.5 bg-[#FAF6F0]/80 border-b border-[#EDE4D5] flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-black text-[#2C1B10]">
                      {l('3. የደንበኞች ብድር እና ቀሪ ሂሳብ', '3. Liqii fi Qabeenya Maamiltootaa', '3. Customer Credit & Debt CRM')}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('የደንበኛ ብድር ሽያጭ እና ገደብ ማለፍ', 'Gurgurtaa Liqii fi Daangaa Darbuu', 'Debt Sales & Credit Limit Alerts')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('ዳቦ በብድር ሲሸጥ፣ የደንበኛ ዕዳ ሲያልፍ ወይም ብድር ሲከፈል', 'Yeroo daangaan liqii darbu ykn liqiin kaffalamu', 'When bread is sold on debt or customers exceed balance limit')}
                        </span>
                      </div>
                      <Switch checked={customerCredit} onCheckedChange={setCustomerCredit} className="shrink-0" />
                    </div>
                  </div>
                </div>

                {/* 4. Staff Loans & Financials */}
                <div className="rounded-2xl bg-white border border-[#EDE4D5] shadow-xs overflow-hidden">
                  <div className="px-4.5 py-3.5 bg-[#FAF6F0]/80 border-b border-[#EDE4D5] flex items-center gap-2.5">
                    <Banknote className="w-4 h-4 text-emerald-700" />
                    <span className="text-sm font-black text-[#2C1B10]">
                      {l('4. የሠራተኞች ብድር እና ወጪ', '4. Liqii Hojjattootaa fi Baasii', '4. Staff Loans & Financial Outflows')}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('የሠራተኛ ብድር እና የደመወዝ ቅድመ-ክፍያ', 'Gaaffii Liqii fi Mindaa Duraa', 'Staff Loan & Advance Requests')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('ሠራተኛ ብድር ሲጠይቅ ወይም በጥሬ ዕቃ ላይ የዱቤ ብድር ሲመዘገብ', 'Gaaffii liqii hojjattootaa fi liqii meeshaa', 'Employee loan requests and supplier credit purchases')}
                        </span>
                      </div>
                      <Switch checked={staffLoans} onCheckedChange={setStaffLoans} className="shrink-0" />
                    </div>
                  </div>
                </div>

                {/* 5. Inter-Branch Transfers */}
                <div className="rounded-2xl bg-white border border-[#EDE4D5] shadow-xs overflow-hidden">
                  <div className="px-4.5 py-3.5 bg-[#FAF6F0]/80 border-b border-[#EDE4D5] flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-black text-[#2C1B10]">
                      {l('5. የቅርንጫፎች ዕቃ ዝውውር', '5. Ce\'umsa Meeshaa Damee', '5. Inter-Branch Transfers & Crates')}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('የሳጥን ዝውውር እና ብክነት', 'Maanifeestii Saanduqaa fi Madaallii', 'Transfer Manifests & Shortages')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('ከማዕከላዊ ቦሌ ፋብሪካ የተላኩ ማኒፌስቶች፣ ርክክብ እና የተበላሹ ሳጥኖች ሪፖርት', 'Ce\'umsa saanduqaa damee gidduutti raawwatamu', 'Hub crate dispatch, spoke receipt, and damaged bread logs')}
                        </span>
                      </div>
                      <Switch checked={transfers} onCheckedChange={setTransfers} className="shrink-0" />
                    </div>
                  </div>
                </div>

                {/* 6. Register Closeout & Cash Drawer */}
                <div className="rounded-2xl bg-white border border-[#EDE4D5] shadow-xs overflow-hidden">
                  <div className="px-4.5 py-3.5 bg-[#FAF6F0]/80 border-b border-[#EDE4D5] flex items-center gap-2.5">
                    <Receipt className="w-4 h-4 text-amber-700" />
                    <span className="text-sm font-black text-[#2C1B10]">
                      {l('6. የቀን ሂሳብ መዝጊያ እና ካዝና', '6. Cufiinsa Herrega Guyyaa', '6. Cash Register & Day-End Closeout')}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('የቀን ሂሳብ መዝጊያ ሪፖርት', 'Gabaasa Cufiinsa Guyyaa', 'Daily Session Closeout Submission')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('ካሺየር የቀን መዝጊያ ሲያቀርብና የባለቤት ማረጋገጫ ሲጠብቅ', 'Yeroo kaashiyeeriin gabaasa cufiinsaa ergu', 'When cashier submits end-of-day register closeout')}
                        </span>
                      </div>
                      <Switch checked={dailyClose} onCheckedChange={setDailyClose} className="shrink-0" />
                    </div>

                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-rose-900 flex items-center gap-2">
                          <span>{l('የካዝና ገንዘብ ጉድለት/ብልጫ', 'Garaagarummaa Saanduqa Maallaqaa', 'Cash Drawer Variance & Discrepancies')}</span>
                          <Badge className="bg-rose-100 text-rose-800 text-[9px] px-1.5 py-0.5 shrink-0">Critical</Badge>
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('በካዝና ውስጥ ያለ ጥሬ ገንዘብ ከሲስተሙ ሽያጭ ጋር ልዩነት ሲያሳይ', 'Yeroo maallaqni qabatamaa fi gurgurtaan wal dhabu', 'Discrepancy detected between physical cash and sales')}
                        </span>
                      </div>
                      <Switch checked={cashDiscrepancy} onCheckedChange={setCashDiscrepancy} className="shrink-0" />
                    </div>
                  </div>
                </div>

                {/* 7. Production & Batch Baking */}
                <div className="rounded-2xl bg-white border border-[#EDE4D5] shadow-xs overflow-hidden">
                  <div className="px-4.5 py-3.5 bg-[#FAF6F0]/80 border-b border-[#EDE4D5] flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-black text-[#2C1B10]">
                      {l('7. የዳቦ እና የምርት ክንውን', '7. Oomisha fi Baachii Daabboo', '7. Hub Production & Baking Yields')}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    <div className="px-4.5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF6F0]/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#2C1B10] block">
                          {l('የዳቦ ባቾች እና ብክነት', 'Baachii Oomishaa fi Madaallii', 'Completed Batches & Spoilage')}
                        </span>
                        <span className="text-xs text-[#8C7361] block leading-relaxed">
                          {l('የዱቄት ቦርሳዎች ተጋግረው ምርት ሲገባና የተበላሸ ዳቦ ሲመዘገብ', 'Oomishni baachii yeroo xumuramu', 'Large batch baking completions and scrap bread logs')}
                        </span>
                      </div>
                      <Switch checked={productionBatches} onCheckedChange={setProductionBatches} className="shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="mx-0 mb-0 rounded-none px-6 pt-4 pb-6 sm:px-8 sm:py-5 bg-white border-t border-[#EDE4D5] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <p className="text-xs text-[#8C7361] text-center sm:text-left leading-relaxed max-w-xs sm:max-w-sm">
            {l(
              'ቅንብሮች በራስ-ሰር በሞባይልዎ እና በሲስተሙ ዳታቤዝ ላይ ይቀመጣሉ',
              'Qindaa\'inni bilbila keessan irratti ni olkaa\'ama',
              'Settings sync automatically across your mobile device and database'
            )}
          </p>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none sm:w-28 h-10 rounded-xl border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] hover:bg-[#FAF6F0]"
            >
              {l('ሰርዝ', 'Haqi', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex-1 sm:flex-none sm:w-44 h-10 rounded-xl bg-[#E87A18] hover:bg-[#D06B13] text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{l('በማስቀመጥ ላይ...', 'Olkaa\'aa jira...', 'Saving...')}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{l('ቅንብሮችን መዝግብ', 'Olkaawwadhu', 'Save Preferences')}</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
