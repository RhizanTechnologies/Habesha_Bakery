'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import NotificationSettingsModal from '@/components/NotificationSettingsModal';
import { Button } from '@/components/ui/button';
import { Bell, Sliders, Volume2, Vibrate, ShieldCheck, Sparkles, Play } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { testNotificationSound, testVibration } from '@/lib/notificationAudio';

export default function NotificationSettingsPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const [isModalOpen, setIsModalOpen] = useState(true);

  const l = (am: string, om: string, en: string) => {
    if (language === 'am') return am;
    if (language === 'om') return om;
    return en;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#4A2E1B] to-[#2C1B10] text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E87A18] text-white flex items-center justify-center shadow-md shrink-0">
              <Bell className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{l('የማሳወቂያ እና የድምፅ ቅንብሮች', 'Qindaa\'ina Beeksisaa fi Sagalee', 'Notification & Sound Settings')}</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#E2C7B4] mt-1">
                {l(
                  'የሞባይል PWA ድምፅ፣ ንዝረት፣ የአድሚን ውክልና እና የክምችት ማሳወቂያዎች መቆጣጠሪያ',
                  'To\'annoo sagalee, socho\'iinsa, heyyama admin fi beeksisa kuusaa',
                  'Enterprise control center for PWA chimes, haptics, admin delegation & alert subscriptions'
                )}
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            className="h-11 px-5 rounded-2xl bg-[#E87A18] hover:bg-[#D06B13] text-white font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>{l('ቅንብሮችን ክፈት', 'Qindaa\'ina Bani', 'Open Controls')}</span>
          </Button>
        </div>

        {/* Feature Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-[#EDE4D5] shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#E87A18] flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#2C1B10]">
              {l('ዜማዊ ድምፅ (Web Audio Chime)', 'Sagalee Mi\'aawaa', 'Melodic Audio Synthesizer')}
            </h3>
            <p className="text-xs text-[#8C7361] leading-relaxed">
              {l(
                'ማንኛውንም ትልቅ የድምፅ ፋይል ሳያወርዱ ወዲያውኑ የሚሰማ የካራሜል ዜማ እና የደወል ድምፅ።',
                'Faayila sagalee osoo hin buufatin battalumatti kan dhagahamu.',
                'Instant synthesized audio chimes with 4 selectable tone profiles and zero network lag.'
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => testNotificationSound('CHIME')}
              className="mt-2 text-xs font-bold text-[#4A2E1B] border-[#EDE4D5] rounded-xl flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-[#4A2E1B] text-[#4A2E1B]" />
              <span>{l('ድምፅ ሞክር', 'Sagalee Yaali', 'Test Chime')}</span>
            </Button>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#EDE4D5] shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Vibrate className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#2C1B10]">
              {l('የሞባይል ንዝረት (Haptic Feedback)', 'Socho\'iinsa Bilbilaa', 'Haptic Vibration Engine')}
            </h3>
            <p className="text-xs text-[#8C7361] leading-relaxed">
              {l(
                'ስልክዎ ኪስዎ ውስጥ እያለ ወሳኝ የገንዘብና የክምችት ለውጦችን በንዝረት ያሳውቀዎታል።',
                'Bilbilli keessan kiisii keessa utuu jiruu beeksisa isinitti hima.',
                'Customizable vibration sequences for standard alerts, late arrivals, and critical audits.'
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => testVibration('double')}
              className="mt-2 text-xs font-bold text-purple-800 border-purple-200 bg-purple-50 hover:bg-purple-100 rounded-xl flex items-center gap-1.5"
            >
              <Vibrate className="w-3.5 h-3.5 text-purple-700" />
              <span>{l('ንዝረት ሞክር', 'Socho\'i Yaali', 'Test Vibration')}</span>
            </Button>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#EDE4D5] shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#2C1B10]">
              {l('የአድሚን ውክልና (Admin Delegation)', 'Heyyama Admin', 'Admin Delegation')}
            </h3>
            <p className="text-xs text-[#8C7361] leading-relaxed">
              {l(
                'የድርጅቱ ባለቤት ለአድሚኖች ማሳወቂያ እንዲደርሳቸው ወይም እንዳይደርሳቸው ሙሉ ሥልጣን አለው።',
                'Abbaan qabeenyaa heyyama beeksisaa adminootaaf kennuu fi dhorkuu danda\'a.',
                'The Owner exclusively controls whether branch admins receive operational business alerts.'
              )}
            </p>
            <div className="mt-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit">
              {isOwner ? l('ሙሉ ቁጥጥር አለዎት (Owner Root)', 'Heyyama Guutuu', 'Root Owner Access') : l('የተገደበ እይታ (Admin)', 'Daanga\'aa', 'Delegated Scope')}
            </div>
          </div>
        </div>

        {/* Modal Controller */}
        <NotificationSettingsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}
